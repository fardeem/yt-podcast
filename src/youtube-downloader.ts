import type { VideoMetadata } from "./types";
import type { Config } from "./config-manager";
import { sanitizeFilename } from "./utils/validators";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";

const execAsync = promisify(exec);

export class YouTubeDownloader {
  private outputDir: string;
  private ytDlpPath: string;

  constructor(private config: Config) {
    this.outputDir = config.ytDlp.outputDir;
    this.ytDlpPath = config.ytDlp.path;
  }

  async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  async getVideoInfo(videoUrl: string): Promise<VideoMetadata> {
    const command = `${this.ytDlpPath} --dump-single-json "${videoUrl}"`;
    
    try {
      const { stdout } = await execAsync(command);
      const videoData = JSON.parse(stdout);
      
      // Get the best quality thumbnail
      let thumbnailUrl = "";
      if (videoData.thumbnail) {
        thumbnailUrl = videoData.thumbnail;
      } else if (videoData.thumbnails && videoData.thumbnails.length > 0) {
        // Get the highest quality thumbnail (usually the last one)
        thumbnailUrl = videoData.thumbnails[videoData.thumbnails.length - 1].url;
      }
      
      return {
        id: videoData.id,
        title: videoData.title,
        description: videoData.description || "",
        duration: videoData.duration || 0,
        uploadDate: videoData.upload_date || new Date().toISOString(),
        uploader: videoData.uploader || videoData.channel || "Unknown",
        thumbnail: thumbnailUrl,
        url: videoData.webpage_url || `https://www.youtube.com/watch?v=${videoData.id}`,
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error}`);
    }
  }

  async getPlaylistInfo(playlistUrl: string): Promise<{
    videos: VideoMetadata[];
    playlistTitle: string;
    channelName: string;
  }> {
    const command = `${this.ytDlpPath} --dump-single-json --flat-playlist "${playlistUrl}"`;
    
    try {
      const { stdout } = await execAsync(command);
      const playlistData = JSON.parse(stdout);
      
      if (!playlistData.entries) {
        throw new Error("No playlist entries found");
      }

      // Extract playlist metadata
      const playlistTitle = playlistData.title || "Unknown Playlist";
      const channelName = playlistData.uploader || playlistData.channel || "Unknown Channel";

      // Map basic video info from flat playlist
      const videos = playlistData.entries.map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description || "",
        duration: entry.duration || 0,
        uploadDate: entry.upload_date || new Date().toISOString(),
        uploader: entry.uploader || channelName,
        thumbnail: "", // Will fetch for first video
        url: `https://www.youtube.com/watch?v=${entry.id}`,
      }));

      // Fetch full info for the first video to get thumbnail
      if (videos.length > 0 && videos[0]) {
        console.log(`  → Fetching full metadata for first video to get thumbnail...`);
        const firstVideoUrl = videos[0].url;
        const firstVideoFullInfo = await this.getVideoInfo(firstVideoUrl);
        videos[0] = firstVideoFullInfo;
      }

      return {
        videos,
        playlistTitle,
        channelName
      };
    } catch (error) {
      throw new Error(`Failed to get playlist info: ${error}`);
    }
  }

  async downloadVideo(
    videoUrl: string,
    outputFilename: string
  ): Promise<string> {
    await this.ensureOutputDir();
    const outputPath = path.join(this.outputDir, outputFilename);
    const tempBaseName = outputFilename.replace('.mp3', '');
    const tempPath = path.join(this.outputDir, tempBaseName);

    // Step 1: Download best audio without conversion
    const downloadCommand = [
      this.ytDlpPath,
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--no-playlist',
      '--no-check-certificate',
      '-o', `"${tempPath}.%(ext)s"`,  // Let yt-dlp determine extension
      `"${videoUrl}"`
    ].join(' ');

    try {
      console.log(`  → Downloading audio...`);
      await execAsync(downloadCommand, { 
        maxBuffer: 50 * 1024 * 1024,
        timeout: 10 * 60 * 1000
      });

      // Find the downloaded file (could be .m4a, .webm, .opus, etc)
      const files = await fs.readdir(this.outputDir);
      const downloadedFile = files.find(f => 
        f.startsWith(tempBaseName) && 
        !f.endsWith('.mp3') &&
        !f.includes('.temp')
      );

      if (!downloadedFile) {
        throw new Error('Downloaded file not found');
      }

      const actualTempPath = path.join(this.outputDir, downloadedFile);

      // Step 2: Convert to MP3 using ffmpeg
      const convertCommand = [
        this.config.ffmpeg.path,
        '-i', `"${actualTempPath}"`,
        '-acodec', 'mp3',
        '-ab', '192k',
        '-y',  // Overwrite output
        `"${outputPath}"`
      ].join(' ');

      console.log(`  → Converting to MP3...`);
      await execAsync(convertCommand);

      // Clean up temp file
      await fs.unlink(actualTempPath).catch(() => {});

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to download video: ${error}`);
    }
  }

  async downloadThumbnail(
    thumbnailUrl: string,
    outputFilename: string
  ): Promise<string> {
    await this.ensureOutputDir();
    const outputPath = path.join(this.outputDir, outputFilename);

    try {
      // Download thumbnail using fetch
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        throw new Error(`Failed to download thumbnail: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      
      // Process image: crop to 1:1 aspect ratio from center and resize to 1400x1400
      await sharp(Buffer.from(buffer))
        .resize(1400, 1400, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to download thumbnail: ${error}`);
    }
  }

  async downloadPlaylist(
    playlistUrl: string,
    onProgress?: (current: number, total: number, videoTitle: string) => void
  ): Promise<{ files: string[]; playlistTitle: string; channelName: string }> {
    const { videos, playlistTitle, channelName } = await this.getPlaylistInfo(playlistUrl);
    const downloadedFiles: string[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video) continue;
      
      const filename = `${i + 1}-${sanitizeFilename(video.title)}.mp3`;
      
      if (onProgress) {
        onProgress(i + 1, videos.length, video.title);
      }

      const outputPath = await this.downloadVideo(video.url, filename);
      downloadedFiles.push(outputPath);
    }

    return {
      files: downloadedFiles,
      playlistTitle,
      channelName
    };
  }
}
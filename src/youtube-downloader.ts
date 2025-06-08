import { VideoMetadata } from "./types";
import { Config } from "./config-manager";
import { sanitizeFilename } from "./utils/validators";
import { YouTubeDownloadError } from "./errors";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class YouTubeDownloader {
  private outputDir: string;
  private ytDlpPath: string;

  constructor(config: Config) {
    this.outputDir = config.ytDlp.outputDir;
    this.ytDlpPath = config.ytDlp.path;
  }

  async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  async getPlaylistInfo(playlistUrl: string): Promise<VideoMetadata[]> {
    const command = `${this.ytDlpPath} --dump-single-json --flat-playlist "${playlistUrl}"`;
    
    try {
      const { stdout } = await execAsync(command);
      const playlistData = JSON.parse(stdout);
      
      if (!playlistData.entries) {
        throw new Error("No playlist entries found");
      }

      return playlistData.entries.map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description || "",
        duration: entry.duration || 0,
        uploadDate: entry.upload_date || new Date().toISOString(),
        uploader: entry.uploader || "Unknown",
        thumbnail: entry.thumbnail || "",
        url: `https://www.youtube.com/watch?v=${entry.id}`,
      }));
    } catch (error) {
      throw new Error(`Failed to get playlist info: ${error}`);
    }
  }

  async downloadVideo(
    videoUrl: string,
    outputFilename: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    await this.ensureOutputDir();
    const outputPath = path.join(this.outputDir, outputFilename);

    const command = [
      this.ytDlpPath,
      '-x',  // Extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '5',  // Faster encoding
      '--no-playlist',  // Just download single video
      '-o', `"${outputPath}"`,
      `"${videoUrl}"`
    ].join(' ');

    try {
      console.log(`  → Executing yt-dlp...`);
      await execAsync(command, { 
        maxBuffer: 50 * 1024 * 1024,  // 50MB buffer
        timeout: 10 * 60 * 1000       // 10 minute timeout
      });
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to download video: ${error}`);
    }
  }

  async downloadPlaylist(
    playlistUrl: string,
    onProgress?: (current: number, total: number, videoTitle: string) => void
  ): Promise<string[]> {
    const videos = await this.getPlaylistInfo(playlistUrl);
    const downloadedFiles: string[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const filename = `${i + 1}-${sanitizeFilename(video.title)}.mp3`;
      
      if (onProgress) {
        onProgress(i + 1, videos.length, video.title);
      }

      const outputPath = await this.downloadVideo(video.url, filename);
      downloadedFiles.push(outputPath);
    }

    return downloadedFiles;
  }
}
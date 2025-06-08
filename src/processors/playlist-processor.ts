import { YouTubeDownloader } from "../youtube-downloader";
import { R2Uploader } from "../r2-uploader";
import { RSSGenerator } from "../rss-generator";
import type { Config } from "../config-manager";
import { ErrorLogger } from "../utils/error-logger";
import { HistoryManager } from "../utils/history-manager";
import { sanitizeFilename } from "../utils/validators";
import fs from "fs/promises";

export interface ProcessorCallbacks {
  onProgress?: (stage: string, current: number, total: number, message: string) => void;
  onStageChange?: (stage: "downloading" | "uploading" | "complete" | "error") => void;
  onComplete?: (feedUrl: string) => void;
  onError?: (error: string) => void;
}

export class PlaylistProcessor {
  private errorLogger: ErrorLogger;
  private historyManager: HistoryManager;

  constructor(
    private config: Config,
    private downloader: YouTubeDownloader,
    private uploader: R2Uploader,
    private rssGenerator: RSSGenerator
  ) {
    this.errorLogger = new ErrorLogger();
    this.historyManager = new HistoryManager();
  }

  async process(playlistUrl: string, callbacks: ProcessorCallbacks = {}): Promise<string> {
    try {
      // Get playlist info
      callbacks.onProgress?.("downloading", 0, 0, "Fetching playlist information...");
      const { videos, playlistTitle, channelName } = await this.downloader.getPlaylistInfo(playlistUrl);
      
      if (videos.length === 0) {
        throw new Error("No videos found in playlist");
      }

      const podcastSlug = this.uploader.generatePodcastSlug(playlistTitle);

      // Download all videos
      const downloadedFiles: string[] = [];
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (!video) continue;
        
        callbacks.onProgress?.("downloading", i + 1, videos.length, `Downloading: ${video.title}`);
        
        const filename = `${i + 1}-${sanitizeFilename(video.title)}.mp3`;
        const outputPath = await this.downloader.downloadVideo(video.url, filename);
        downloadedFiles.push(outputPath);
      }

      // Upload to R2
      callbacks.onStageChange?.("uploading");
      const episodes = [];
      
      for (let i = 0; i < downloadedFiles.length; i++) {
        callbacks.onProgress?.("uploading", i + 1, downloadedFiles.length, "");
        
        const filePath = downloadedFiles[i];
        if (!filePath) continue;
        
        const video = videos[i];
        if (!video) continue;
        
        const { url, size } = await this.uploader.uploadPodcastEpisode(
          filePath,
          podcastSlug,
          i + 1
        );
        
        const episode = this.rssGenerator.createEpisode(video, url, size, i + 1);
        episodes.push(episode);
      }

      // Generate and upload RSS feed
      callbacks.onProgress?.("uploading", 1, 1, "Generating podcast feed...");
      
      const podcastInfo = this.rssGenerator.createPodcastInfoFromPlaylist(
        playlistTitle,
        channelName,
        videos
      );
      const feedUrl = `${this.config.r2.publicUrl}/podcasts/${podcastSlug}/feed.xml`;
      const rssFeed = this.rssGenerator.generateFeed(podcastInfo, episodes, feedUrl);
      
      const { url: finalFeedUrl } = await this.uploader.uploadRSSFeed(rssFeed, podcastSlug);

      // Clean up downloaded files
      for (const file of downloadedFiles) {
        await fs.unlink(file).catch(() => {});
      }

      // Save to history
      await this.historyManager.addEntry({
        playlistUrl,
        playlistTitle,
        channelName,
        feedUrl: finalFeedUrl,
        episodeCount: videos.length,
      });

      // Complete
      callbacks.onStageChange?.("complete");
      callbacks.onComplete?.(finalFeedUrl);
      
      return finalFeedUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      await this.errorLogger.logError(error as Error, { 
        playlistUrl,
        timestamp: new Date().toISOString()
      });
      
      callbacks.onStageChange?.("error");
      callbacks.onError?.(errorMessage);
      
      throw error;
    }
  }
}
#!/usr/bin/env bun

import { YouTubeDownloader } from "./youtube-downloader";
import { R2Uploader } from "./r2-uploader";
import { RSSGenerator } from "./rss-generator";
import { PlaylistProcessor } from "./processors/playlist-processor";
import { startCLI, CLIController } from "./cli";
import { InitCLI } from "./init-cli";
import { ConfigManager, type Config } from "./config-manager";
import { validatePlaylistUrl } from "./utils/validators";
import { ValidationError } from "./errors";
import { render } from "ink";
import React from "react";

async function runInit(): Promise<Config> {
  return new Promise((resolve, reject) => {
    const { unmount } = render(
      React.createElement(InitCLI, {
        onComplete: (config: Config) => {
          unmount();
          resolve(config);
        },
        onExit: () => {
          unmount();
          reject(new Error("Setup cancelled"));
        },
      })
    );
  });
}

async function main() {
  // Check if we're in a TTY environment
  if (!process.stdin.isTTY) {
    console.error("This CLI requires an interactive terminal. Please run it directly, not through pipes.");
    console.error("Use: bun run src/main-ink.ts");
    process.exit(1);
  }

  const configManager = new ConfigManager();
  
  // Check if already configured
  const isConfigured = await configManager.isConfigured();
  
  let config: Config;
  
  if (!isConfigured) {
    // Run init process
    try {
      config = await runInit();
    } catch (error) {
      console.error("Setup cancelled");
      process.exit(1);
    }
  } else {
    config = await configManager.getConfig();
  }

  // Create processor with dependencies
  const downloader = new YouTubeDownloader(config);
  const uploader = new R2Uploader(config);
  const rssGenerator = new RSSGenerator();
  const processor = new PlaylistProcessor(config, downloader, uploader, rssGenerator);

  // Start main CLI
  const cli = startCLI(async (playlistUrl, controller) => {
    // Validate URL first
    if (!validatePlaylistUrl(playlistUrl)) {
      controller.setError("Invalid YouTube URL. Please provide a valid YouTube playlist or video URL.");
      return;
    }

    try {
      await processor.process(playlistUrl, {
        onProgress: (stage, current, total, message) => {
          controller.updateProgress(current, total, message);
        },
        onStageChange: (stage) => {
          controller.setStage(stage);
        },
        onComplete: (feedUrl) => {
          controller.setComplete(feedUrl);
        },
        onError: (error) => {
          controller.setError(error);
        },
      });
    } catch (error) {
      // Error is already logged by processor
      console.error("Processing failed:", error);
    }
  });
}

main().catch(console.error);
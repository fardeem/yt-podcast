#!/usr/bin/env bun

import { HistoryManager } from "./utils/history-manager";

async function main() {
  const historyManager = new HistoryManager();
  const history = await historyManager.loadHistory();

  if (history.length === 0) {
    console.log("No podcasts have been created yet.");
    return;
  }

  console.log("\n📚 Podcast History");
  console.log("==================\n");

  history.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.playlistTitle}`);
    console.log(`   Channel: ${entry.channelName}`);
    console.log(`   Episodes: ${entry.episodeCount}`);
    console.log(`   Created: ${new Date(entry.createdAt).toLocaleString()}`);
    console.log(`   Feed URL: ${entry.feedUrl}`);
    console.log(`   Playlist: ${entry.playlistUrl}`);
    console.log();
  });

  console.log(`Total: ${history.length} podcasts created`);
}

main().catch(console.error);
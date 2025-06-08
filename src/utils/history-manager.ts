import fs from "fs/promises";
import path from "path";
import os from "os";

export interface PodcastHistoryEntry {
  id: string;
  playlistUrl: string;
  playlistTitle: string;
  channelName: string;
  feedUrl: string;
  createdAt: string;
  episodeCount: number;
}

export class HistoryManager {
  private historyPath: string;
  private historyDir: string;

  constructor() {
    this.historyDir = path.join(os.homedir(), ".yt-podcast");
    this.historyPath = path.join(this.historyDir, "history.json");
  }

  async ensureHistoryDir() {
    await fs.mkdir(this.historyDir, { recursive: true });
  }

  async loadHistory(): Promise<PodcastHistoryEntry[]> {
    try {
      const data = await fs.readFile(this.historyPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async addEntry(entry: Omit<PodcastHistoryEntry, "id" | "createdAt">): Promise<void> {
    await this.ensureHistoryDir();
    
    const history = await this.loadHistory();
    
    const newEntry: PodcastHistoryEntry = {
      ...entry,
      id: `podcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    history.unshift(newEntry); // Add to beginning
    
    // Keep only last 100 entries
    const trimmedHistory = history.slice(0, 100);
    
    await fs.writeFile(this.historyPath, JSON.stringify(trimmedHistory, null, 2));
  }

  async searchHistory(query: string): Promise<PodcastHistoryEntry[]> {
    const history = await this.loadHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(entry => 
      entry.playlistTitle.toLowerCase().includes(lowerQuery) ||
      entry.channelName.toLowerCase().includes(lowerQuery) ||
      entry.playlistUrl.toLowerCase().includes(lowerQuery)
    );
  }

  async getRecentHistory(limit: number = 10): Promise<PodcastHistoryEntry[]> {
    const history = await this.loadHistory();
    return history.slice(0, limit);
  }

  async findByPlaylistUrl(playlistUrl: string): Promise<PodcastHistoryEntry | null> {
    const history = await this.loadHistory();
    return history.find(entry => entry.playlistUrl === playlistUrl) || null;
  }

  getHistoryPath(): string {
    return this.historyPath;
  }
}
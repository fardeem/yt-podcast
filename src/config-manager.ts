import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Config {
  r2: {
    endpoint: string;
    publicUrl: string;
    accessKey: string;
    secretKey: string;
    bucketName: string;
  };
  ffmpeg: {
    path: string;
  };
  ytDlp: {
    path: string;
    outputDir: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private configDir: string;

  constructor() {
    this.configDir = path.join(os.homedir(), ".yt-podcast");
    this.configPath = path.join(this.configDir, "config.json");
  }

  async ensureConfigDir() {
    await fs.mkdir(this.configDir, { recursive: true });
  }

  async checkDependency(command: string): Promise<{ installed: boolean; path?: string }> {
    try {
      const { stdout } = await execAsync(`which ${command}`);
      return { installed: true, path: stdout.trim() };
    } catch {
      return { installed: false };
    }
  }

  async checkDependencies(): Promise<{
    ytDlp: { installed: boolean; path?: string };
    ffmpeg: { installed: boolean; path?: string };
  }> {
    const [ytDlp, ffmpeg] = await Promise.all([
      this.checkDependency("yt-dlp"),
      this.checkDependency("ffmpeg"),
    ]);

    return { ytDlp, ffmpeg };
  }

  async loadConfig(): Promise<Config | null> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveConfig(config: Config): Promise<void> {
    await this.ensureConfigDir();
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  async getConfig(): Promise<Config> {
    // First try to load existing config
    const existingConfig = await this.loadConfig();
    if (existingConfig) {
      return existingConfig;
    }

    // If no config exists, return defaults (will be replaced by init process)
    const deps = await this.checkDependencies();
    
    return {
      r2: {
        endpoint: "",
        publicUrl: "",
        accessKey: "",
        secretKey: "",
        bucketName: "",
      },
      ffmpeg: {
        path: deps.ffmpeg.path || "ffmpeg",
      },
      ytDlp: {
        path: deps.ytDlp.path || "yt-dlp",
        outputDir: path.join(os.tmpdir(), "yt-podcast-downloads"),
      },
    };
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.loadConfig();
    return config !== null && config.r2.accessKey !== "";
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
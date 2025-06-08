import fs from "fs/promises";
import path from "path";
import os from "os";

export class ErrorLogger {
  private errorLogPath: string;
  private errorDir: string;

  constructor() {
    this.errorDir = path.join(os.homedir(), ".yt-podcast");
    this.errorLogPath = path.join(this.errorDir, "errors.log");
  }

  async ensureErrorDir() {
    await fs.mkdir(this.errorDir, { recursive: true });
  }

  async logError(error: Error, context: Record<string, any>) {
    await this.ensureErrorDir();
    
    const entry = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    };
    
    try {
      // Append to log file
      await fs.appendFile(
        this.errorLogPath, 
        JSON.stringify(entry) + '\n'
      );
    } catch (fileError) {
      // If we can't write to the global error log, at least log to console
      console.error("Failed to write to error log:", fileError);
      console.error("Original error:", entry);
    }
  }

  async getRecentErrors(count: number = 10): Promise<any[]> {
    try {
      const content = await fs.readFile(this.errorLogPath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines
        .slice(-count)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  getErrorLogPath(): string {
    return this.errorLogPath;
  }
}
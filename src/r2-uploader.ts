import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Config } from "./config-manager";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export class R2Uploader {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private config: Config) {
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKey,
        secretAccessKey: config.r2.secretKey,
      },
    });
    this.bucketName = config.r2.bucketName;
    this.publicUrl = config.r2.publicUrl;
  }

  private generateKey(filename: string, prefix?: string): string {
    const sanitized = filename.replace(/[^a-z0-9.-]/gi, "_");
    const key = prefix ? `${prefix}/${sanitized}` : sanitized;
    return key;
  }

  async uploadFile(
    filePath: string,
    key?: string,
    contentType?: string
  ): Promise<{ key: string; url: string; size: number }> {
    const fileContent = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);
    
    const finalKey = key || this.generateKey(filename);
    const mimeType = contentType || this.getMimeType(filename);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: finalKey,
      Body: fileContent,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000",
    });

    await this.s3Client.send(command);

    const url = `${this.publicUrl}/${finalKey}`;
    
    return {
      key: finalKey,
      url,
      size: stats.size,
    };
  }

  async uploadPodcastEpisode(
    filePath: string,
    podcastSlug: string,
    episodeNumber: number
  ): Promise<{ key: string; url: string; size: number }> {
    const filename = path.basename(filePath);
    const key = `podcasts/${podcastSlug}/episodes/${episodeNumber}-${filename}`;
    
    return this.uploadFile(filePath, key, "audio/mpeg");
  }

  async uploadPodcastThumbnail(
    filePath: string,
    podcastSlug: string
  ): Promise<{ key: string; url: string; size: number }> {
    const filename = 'cover.jpg';
    const key = `podcasts/${podcastSlug}/${filename}`;
    
    return this.uploadFile(filePath, key, "image/jpeg");
  }

  async uploadRSSFeed(
    content: string,
    podcastSlug: string
  ): Promise<{ key: string; url: string }> {
    const key = `podcasts/${podcastSlug}/feed.xml`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: Buffer.from(content),
      ContentType: "application/rss+xml",
      CacheControl: "public, max-age=300", // 5 minutes cache for RSS
    });

    await this.s3Client.send(command);

    const url = `${this.publicUrl}/${key}`;
    
    return { key, url };
  }

  async checkFileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".xml": "application/rss+xml",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    
    return mimeTypes[ext] || "application/octet-stream";
  }

  generatePodcastSlug(playlistTitle: string): string {
    return playlistTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }
}
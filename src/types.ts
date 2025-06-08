export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  duration: number;
  uploadDate: string;
  uploader: string;
  thumbnail: string;
  url: string;
}

export interface PodcastEpisode {
  title: string;
  description: string;
  url: string;
  pubDate: Date;
  duration: string;
  fileSize: number;
  guid: string;
  author?: string;
}
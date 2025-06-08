import RSS from "rss";
import type { PodcastEpisode, VideoMetadata } from "./types";

export interface PodcastInfo {
  title: string;
  description: string;
  author: string;
  imageUrl: string;
  language: string;
  category: string;
  explicit: boolean;
}

export class RSSGenerator {
  generateFeed(
    podcastInfo: PodcastInfo,
    episodes: PodcastEpisode[],
    feedUrl: string
  ): string {
    const feed = new RSS({
      title: podcastInfo.title,
      description: podcastInfo.description,
      generator: "YouTube to Podcast Converter",
      feed_url: feedUrl,
      site_url: feedUrl.replace("/feed.xml", ""),
      image_url: podcastInfo.imageUrl,
      language: podcastInfo.language,
      pubDate: new Date(),
      ttl: 60,
      custom_namespaces: {
        itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
      },
      custom_elements: [
        { author: podcastInfo.author },
        { "itunes:author": podcastInfo.author },
        { "itunes:summary": podcastInfo.description },
        { "itunes:explicit": podcastInfo.explicit ? "yes" : "no" },
        { "itunes:category": { _attr: { text: podcastInfo.category } } },
        {
          "itunes:image": {
            _attr: { href: podcastInfo.imageUrl },
          },
        },
      ],
    });

    episodes.forEach((episode) => {
      feed.item({
        title: episode.title,
        description: episode.description,
        url: episode.url,
        guid: episode.guid,
        date: episode.pubDate,
        enclosure: {
          url: episode.url,
          type: "audio/mpeg",
          size: episode.fileSize,
        },
        custom_elements: [
          { "itunes:author": episode.author || podcastInfo.author },
          { "itunes:subtitle": episode.description.substring(0, 255) },
          { "itunes:duration": episode.duration },
          { "itunes:explicit": podcastInfo.explicit ? "yes" : "no" },
        ],
      });
    });

    return feed.xml({ indent: true });
  }

  createPodcastInfo(playlistTitle: string, videos: VideoMetadata[]): PodcastInfo {
    const firstVideo = videos[0];
    
    return {
      title: playlistTitle,
      description: `Podcast generated from YouTube playlist: ${playlistTitle}`,
      author: firstVideo?.uploader || "Various Artists",
      imageUrl: firstVideo?.thumbnail || "",
      language: "en-US",
      category: "Technology",
      explicit: false,
    };
  }

  createPodcastInfoFromPlaylist(
    playlistTitle: string,
    channelName: string,
    videos: VideoMetadata[]
  ): PodcastInfo {
    const firstVideo = videos[0];
    
    return {
      title: playlistTitle,
      description: `${playlistTitle} - A podcast series from ${channelName}`,
      author: channelName,
      imageUrl: firstVideo?.thumbnail || "",
      language: "en-US",
      category: "Technology",
      explicit: false,
    };
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  createEpisode(
    video: VideoMetadata,
    mp3Url: string,
    fileSize: number,
    episodeNumber: number
  ): PodcastEpisode {
    return {
      title: video.title,
      description: video.description || `Episode ${episodeNumber}`,
      url: mp3Url,
      pubDate: new Date(video.uploadDate),
      duration: this.formatDuration(video.duration),
      fileSize,
      guid: `episode-${video.id}`,
      author: video.uploader,
    };
  }
}
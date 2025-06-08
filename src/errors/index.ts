export class YouTubePodcastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubePodcastError';
  }
}

export class YouTubeDownloadError extends YouTubePodcastError {
  constructor(message: string, public videoId?: string, public videoTitle?: string) {
    super(message);
    this.name = 'YouTubeDownloadError';
  }
}

export class PlaylistNotFoundError extends YouTubePodcastError {
  constructor(public playlistUrl: string) {
    super(`Playlist not found: ${playlistUrl}`);
    this.name = 'PlaylistNotFoundError';
  }
}

export class R2UploadError extends YouTubePodcastError {
  constructor(message: string, public key?: string, public bucketName?: string) {
    super(message);
    this.name = 'R2UploadError';
  }
}

export class ConfigurationError extends YouTubePodcastError {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends YouTubePodcastError {
  constructor(message: string, public field?: string, public value?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DependencyError extends YouTubePodcastError {
  constructor(public dependency: string, public path?: string) {
    super(`Required dependency not found: ${dependency}`);
    this.name = 'DependencyError';
  }
}
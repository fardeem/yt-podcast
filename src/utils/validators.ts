export function sanitizeFilename(filename: string): string {
  // Remove or replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')  // Replace invalid chars with underscore
    .replace(/\.+$/, '')                      // Remove trailing dots
    .replace(/^\.+/, '')                      // Remove leading dots
    .replace(/\s+/g, '_')                     // Replace spaces with underscores
    .substring(0, 200);                       // Limit length
}

export function validatePlaylistUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Must be YouTube
    if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
      return false;
    }
    
    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return false;
    }
    
    // Check for playlist or video
    const isPlaylist = urlObj.searchParams.has('list');
    const isVideo = urlObj.searchParams.has('v') || urlObj.pathname.includes('/watch');
    const isShortUrl = urlObj.hostname === 'youtu.be';
    
    return isPlaylist || isVideo || isShortUrl;
  } catch {
    return false;
  }
}

export function validateR2Endpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.hostname.includes('r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

export function validateR2PublicUrl(publicUrl: string): boolean {
  try {
    const url = new URL(publicUrl);
    return url.protocol === 'https:' && url.hostname.includes('r2.dev');
  } catch {
    return false;
  }
}

export function validateBucketName(bucketName: string): boolean {
  // R2/S3 bucket naming rules
  const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return bucketName.length >= 3 && 
         bucketName.length <= 63 && 
         pattern.test(bucketName) &&
         !bucketName.includes('..');
}
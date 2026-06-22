import { MediaAssetType } from '@prisma/client';

export type SafeMediaProvider =
  | 'upload'
  | 'youtube'
  | 'vimeo'
  | 'matterport'
  | 'kuula'
  | 'cloudpano'
  | 'external';

export type SafeMediaEmbed = {
  originalUrl: string;
  normalizedUrl: string;
  provider: SafeMediaProvider;
  type?: MediaAssetType;
  canEmbed: boolean;
  embedUrl?: string;
  externalUrl: string;
};

const UPLOAD_PATH_PATTERN = /^\/uploads\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/;

const EMBEDDABLE_EXTERNAL_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtu.be',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'my.matterport.com',
  'kuula.co',
  'www.kuula.co',
  'app.cloudpano.com',
  'cloudpano.com',
  'www.cloudpano.com'
]);

const SAFE_EXTERNAL_HOSTS = new Set([
  ...EMBEDDABLE_EXTERNAL_HOSTS,
  'matterport.com',
  'www.matterport.com'
]);

export function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();

  return normalized.length ? normalized : undefined;
}

export function isUploadPath(value: string) {
  return UPLOAD_PATH_PATTERN.test(value);
}

export function parseHttpUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getNormalizedHostname(url: URL) {
  return url.hostname.toLowerCase().replace(/^m\./, 'www.');
}

export function isSafeExternalMediaUrl(value: string) {
  const parsed = parseHttpUrl(value);

  if (!parsed) return false;

  const host = getNormalizedHostname(parsed);

  return SAFE_EXTERNAL_HOSTS.has(host);
}

export function isSafeMediaUrl(
  value: string,
  options: {
    allowUploads?: boolean;
    allowExternal?: boolean;
  } = {}
) {
  const { allowUploads = true, allowExternal = true } = options;

  if (allowUploads && isUploadPath(value)) {
    return true;
  }

  if (!allowExternal) {
    return false;
  }

  return isSafeExternalMediaUrl(value);
}

function getYouTubeVideoId(url: URL) {
  const host = getNormalizedHostname(url);

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];

    return id || undefined;
  }

  if (host !== 'youtube.com' && host !== 'www.youtube.com') {
    return undefined;
  }

  if (url.pathname === '/watch') {
    return url.searchParams.get('v') || undefined;
  }

  const pathParts = url.pathname.split('/').filter(Boolean);

  if (pathParts[0] === 'embed' || pathParts[0] === 'shorts') {
    return pathParts[1] || undefined;
  }

  return undefined;
}

function getVimeoVideoId(url: URL) {
  const host = getNormalizedHostname(url);

  if (host === 'player.vimeo.com') {
    const pathParts = url.pathname.split('/').filter(Boolean);
    const videoIndex = pathParts.indexOf('video');

    return videoIndex >= 0 ? pathParts[videoIndex + 1] : undefined;
  }

  if (host !== 'vimeo.com' && host !== 'www.vimeo.com') {
    return undefined;
  }

  const id = url.pathname.split('/').filter(Boolean)[0];

  return id && /^\d+$/.test(id) ? id : undefined;
}

function getMatterportModelId(url: URL) {
  const host = getNormalizedHostname(url);

  if (host !== 'my.matterport.com') {
    return undefined;
  }

  return url.searchParams.get('m') || undefined;
}

function getKuulaEmbedUrl(url: URL) {
  const host = getNormalizedHostname(url);

  if (host !== 'kuula.co' && host !== 'www.kuula.co') {
    return undefined;
  }

  const pathParts = url.pathname.split('/').filter(Boolean);

  if (!pathParts.length) return undefined;

  return `https://kuula.co/share/${pathParts[pathParts.length - 1]}?logo=0&info=0&fs=1&vr=0&sd=1`;
}

function getCloudPanoEmbedUrl(url: URL) {
  const host = getNormalizedHostname(url);

  if (
    host !== 'app.cloudpano.com' &&
    host !== 'cloudpano.com' &&
    host !== 'www.cloudpano.com'
  ) {
    return undefined;
  }

  return url.toString();
}

export function getMediaProvider(value: string): SafeMediaProvider | undefined {
  if (isUploadPath(value)) return 'upload';

  const parsed = parseHttpUrl(value);

  if (!parsed) return undefined;

  const host = getNormalizedHostname(parsed);

  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtu.be' || host === 'www.youtu.be') {
    return 'youtube';
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    return 'vimeo';
  }

  if (host === 'my.matterport.com') {
    return 'matterport';
  }

  if (host === 'kuula.co' || host === 'www.kuula.co') {
    return 'kuula';
  }

  if (
    host === 'app.cloudpano.com' ||
    host === 'cloudpano.com' ||
    host === 'www.cloudpano.com'
  ) {
    return 'cloudpano';
  }

  if (isSafeExternalMediaUrl(value)) {
    return 'external';
  }

  return undefined;
}

export function getSafeEmbedUrl(value: string) {
  const parsed = parseHttpUrl(value);

  if (!parsed) return undefined;

  const provider = getMediaProvider(value);

  if (provider === 'youtube') {
    const videoId = getYouTubeVideoId(parsed);

    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : undefined;
  }

  if (provider === 'vimeo') {
    const videoId = getVimeoVideoId(parsed);

    return videoId ? `https://player.vimeo.com/video/${encodeURIComponent(videoId)}` : undefined;
  }

  if (provider === 'matterport') {
    const modelId = getMatterportModelId(parsed);

    return modelId
      ? `https://my.matterport.com/show/?m=${encodeURIComponent(modelId)}`
      : undefined;
  }

  if (provider === 'kuula') {
    return getKuulaEmbedUrl(parsed);
  }

  if (provider === 'cloudpano') {
    return getCloudPanoEmbedUrl(parsed);
  }

  return undefined;
}

export function createSafeMediaEmbed(
  value: string,
  type?: MediaAssetType
): SafeMediaEmbed | null {
  const normalizedUrl = value.trim();

  if (!isSafeMediaUrl(normalizedUrl)) {
    return null;
  }

  const provider = getMediaProvider(normalizedUrl);

  if (!provider) {
    return null;
  }

  const embedUrl = getSafeEmbedUrl(normalizedUrl);

  return {
    originalUrl: value,
    normalizedUrl,
    provider,
    type,
    canEmbed: Boolean(embedUrl),
    embedUrl,
    externalUrl: normalizedUrl
  };
}

export function assertSafeMediaUrl(value: string, label = 'Media URL') {
  const normalizedUrl = value.trim();

  if (!isSafeMediaUrl(normalizedUrl)) {
    throw new Error(
      `${label} must be an uploaded file path or a supported media URL`
    );
  }

  return normalizedUrl;
}

export function isVirtualTourType(type: MediaAssetType) {
  return type === 'TOUR_360' || type === 'VIRTUAL_TOUR';
}

export function isPremiumMediaType(type: MediaAssetType) {
  return (
    type === 'VIDEO_WALKTHROUGH' ||
    type === 'TOUR_360' ||
    type === 'VIRTUAL_TOUR' ||
    type === 'FLOOR_PLAN' ||
    type === 'DOCUMENT'
  );
}
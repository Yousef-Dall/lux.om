export type SafeEmbedProvider = 'youtube' | 'vimeo' | 'matterport' | 'kuula' | 'cloudpano' | 'external' | 'upload';

export function getMediaProvider(url: string): SafeEmbedProvider | undefined {
  if (url.startsWith('/uploads/')) return 'upload';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^m\./, 'www.');

    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('vimeo.com')) return 'vimeo';
    if (host === 'my.matterport.com') return 'matterport';
    if (host.includes('kuula.co')) return 'kuula';
    if (host.includes('cloudpano.com')) return 'cloudpano';

    return 'external';
  } catch {
    return undefined;
  }
}

export function getSafeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const provider = getMediaProvider(url);

    if (provider === 'youtube') {
      const id = parsed.hostname.includes('youtu.be')
        ? parsed.pathname.split('/').filter(Boolean)[0]
        : parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1);

      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : undefined;
    }

    if (provider === 'vimeo') {
      const id = parsed.pathname.split('/').filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : undefined;
    }

    if (provider === 'matterport') {
      const id = parsed.searchParams.get('m');
      return id ? `https://my.matterport.com/show/?m=${encodeURIComponent(id)}` : undefined;
    }

    if (provider === 'kuula' || provider === 'cloudpano') {
      return url;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

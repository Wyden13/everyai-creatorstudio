/**
 * Pexels Stock Video & Photo B-Roll Org Connector.
 */

export interface StockVideoClip {
  id: number;
  durationSec: number;
  width: number;
  height: number;
  downloadUrl: string;
  previewImage: string;
}

interface RawPexelsVideos {
  videos?: {
    id: number;
    duration?: number;
    width?: number;
    height?: number;
    image?: string;
    video_files?: { link: string; width?: number; height?: number; file_type?: string }[];
  }[];
}

export function normalizePexelsVideos(raw: RawPexelsVideos): StockVideoClip[] {
  return (raw.videos ?? [])
    .map((v) => {
      const mp4 = (v.video_files ?? [])
        .filter((f) => f.file_type === 'video/mp4')
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (!mp4) return null;
      return {
        id: v.id,
        durationSec: Number(v.duration ?? 0),
        width: Number(mp4.width ?? v.width ?? 1920),
        height: Number(mp4.height ?? v.height ?? 1080),
        downloadUrl: mp4.link,
        previewImage: v.image ?? '',
      };
    })
    .filter((x): x is StockVideoClip => x !== null);
}

export async function searchPexelsVideos(opts: {
  apiKey: string;
  query: string;
  orientation?: 'landscape' | 'portrait';
  perPage?: number;
}): Promise<StockVideoClip[]> {
  if (!opts.apiKey) throw new Error('Missing PEXELS_API_KEY');
  const params = new URLSearchParams({
    query: opts.query,
    per_page: String(Math.min(15, opts.perPage ?? 6)),
  });
  if (opts.orientation) params.set('orientation', opts.orientation);
  const res = await fetch(`https://api.pexels.com/videos/search?${params.toString()}`, {
    headers: { authorization: opts.apiKey },
  });
  if (!res.ok) throw new Error(`Pexels API error ${res.status}: ${await res.text()}`);
  return normalizePexelsVideos((await res.json()) as RawPexelsVideos);
}

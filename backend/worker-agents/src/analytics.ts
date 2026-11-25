/**
 * Post-publish analytics poller for YouTube Data API v3 and Ayrshare.
 * Normalizes platform responses into a uniform PublishedStats record for Tracker widgets.
 */

export interface PublishedStats {
  platform: 'youtube' | 'tiktok' | 'instagram';
  externalId: string;
  views: number;
  likes: number;
  comments: number;
  fetchedAt: string;
}

export function normalizeYouTubeStats(
  items: readonly { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[],
  nowIso = new Date().toISOString(),
): PublishedStats[] {
  return items.map((item) => ({
    platform: 'youtube',
    externalId: item.id,
    views: Number(item.statistics?.viewCount ?? 0),
    likes: Number(item.statistics?.likeCount ?? 0),
    comments: Number(item.statistics?.commentCount ?? 0),
    fetchedAt: nowIso,
  }));
}

export async function fetchYouTubeVideoStats(
  oauthAccessToken: string,
  videoIds: readonly string[],
): Promise<PublishedStats[]> {
  if (videoIds.length === 0) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoIds.join(','))}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${oauthAccessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube analytics error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    items?: { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
  };
  return normalizeYouTubeStats(data.items ?? []);
}

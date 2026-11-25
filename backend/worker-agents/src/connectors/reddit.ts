/**
 * Reddit Org Connector: fetches rising/hot subreddit discussions for Trend Scout
 * and topic research. Pure normalizer + thin fetch boundary.
 */

export interface RedditTrendItem {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  score: number;
  numComments: number;
  createdUtc: number;
}

interface RawRedditListing {
  data?: {
    children?: {
      data?: {
        id?: string;
        subreddit?: string;
        title?: string;
        permalink?: string;
        score?: number;
        num_comments?: number;
        created_utc?: number;
      };
    }[];
  };
}

export function normalizeRedditListing(raw: RawRedditListing): RedditTrendItem[] {
  return (raw.data?.children ?? [])
    .map((c) => c.data)
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.id && d?.title))
    .map((d) => ({
      id: d.id!,
      subreddit: d.subreddit ?? 'all',
      title: d.title!,
      url: `https://reddit.com${d.permalink ?? ''}`,
      score: Number(d.score ?? 0),
      numComments: Number(d.num_comments ?? 0),
      createdUtc: Number(d.created_utc ?? 0),
    }));
}

export async function fetchRedditHot(opts: {
  subreddit: string;
  accessToken?: string;
  limit?: number;
}): Promise<RedditTrendItem[]> {
  const host = opts.accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${host}/r/${encodeURIComponent(opts.subreddit)}/hot.json?limit=${Math.min(25, opts.limit ?? 10)}`;
  const headers: Record<string, string> = { 'user-agent': 'EveryAI-CreatorStudio/1.0' };
  if (opts.accessToken) headers.authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Reddit API error ${res.status}: ${await res.text()}`);
  return normalizeRedditListing((await res.json()) as RawRedditListing);
}

/**
 * X (Twitter) API v2 Org Connector: recent topic search & multi-tweet thread posting.
 */

export interface XPostItem {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}

interface RawXSearch {
  data?: {
    id: string;
    text: string;
    created_at?: string;
    public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
  }[];
}

export function normalizeXSearch(raw: RawXSearch): XPostItem[] {
  return (raw.data ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    likes: Number(t.public_metrics?.like_count ?? 0),
    retweets: Number(t.public_metrics?.retweet_count ?? 0),
    replies: Number(t.public_metrics?.reply_count ?? 0),
    createdAt: t.created_at ?? '',
  }));
}

export async function searchXRecent(opts: {
  bearerToken: string;
  query: string;
  maxResults?: number;
}): Promise<XPostItem[]> {
  if (!opts.bearerToken) throw new Error('Missing X API bearer token');
  const n = Math.max(10, Math.min(50, opts.maxResults ?? 15));
  const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(opts.query)}&max_results=${n}&tweet.fields=created_at,public_metrics`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${opts.bearerToken}` } });
  if (!res.ok) throw new Error(`X search API error ${res.status}: ${await res.text()}`);
  return normalizeXSearch((await res.json()) as RawXSearch);
}

export async function postXThread(opts: {
  oauthAccessToken: string;
  tweets: readonly string[];
}): Promise<{ ids: string[] }> {
  if (!opts.oauthAccessToken) throw new Error('Missing X OAuth2 access token');
  if (opts.tweets.length === 0) throw new Error('Thread must contain at least one post');

  const ids: string[] = [];
  let replyTo: string | undefined;
  for (const text of opts.tweets) {
    const body: Record<string, unknown> = { text };
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.oauthAccessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`X post API error ${res.status}: ${await res.text()}`);
    const created = (await res.json()) as { data?: { id?: string } };
    if (!created.data?.id) throw new Error('X post API returned no tweet id');
    ids.push(created.data.id);
    replyTo = created.data.id;
  }
  return { ids };
}

/**
 * Trend Scout Agent: polls org keywords via SerpApi / Exa / Tavily and scores
 * candidate topics deterministically by velocity (recency + mentions) and novelty
 * (distance from previously produced video titles).
 */
import { callSearchProvider, type SearchHit } from '../providers';

export interface ScoredTopic {
  topic: string;
  velocity: number;
  novelty: number;
  score: number;
  sources: { title: string; url: string; source: string }[];
}

/** Pure deterministic topic scorer — easy to test without mocking network I/O. */
export function scoreTopics(hits: readonly SearchHit[], recentTitles: readonly string[]): ScoredTopic[] {
  const recentTokens = new Set(
    recentTitles
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );

  const scored = hits.map((hit) => {
    const recency = Math.max(0.1, 1 - hit.published_hours_ago / 72);
    const velocity = Number((0.4 + recency * 0.6).toFixed(2));

    const words = hit.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    const overlap = words.filter((w) => recentTokens.has(w)).length;
    const novelty = words.length === 0 ? 0.5 : Number(Math.max(0.1, 1 - overlap / words.length).toFixed(2));

    const score = Number((velocity * 0.6 + novelty * 0.4).toFixed(3));
    return {
      topic: hit.title,
      velocity,
      novelty,
      score,
      sources: [{ title: hit.title, url: hit.url, source: hit.source }],
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export async function runTrendScout(opts: {
  providerId: string;
  modelId: string;
  apiKey: string;
  keywords: readonly string[];
  recentTitles: readonly string[];
}): Promise<ScoredTopic[]> {
  const allHits: SearchHit[] = [];
  for (const kw of opts.keywords) {
    const hits = await callSearchProvider({
      providerId: opts.providerId,
      modelId: opts.modelId,
      apiKey: opts.apiKey,
      query: kw,
    });
    allHits.push(...hits);
  }
  return scoreTopics(allHits, opts.recentTitles).slice(0, 5);
}

import { describe, expect, test } from 'bun:test';
import { LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveStage } from './live-run';
import { pageKey, scoutHarness } from './scout';

describe.skipIf(!LIVE)('scout (live: Claude + server web_search)', () => {
  test(
    "finds ranked topics whose every source came from this run's real searches",
    async () => {
      const { output: out, session } = await liveStage(scoutHarness, {
        niche: Bun.env.LIVE_NICHE ?? 'Roman and ancient Mediterranean history (new finds, research, anniversaries)',
        keywords: [],
        recentTitles: [],
        count: 3,
      });
      expect(out.topics.length).toBeGreaterThan(0);
      // The session is the evidence: search count and every returned URL per reply.
      const replies = session.messages.flatMap((m) => (m.role === 'assistant' ? [m] : []));
      const searches = replies.reduce((n, m) => n + m.usage.webSearchRequests, 0);
      const returned = new Set(replies.flatMap((m) => m.searchResults.map((r) => pageKey(r.url))));
      const sources = out.topics.flatMap((t) => t.sources);
      console.log(JSON.stringify({ searches, searchResults: returned.size, usd: replies.map((m) => m.usage.estimatedUsd), verified: sources.length, dropped: out.unverified, topics: out.topics }, null, 2));
      expect(searches).toBeGreaterThanOrEqual(1);
      expect(sources.filter((s) => !returned.has(pageKey(s.url)))).toEqual([]);
    },
    LIVE_TIMEOUT_MS,
  );
});

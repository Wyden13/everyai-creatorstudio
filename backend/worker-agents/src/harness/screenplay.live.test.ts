import { describe, expect, test } from 'bun:test';
import { LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveOutput, liveStage } from './live-run';
import { scoutHarness } from './scout';
import { screenplayHarness } from './screenplay';

describe.skipIf(!LIVE)('screenplay (live: Claude; the scout artifact or LIVE_TOPIC)', () => {
  test(
    'writes a valid Short beat sheet for the top scouted topic',
    async () => {
      // LIVE_TOPIC pins a topic (e.g. to compare runs); otherwise the top scouted topic and its sources.
      const pinned = Bun.env.LIVE_TOPIC;
      const top = pinned ? undefined : (await liveOutput(scoutHarness)).topics[0];
      const { output: sheet } = await liveStage(screenplayHarness, {
        videoId: 'live-short',
        format: 'short',
        topic: pinned ?? `${top!.topic}: ${top!.angle}`,
        research: top?.sources.map((s) => `${s.title} <${s.url}>`).join('\n'),
      });
      expect(sheet.format).toBe('short');
    },
    LIVE_TIMEOUT_MS,
  );
});

import { describe, expect, test } from 'bun:test';
import { animationHarness } from './animation';
import { LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveMediaPath, liveOutput, liveStage } from './live-run';
import { screenplayHarness } from './screenplay';
import { voiceoverHarness } from './voiceover';

describe.skipIf(!LIVE)('animation (live: Chromium sandbox + Claude repair, reads screenplay + voiceover)', () => {
  test(
    'audits, repairs and renders the video',
    async () => {
      const voiceover = await liveOutput(voiceoverHarness);
      const { output: out } = await liveStage(animationHarness, {
        sheet: await liveOutput(screenplayHarness),
        words: voiceover.words,
        audioPath: voiceover.audioPath,
        outputPath: liveMediaPath('animation.mp4'),
      });
      expect(await Bun.file(out.outputPath).exists()).toBe(true);
    },
    LIVE_TIMEOUT_MS,
  );
});

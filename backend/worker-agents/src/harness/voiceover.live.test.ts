import { describe, expect, test } from 'bun:test';
import { LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveMediaPath, liveOutput, liveStage } from './live-run';
import { screenplayHarness } from './screenplay';
import { voiceoverHarness } from './voiceover';

describe.skipIf(!LIVE)('voiceover (live: Gemini TTS + faster-whisper, reads the screenplay artifact)', () => {
  test(
    'voices the sheet and aligns every word',
    async () => {
      const sheet = await liveOutput(screenplayHarness);
      const { output: out } = await liveStage(voiceoverHarness, { sheet, audioPath: liveMediaPath('voiceover.wav') });
      expect(out.words.at(-1)!.end_ms).toBeLessThanOrEqual(out.durationMs + 500);
    },
    LIVE_TIMEOUT_MS,
  );
});

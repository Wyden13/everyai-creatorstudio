import { describe, expect, test } from 'bun:test';
import { LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveOutput, liveStage } from './live-run';
import { repairHarness, screenplayHarness } from './screenplay';

describe.skipIf(!LIVE)('repair (live: Claude, reads the screenplay artifact)', () => {
  test(
    'rewrites one beat for an audit failure, narration untouched',
    async () => {
      const sheet = await liveOutput(screenplayHarness);
      // A realistic audit failure: the first map beat with labels has a label colliding with its annotation.
      const beat = sheet.beats.find((b) => b.shot.kind === 'map' && b.shot.labels.length > 0);
      if (!beat || beat.shot.kind !== 'map') throw new Error('the screenplay artifact has no labelled map beat to repair');
      const label = beat.shot.labels[0]!.place;
      const { output: out } = await liveStage(repairHarness, { sheet, beatId: beat.id, problems: [`text_overlap: label:${label} overlaps the pen annotation (31%); show less on this map or choose another view`] });
      const fixed = out.beats.find((b) => b.id === beat.id)!;
      expect(fixed.narration).toBe(beat.narration);
      expect(fixed.shot).not.toEqual(beat.shot);
    },
    LIVE_TIMEOUT_MS,
  );
});

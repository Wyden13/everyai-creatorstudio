/**
 * Every harness, in pipeline order. Add a harness as a row here (and a `<id>.live.test.ts`).
 * Publisher metadata and Architect still call providers directly; they move here later.
 */
import { animationHarness } from './animation';
import { assetHarness } from './asset';
import { scoutHarness } from './scout';
import { repairHarness, screenplayHarness } from './screenplay';
import { voiceoverHarness } from './voiceover';

export const HARNESSES = {
  scout: scoutHarness,
  screenplay: screenplayHarness,
  repair: repairHarness,
  voiceover: voiceoverHarness,
  animation: animationHarness,
  /** Off the video pipeline: builds org-library assets (pipes into the Asset Storage tool). */
  asset: assetHarness,
} as const;

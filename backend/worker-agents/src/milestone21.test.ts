import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildConcatManifest,
  buildConcatPlan,
  buildShowBibleCachePrefix,
  checkVmRenderCapacity,
  cleanupChapterScratch,
  DEFAULT_VISUAL_BUDGET,
  executeConcatPlan,
  extractVerbalBridge,
  hashChapterInput,
  offsetWordTimestamps,
  shouldReuseChapterCheckpoint,
  transitionChapterState,
  type ChapterBeat,
  type ChapterCheckpoint,
  type ShowBible,
} from './longform';

const SAMPLE_BEAT: ChapterBeat = {
  id: 'ch_01',
  index: 0,
  title: 'The Lithium Bottleneck',
  target_sec: 180,
  key_claim: 'Lithium refining concentration creates a structural price floor.',
  transition_in: 'Cold open with table salt battery hook.',
  transition_out: 'Lead into sodium-ion cathode chemistry.',
  callbacks: [],
  dominant_tier: 'ffmpeg_broll',
};

const SAMPLE_BIBLE: ShowBible = {
  title: 'The Salt Battery Revolution',
  thesis: 'Sodium-ion batteries will dominate stationary grid storage before 2030.',
  tone: 'Analytical, visual, Vox-meets-3Blue1Brown',
  visual_style: 'Dark graphite #0B0C0F + violet #8B6CFF data callouts',
  glossary: ['LFP = Lithium Iron Phosphate', 'CATL = Contemporary Amperex Technology'],
  beats: [
    SAMPLE_BEAT,
    {
      ...SAMPLE_BEAT,
      id: 'ch_02',
      index: 1,
      title: 'Why Sodium Works',
      callbacks: ['ch_01'],
      dominant_tier: 'manim_diagram',
    },
    {
      ...SAMPLE_BEAT,
      id: 'ch_03',
      index: 2,
      title: 'Grid Economics',
      callbacks: ['ch_01', 'ch_02'],
      dominant_tier: 'remotion_motion',
    },
  ],
};

describe('Milestone 21 — Long-Form Video Essay Pipeline (10–120 min)', () => {
  test('explicit chapter state machine enforces valid transitions and rejects illegal ones', () => {
    let s = transitionChapterState('Pending', 'START_SCRIPT');
    expect(s).toBe('Scripting');
    s = transitionChapterState(s, 'SCRIPT_OK');
    s = transitionChapterState(s, 'START_VOICE');
    s = transitionChapterState(s, 'VOICE_OK');
    s = transitionChapterState(s, 'START_RENDER');
    s = transitionChapterState(s, 'RENDER_OK');
    expect(s).toBe('Rendered');

    // Editing a rendered chapter invalidates back to Pending.
    expect(transitionChapterState(s, 'INVALIDATE')).toBe('Pending');
    // Cannot jump directly from Pending to Rendered.
    expect(() => transitionChapterState('Pending', 'RENDER_OK')).toThrow(/Invalid chapter transition/);
  });

  test('VM Capacity Preflight Gate passes healthy VM and fails loudly with suggestions when overloaded', () => {
    const ok = checkVmRenderCapacity({
      targetMinutes: 60,
      visualBudget: DEFAULT_VISUAL_BUDGET,
      vmResources: { freeRamMb: 4096, totalRamMb: 8192, freeDiskMb: 20_000 },
    });
    expect(ok.ok).toBe(true);
    expect(ok.report.chapterCount).toBe(20);
    expect(ok.report.estimatedRenderMinutes).toBeLessThan(60);

    // 120-min essay with 100% Remotion on a tiny 1 GB RAM / 2 GB disk VM must fail loudly.
    const fail = checkVmRenderCapacity({
      targetMinutes: 120,
      visualBudget: { ffmpeg_broll: 0, remotion_motion: 100, manim_diagram: 0 },
      vmResources: { freeRamMb: 1024, totalRamMb: 2048, freeDiskMb: 2048 },
    });
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.reason).toContain('RAM insufficient');
      expect(fail.reason).toContain('Scratch disk insufficient');
      expect(fail.reason).toContain('Estimated render time');
      expect(fail.suggestions.length).toBeGreaterThanOrEqual(2);
    }

    // Out-of-range duration or invalid visual budget throws loud boundary error.
    expect(() => checkVmRenderCapacity({ targetMinutes: 5 })).toThrow(/between 10 and 120/);
    expect(() =>
      checkVmRenderCapacity({
        targetMinutes: 30,
        visualBudget: { ffmpeg_broll: 50, remotion_motion: 50, manim_diagram: 10 },
      }),
    ).toThrow(/must sum to 100/);
  });

  test('Show Bible cache prefix is byte-identical across chapters and verbal bridge trims cleanly', () => {
    const p1 = buildShowBibleCachePrefix(SAMPLE_BIBLE);
    const p2 = buildShowBibleCachePrefix(SAMPLE_BIBLE);
    expect(p1).toBe(p2);
    expect(p1).toContain('# SHOW BIBLE');
    expect(p1).toContain('Callbacks: ch_01, ch_02');

    const longText = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const bridge = extractVerbalBridge(longText, 150);
    expect(bridge.split(' ')).toHaveLength(150);
    expect(bridge.startsWith('word50')).toBe(true);
  });

  test('Content-addressed chapter checkpoints skip unchanged chapters and invalidate edited ones', () => {
    const hash1 = hashChapterInput({ beat: SAMPLE_BEAT, narration: 'Original narration.', voiceId: 'v1' });
    const cp: ChapterCheckpoint = {
      id: 'ch_01',
      index: 0,
      prevId: null,
      nextId: 'ch_02',
      state: 'Rendered',
      inputHash: hash1,
      chapterOffsetMs: 0,
      durationMs: 180_000,
      audioPath: '/tmp/ch_01.mp3',
      clipPath: '/tmp/ch_01.mp4',
      words: [],
    };
    expect(shouldReuseChapterCheckpoint(cp, hash1)).toBe(true);

    const hashEdited = hashChapterInput({ beat: SAMPLE_BEAT, narration: 'Edited narration.', voiceId: 'v1' });
    expect(shouldReuseChapterCheckpoint(cp, hashEdited)).toBe(false);
  });

  test('offsetWordTimestamps shifts chapter timings onto global 2-hour timeline', () => {
    const shifted = offsetWordTimestamps(
      [
        { word: 'Sodium', start_ms: 0, end_ms: 400 },
        { word: 'scales', start_ms: 450, end_ms: 900 },
      ],
      3_600_000, // 60 minutes in
    );
    expect(shifted[0]).toEqual({ word: 'Sodium', start_ms: 3_600_000, end_ms: 3_600_400 });
    expect(shifted[1]).toEqual({ word: 'scales', start_ms: 3_600_450, end_ms: 3_600_900 });
  });

  test('Zero-reencode FFmpeg concat joins two real chapter MP4s and cleans up scratch', async () => {
    const workDir = join(tmpdir(), `everyai-m21-test-${Date.now()}`);
    const scratchDir = join(workDir, 'ch1_frames');
    mkdirSync(scratchDir, { recursive: true });

    const ch1 = join(workDir, 'ch_01.mp4');
    const ch2 = join(workDir, 'ch_02.mp4');
    const out = join(workDir, 'master.mp4');
    const manifest = join(workDir, 'concat.txt');

    try {
      // Generate two tiny 0.5s identical-format chapter clips via FFmpeg lavfi.
      for (const target of [ch1, ch2]) {
        const proc = Bun.spawn(
          [
            'ffmpeg',
            '-y',
            '-f',
            'lavfi',
            '-i',
            'color=c=#0B0C0F:s=320x180:d=0.5:r=30',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=r=48000:cl=stereo',
            '-t',
            '0.5',
            '-c:v',
            'libopenh264',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            target,
          ],
          { stdout: 'pipe', stderr: 'pipe' },
        );
        expect(await proc.exited).toBe(0);
      }

      const plan = buildConcatPlan({ chapterClipPaths: [ch1, ch2], manifestPath: manifest, outputPath: out });
      expect(buildConcatManifest([ch1, ch2])).toContain(`file '${ch1}'`);
      expect(plan.args).toContain('-c');
      expect(plan.args).toContain('copy');

      await executeConcatPlan(plan);
      expect(existsSync(out)).toBe(true);
      expect(statSync(out).size).toBeGreaterThan(statSync(ch1).size);

      cleanupChapterScratch(scratchDir);
      expect(existsSync(scratchDir)).toBe(false);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});

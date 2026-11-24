import { describe, expect, test } from 'bun:test';
import { unlinkSync, writeFileSync, statSync } from 'node:fs';
import { validateGeneratedCode } from './agents/animation';
import { buildCompilePlan, executeCompilePlan } from './compiler';
import { buildAssSubtitles, groupWordsIntoCaptionCues } from './remotion/captions';
import { ASPECT_SPECS } from './remotion/primitives';
import type { WordTimestamp } from './providers';

const SAMPLE_WORDS: WordTimestamp[] = [
  { word: 'One', start_ms: 0, end_ms: 250 },
  { word: 'dropped', start_ms: 260, end_ms: 520 },
  { word: 'packet', start_ms: 530, end_ms: 820 },
  { word: 'stalls', start_ms: 840, end_ms: 1120 },
  { word: 'every', start_ms: 1130, end_ms: 1400 },
  { word: 'stream.', start_ms: 1420, end_ms: 1800 },
];

describe('native multi-aspect specs & burned-in captions', () => {
  test('16:9 and 9:16 use distinct native dimensions and cue word budgets', () => {
    expect(ASPECT_SPECS['16:9'].width).toBe(1920);
    expect(ASPECT_SPECS['16:9'].height).toBe(1080);
    expect(ASPECT_SPECS['9:16'].width).toBe(1080);
    expect(ASPECT_SPECS['9:16'].height).toBe(1920);

    const wideCues = groupWordsIntoCaptionCues(SAMPLE_WORDS, '16:9');
    const tallCues = groupWordsIntoCaptionCues(SAMPLE_WORDS, '9:16');
    expect(wideCues.length).toBe(1);
    expect(tallCues.length).toBe(2);
    expect(tallCues[0]?.text).toBe('One dropped packet');
    expect(tallCues[1]?.text).toBe('stalls every stream.');
  });

  test('emits valid ASS v4.00+ karaoke subtitles for burned-in captions', () => {
    const ass = buildAssSubtitles(SAMPLE_WORDS, '9:16', 'violet_pop');
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('{\\kf25}One');
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:00.82,Default');
  });
});

describe('animation codegen sandbox validator', () => {
  const cases: { kind: 'remotion_tsx' | 'manim_python'; code: string; expectedOk: boolean }[] = [
    {
      kind: 'remotion_tsx',
      code: 'import { AbsoluteFill, spring } from "remotion"; export const Scene = () => <AbsoluteFill />;',
      expectedOk: true,
    },
    {
      kind: 'remotion_tsx',
      code: 'import fs from "node:fs"; export const Scene = () => fs.readFileSync("/etc/passwd");',
      expectedOk: false,
    },
    {
      kind: 'manim_python',
      code: 'from manim import Scene, MathTex\nclass Eq(Scene):\n  def construct(self): self.play(MathTex("E=mc^2"))',
      expectedOk: true,
    },
    {
      kind: 'manim_python',
      code: 'import subprocess\nsubprocess.run(["rm", "-rf", "/"])',
      expectedOk: false,
    },
  ];

  for (const c of cases) {
    test(`${c.kind} sandbox check expects ok=${c.expectedOk}`, () => {
      expect(validateGeneratedCode(c.kind, c.code).ok).toBe(c.expectedOk);
    });
  }
});

describe('FFmpeg 16:9 & 9:16 compiler + burned-in captions', () => {
  test('builds deterministic FFmpeg filter graph with overlay, loudnorm, and ASS burn-in', () => {
    const plan = buildCompilePlan({
      aspectRatio: '9:16',
      baseVideoPath: '/tmp/base.mp4',
      manimOverlayPath: '/tmp/manim.webm',
      audioPath: '/tmp/voice.mp3',
      assSubtitlePath: '/tmp/captions.ass',
      outputPath: '/tmp/final_9x16.mp4',
    });
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    const filterArg = plan.args[plan.args.indexOf('-filter_complex') + 1]!;
    expect(filterArg).toContain('scale=1080:1920');
    expect(filterArg).toContain('overlay=0:0:shortest=1');
    expect(filterArg).toContain("ass='/tmp/captions.ass'");
    expect(plan.args).toContain('loudnorm=I=-14:TP=-1.5:LRA=11');
  });

  test('renders a real 1-second 9:16 MP4 with burned-in ASS captions via local ffmpeg', async () => {
    const base = '/tmp/cs_test_base.mp4';
    const assPath = '/tmp/cs_test_captions.ass';
    const out = '/tmp/cs_test_burned.mp4';
    try {
      // Generate a tiny 1s graphite video frame with ffmpeg
      const gen = Bun.spawn(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=c=0x0B0C0F:s=360x640:d=1:r=30', '-c:v', 'libopenh264', base], {
        stdout: 'ignore',
        stderr: 'pipe',
      });
      expect(await gen.exited).toBe(0);

      writeFileSync(assPath, buildAssSubtitles(SAMPLE_WORDS.slice(0, 3), '9:16', 'violet_pop'));
      const plan = buildCompilePlan({
        aspectRatio: '9:16',
        baseVideoPath: base,
        assSubtitlePath: assPath,
        videoCodec: 'libopenh264',
        outputPath: out,
      });
      await executeCompilePlan(plan);
      expect(statSync(out).size).toBeGreaterThan(1000);
    } finally {
      for (const f of [base, assPath, out]) {
        try {
          unlinkSync(f);
        } catch {
          // ignore
        }
      }
    }
  });
});

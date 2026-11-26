import { describe, expect, test } from 'bun:test';
import { unlinkSync, writeFileSync, statSync } from 'node:fs';
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
    // 3 words at most, and "stalls every stream." (20 chars) is wider than one 9:16 line.
    expect(tallCues.map((c) => c.text)).toEqual(['One dropped packet', 'stalls every', 'stream.']);
  });

  test('16:9 emits ASS v4.00+ karaoke: one event per cue, words swept in as spoken', () => {
    const ass = buildAssSubtitles(SAMPLE_WORDS, '16:9', 'violet_pop');
    expect(ass).toContain('PlayResX: 1920');
    expect(ass).toContain('PlayResY: 1080');
    expect(ass).toContain('{\\kf25}One');
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:01.80,Default');
  });

  const tallAss = buildAssSubtitles(SAMPLE_WORDS, '9:16', 'vox_clean');
  const tallEvents = tallAss.split('\n').filter((l) => l.startsWith('Dialogue:'));
  const yellow = '{\\c&H0000F2FF}';
  const rows: [string, string][] = [
    ['first word lit, held until the next word starts', `Dialogue: 0,0:00:00.00,0:00:00.26,Default,,0,0,0,,${yellow}One{\\c&H00F1ECEC}{\\fsp8} {\\fsp0}dropped{\\fsp8} {\\fsp0}packet`],
    ['middle word lit, the rest stay white', `Dialogue: 0,0:00:00.26,0:00:00.53,Default,,0,0,0,,One{\\fsp8} {\\fsp0}${yellow}dropped{\\c&H00F1ECEC}{\\fsp8} {\\fsp0}packet`],
    ['last word of a cue holds until the cue ends', `Dialogue: 0,0:00:00.53,0:00:00.82,Default,,0,0,0,,One{\\fsp8} {\\fsp0}dropped{\\fsp8} {\\fsp0}${yellow}packet{\\c&H00F1ECEC}`],
  ];
  for (const [name, line] of rows) test(`9:16 Shorts captions: ${name}`, () => expect(tallEvents).toContain(line));
  test('9:16 Shorts captions: one event per word, no karaoke sweep, big and clear of the Shorts UI', () => {
    expect(tallEvents).toHaveLength(SAMPLE_WORDS.length);
    expect(tallAss).not.toContain('\\kf');
    // Big Libre Franklin Bold, bottom-centred 480 px up (clear of the Shorts title block), 100 px side margins (clear of the action rail).
    expect(tallAss).toContain('Style: Default,Libre Franklin,88,&H00F1ECEC,&H00ACA1A0,&H000F0C0B,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,100,100,480,1');
  });

  test('a 9:16 cue never runs wider than one caption line', () => {
    const long = ['Mediterranean', 'world,', 'roughly'].map((word, i) => ({ word, start_ms: i * 300, end_ms: i * 300 + 280 }));
    expect(groupWordsIntoCaptionCues(long, '9:16').map((c) => c.text)).toEqual(['Mediterranean', 'world, roughly']);
    expect(groupWordsIntoCaptionCues(long, '16:9').map((c) => c.text)).toEqual(['Mediterranean world, roughly']);
  });

  test('widens word gaps by both outlines so thick strokes never swallow spaces', () => {
    const ass = buildAssSubtitles(SAMPLE_WORDS, '16:9', 'vox_clean');
    expect(ass).toContain('One{\\fsp8} {\\fsp0}{\\kf');
    expect(ass).toContain('Style: Default,Libre Franklin,');
  });
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

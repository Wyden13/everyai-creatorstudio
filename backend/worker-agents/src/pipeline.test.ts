import { describe, expect, test } from 'bun:test';
import { scoreTopics } from './agents/trend-scout';
import type { Storyboard } from './contracts';
import { transitionRun, type PipelineRun } from './pipeline';
import { alignCharactersToWords, type TtsResult } from './providers';

const SAMPLE_STORYBOARD: Storyboard = {
  video_id: 'vid_m2_01',
  title: 'Why QUIC beats TCP for realtime canvases',
  hook: 'One dropped packet stalls every TCP stream.',
  aspect_ratios: ['16:9', '9:16'],
  scenes: [
    {
      scene_id: 'sc_1',
      index: 0,
      narration: 'WebTransport multiplexes streams independently over QUIC.',
      visual_directive: 'Three parallel colored packet lanes crossing a dark grid.',
      animation_engine: 'remotion',
      primitive_hints: ['animated_chart'],
    },
  ],
};

const SAMPLE_TTS: TtsResult = {
  audio_base64: 'UklGRg==',
  mime_type: 'audio/mpeg',
  duration_ms: 2100,
  words: [
    { word: 'One', start_ms: 0, end_ms: 300 },
    { word: 'dropped', start_ms: 320, end_ms: 700 },
  ],
};

function makeRun(approvalMode: 'gate' | 'auto'): PipelineRun {
  return {
    runId: 'run_1',
    workspaceId: 'ws_explainers',
    topic: 'WebTransport vs WebSockets',
    approvalMode,
    stage: 'screenplay',
    state: 'Queued',
    storyboard: null,
    voiceover: null,
    error: null,
  };
}

describe('pipeline run state machine (gate vs auto mode)', () => {
  test('gate mode pauses screenplay at NeedsApproval and advances to voiceover on approve', () => {
    const r1 = transitionRun(makeRun('gate'), { type: 'start_screenplay' });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.run.state).toBe('Running');

    const r2 = transitionRun(r1.run, { type: 'screenplay_produced', storyboard: SAMPLE_STORYBOARD });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.run.stage).toBe('screenplay');
    expect(r2.run.state).toBe('NeedsApproval');

    const r3 = transitionRun(r2.run, { type: 'approve_screenplay' });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.run.stage).toBe('voiceover');
    expect(r3.run.state).toBe('Queued');

    const r4 = transitionRun(r3.run, { type: 'voiceover_produced', tts: SAMPLE_TTS });
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    expect(r4.run.stage).toBe('animation');
    expect(r4.run.state).toBe('Done');
  });

  test('auto mode skips NeedsApproval and advances screenplay directly to voiceover', () => {
    const r1 = transitionRun(makeRun('auto'), { type: 'start_screenplay' });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = transitionRun(r1.run, { type: 'screenplay_produced', storyboard: SAMPLE_STORYBOARD });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.run.stage).toBe('voiceover');
    expect(r2.run.state).toBe('Queued');
    expect(r2.run.storyboard?.video_id).toBe('vid_m2_01');
  });

  test('rejects illegal transitions loudly', () => {
    const badApprove = transitionRun(makeRun('gate'), { type: 'approve_screenplay' });
    expect(badApprove.ok).toBe(false);

    const badVoiceover = transitionRun(makeRun('gate'), { type: 'voiceover_produced', tts: SAMPLE_TTS });
    expect(badVoiceover.ok).toBe(false);
  });
});

describe('trend scout scoring & voiceover alignment', () => {
  test('scores fresher, more novel topics higher than repeated topics', () => {
    const ranked = scoreTopics(
      [
        { title: 'Old repeated WebSockets guide', url: 'https://a', snippet: '', source: 'News', published_hours_ago: 60 },
        { title: 'Zero-copy Zig WebTransport benchmarks', url: 'https://b', snippet: '', source: 'News', published_hours_ago: 2 },
      ],
      ['WebSockets guide for beginners'],
    );
    expect(ranked[0]?.topic).toBe('Zero-copy Zig WebTransport benchmarks');
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  test('converts ElevenLabs character alignment arrays into word timestamps', () => {
    const chars = ['H', 'i', ' ', 'a', 'l', 'l'];
    const starts = [0.0, 0.08, 0.16, 0.2, 0.28, 0.35];
    const ends = [0.08, 0.16, 0.2, 0.28, 0.35, 0.45];
    expect(alignCharactersToWords(chars, starts, ends)).toEqual([
      { word: 'Hi', start_ms: 0, end_ms: 160 },
      { word: 'all', start_ms: 200, end_ms: 450 },
    ]);
  });
});

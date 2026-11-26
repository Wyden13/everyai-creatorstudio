import { describe, expect, test } from 'bun:test';
import type { BeatSheet } from './vox/beat-sheet';
import { transitionRun, type PipelineRun } from './pipeline';
import { alignCharactersToWords, type TtsResult } from './providers';

const SAMPLE_SHEET: BeatSheet = {
  video_id: 'vid_m2_01',
  format: 'short',
  register: 'documentary',
  title: 'Rome never fell (half of it)',
  topic: 'Roman Empire',
  target_duration_sec: 60,
  beats: [{ id: 'b01', act: 'cold_open', narration: 'Rome fell in 476. Only half of it.', shot: { kind: 'headline', lines: ['Only half', 'of it'], highlight: 'Only half' } }],
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
    sheet: null,
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

    const r2 = transitionRun(r1.run, { type: 'screenplay_produced', sheet: SAMPLE_SHEET });
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

    const r2 = transitionRun(r1.run, { type: 'screenplay_produced', sheet: SAMPLE_SHEET });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.run.stage).toBe('voiceover');
    expect(r2.run.state).toBe('Queued');
    expect(r2.run.sheet?.video_id).toBe('vid_m2_01');
  });

  test('rejects illegal transitions loudly', () => {
    const badApprove = transitionRun(makeRun('gate'), { type: 'approve_screenplay' });
    expect(badApprove.ok).toBe(false);

    const badVoiceover = transitionRun(makeRun('gate'), { type: 'voiceover_produced', tts: SAMPLE_TTS });
    expect(badVoiceover.ok).toBe(false);
  });
});

describe('voiceover alignment', () => {
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

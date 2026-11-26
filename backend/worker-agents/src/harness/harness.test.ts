import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { alignWords } from '../align';
import type { LlmRequest, TtsResult } from '../providers';
import type { BeatSheet, Format } from '../vox/beat-sheet';
import { clone, FIXTURE, llmReply, scripted, voice } from '../vox/fixtures';
import { MAX_SCREENPLAY_ATTEMPTS } from '../vox/screenplay';
import type { HarnessSession } from './contract';
import { edgesFromEnv } from './env';
import { HARNESSES } from './registry';
import { VOICE } from './voiceover';
import type { Register } from '../vox/register';

const TMP = Bun.env.TMPDIR ?? '/tmp';
const model = { providerId: 'anthropic', modelId: 'claude-opus-5-5', effort: 'low' as const };

const prompt = (req: LlmRequest | undefined) => JSON.parse(req!.userPrompt);

describe('registry', () => {
  for (const [key, h] of Object.entries(HARNESSES)) {
    test(`${key}: id matches its row and it has a live test`, () => {
      expect(h.id).toBe(key);
      expect(existsSync(join(import.meta.dir, `${key}.live.test.ts`))).toBe(true);
    });
  }
});

describe('scout harness (LLM mocked at the edge)', () => {
  const src = [{ title: 'News', url: 'https://example.com/a' }];
  const invented = { title: 'Remembered', url: 'https://example.com/never-searched' };
  /** What the run's web_search returned, in the recorded stream shape (url + title per result). */
  const found = [...src, { title: 'Dig', url: 'https://digs.org/carthage' }];
  const topic = (name: string, velocity: number, sources: { title: string; url: string }[]) => ({ topic: name, angle: 'a', velocity, sources });
  const text = JSON.stringify({
    topics: [topic('How Rome built its roads again', 0.9, src), topic('Carthage harbour excavation finds', 0.8, [...src, invented]), topic('Evergreen aqueducts', 0.1, src)],
  });
  const searched = (t: string) => llmReply(t, found);
  const input = { niche: 'ancient history', keywords: ['rome'], recentTitles: ['How Rome built its roads'], count: 2 };

  test('searches with web_search, keeps only searched sources, scores novelty in code, ranks and trims to count', async () => {
    const reply = searched('```json\n' + text + '\n```');
    const { calls, llm } = scripted(reply);
    const r = await HARNESSES.scout.run(input, { llm, model });
    expect(r.state).toBe('Done');
    if (r.state !== 'Done') return;
    expect(r.output.topics.map((t) => [t.topic, t.novelty, t.score, t.sources])).toEqual([
      ['Carthage harbour excavation finds', 1, 0.88, src],
      ['How Rome built its roads again', 0.25, 0.64, src],
    ]);
    expect(r.output.unverified).toEqual([{ ...invented, topic: 'Carthage harbour excavation finds' }]);
    expect(calls[0]).toMatchObject({ nodeKind: 'trend_scout', serverTools: ['web_search'], effort: 'low' });
    expect(r.session).toEqual({
      harnessId: 'scout',
      messages: [{ role: 'user', content: calls[0]!.userPrompt }, { role: 'assistant', content: reply.text, usage: reply.usage, searchResults: found }],
      lastOutput: r.output,
    });
  });

  // name, URL the model cited, URL the search returned, counts as verified
  const pages: [string, string, string, boolean][] = [
    ['the exact URL', 'https://digs.org/carthage', 'https://digs.org/carthage', true],
    ['http vs https', 'http://digs.org/carthage', 'https://digs.org/carthage', true],
    ['www. vs bare host', 'https://www.digs.org/carthage', 'https://digs.org/carthage', true],
    ['bare cited, www. searched', 'https://digs.org/carthage', 'https://www.digs.org/carthage', true],
    ['trailing slash', 'https://digs.org/carthage/', 'https://digs.org/carthage', true],
    ['another page on the same site', 'https://digs.org/rome', 'https://digs.org/carthage', false],
    ['another site with the same path', 'https://elsewhere.org/carthage', 'https://digs.org/carthage', false],
  ];
  for (const [name, cited, returned, verified] of pages) {
    test(`source check: ${name} → ${verified ? 'kept' : 'dropped'}`, async () => {
      const source = { title: 'Dig', url: cited };
      const reply = JSON.stringify({ topics: [topic('Anchor', 0.5, src), topic('Carthage', 0.9, [source])] });
      const r = await HARNESSES.scout.run({ ...input, recentTitles: [] }, { ...scripted(llmReply(reply, [...src, { title: 'Dig', url: returned }])), model });
      expect(r.state === 'Done' && [r.output.topics.map((t) => t.topic), r.output.unverified]).toEqual(verified ? [['Carthage', 'Anchor'], []] : [['Anchor'], [{ ...source, topic: 'Carthage' }]]);
    });
  }

  // name, input, model reply, error contains, messages recorded
  const failures: [string, unknown, string | ReturnType<typeof llmReply> | Error, string, number][] = [
    ['invalid input never reaches the model', { ...input, count: 0 }, searched(text), 'count', 0],
    ['a run that never searched fails, even with plausible sources', input, llmReply(text, [], 0), 'ran no web_search', 2],
    ['a search count without results verifies nothing', input, llmReply(text, [], 2), "no topic kept a source this run's 2 web_search(es) returned", 2],
    ['sources all from memory leave no topic', input, llmReply(JSON.stringify({ topics: [topic('t', 0.5, [invented])] }), found), `unverified: ${invented.url}`, 2],
    ['an invented non-URL source is rejected', input, searched(JSON.stringify({ topics: [topic('t', 0.5, [{ title: 'x', url: 'not a url' }])] })), 'url', 2],
    ['prose instead of JSON is rejected', input, searched('Here are some topics!'), 'JSON', 2],
    ['a provider error becomes a Failed run', input, new Error('Anthropic API error 529'), '529', 1],
  ];
  for (const [name, raw, replyOrError, message, recorded] of failures) {
    test(name, async () => {
      const r = await HARNESSES.scout.run(raw as typeof input, { ...scripted(replyOrError), model });
      expect(r.state === 'Failed' && r.error).toContain(message);
      expect(r.session.failure).toBe(r.state === 'Failed' ? r.error : 'unreachable');
      expect(r.session.messages).toHaveLength(recorded);
    });
  }

  test('an all-unverified run keeps its topics for resuming', async () => {
    const topics = [topic('t', 0.5, [invented])];
    const r = await HARNESSES.scout.run(input, { ...scripted(llmReply(JSON.stringify({ topics }), found)), model });
    expect(r.session.lastOutput).toEqual({ topics });
  });

  test('resume hands the model its previous output and the failure flag', async () => {
    const { calls, llm } = scripted(searched(text));
    const resume: HarnessSession = { harnessId: 'scout', messages: [{ role: 'user', content: 'earlier' }], lastOutput: { topics: [] }, failure: 'renderer flag: failing' };
    const r = await HARNESSES.scout.run(input, { llm, model }, resume);
    expect(prompt(calls[0])).toMatchObject({ previous_output: { topics: [] }, failure: 'renderer flag: failing' });
    expect(r.session.messages[0]).toEqual({ role: 'user', content: 'earlier' });
    expect(r.session.messages).toHaveLength(3);
  });

  test('a failed resume keeps the last good output', async () => {
    const { llm } = scripted(new Error('boom'));
    const r = await HARNESSES.scout.run(input, { llm, model }, { harnessId: 'scout', messages: [], lastOutput: 'kept' });
    expect(r.session).toMatchObject({ lastOutput: 'kept', failure: 'boom' });
  });
});

describe('screenplay harnesses (LLM mocked at the edge)', () => {
  const input = { videoId: 'vid', format: 'explainer' as const, topic: 't', targetDurationSec: 30 };
  const bad = clone();
  (bad.beats[0]!.shot as { highlight: string }).highlight = 'nowhere';

  test('Done returns the validated sheet', async () => {
    const r = await HARNESSES.screenplay.run(input, { ...scripted(JSON.stringify(FIXTURE)), model });
    expect(r).toMatchObject({ state: 'Done', output: FIXTURE });
  });
  test('exhausted attempts fail with the last attempt kept for resuming', async () => {
    const { calls, llm } = scripted(JSON.stringify(bad));
    const r = await HARNESSES.screenplay.run(input, { llm, model });
    expect(r.state === 'Failed' && r.error).toContain('highlight_visible');
    expect(r.session.lastOutput).toEqual(bad);
    expect(r.session.messages).toHaveLength(2 * MAX_SCREENPLAY_ATTEMPTS);
    expect(calls).toHaveLength(MAX_SCREENPLAY_ATTEMPTS);
  });
  test('resume edits the previous sheet with the failure as feedback', async () => {
    const { calls, llm } = scripted(JSON.stringify(FIXTURE));
    const r = await HARNESSES.screenplay.run(input, { llm, model }, { harnessId: 'screenplay', messages: [], lastOutput: bad, failure: 'audit: b1 overlaps' });
    expect(prompt(calls[0])).toMatchObject({ previous_attempt: bad, previous_attempt_violations: 'audit: b1 overlaps' });
    expect(r.state).toBe('Done');
  });
  const defaults: [string, { format?: Format; targetDurationSec?: number }, number, string][] = [
    ['a short without a target is a 60 s Short', { format: 'short', targetDurationSec: undefined }, 60, '130-160'],
    ['an explainer without a target uses its format default', { targetDurationSec: undefined }, 120, '252-336'],
    ['an explicit target wins', { format: 'short', targetDurationSec: 45 }, 45, '98-120'],
  ];
  for (const [name, over, sec, words] of defaults) {
    test(name, async () => {
      const { calls, llm } = scripted(JSON.stringify(FIXTURE));
      await HARNESSES.screenplay.run({ ...input, ...over }, { llm, model });
      expect(prompt(calls[0])).toMatchObject({ target_duration_sec: sec, narration_words: words });
    });
  }
  test('repair returns the sheet with only that beat changed', async () => {
    const fixed = { ...FIXTURE.beats[2]!, shot: { kind: 'map', view: 'mediterranean', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [{ place: 'city:rome-it' }] } };
    const r = await HARNESSES.repair.run({ sheet: clone(), beatId: 'b3', problems: ['x'] }, { ...scripted(JSON.stringify(fixed)), model });
    expect(r.state === 'Done' && r.output.beats[2]).toEqual(fixed as never);
  });
});

describe('voiceover stage (TTS and align mocked at the edge)', () => {
  const audioPath = join(TMP, 'harness-test-voiceover.wav');
  afterEach(() => rmSync(audioPath, { force: true }));
  const fakeTts = (calls: unknown[]) => async (req: unknown): Promise<TtsResult> => (calls.push(req), { audio_base64: Buffer.from('RIFFdata').toString('base64'), mime_type: 'audio/wav', duration_ms: 4200, words: [] });

  const plain = FIXTURE.beats.map((b) => b.narration).join(' ');
  // Tone → the one TTS request: voice and style from REGISTERS, vocal tags inserted by code (documentary: none).
  const toneRequests: [Register, Record<string, unknown>][] = [
    ['documentary', { ...VOICE, voiceId: 'Puck', text: plain }],
    ['hype', { ...VOICE, voiceId: 'Fenrir', style: 'energetic, speaking rapidly, excited', text: plain }],
    ['comedic', { ...VOICE, voiceId: 'Puck', style: 'playful and wry, quick, a hint of a smirk', text: plain.replace(' And it', ' <chuckle> <short pause> And it') }],
    ['dramatic', { ...VOICE, voiceId: 'Algenib', style: 'low and hushed, speaking slowly, building tension', text: plain }],
  ];
  for (const [register, request] of toneRequests) {
    test(`voices the locked narration in one take (${register}), writes the WAV, aligns the real audio`, async () => {
      const ttsCalls: unknown[] = [];
      const aligned: string[] = [];
      const words = voice(FIXTURE);
      const r = await HARNESSES.voiceover.run({ sheet: { ...FIXTURE, register }, audioPath }, { tts: fakeTts(ttsCalls), align: async (p) => (aligned.push(p), words) });
      expect(r).toMatchObject({ state: 'Done', output: { audioPath, durationMs: 4200, words } });
      expect(ttsCalls).toEqual([request]);
      expect(aligned).toEqual([audioPath]);
      expect(await Bun.file(audioPath).text()).toBe('RIFFdata');
    });
  }
  const provenance: [string, string | undefined][] = [
    ['TTS content credentials are stored beside the audio', 'c2pa-manifest-bytes'],
    ['no credentials, no provenance file', undefined],
  ];
  for (const [name, manifest] of provenance) {
    test(name, async () => {
      const tts = async (): Promise<TtsResult> => ({ audio_base64: Buffer.from('RIFFdata').toString('base64'), mime_type: 'audio/wav', duration_ms: 4200, words: [], ...(manifest && { c2pa_base64: Buffer.from(manifest).toString('base64') }) });
      const r = await HARNESSES.voiceover.run({ sheet: FIXTURE, audioPath }, { tts, align: async () => voice(FIXTURE) });
      const path = r.state === 'Done' ? r.output.provenancePath : 'failed';
      expect(path).toBe(manifest ? `${audioPath}.c2pa` : undefined);
      if (manifest) expect(await Bun.file(path!).text()).toBe(manifest);
      rmSync(`${audioPath}.c2pa`, { force: true });
    });
  }
  test('an alignment failure fails the stage', async () => {
    const r = await HARNESSES.voiceover.run({ sheet: FIXTURE, audioPath }, { tts: fakeTts([]), align: () => Promise.reject(new Error('word alignment failed')) });
    expect(r.state === 'Failed' && r.error).toBe('word alignment failed');
  });
  test('the alignment tool fails loud without its interpreter', async () => {
    await expect(alignWords('/nonexistent/python', audioPath)).rejects.toThrow();
  });
});

describe('animation harness (sandbox and LLM mocked at the edge)', () => {
  const violation = { beatId: 'b3', frame: 1, check: 'text_overlap' as const, message: 'a overlaps b' };
  const audits = (...rounds: (typeof violation)[][]) => {
    let n = 0;
    return async () => ({ ok: true as const, value: { violations: rounds[Math.min(n++, rounds.length - 1)]!, restFrames: [] } });
  };
  const input = { sheet: FIXTURE, words: voice(FIXTURE), audioPath: 'a.wav', outputPath: join(TMP, 'harness-test-animation.mp4') };
  const render = async () => {};
  const fixedB3 = JSON.stringify({ ...FIXTURE.beats[2]!, shot: { kind: 'map', view: 'mediterranean', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [{ place: 'rome' }] } });
  /** A second, different fix: each repair round must change the shot (an unchanged one is rejected). */
  const fixedB3Again = JSON.stringify({ ...FIXTURE.beats[2]!, shot: { kind: 'map', view: 'mediterranean', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [] } });

  test('repairs the failing beat through the repair harness, records it, renders', async () => {
    const { calls, llm } = scripted(fixedB3);
    const r = await HARNESSES.animation.run(input, { llm, model, audit: audits([violation], []), render });
    expect(r).toMatchObject({ state: 'Done', output: { repairedBeats: ['b3'], outputPath: input.outputPath } });
    expect(calls).toHaveLength(1);
    expect(r.session.messages).toHaveLength(2);
  });

  const failures: [string, Parameters<typeof HARNESSES.animation.run>[1]['audit'], string, unknown][] = [
    ['audit still failing keeps the repaired sheet', audits([violation]), 'layout audit still failing', { violations: [violation] }],
    ['sandbox crash is a Failed run', async () => ({ ok: false as const, stage: 'bundle' as const, error: 'boom' }), 'render sandbox failed (bundle): boom', undefined],
  ];
  for (const [name, audit, message, partial] of failures) {
    test(name, async () => {
      const r = await HARNESSES.animation.run(input, { ...scripted(fixedB3, fixedB3Again), model, audit, render });
      expect(r.state === 'Failed' && r.error).toContain(message);
      if (partial) expect(r.session.lastOutput).toMatchObject(partial as object);
      else expect(r.session.lastOutput).toBeUndefined();
    });
  }

  test('resume starts from the last sheet, not the input sheet', async () => {
    const last: BeatSheet = { ...clone(), title: 'Repaired earlier' };
    const r = await HARNESSES.animation.run(input, { ...scripted(), model, audit: audits([]), render }, { harnessId: 'animation', messages: [], lastOutput: { sheet: last }, failure: 'renderer flag: failing' });
    expect(r.state === 'Done' && r.output.sheet.title).toBe('Repaired earlier');
  });
});

describe('edges from env fail loud', () => {
  const saved = { ...Bun.env };
  afterEach(() => {
    for (const k of ['ANTHROPIC_TEST_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'ALIGN_PYTHON', 'LIVE_EFFORT', 'VIDEO_CODEC']) {
      if (saved[k] === undefined) delete Bun.env[k];
      else Bun.env[k] = saved[k];
    }
  });
  const clear = () => ['ANTHROPIC_TEST_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'ALIGN_PYTHON'].forEach((k) => delete Bun.env[k]);
  const rows: [string, Parameters<typeof edgesFromEnv>[0], Record<string, string>, string][] = [
    ['llm without an Anthropic key', ['llm'], {}, 'ANTHROPIC_TEST_API_KEY or ANTHROPIC_API_KEY'],
    ['a blank key counts as missing', ['llm'], { ANTHROPIC_TEST_API_KEY: ' ' }, 'ANTHROPIC_TEST_API_KEY'],
    ['tts without a Gemini key', ['tts'], {}, 'GEMINI_API_KEY'],
    ['align with a missing interpreter', ['align'], { ALIGN_PYTHON: '/nonexistent/python' }, 'no word-alignment python at /nonexistent/python'],
    ['an unknown effort level', ['model'], { LIVE_EFFORT: 'extreme' }, 'Invalid enum value'],
    ['an unknown video codec', ['render'], { VIDEO_CODEC: 'h265' }, 'Invalid enum value'],
  ];
  for (const [name, edges, env, message] of rows) {
    test(name, () => {
      clear();
      Object.assign(Bun.env, env);
      expect(() => edgesFromEnv(edges)).toThrow(message);
    });
  }
  test('ANTHROPIC_API_KEY is accepted, and a key is bound to its provider only', () => {
    clear();
    Bun.env.ANTHROPIC_API_KEY = 'test-key';
    const { llm } = edgesFromEnv(['llm']);
    expect(() => llm({ nodeKind: 'screenplay', providerId: 'openai', modelId: 'gpt-4o', systemPrompt: 's', userPrompt: 'u' })).toThrow('bound to anthropic');
  });
});

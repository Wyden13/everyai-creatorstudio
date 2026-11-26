import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { RunContextSchema, localCheckpointStore, readStageOutput, runSpend, runStage, type CheckpointStore, type StagePlan } from './checkpoint';
import { defineHarness } from './harness/contract';
import { voiceoverHarness } from './harness/voiceover';
import { computeLlmCost, type Effort, type LlmReply, type LlmRequest, type TtsResult } from './providers';
import { FIXTURE, voice } from './vox/fixtures';

const TMP = Bun.env.TMPDIR ?? '/tmp';
let root = '';
let store: CheckpointStore;
const FILE = () => join(root, 'audio.wav');
beforeEach(() => {
  root = mkdtempSync(join(TMP, 'checkpoint-test-'));
  store = localCheckpointStore(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const ctx = RunContextSchema.parse({ runId: 'run' });
const modelFor = (effort: Effort = 'low') => ({ providerId: 'anthropic', modelId: 'claude-opus-5-5', effort });
/** Every fake reply bills 1M input tokens, so spend is visible. */
const reply = (text: string): LlmReply => ({ text, usage: computeLlmCost('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 0, webSearchRequests: 0 }), searchResults: [] });
const COST = reply('').usage.estimatedUsd;
const Text = z.object({ text: z.string() });

/** Two fake stages: draft (topic → text, fails on a FAIL reply) and polish (draft → text, also reads FILE). */
const draft = defineHarness({
  id: 'draft',
  capability: 'llm_text',
  systemPrompt: 'draft it',
  tools: [],
  input: z.object({ topic: z.string() }),
  output: Text,
  edges: ['llm', 'model'],
  async body({ input, edges, resume, llm }) {
    const r = await llm({ nodeKind: 'screenplay', ...edges.model, systemPrompt: 'draft it', userPrompt: JSON.stringify({ topic: input.topic, failure: resume?.failure }) });
    return r.text === 'FAIL' ? { state: 'Failed', error: 'draft rejected', partial: { text: 'half' } } : { state: 'Done', output: { text: r.text } };
  },
});
const polish = defineHarness({
  id: 'polish',
  capability: 'llm_text',
  systemPrompt: 'polish it',
  tools: [],
  input: z.object({ text: z.string(), audioPath: z.string() }),
  output: Text,
  edges: ['llm', 'model'],
  inputFiles: (input) => [input.audioPath],
  async body({ input, edges, llm }) {
    return { state: 'Done', output: { text: (await llm({ nodeKind: 'screenplay', ...edges.model, systemPrompt: 'polish it', userPrompt: input.text })).text } };
  },
});

interface Step {
  topic: string;
  force?: 'draft' | 'polish';
  /** The draft LLM rejects this run. */
  fail?: boolean;
  effort?: Effort;
  /** Contents of the file polish reads (default v1). */
  file?: string;
}
const show = (stage: string, p: StagePlan) => [stage, p.kind, 'reason' in p ? p.reason : ''].filter(Boolean).join(':');

/** Runs draft → polish (polish only after a Done draft), as a pipeline rerun would. */
async function runSteps(steps: Step[]) {
  const calls: LlmRequest[] = [];
  const plans: string[] = [];
  let draftMessages = 0;
  for (const step of steps) {
    await Bun.write(FILE(), step.file ?? 'v1');
    const llm = async (req: LlmRequest) => (calls.push(req), reply(step.fail && req.systemPrompt === 'draft it' ? 'FAIL' : `${req.systemPrompt}: ${req.userPrompt}`));
    const edges = { llm, model: modelFor(step.effort) };
    const d = await runStage({ store, ctx, harness: draft, input: { topic: step.topic }, edges, force: step.force === 'draft' });
    plans.push(show('draft', d.plan));
    draftMessages = d.result.session.messages.length;
    if (d.result.state !== 'Done') continue;
    const p = await runStage({ store, ctx, harness: polish, input: { text: d.result.output.text, audioPath: FILE() }, edges, force: step.force === 'polish' });
    plans.push(show('polish', p.plan));
  }
  return { plans, calls: calls.length, draftMessages, spend: await runSpend(store, ctx) };
}

describe('per-stage checkpoints', () => {
  // name, runs of the same run id, every stage's plan in order, LLM calls made, messages in the last draft session
  const rows: [string, Step[], string[], number, number][] = [
    ['a first run runs every stage fresh', [{ topic: 'rome' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint'], 2, 2],
    ['the same input skips every stage', [{ topic: 'rome' }, { topic: 'rome' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Reuse', 'polish:Reuse'], 2, 2],
    ['a changed input reruns that stage and everything downstream', [{ topic: 'rome' }, { topic: 'carthage' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Fresh:InputChanged', 'polish:Fresh:InputChanged'], 4, 2],
    ['a changed model config reruns', [{ topic: 'rome' }, { topic: 'rome', effort: 'high' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Fresh:InputChanged', 'polish:Fresh:InputChanged'], 4, 2],
    ['a changed input file reruns only the stage that reads it', [{ topic: 'rome' }, { topic: 'rome', file: 'v2' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Reuse', 'polish:Fresh:InputChanged'], 3, 2],
    ['a forced stage reruns; an unchanged output keeps downstream', [{ topic: 'rome' }, { topic: 'rome', force: 'draft' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Fresh:Forced', 'polish:Reuse'], 3, 2],
    ['a forced downstream stage reruns alone', [{ topic: 'rome' }, { topic: 'rome', force: 'polish' }], ['draft:Fresh:NoCheckpoint', 'polish:Fresh:NoCheckpoint', 'draft:Reuse', 'polish:Fresh:Forced'], 3, 2],
    ['a failed stage resumes with its saved session', [{ topic: 'rome', fail: true }, { topic: 'rome' }], ['draft:Fresh:NoCheckpoint', 'draft:Resume', 'polish:Fresh:NoCheckpoint'], 3, 4],
    ['a failed stage that keeps failing resumes again', [{ topic: 'rome', fail: true }, { topic: 'rome', fail: true }], ['draft:Fresh:NoCheckpoint', 'draft:Resume'], 2, 4],
    ['a failed stage with a changed input starts fresh', [{ topic: 'rome', fail: true }, { topic: 'carthage' }], ['draft:Fresh:NoCheckpoint', 'draft:Fresh:InputChanged', 'polish:Fresh:NoCheckpoint'], 3, 2],
    ['a forced failed stage starts fresh', [{ topic: 'rome', fail: true }, { topic: 'rome', force: 'draft' }], ['draft:Fresh:NoCheckpoint', 'draft:Fresh:Forced', 'polish:Fresh:NoCheckpoint'], 3, 2],
  ];
  for (const [name, steps, plans, calls, draftMessages] of rows) {
    test(name, async () => {
      const r = await runSteps(steps);
      // Every paid call is in the run total, failed and overwritten attempts included.
      expect([r.plans, r.calls, r.draftMessages, r.spend.spentUsd]).toEqual([plans, calls, draftMessages, Number((calls * COST).toFixed(6))]);
    });
  }

  test('a resumed stage sees its failure and keeps the earlier exchange', async () => {
    await runSteps([{ topic: 'rome', fail: true }]);
    const prompts: string[] = [];
    const edges = { llm: async (req: LlmRequest) => (prompts.push(req.userPrompt), reply('fixed')), model: modelFor() };
    const r = await runStage({ store, ctx, harness: draft, input: { topic: 'rome' }, edges });
    expect([prompts, r.result.state === 'Done' && r.result.output]).toEqual([[JSON.stringify({ topic: 'rome', failure: 'draft rejected' })], { text: 'fixed' }]);
  });

  test('a later stage reads a Done stage output, and fails loud on a missing or failed one', async () => {
    await expect(readStageOutput(store, 'run', draft)).rejects.toThrow('run run has no draft checkpoint');
    await runSteps([{ topic: 'rome', fail: true }]);
    await expect(readStageOutput(store, 'run', draft)).rejects.toThrow('the draft stage of run run is Failed: draft rejected');
    await runSteps([{ topic: 'rome' }]);
    expect(await readStageOutput(store, 'run', draft)).toEqual({ text: 'draft it: {"topic":"rome","failure":"draft rejected"}' });
  });

  test('a missing input file fails loud before any call', async () => {
    const edges = { llm: async (): Promise<LlmReply> => Promise.reject(new Error('called')), model: modelFor() };
    await expect(runStage({ store, ctx, harness: polish, input: { text: 'x', audioPath: join(root, 'gone.wav') }, edges })).rejects.toThrow(`polish input file ${join(root, 'gone.wav')} does not exist`);
  });
});

describe('a corrupt checkpoint fails loud', () => {
  const done = (over: object) => JSON.stringify({ state: 'Done', stage: 'draft', inputHash: 'a'.repeat(64), spentUsd: 0, output: { text: 'ok' }, session: { harnessId: 'draft', messages: [] }, ...over });
  // name, saved text, forced rerun, the run total refuses it too (it reads no stage schema)
  const rows: [string, string, boolean, boolean][] = [
    ['not JSON', '{"state": "Do', false, true],
    ['not a checkpoint', '{"state":"Done"}', false, true],
    ['an unknown state', done({ state: 'Running' }), false, true],
    ['another stage under this name', done({ stage: 'polish' }), false, true],
    ["another harness's session", done({ session: { harnessId: 'polish', messages: [] } }), false, true],
    ['an output the stage schema rejects', done({ output: { text: 5 } }), false, false],
    ['a negative spend', done({ spentUsd: -1 }), false, true],
    ['a forced rerun still refuses it', '{', true, true],
  ];
  for (const [name, text, force, spendFails] of rows) {
    test(name, async () => {
      await store.write('run', 'draft', text);
      const edges = { llm: async (): Promise<LlmReply> => Promise.reject(new Error('called')), model: modelFor() };
      const corrupt = 'corrupt checkpoint run/draft';
      await expect(runStage({ store, ctx, harness: draft, input: { topic: 'rome' }, edges, force })).rejects.toThrow(corrupt);
      await expect(readStageOutput(store, 'run', draft)).rejects.toThrow(corrupt);
      if (spendFails) await expect(runSpend(store, ctx)).rejects.toThrow(corrupt);
    });
  }
});

describe('run budget and spend', () => {
  // name, run context given, budget it resolves to (undefined = rejected)
  const rows: [string, unknown, number | undefined][] = [
    ['no budget set uses the default of 5 USD per video', { runId: 'r' }, 5],
    ['an org/user budget overrides it', { runId: 'r', budgetUsd: 12.5 }, 12.5],
    ['a zero budget is rejected', { runId: 'r', budgetUsd: 0 }, undefined],
    ['a negative budget is rejected', { runId: 'r', budgetUsd: -1 }, undefined],
    ['a NaN budget (bad env) is rejected', { runId: 'r', budgetUsd: Number('lots') }, undefined],
    ['a run id that escapes the runs directory is rejected', { runId: '../x' }, undefined],
    ['a hidden run id is rejected', { runId: '.x' }, undefined],
  ];
  for (const [name, given, budget] of rows) {
    test(name, () => {
      const r = RunContextSchema.safeParse(given);
      expect(r.success ? r.data.budgetUsd : undefined).toBe(budget as number);
    });
  }

  test('the run spend reports each stage against the budget', async () => {
    await runSteps([{ topic: 'rome' }]);
    expect(await runSpend(store, RunContextSchema.parse({ runId: 'run', budgetUsd: 2 }))).toEqual({
      budgetUsd: 2,
      spentUsd: Number((2 * COST).toFixed(6)),
      remainingUsd: Number((2 - 2 * COST).toFixed(6)),
      stages: { draft: COST, polish: COST },
    });
  });

  // name, audio duration the fake TTS returns, USD recorded (60 s of Gemini Flash TTS = 1.35 cents)
  const tts: [string, number, number][] = [
    ['a one-minute voiceover', 60_000, 0.0135],
    ['a ten-second voiceover', 10_000, 0.00225],
  ];
  for (const [name, durationMs, usd] of tts) {
    test(`TTS cost is recorded: ${name}`, async () => {
      const fake = async (): Promise<TtsResult> => ({ audio_base64: Buffer.from('RIFF').toString('base64'), mime_type: 'audio/wav', duration_ms: durationMs, words: [] });
      const r = await runStage({ store, ctx, harness: voiceoverHarness, input: { sheet: FIXTURE, audioPath: FILE() }, edges: { tts: fake, align: async () => voice(FIXTURE) } });
      expect([r.spentUsd, (await runSpend(store, ctx)).stages, r.result.session.messages.at(-1)]).toEqual([
        usd,
        { voiceover: usd },
        { role: 'tts', providerId: 'google_gemini', modelId: 'gemini-3.8-flash-tts', chars: FIXTURE.beats.map((b) => b.narration).join(' ').length, durationMs, estimatedUsd: usd },
      ]);
    });
  }

  test('a TTS model without a price fails before the call is made', async () => {
    let called = 0;
    const unpriced = defineHarness({
      id: 'unpriced',
      capability: 'tts',
      systemPrompt: '',
      tools: [],
      input: z.object({}),
      output: z.object({}),
      edges: ['tts'],
      body: async ({ edges }) => (await edges.tts({ providerId: 'acme', modelId: 'acme-tts', text: 'hi' }), { state: 'Done', output: {} }),
    });
    const r = await unpriced.run({}, { tts: async () => (called++, Promise.reject(new Error('called'))) });
    expect([r.state === 'Failed' && r.error, called]).toEqual(['no TTS price for acme-tts; add a row to TTS_USD_PER_AUDIO_SEC (src/providers.ts)', 0]);
  });
});

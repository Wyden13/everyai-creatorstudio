/**
 * Per-stage checkpoints, taken explicitly at the runner boundary (harnesses never save anything).
 *
 * Each finished stage saves its result plus a hash of everything it read: the input JSON, the
 * harness id, system prompt and tools, the model config, and the contents of its input files
 * (e.g. the voiceover audio for animation). Re-running a run:
 *   Done checkpoint, same hash    → reused, no paid call repeats
 *   Failed checkpoint, same hash  → resumed with its saved session
 *   no checkpoint / hash changed  → run fresh (a changed output changes every later stage's hash,
 *                                   so everything downstream of a change reruns)
 *   force                         → run fresh, whatever is saved
 * A checkpoint that does not parse fails loud; it is never treated as missing.
 *
 * Each checkpoint also records what the stage spent (all attempts in this run), so the run total
 * is known. The budget is a setting piped in on the run context; nothing here enforces it.
 */
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z, type ZodType } from 'zod';
import type { EdgeName, Harness, HarnessEdges, HarnessResult, HarnessSession } from './harness/contract';
import { roundUsd, sessionSpendUsd } from './harness/spend';

/** Per-video spend budget when the org/user set none. */
export const DEFAULT_BUDGET_USD = 5;

export const RunContextSchema = z.object({
  /** Names the run's directory, so only letters, digits, `.`, `_` and `-` (never a leading dot). */
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'runId must be letters, digits, . _ - and not start with a dot'),
  /** The org/user spend setting for this video, for harnesses that plan against it. */
  budgetUsd: z.number().positive().default(DEFAULT_BUDGET_USD),
});
export type RunContext = z.infer<typeof RunContextSchema>;

const SessionSchema = z.object({
  harnessId: z.string(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'tts', 'image']) }).passthrough()),
  lastOutput: z.unknown().optional(),
  failure: z.string().optional(),
});
const saved = { stage: z.string(), inputHash: z.string().regex(/^[0-9a-f]{64}$/), spentUsd: z.number().nonnegative(), session: SessionSchema };
const CheckpointSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('Done'), output: z.unknown(), ...saved }),
  z.object({ state: z.literal('Failed'), error: z.string(), ...saved }),
]);
type Checkpoint = z.infer<typeof CheckpointSchema>;

/** Where checkpoints live. Bytes only: parsing and validation stay in this module, so a Postgres/Drive store gets them for free. */
export interface CheckpointStore {
  /** The saved checkpoint text, or null when the stage never ran in this run. */
  read(runId: string, stage: string): Promise<string | null>;
  write(runId: string, stage: string, text: string): Promise<void>;
  /** Every stage with a checkpoint in this run. */
  stages(runId: string): Promise<string[]>;
  /** Where a stage of this run writes its media (audio, video). */
  mediaPath(runId: string, file: string): string;
}

export const RUNS_DIR = resolve(import.meta.dir, '../.runs');

/** `<root>/<runId>/<stage>.json` plus the run's media beside it. Writes go through a rename, so a crash never leaves half a checkpoint. */
export function localCheckpointStore(root: string): CheckpointStore {
  const file = (runId: string, stage: string) => join(root, runId, `${stage}.json`);
  return {
    async read(runId, stage) {
      const f = Bun.file(file(runId, stage));
      return (await f.exists()) ? f.text() : null;
    },
    async write(runId, stage, text) {
      mkdirSync(join(root, runId), { recursive: true });
      await Bun.write(`${file(runId, stage)}.tmp`, text);
      renameSync(`${file(runId, stage)}.tmp`, file(runId, stage));
    },
    async stages(runId) {
      const dir = join(root, runId);
      return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)) : [];
    },
    mediaPath: (runId, name) => join(root, runId, name),
  };
}

/** Reads and validates one checkpoint (and its output, when the stage's schema is given). Corrupt → throws. */
async function readCheckpoint(store: CheckpointStore, runId: string, stage: string, output?: ZodType): Promise<Checkpoint | null> {
  const text = await store.read(runId, stage);
  if (text === null) return null;
  try {
    const cp = CheckpointSchema.parse(JSON.parse(text));
    if (cp.stage !== stage || cp.session.harnessId !== stage) throw new Error(`it belongs to stage ${cp.stage} / harness ${cp.session.harnessId}`);
    if (output && cp.state === 'Done') output.parse(cp.output);
    return cp;
  } catch (e) {
    throw new Error(`corrupt checkpoint ${runId}/${stage}: ${(e as Error).message}\nInspect or delete it to rerun the stage.`);
  }
}

/** JSON with sorted keys, so the same input always hashes the same. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])])) : v;

const sha256 = (data: string | ArrayBuffer) => new Bun.CryptoHasher('sha256').update(data).digest('hex');

/** What the runner did with a stage, and why. */
export type StagePlan =
  | { kind: 'Reuse' }
  | { kind: 'Resume'; session: HarnessSession }
  | { kind: 'Fresh'; reason: 'NoCheckpoint' | 'InputChanged' | 'Forced' };

export interface StageRun<O> {
  plan: StagePlan;
  result: HarnessResult<O>;
  /** What this stage has spent in this run, over all its attempts. */
  spentUsd: number;
}

export async function runStage<I, O, E extends EdgeName>(opts: {
  store: CheckpointStore;
  ctx: RunContext;
  harness: Harness<I, O, E>;
  input: I;
  edges: Pick<HarnessEdges, E>;
  /** Run fresh even when a matching checkpoint is saved. */
  force?: boolean;
}): Promise<StageRun<O>> {
  const { store, ctx, harness, input, edges } = opts;
  const prev = await readCheckpoint(store, ctx.runId, harness.id, harness.output);
  const files = await Promise.all(
    (harness.inputFiles?.(input) ?? []).map(async (path) => {
      const f = Bun.file(path);
      if (!(await f.exists())) throw new Error(`${harness.id} input file ${path} does not exist`);
      return { path, sha256: sha256(await f.arrayBuffer()) };
    }),
  );
  const model = 'model' in edges ? (edges as Pick<HarnessEdges, 'model'>).model : null;
  const inputHash = sha256(JSON.stringify(canonical({ harnessId: harness.id, systemPrompt: harness.systemPrompt, tools: harness.tools, model, input, files })));

  const plan: StagePlan = opts.force
    ? { kind: 'Fresh', reason: 'Forced' }
    : !prev
      ? { kind: 'Fresh', reason: 'NoCheckpoint' }
      : prev.inputHash !== inputHash
        ? { kind: 'Fresh', reason: 'InputChanged' }
        : prev.state === 'Done'
          ? { kind: 'Reuse' }
          : { kind: 'Resume', session: prev.session as HarnessSession };

  if (plan.kind === 'Reuse' && prev?.state === 'Done') {
    return { plan, result: { state: 'Done', output: harness.output.parse(prev.output), session: prev.session as HarnessSession }, spentUsd: prev.spentUsd };
  }
  const resume = plan.kind === 'Resume' ? plan.session : undefined;
  const result = await harness.run(input, edges, resume);
  // A resumed session already holds the spend saved with it; count only what this attempt added.
  const spentUsd = roundUsd((prev?.spentUsd ?? 0) + sessionSpendUsd(result.session) - (resume ? sessionSpendUsd(resume) : 0));
  const outcome = result.state === 'Done' ? { state: result.state, output: result.output } : { state: result.state, error: result.error };
  await store.write(ctx.runId, harness.id, JSON.stringify({ ...outcome, stage: harness.id, inputHash, spentUsd, session: result.session }, null, 2));
  return { plan, result, spentUsd };
}

/** A finished stage's output, for the stage after it. Fails loud if it never ran or did not finish. */
export async function readStageOutput<O>(store: CheckpointStore, runId: string, harness: { id: string; output: ZodType<O, any, unknown> }): Promise<O> {
  const cp = await readCheckpoint(store, runId, harness.id, harness.output);
  if (!cp) throw new Error(`run ${runId} has no ${harness.id} checkpoint: run that stage first`);
  if (cp.state !== 'Done') throw new Error(`the ${harness.id} stage of run ${runId} is ${cp.state}: ${cp.error}`);
  return harness.output.parse(cp.output);
}

/** The run's spend so far against its budget, per stage. */
export async function runSpend(store: CheckpointStore, ctx: RunContext) {
  const stages = await store.stages(ctx.runId);
  const spent = await Promise.all(stages.map(async (s) => [s, (await readCheckpoint(store, ctx.runId, s))!.spentUsd] as const));
  const spentUsd = roundUsd(spent.reduce((usd, [, s]) => usd + s, 0));
  return { budgetUsd: ctx.budgetUsd, spentUsd, remainingUsd: roundUsd(ctx.budgetUsd - spentUsd), stages: Object.fromEntries(spent) };
}

/**
 * Live tests are one checkpointed run (src/checkpoint.ts) under .runs/<LIVE_RUN>/, so rerunning
 * `bun run test:live` reuses every stage whose input did not change and no paid call repeats.
 *
 *   LIVE_RUN         default live    the run id (its directory under .runs/)
 *   LIVE_FORCE       e.g. screenplay,voiceover   rerun these stages even with a matching checkpoint
 *   LIVE_BUDGET_USD  default 5       the run's spend budget (reported, not enforced)
 */
import { z, type ZodType } from 'zod';
import { RUNS_DIR, RunContextSchema, localCheckpointStore, readStageOutput, runSpend, runStage } from '../checkpoint';
import type { EdgeName, Harness } from './contract';
import { edgesFromEnv } from './env';
import { HARNESSES } from './registry';

const STORE = localCheckpointStore(RUNS_DIR);
const CTX = RunContextSchema.parse({ runId: Bun.env.LIVE_RUN ?? 'live', budgetUsd: Bun.env.LIVE_BUDGET_USD === undefined ? undefined : Number(Bun.env.LIVE_BUDGET_USD) });
const STAGE_IDS = Object.keys(HARNESSES) as [keyof typeof HARNESSES, ...(keyof typeof HARNESSES)[]];
const FORCED = new Set<string>(z.array(z.enum(STAGE_IDS)).parse((Bun.env.LIVE_FORCE ?? '').split(',').filter(Boolean)));

/** Runs (or reuses) one stage on real edges and fails unless it is Done; the checkpoint keeps a failed session for resuming. */
export async function liveStage<I, O, E extends EdgeName>(harness: Harness<I, O, E>, input: I) {
  const { plan, result, spentUsd } = await runStage({ store: STORE, ctx: CTX, harness, input, edges: edgesFromEnv(harness.edges), force: FORCED.has(harness.id) });
  console.log(JSON.stringify({ stage: harness.id, plan: plan.kind, ...('reason' in plan && { reason: plan.reason }), stageUsd: spentUsd, run: await runSpend(STORE, CTX) }));
  if (result.state === 'Failed') throw new Error(`${harness.id} failed (session saved in run ${CTX.runId} under ${RUNS_DIR}; rerun to resume it):\n${result.error}`);
  return result;
}

/** A previous stage's output from this run. */
export const liveOutput = <O>(harness: { id: string; output: ZodType<O, any, unknown> }) => readStageOutput(STORE, CTX.runId, harness);

/** This run's spend budget (RunContext.budgetUsd), for harnesses that take it as an input. */
export const liveBudgetUsd = CTX.budgetUsd;

/** Where a stage of this run writes its media. */
export const liveMediaPath = (file: string) => STORE.mediaPath(CTX.runId, file);

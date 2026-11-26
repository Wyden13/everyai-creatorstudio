/**
 * Screenplay harnesses over src/vox/screenplay.ts:
 *  - screenplay: topic → validated Vox Beat Sheet (violations fed back, ≤3 attempts).
 *  - repair: rewrites ONE beat's shot to fix audit problems (narration locked).
 * screenplay resumes from the last attempt with the recorded failure as feedback; repair is
 * scoped and cheap, so it always runs fresh.
 */
import { z } from 'zod';
import { BeatSheetSchema, FORMATS, type Format } from '../vox/beat-sheet';
import { REGISTER_IDS } from '../vox/register';
import { SCREENPLAY_SYSTEM_PROMPT, ScreenplayRejected, VOX_SCREENPLAY_BIBLE, repairVoxBeat, runVoxScreenplayAgent } from '../vox/screenplay';
import { defineHarness, type ToolSpec } from './contract';

const SYSTEM_PROMPT = `${SCREENPLAY_SYSTEM_PROMPT}\n\n${VOX_SCREENPLAY_BIBLE}`;
const TOOLS: readonly ToolSpec[] = [{ id: 'beat_sheet_validator', kind: 'coded', description: 'zod schema + BEAT_SHEET_RULES; every violation is returned to the model' }];

export const ScreenplayInputSchema = z.object({
  videoId: z.string().min(1),
  format: z.enum(Object.keys(FORMATS) as [Format, ...Format[]]),
  topic: z.string().min(1),
  /** Defaults to the format's targetSec (a short is 60 s). */
  targetDurationSec: z.number().int().min(30).max(900).optional(),
  /** Research notes / sources the script must stay faithful to. */
  research: z.string().optional(),
  /** The Tone (UI label); documentary when absent. */
  register: z.enum(REGISTER_IDS).optional(),
});

export const RepairInputSchema = z.object({
  sheet: BeatSheetSchema,
  beatId: z.string().min(1),
  problems: z.array(z.string()).min(1),
});

/** Attempts exhausted is a Failed run that keeps the last attempt for resuming; any other throw is a bug. */
const rejected = (e: unknown) => {
  if (e instanceof ScreenplayRejected) return { state: 'Failed' as const, error: e.message, partial: e.previous };
  throw e;
};

export const screenplayHarness = defineHarness({
  id: 'screenplay',
  capability: 'llm_text',
  systemPrompt: SYSTEM_PROMPT,
  tools: TOOLS,
  input: ScreenplayInputSchema,
  output: BeatSheetSchema,
  edges: ['llm', 'model'],
  body: ({ input, edges, resume, llm }) =>
    runVoxScreenplayAgent({ ...input, targetDurationSec: input.targetDurationSec ?? FORMATS[input.format].targetSec, model: edges.model, llm, resume: resume && { previous: resume.lastOutput, feedback: resume.failure ?? '' } })
      .then((sheet) => ({ state: 'Done' as const, output: sheet }))
      .catch(rejected),
});

export const repairHarness = defineHarness({
  id: 'repair',
  capability: 'llm_text',
  systemPrompt: SYSTEM_PROMPT,
  tools: TOOLS,
  input: RepairInputSchema,
  output: BeatSheetSchema,
  edges: ['llm', 'model'],
  body: ({ input, edges, llm }) =>
    repairVoxBeat({ ...input, model: edges.model, llm })
      .then((sheet) => ({ state: 'Done' as const, output: sheet }))
      .catch(rejected),
});

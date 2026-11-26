/**
 * Animation harness over src/vox/harness.ts produceVoxVideo:
 *   compile Timeline → Chromium layout audit → scoped LLM repair (the repair harness) → render.
 * The LLM only rewrites failing beats' shots; code owns every visual.
 * Resume starts from the last sheet (repaired beats kept) instead of the input sheet.
 */
import { z } from 'zod';
import { WordTrackSchema } from '../align';
import { BeatSheetSchema } from '../vox/beat-sheet';
import { GEO_SOURCES, WORLDVIEWS, type Worldview } from '../vox/geo-manifest';
import { produceVoxVideo, type VoxProduction } from '../vox/harness';
import { defineHarness, type HarnessOutcome } from './contract';
import { repairHarness } from './screenplay';

export const AnimationInputSchema = z.object({
  sheet: BeatSheetSchema,
  words: WordTrackSchema,
  audioPath: z.string().min(1),
  outputPath: z.string().min(1),
  /** Org setting: whose view of disputed borders the maps draw (absent: ISO). */
  worldview: z.enum(Object.keys(WORLDVIEWS) as [Worldview, ...Worldview[]]).optional(),
});
/** A dataset a rendered video's maps drew, with its licence and suggested credit (the user decides whether to credit). */
const SourceSchema = z.object({ id: z.string(), name: z.string(), licence: z.string(), credit: z.string() });
export const AnimationOutputSchema = z.object({ outputPath: z.string(), sheet: BeatSheetSchema, repairedBeats: z.array(z.string()), sources: z.array(SourceSchema).default([]) });
type AnimationOutput = z.infer<typeof AnimationOutputSchema>;

/** How each production end state maps to a harness outcome; `partial` keeps the sheet to resume from. */
const PRODUCTION_OUTCOME: { [S in VoxProduction['state']]: (p: Extract<VoxProduction, { state: S }>) => HarnessOutcome<AnimationOutput> } = {
  Rendered: (p) => ({ state: 'Done', output: { outputPath: p.outputPath, sheet: p.sheet, repairedBeats: p.repairedBeats, sources: p.timeline.sources.map((id) => ({ id, ...GEO_SOURCES[id] })) } }),
  AuditFailed: (p) => ({
    state: 'Failed',
    error: `layout audit still failing after repairs:\n${p.violations.map((v) => `- ${v.beatId}@${v.frame} ${v.check}: ${v.message}`).join('\n')}`,
    partial: { sheet: p.sheet, repairedBeats: p.repairedBeats, violations: p.violations },
  }),
  SandboxFailed: (p) => ({ state: 'Failed', error: `render sandbox failed (${p.stage}): ${p.error}` }),
};

export const animationHarness = defineHarness({
  id: 'animation',
  capability: 'llm_text',
  systemPrompt: repairHarness.systemPrompt,
  tools: [
    { id: 'compile_timeline', kind: 'coded', description: 'deterministic timing, framing and label placement' },
    { id: 'audit', kind: 'coded', description: 'Chromium sandbox layout audit' },
    { id: 'repair', kind: 'coded', description: 'the repair harness, one failing beat at a time' },
    { id: 'render', kind: 'coded', description: 'Chromium frames + FFmpeg mux with burned captions' },
  ],
  input: AnimationInputSchema,
  output: AnimationOutputSchema,
  edges: ['llm', 'model', 'audit', 'render'],
  inputFiles: (input) => [input.audioPath],
  async body({ input, edges, resume, llm }) {
    const resumed = z.object({ sheet: BeatSheetSchema }).safeParse(resume?.lastOutput);
    const production = await produceVoxVideo({
      ...input,
      sheet: resumed.success ? resumed.data.sheet : input.sheet,
      audit: edges.audit,
      render: edges.render,
      // The recording llm, so repair exchanges land in this run's session.
      repair: async (sheet, beatId, problems) => {
        const r = await repairHarness.run({ sheet, beatId, problems: [...problems] }, { llm, model: edges.model });
        if (r.state === 'Failed') throw new Error(`repair of ${beatId} failed: ${r.error}`);
        return r.output;
      },
    });
    return (PRODUCTION_OUTCOME[production.state] as (p: VoxProduction) => HarnessOutcome<AnimationOutput>)(production);
  },
});

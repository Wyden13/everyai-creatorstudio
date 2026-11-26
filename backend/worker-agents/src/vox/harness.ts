/**
 * Vox production harness (post-voiceover):
 *   validated Beat Sheet + full word timestamps
 *     → compile Timeline (deterministic timing, framing, label placement)
 *     → render audit frames in Chromium → deterministic layout audit
 *     → scoped repair of only the failing beats (narration locked) → re-audit
 *     → full render + burned captions + the register's SFX, ducked under the voice.
 * Straight-line async: the current line is the state. Every outcome is an explicit result.
 */
import type { VideoCodec } from '../compiler';
import { buildAssSubtitles } from '../remotion/captions';
import type { WordTimestamp } from '../providers';
import type { AuditViolation } from './audit';
import type { Worldview } from './geo-manifest';
import { FORMATS, type BeatSheet } from './beat-sheet';
import { sfxCues } from './audio';
import { resolveStyle } from './register';
import { auditTimeline, renderTimelineVideo } from './render';
import type { Timeline } from './timeline';
import { compileTimeline, scriptWords } from './timing';

export const MAX_REPAIR_ROUNDS = 2;

export type VoxProduction =
  | { state: 'Rendered'; sheet: BeatSheet; timeline: Timeline; repairedBeats: string[]; outputPath: string }
  | { state: 'AuditFailed'; sheet: BeatSheet; violations: AuditViolation[]; repairedBeats: string[] }
  | { state: 'SandboxFailed'; stage: 'bundle' | 'runtime'; error: string };

/** Fixes one beat given its audit problems (e.g. repairVoxBeat bound to a model). */
export type BeatRepair = (sheet: BeatSheet, beatId: string, problems: readonly string[]) => Promise<BeatSheet>;

export async function produceVoxVideo(opts: {
  sheet: BeatSheet;
  words: readonly WordTimestamp[];
  audioPath: string;
  outputPath: string;
  repair?: BeatRepair;
  videoCodec?: VideoCodec;
  /** The org's worldview for disputed borders (geo-manifest WORLDVIEWS; default ISO). */
  worldview?: Worldview;
  /** I/O seams for tests: default to the Chromium sandbox. */
  audit?: typeof auditTimeline;
  render?: typeof renderTimelineVideo;
}): Promise<VoxProduction> {
  const audit = opts.audit ?? auditTimeline;
  const render = opts.render ?? renderTimelineVideo;
  let sheet = opts.sheet;
  const repairedBeats: string[] = [];

  for (let round = 0; ; round++) {
    const timeline = compileTimeline(sheet, opts.words, { worldview: opts.worldview });
    const report = await audit(timeline);
    if (!report.ok) return { state: 'SandboxFailed', stage: report.stage, error: report.error };
    const { violations } = report.value;

    if (violations.length === 0) {
      const assPath = opts.outputPath.replace(/\.[^.]+$/, '') + '.ass';
      const style = resolveStyle(FORMATS[sheet.format], sheet.register);
      await Bun.write(assPath, buildAssSubtitles(scriptWords(sheet, opts.words), timeline.aspect, style.captions));
      const sfx = sfxCues(timeline, style.sfx, style.punchActs);
      await render({ timeline, audioPath: opts.audioPath, outputPath: opts.outputPath, assSubtitlesPath: assPath, sfx, videoCodec: opts.videoCodec });
      return { state: 'Rendered', sheet, timeline, repairedBeats, outputPath: opts.outputPath };
    }
    if (!opts.repair || round >= MAX_REPAIR_ROUNDS) return { state: 'AuditFailed', sheet, violations, repairedBeats };

    for (const beatId of new Set(violations.map((v) => v.beatId))) {
      const problems = new Set(violations.filter((v) => v.beatId === beatId).map((v) => `${v.check}: ${v.message}`));
      sheet = await opts.repair(sheet, beatId, [...problems]);
      repairedBeats.push(beatId);
    }
  }
}

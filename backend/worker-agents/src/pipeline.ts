/**
 * Explicit pipeline run state machine for Milestone 2 (Screenplay [gate | auto] → Voiceover).
 * Rules are data: every legal (stage, state, event) transition lives in the table below.
 */
import type { ApprovalMode } from './agents/screenplay';
import type { PipelineState, Storyboard } from './contracts';
import type { TtsResult } from './providers';

export type PipelineStage = 'screenplay' | 'voiceover' | 'animation';

export type RunEvent =
  | { type: 'start_screenplay' }
  | { type: 'screenplay_produced'; storyboard: Storyboard }
  | { type: 'approve_screenplay'; storyboard?: Storyboard }
  | { type: 'voiceover_produced'; tts: TtsResult }
  | { type: 'fail'; error: string }
  | { type: 'reset' };

export interface PipelineRun {
  runId: string;
  workspaceId: string;
  topic: string;
  approvalMode: ApprovalMode;
  stage: PipelineStage;
  state: PipelineState;
  storyboard: Storyboard | null;
  voiceover: TtsResult | null;
  error: string | null;
}

type TransitionKey = `${PipelineStage}:${PipelineState}:${RunEvent['type']}`;

/**
 * Every legal pipeline transition is a row here; add new stages or events as rows,
 * never as ad-hoc branches scattered across handlers.
 */
const STAGE_TRANSITIONS: Partial<
  Record<TransitionKey, (run: PipelineRun, ev: RunEvent) => PipelineRun>
> = {
  'screenplay:Queued:start_screenplay': (run) => ({
    ...run,
    state: 'Running',
    error: null,
  }),
  'screenplay:Idle:start_screenplay': (run) => ({
    ...run,
    state: 'Running',
    error: null,
  }),
  'screenplay:Running:screenplay_produced': (run, ev) => {
    if (ev.type !== 'screenplay_produced') return run;
    // Explicit ApprovalMode decision: 'auto' skips NeedsApproval and advances straight to Voiceover.
    if (run.approvalMode === 'auto') {
      return {
        ...run,
        storyboard: ev.storyboard,
        stage: 'voiceover',
        state: 'Queued',
      };
    }
    return {
      ...run,
      storyboard: ev.storyboard,
      state: 'NeedsApproval',
    };
  },
  'screenplay:NeedsApproval:approve_screenplay': (run, ev) => {
    if (ev.type !== 'approve_screenplay') return run;
    return {
      ...run,
      storyboard: ev.storyboard ?? run.storyboard,
      stage: 'voiceover',
      state: 'Queued',
    };
  },
  'voiceover:Queued:voiceover_produced': (run, ev) => {
    if (ev.type !== 'voiceover_produced') return run;
    return {
      ...run,
      voiceover: ev.tts,
      stage: 'animation',
      state: 'Done',
    };
  },
  'voiceover:Running:voiceover_produced': (run, ev) => {
    if (ev.type !== 'voiceover_produced') return run;
    return {
      ...run,
      voiceover: ev.tts,
      stage: 'animation',
      state: 'Done',
    };
  },
};

export function transitionRun(
  run: PipelineRun,
  ev: RunEvent,
): { ok: true; run: PipelineRun } | { ok: false; reason: string } {
  if (ev.type === 'fail') {
    return { ok: true, run: { ...run, state: 'Failed', error: ev.error } };
  }
  if (ev.type === 'reset') {
    return { ok: true, run: { ...run, stage: 'screenplay', state: 'Idle', error: null } };
  }
  const key: TransitionKey = `${run.stage}:${run.state}:${ev.type}`;
  const handler = STAGE_TRANSITIONS[key];
  if (!handler) {
    return { ok: false, reason: `Illegal transition: ${key}` };
  }
  return { ok: true, run: handler(run, ev) };
}

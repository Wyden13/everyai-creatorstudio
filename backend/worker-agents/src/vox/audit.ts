/**
 * Deterministic layout audit. Runs on DOM rects collected from real rendered frames, BEFORE any
 * vision model: VLM judges are unreliable at spotting overlaps, geometry is not.
 * Pure: input rects, output violations (each names the beat so repair is scoped to it).
 */
import type { ShotKind } from './beat-sheet';
import { REGISTERS, punchlineBeats } from './register';
import type { Timeline } from './timeline';
import type { Layout, Rect } from './tokens';

export interface AuditedText extends Rect {
  beatId: string;
  /** Element role from data-vox-role, e.g. "label:rome", "title", "number". */
  role: string;
  /** scrollWidth > clientWidth or scrollHeight > clientHeight. */
  overflow: boolean;
}

export interface AuditViolation {
  beatId: string;
  frame: number;
  check: AuditCheck;
  message: string;
}

export function intersectArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Fraction of the smaller rect covered by the other. */
export function overlapRatio(a: Rect, b: Rect): number {
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? intersectArea(a, b) / smaller : 0;
}

const outside = (r: Rect, box: Rect) => r.x < box.x || r.y < box.y || r.x + r.w > box.x + box.w || r.y + r.h > box.y + box.h;
const name = (t: AuditedText) => `${t.role} [${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.w)}x${Math.round(t.h)}]`;

/** Tolerated overlap between two text boxes (line boxes have slack around glyphs). */
export const MAX_TEXT_OVERLAP = 0.04;

/** Every audit check is one row: per-element checks and per-pair checks. */
const ELEMENT_CHECKS = {
  overflow: (t: AuditedText) => (t.overflow ? `${name(t)} overflows its box` : null),
  outside_safe: (t: AuditedText, z: Layout['zone']) => (outside(t, z.safe) ? `${name(t)} is outside the title-safe area` : null),
  subtitle_band: (t: AuditedText, z: Layout['zone']) => (intersectArea(t, z.subtitles) > 0 ? `${name(t)} intrudes into the subtitle band` : null),
} as const;

const PAIR_CHECKS = {
  text_overlap: (a: AuditedText, b: AuditedText) =>
    overlapRatio(a, b) > MAX_TEXT_OVERLAP ? `${name(a)} overlaps ${name(b)} (${Math.round(overlapRatio(a, b) * 100)}%)` : null,
} as const;

export type AuditCheck = keyof typeof ELEMENT_CHECKS | keyof typeof PAIR_CHECKS | keyof typeof TEMPORAL_CHECKS | keyof typeof TIMELINE_CHECKS;

export function auditFrame(frame: number, texts: readonly AuditedText[], layout: Layout): AuditViolation[] {
  const out: AuditViolation[] = [];
  for (const t of texts) {
    for (const [check, fn] of Object.entries(ELEMENT_CHECKS)) {
      const msg = fn(t, layout.zone);
      if (msg) out.push({ beatId: t.beatId, frame, check: check as AuditCheck, message: msg });
    }
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      for (const [check, fn] of Object.entries(PAIR_CHECKS)) {
        const msg = fn(texts[i]!, texts[j]!);
        if (msg) out.push({ beatId: texts[i]!.beatId, frame, check: check as AuditCheck, message: msg });
      }
    }
  }
  return out;
}

// ── Temporal checks (motion across frames) ──────────────────────────────────

/**
 * Motion probe: the whole video is sampled every `everySec` at `scale` size with the paper
 * textures off (their boil would count as motion), and each sample's mean absolute luma change
 * (0-255) from the previous sample is measured. A run of changes below `stillLuma` lasting
 * `frozenSec` or more on a shot that must move is a frozen frame.
 */
export const MOTION_PROBE = { everySec: 0.25, scale: 0.125, stillLuma: 0.01, frozenSec: 1 } as const;

/** Shot kinds allowed to hold still (owner's rule: maps, real pictures and diagrams). Everything else keeps moving. */
export const STILL_SHOTS: ReadonlySet<ShotKind> = new Set(['map']);

/** Mean absolute difference of two equal-size luma frames. */
export function frameChange(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) throw new Error(`frameChange: frame sizes differ (${a.length} vs ${b.length})`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

/** One probe sample: its frame and its change from the previous sample. */
export interface MotionSample {
  frame: number;
  change: number;
}

export interface ProbedBeat {
  id: string;
  kind: ShotKind;
  from: number;
  to: number;
}

/**
 * Temporal checks: one row per check over a beat's probe samples. `frozen_frame` finds runs of
 * consecutive still samples (each run starts at the sample before its first still one).
 */
const TEMPORAL_CHECKS = {
  frozen_frame: (samples: readonly MotionSample[], beat: ProbedBeat, fps: number) => {
    if (STILL_SHOTS.has(beat.kind)) return [];
    const inBeat = samples.filter((s) => s.frame >= beat.from && s.frame < beat.to);
    const runs: [number, number][] = [];
    inBeat.forEach((s, i) => {
      if (i === 0 || s.change >= MOTION_PROBE.stillLuma) return;
      const prev = inBeat[i - 1]!.frame;
      const last = runs.at(-1);
      if (last && last[1] === prev) last[1] = s.frame;
      else runs.push([prev, s.frame]);
    });
    return runs
      .filter(([a, b]) => (b - a) / fps >= MOTION_PROBE.frozenSec)
      .map(([a, b]) => ({ frame: a, message: `${beat.kind} shot holds still for ${((b - a) / fps).toFixed(1)} s (frames ${a}-${b}); every non-map shot must keep moving` }));
  },
} as const;

export function auditMotion(samples: readonly MotionSample[], beats: readonly ProbedBeat[], fps: number): AuditViolation[] {
  return beats.flatMap((beat) =>
    Object.entries(TEMPORAL_CHECKS).flatMap(([check, fn]) => fn(samples, beat, fps).map((v) => ({ beatId: beat.id, check: check as AuditCheck, ...v }))),
  );
}

// ── Register-gated motion (checked on the compiled timeline, before any render) ──

/**
 * Hard limits on a register's motion feel: past these an overshoot reads as a bounce and a shake
 * as a glitch. A register row (register.ts) must stay inside them.
 */
export const MOTION_LIMITS = { spring: 2.2, shake: 16, durationMin: 0.6, durationMax: 1.4, pushMin: 0.6, pushMax: 1.8 } as const;

/**
 * Motion that breaks the house rules is allowed only where its register grants it: a hard cut
 * only into a punchline beat of a register whose punchline transition is `cut`; overshoot and
 * shake only up to the register's own row and MOTION_LIMITS. The frozen-frame probe still runs
 * on every register, so a slow or damped feel must keep moving. Add a check as a row.
 */
const TIMELINE_CHECKS = {
  hard_cut: (tl: Timeline) => {
    const spec = REGISTERS[tl.register];
    const punch = punchlineBeats(tl.beats.map((b) => b.act), spec.punchActs);
    return tl.beats.flatMap((b, i) =>
      b.enter?.kind === 'cut' && !(punch[i] && spec.transitions.punchline === 'cut')
        ? [{ beatId: b.id, frame: b.from, message: `hard cut into ${b.id}: cuts are allowed only into a punchline beat of a register that cuts (tone ${tl.register} does not here)` }]
        : [],
    );
  },
  register_motion: (tl: Timeline) => {
    const row = REGISTERS[tl.register].motion;
    const L = MOTION_LIMITS;
    return tl.beats.flatMap((b) => {
      const f = b.feel;
      const bad = [
        f.spring > Math.min(row.spring, L.spring) && `overshoot spring ${f.spring} exceeds tone ${tl.register} (${row.spring}, limit ${L.spring})`,
        f.shake > Math.min(row.shake, L.shake) && `shake ${f.shake}px exceeds tone ${tl.register} (${row.shake}px, limit ${L.shake}px)`,
        (f.duration < L.durationMin || f.duration > L.durationMax) && `motion duration scale ${f.duration} outside ${L.durationMin}-${L.durationMax}`,
        (f.push < L.pushMin || f.push > L.pushMax) && `push amplitude ${f.push} outside ${L.pushMin}-${L.pushMax}`,
      ].filter((m): m is string => !!m);
      return bad.map((message) => ({ beatId: b.id, frame: b.from, message }));
    });
  },
} as const;

export function auditTimelineMotion(timeline: Timeline): AuditViolation[] {
  return Object.entries(TIMELINE_CHECKS).flatMap(([check, fn]) => fn(timeline).map((v) => ({ check: check as AuditCheck, ...v })));
}

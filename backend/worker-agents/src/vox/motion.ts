/**
 * Pure motion maths shared by the compiler (Bun), the widgets (browser) and the tests: easing,
 * cue-relative progress, word-synced landing frames, the camera push, map camera continuity,
 * unit-square regrouping and the transition table. No Remotion or Node imports.
 */
import { tokenize, type ShotKind } from './beat-sheet';
import type { MotionFeel, SpokenWord, TimedBeat } from './timeline';
import { FPS, MOTION, PUSH, TRANSITIONS, TRANSITION_MAX_SHARE, type Aspect, type TransitionKind, type View } from './tokens';

export type Ease = (t: number) => number;
export const EASE = {
  linear: (t: number) => t,
  out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
} as const satisfies Record<string, Ease>;

/** Back ease-out with spring constant `s`: overshoots then settles (s = 1.7 peaks ~10% past the target). */
export const backOut = (s: number): Ease => (t) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

/** 0→1 progress of an animation starting at `start` lasting `dur` frames. */
export const progress = (frame: number, start: number, dur: number, ease: Ease = EASE.out) =>
  ease(Math.min(1, Math.max(0, (frame - start) / Math.max(1, dur))));

/**
 * Frame each on-screen word lands (kinetic type): on the spoken word it matches, searching the
 * narration in order; a word that is never spoken lands `wordStagger` after its predecessor, so
 * silent words cascade instead of all appearing at once. Never earlier than its predecessor, and
 * never more than `wordWaitMax` after it (a late-spoken word must not leave the frame empty).
 */
export function landingFrames(words: readonly string[], spoken: readonly SpokenWord[], start: number): number[] {
  let cursor = 0;
  let prev = start - MOTION.wordStagger;
  return words.map((w) => {
    const token = tokenize(w).join('');
    const hit = token ? spoken.findIndex((s, j) => j >= cursor && s.token === token) : -1;
    if (hit >= 0) cursor = hit + 1;
    prev = hit >= 0 ? Math.min(Math.max(prev, spoken[hit]!.frame), prev + MOTION.wordWaitMax) : prev + MOTION.wordStagger;
    return prev;
  });
}

/**
 * An element's landing in a register's feel: its duration scaled, and a back-ease spring when the
 * register has one (spring 0 is exactly the house ease-out).
 */
export const landing = (feel: MotionFeel, frame: number, start: number, dur: number) =>
  progress(frame, start, dur * feel.duration, feel.spring > 0 ? backOut(feel.spring) : EASE.out);

/**
 * A punch word at a frame, in the register's punch feel: how far it has landed (past 1 while a
 * spring overshoots) and its scale (from `punch.scale` down to 1; frames 0 is a flat cut).
 */
export function punchWord(feel: MotionFeel, frame: number, land: number): { p: number; scale: number } {
  const p = landing(feel, frame, land, feel.punch.frames);
  return { p, scale: feel.punch.scale + (1 - feel.punch.scale) * p };
}

/** The register's punch flash at a frame: full on the latest word's landing, gone MOTION.flashDecay frames later. */
export function punchFlash(feel: MotionFeel, frame: number, lands: readonly number[]): number {
  const last = lands.filter((f) => f <= frame).at(-1);
  return last === undefined ? 0 : feel.punch.flash * (1 - progress(frame, last, MOTION.flashDecay, EASE.linear));
}

/**
 * Camera push scale of a non-map shot at a frame: linear across its push span, never stopping.
 * The register scales the push amplitude; every push still ends at 1.
 */
export function pushScale(kind: Exclude<ShotKind, 'map'>, span: TimedBeat['push'], frame: number, amplitude = 1): number {
  const [a0, b] = PUSH[kind];
  const a = a0 + (b - a0) * (1 - amplitude);
  return a + ((b - a) * (frame - span.from)) / Math.max(1, span.to - span.from);
}

/** Frames a camera shake lasts after a cue lands. */
export const SHAKE_FRAMES = 6;

/** Camera shake offset (px) at a frame: decays over SHAKE_FRAMES after each cue lands; none when the feel has no shake. */
export function shakeAt(feel: MotionFeel, cues: readonly number[], frame: number): readonly [number, number] {
  const k = cues.map((c) => frame - c).find((d) => d >= 0 && d < SHAKE_FRAMES);
  if (feel.shake === 0 || k === undefined) return [0, 0];
  const amp = feel.shake * (1 - k / SHAKE_FRAMES);
  return [amp * Math.sin(k * 2.7 + 1), amp * Math.cos(k * 3.1)];
}

/** Map camera at a frame: ease from→to (log-width for even zoom speed) under a slow push-in that never stops. */
export function cameraAt({ from, to }: { from: View; to: View }, start: number, frame: number): View {
  const t = progress(frame, start, MOTION.cameraMove, EASE.inOut);
  const w = Math.exp(Math.log(from[2]) + (Math.log(to[2]) - Math.log(from[2])) * t);
  const sec = Math.max(0, (frame - start) / FPS);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, w / (1 + MOTION.driftPerSec * sec)];
}

/** Deterministic shuffle of 0..n-1 (mulberry32 seeded by a string), so renders are reproducible. */
export function shuffled(n: number, seed: string): number[] {
  let h = [...seed].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Grid slot of every unit square once the first `k` groups have regrouped. Group squares are
 * contiguous by index (group 0 first), so regrouped squares take slots 0..n-1 in order; the rest
 * keep their scattered order in the remaining slots. Every stage is a permutation: no two
 * squares ever share a slot.
 */
export function unitSlots(owners: readonly (number | undefined)[], scatter: readonly number[], k: number): number[] {
  const settled = (i: number) => owners[i] !== undefined && owners[i]! < k;
  const done = owners.filter((_, i) => settled(i)).length;
  const out = owners.map((_, i) => i);
  owners
    .map((_, i) => i)
    .filter((i) => !settled(i))
    .sort((a, b) => scatter[a]! - scatter[b]!)
    .forEach((i, r) => (out[i] = done + r));
  return out;
}

// ── Transitions ─────────────────────────────────────────────────────────────

type KindOrAny = ShotKind | '*';
/**
 * Which transition joins two consecutive beats: the first matching row wins. Same-world beats
 * glide (their camera and carried elements are already continuous); type shots hand over with
 * the highlighter wipe; everything else is a paper push, which rises on a tall frame. Add a
 * pairing as a row above the catch-all, never as a branch in the compiler.
 */
export const TRANSITION_RULES: readonly { from: KindOrAny; to: KindOrAny; world: 'same' | 'any'; aspect: Aspect | '*'; kind: TransitionKind }[] = [
  { from: '*', to: '*', world: 'same', aspect: '*', kind: 'glide' },
  { from: 'headline', to: '*', world: 'any', aspect: '*', kind: 'wipe' },
  { from: 'quote', to: '*', world: 'any', aspect: '*', kind: 'wipe' },
  { from: 'chapter', to: '*', world: 'any', aspect: '*', kind: 'wipe' },
  { from: '*', to: 'chapter', world: 'any', aspect: '*', kind: 'wipe' },
  { from: '*', to: '*', world: 'any', aspect: '9:16', kind: 'rise' },
  { from: '*', to: '*', world: 'any', aspect: '*', kind: 'push' },
];

export function transitionFor(from: ShotKind, to: ShotKind, sameWorld: boolean, aspect: Aspect): TransitionKind {
  const row = TRANSITION_RULES.find(
    (r) => (r.from === '*' || r.from === from) && (r.to === '*' || r.to === to) && (r.world === 'any' || sameWorld) && (r.aspect === '*' || r.aspect === aspect),
  );
  return row!.kind;
}

/** The overlap window centred on a beat boundary, capped to a share of both beats it joins. */
export function transitionWindow(kind: TransitionKind, boundary: number, prevLen: number, nextLen: number): { from: number; to: number } {
  const frames = Math.min(TRANSITIONS[kind].frames, Math.floor(Math.min(prevLen, nextLen) * TRANSITION_MAX_SHARE));
  return { from: boundary - Math.floor(frames / 2), to: boundary + Math.ceil(frames / 2) };
}

/** One beat layer on screen: alone, or leaving / arriving through a transition at t∈[0,1). */
export type Layer = { beat: TimedBeat; side: 'solo' } | { beat: TimedBeat; side: 'out' | 'in'; kind: TransitionKind; t: number };

/** The beat layers to draw at a frame: one beat, or two while a transition window is open. */
export function layersAt(beats: readonly TimedBeat[], frame: number): Layer[] {
  const i = Math.max(0, beats.filter((b) => b.from <= frame).length - 1);
  const j = [i, i + 1].find((k) => {
    const w = beats[k]?.enter;
    return w !== undefined && frame >= w.from && frame < w.to;
  });
  if (j === undefined) return [{ beat: beats[i]!, side: 'solo' }];
  const { kind, from, to } = beats[j]!.enter!;
  const t = (frame - from) / (to - from);
  return [
    { beat: beats[j - 1]!, side: 'out', kind, t },
    { beat: beats[j]!, side: 'in', kind, t },
  ];
}

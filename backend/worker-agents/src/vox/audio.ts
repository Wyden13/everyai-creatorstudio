/**
 * Procedural sound design for the Vox engine: no licensed files. Every sound is an FFmpeg lavfi
 * source written once as data (SFX); a register's SFX rules (register.ts) say where sounds go,
 * and `sfxCues` turns them into absolute times from the compiled Timeline, whose cue frames come
 * from the real word timestamps. Pure: render.ts generates the sounds and mixes them, ducked
 * under the voice. Music is out of scope for now.
 */
import { punchlineBeats } from './register';
import type { Act, ShotKind } from './beat-sheet';
import type { Timeline } from './timeline';

/**
 * Sound → FFmpeg lavfi source (mono 48 kHz) and `hitMs`, the moment inside the sound that lands
 * on its cue (a whoosh peaks mid-way, a riser ends on the hit). Add a sound as a row.
 */
export const SFX = {
  whoosh: { hitMs: 300, lavfi: 'anoisesrc=d=0.6:c=pink:r=48000:a=1:seed=11,highpass=f=350,lowpass=f=4500,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.3' },
  impact: { hitMs: 0, lavfi: "aevalsrc='0.9*sin(2*PI*52*t)*exp(-7*t)+0.5*(random(1)*2-1)*exp(-45*t)':d=0.7:s=48000,lowpass=f=2600" },
  riser: { hitMs: 1600, lavfi: "aevalsrc='0.4*sin(2*PI*(150*t+240*t*t))*(t/1.6)*(t/1.6)+0.25*(random(2)*2-1)*(t/1.6)*(t/1.6)*(t/1.6)':d=1.6:s=48000,highpass=f=120" },
  stinger: { hitMs: 0, lavfi: "aevalsrc='0.45*(lt(t,0.13)*sin(2*PI*523.25*t)+gte(t,0.13)*sin(2*PI*783.99*t))*exp(-4*t)':d=0.8:s=48000" },
  chime: { hitMs: 0, lavfi: "aevalsrc='0.28*(sin(2*PI*880*t)+0.6*sin(2*PI*1320*t)+0.35*sin(2*PI*1760*t))*exp(-3.5*t)':d=1.3:s=48000" },
  sub_boom: { hitMs: 0, lavfi: "aevalsrc='0.95*sin(2*PI*(48*t-9*t*t))*exp(-2.2*t)*min(1,t*80)':d=1.8:s=48000" },
  paper_rustle: { hitMs: 80, lavfi: 'anoisesrc=d=0.4:c=white:r=48000:a=0.5:seed=5,highpass=f=2500,lowpass=f=9000,tremolo=f=28:d=0.8,afade=t=in:d=0.04,afade=t=out:st=0.12:d=0.28' },
} as const satisfies Record<string, { hitMs: number; lavfi: string }>;
export type SfxId = keyof typeof SFX;

/** Where a register places a sound: every non-glide beat change, each cue of some shots, each punchline beat, an act's first beat. */
export type SfxTrigger = { at: 'transition' } | { at: 'cue'; shots: readonly ShotKind[] } | { at: 'punchline' } | { at: 'act'; act: Act };
export interface SfxRule {
  on: SfxTrigger;
  sound: SfxId;
  gainDb: number;
}

/** One placed sound: it starts at `startMs` so its hit lands on the cue. */
export interface SfxCue {
  sound: SfxId;
  startMs: number;
  gainDb: number;
}

/** Placed sounds for a compiled timeline, sorted by start (pure). */
export function sfxCues(timeline: Timeline, rules: readonly SfxRule[], punchActs: readonly Act[]): SfxCue[] {
  const ms = (frame: number) => (frame / timeline.fps) * 1000;
  const { beats } = timeline;
  const punch = punchlineBeats(beats.map((b) => b.act), punchActs);
  const spokenAt = (i: number) => ms(beats[i]!.spoken[0]?.frame ?? beats[i]!.from);
  /** Trigger → the moments (ms) it fires. Add a trigger as a row here and in SfxTrigger. */
  const MOMENTS: { [K in SfxTrigger['at']]: (on: Extract<SfxTrigger, { at: K }>) => number[] } = {
    transition: () => beats.flatMap((b) => (b.enter && b.enter.kind !== 'glide' ? [ms(b.from)] : [])),
    cue: (on) => beats.flatMap((b) => (on.shots.includes(b.shot.kind) ? Object.values(b.cues).map(ms) : [])),
    punchline: () => beats.flatMap((_, i) => (punch[i] ? [spokenAt(i)] : [])),
    act: (on) => {
      const i = beats.findIndex((b) => b.act === on.act);
      return i < 0 ? [] : [spokenAt(i)];
    },
  };
  return rules
    .flatMap((r) => (MOMENTS[r.on.at] as (on: SfxTrigger) => number[])(r.on).map((t) => ({ sound: r.sound, startMs: Math.max(0, Math.round(t - SFX[r.sound].hitMs)), gainDb: r.gainDb })))
    .sort((a, b) => a.startMs - b.startMs);
}

/**
 * The FFmpeg audio graph: voice (input `voice`) plus every cue (inputs `first`..), each delayed
 * to its start and set to its gain, summed, then sidechain-ducked under the voice and limited.
 */
export function sfxMixGraph(cues: readonly SfxCue[], voice: number, first: number): string {
  const fx = cues.map((c, k) => `[${first + k}:a]volume=${c.gainDb}dB,adelay=${c.startMs}:all=1[s${k}]`);
  return [
    `[${voice}:a]aformat=sample_rates=48000:channel_layouts=mono,asplit=2[voice][key]`,
    ...fx,
    `${cues.map((_, k) => `[s${k}]`).join('')}amix=inputs=${cues.length}:normalize=0[fx]`,
    '[fx][key]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=280[duck]',
    '[voice][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]',
  ].join(';');
}

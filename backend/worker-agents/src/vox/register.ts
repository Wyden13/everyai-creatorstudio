/**
 * Tone (UI label) = `Register` (code; `Tone` already names the data hues in tokens.ts).
 *
 * One register per video, carried on the beat sheet. Every per-register value lives in ONE
 * table, REGISTERS: prose rules for the screenplay prompt, voice + TTS style + code-inserted
 * vocal tags, motion feel, transitions, grade, caption style and SFX. `resolveStyle` is the one
 * place a register meets a format (FORMATS in beat-sheet.ts); there is no row per combination.
 * The look stays Vox: a register only re-grades, changes motion feel, captions, audio and prose.
 * `documentary` is today's behaviour exactly (no prompt block, no style, no tags, no SFX).
 * Add a register as a row here; never branch on a register id anywhere else.
 */
import type { CaptionStyleId } from '../remotion/primitives';
import type { SfxRule } from './audio';
import type { Act, FormatSpec } from './beat-sheet';
import type { MotionFeel } from './timeline';
import { COLOR, PAPER_GRADE, type Grade, type TransitionKind } from './tokens';

/** Gemini 3.8 Flash TTS vocal tags (angle brackets). Inserted by code only, never by the LLM. */
export const VOCAL_TAGS = ['<short pause>', '<long pause>', '<chuckle>', '<laugh>', '<sigh>', '<gasp>', '<breath>'] as const;
export type VocalTag = (typeof VOCAL_TAGS)[number];

/** Prose rules appended after the cached bible (the bible stays byte-stable for caching). */
interface RegisterPrompt {
  hook: string;
  humor: string;
  sentences: string;
  devices: string;
  never: string;
  accuracy: string;
}

export interface RegisterSpec {
  /** UI label ("Tone" selector). */
  label: string;
  /** null = the bible alone (documentary). */
  prompt: RegisterPrompt | null;
  voice: {
    voiceId: string;
    /** Gemini `speech_metadata.style`: short, constant delivery direction; null = none. */
    style: string | null;
    /** Measured speed of this voice + style (words/s); word budgets scale by it (resolveStyle). */
    wordsPerSec: number;
    /** Where code inserts vocal tags: before a punchline beat's last sentence, between beats, before an act's first beat. */
    tags: { punchline?: VocalTag; boundary?: VocalTag; acts?: Partial<Record<Act, VocalTag>> };
  };
  /** Acts whose FIRST beat is a punchline beat (tags, cuts, stingers key on it). */
  punchActs: readonly Act[];
  motion: MotionFeel;
  /** `swap` replaces a TRANSITION_RULES kind; `punchline` joins a punchline beat (the only way to get a `cut`). */
  transitions: { swap: Partial<Record<TransitionKind, TransitionKind>>; punchline: TransitionKind | null };
  grade: Grade;
  captions: CaptionStyleId;
  sfx: readonly SfxRule[];
}

/** Words/s the FORMATS budgets were calibrated on (Gemini "Puck", no style: ~2.9 words/s). */
export const REFERENCE_WORDS_PER_SEC = 2.9;

const SAME_FACTS = 'The bible accuracy rules hold unchanged: never invent quotes, numbers or events.';

/**
 * Every value is a starting hypothesis from docs/research/research-tone-shots.md, except
 * voice.wordsPerSec, measured per (voice, style) in the TTS tone spike (2026-11-25).
 */
export const REGISTERS = {
  documentary: {
    label: 'Documentary',
    prompt: null,
    voice: { voiceId: 'Puck', style: null, wordsPerSec: REFERENCE_WORDS_PER_SEC, tags: {} },
    punchActs: [],
    motion: { duration: 1, spring: 0, push: 1, shake: 0, punch: { scale: 1.3, frames: 8, flash: 0 } },
    transitions: { swap: {}, punchline: null },
    grade: PAPER_GRADE,
    captions: 'vox_clean',
    sfx: [],
  },
  deadpan: {
    label: 'Deadpan',
    prompt: {
      hook: 'a flat statement of an absurd TRUE fact, with no reaction to it.',
      humor: '3-4 jokes per 60 s, all understatement: a rule of three whose third item deflates; the pause before the punchline is the joke.',
      sentences: 'mostly 5-9 words, at most 12; a punchline is 3-5 words and ends on its flattest word.',
      devices: 'one three-beat build that deflates; state the ridiculous as if it were routine.',
      never: 'exclamation marks, "literally", "crazy", "insane", any sign that the narrator finds it funny.',
      accuracy: SAME_FACTS,
    },
    voice: { voiceId: 'Schedar', style: 'monotone and flat, dry, understated', wordsPerSec: 2.26, tags: { punchline: '<short pause>' } },
    punchActs: ['turn', 'ending'],
    motion: { duration: 1, spring: 0, push: 0.7, shake: 0, punch: { scale: 1, frames: 0, flash: 0 } },
    transitions: { swap: {}, punchline: 'cut' },
    grade: { ...PAPER_GRADE, highlight: '#E2D3B4', grain: { opacity: 0.45, blend: 'multiply' } },
    captions: 'vox_flat',
    sfx: [],
  },
  comedic: {
    label: 'Comedic',
    prompt: {
      hook: 'an absurd TRUE premise plus a promise that it escalates.',
      humor: '5-7 jokes per 60 s: anachronism, callbacks, escalation, quick asides. Satire is allowed: a joke may exaggerate when it is clearly a joke.',
      sentences: 'average at most 12 words; asides in short clauses.',
      devices: 'one running gag with a callback in the last beat.',
      never: '"lol", dated meme slang, mocking victims.',
      accuracy: 'Facts stated straight stay true (numbers, dates, names, places); only an obvious joke may exaggerate. Quotes stay verbatim and real.',
    },
    voice: { voiceId: 'Puck', style: 'playful and wry, quick, a hint of a smirk', wordsPerSec: 2.57, tags: { punchline: '<short pause>', acts: { ending: '<chuckle>' } } },
    punchActs: ['turn', 'ending'],
    motion: { duration: 0.85, spring: 1.7, push: 1.2, shake: 0, punch: { scale: 1.6, frames: 9, flash: 0.35 } },
    transitions: { swap: {}, punchline: 'cut' },
    grade: { ...PAPER_GRADE, tint: '#FFF6E2', highlight: '#FFE600' },
    captions: 'vox_clean',
    sfx: [
      { on: { at: 'transition' }, sound: 'paper_rustle', gainDb: -16 },
      { on: { at: 'punchline' }, sound: 'stinger', gainDb: -12 },
      { on: { at: 'cue', shots: ['number', 'pictogram', 'ranking', 'versus', 'checklist', 'chat'] }, sound: 'chime', gainDb: -18 },
    ],
  },
  hype: {
    label: 'Hype',
    prompt: {
      hook: 'the stakes and the payoff promise, in at most 12 words.',
      humor: 'no jokes: energy replaces them, one stakes line per beat.',
      sentences: 'short and punchy, average at most 8 words; end sentences on a verb or a number.',
      devices: 'a pattern interrupt every beat, an open loop in beat 2, "but" turns, a countdown or clock.',
      never: 'clickbait lies ("you won\'t believe"), superlatives ("biggest", "only") without a number comparison in the same beat.',
      accuracy: SAME_FACTS,
    },
    voice: { voiceId: 'Fenrir', style: 'energetic, speaking rapidly, excited', wordsPerSec: 3.1, tags: {} },
    punchActs: [],
    motion: { duration: 0.7, spring: 2, push: 1.6, shake: 14, punch: { scale: 1.8, frames: 8, flash: 0.85 } },
    transitions: { swap: { push: 'zoom', rise: 'zoom' }, punchline: null },
    grade: { ...PAPER_GRADE, tint: '#FFF1DC', highlight: '#FFE600', grain: { opacity: 0.6, blend: 'multiply' } },
    captions: 'vox_hype',
    sfx: [
      { on: { at: 'transition' }, sound: 'whoosh', gainDb: -8 },
      { on: { at: 'cue', shots: ['number', 'pictogram', 'timeline', 'split', 'chain', 'punch', 'ranking', 'versus', 'checklist'] }, sound: 'impact', gainDb: -7 },
      { on: { at: 'act', act: 'payoff' }, sound: 'riser', gainDb: -12 },
    ],
  },
  wholesome: {
    label: 'Wholesome',
    prompt: {
      hook: 'wonder, or "you are part of this".',
      humor: '1-2 mild, warm jokes per 60 s at most.',
      sentences: 'average at most 14 words; gentle rhythm.',
      devices: '"we" and "our", one scale comparison, a reassuring close.',
      never: 'cynicism, a doom ending.',
      accuracy: SAME_FACTS,
    },
    voice: { voiceId: 'Sulafat', style: 'warm, gentle, smiling', wordsPerSec: 2.26, tags: { acts: { ending: '<breath>' } } },
    punchActs: [],
    motion: { duration: 1.15, spring: 0.8, push: 0.9, shake: 0, punch: { scale: 1.15, frames: 14, flash: 0 } },
    transitions: { swap: {}, punchline: null },
    grade: { ...PAPER_GRADE, tint: '#FFF5E6', highlight: '#FFEA7A', tone: { ...COLOR.tone, red: '#C9584A' } },
    captions: 'vox_clean',
    sfx: [
      { on: { at: 'transition' }, sound: 'paper_rustle', gainDb: -20 },
      { on: { at: 'cue', shots: ['number', 'pictogram'] }, sound: 'chime', gainDb: -16 },
    ],
  },
  dramatic: {
    label: 'Dramatic',
    prompt: {
      hook: 'in medias res, in fragments: date. fact. consequence.',
      humor: 'none.',
      sentences: 'average at most 10 words; a long sentence, then a two-word one.',
      devices: 'withhold one reveal until the beat two before the end; a short sentence after every long one.',
      never: 'jokes, hedging filler.',
      accuracy: SAME_FACTS,
    },
    voice: { voiceId: 'Algenib', style: 'low and hushed, speaking slowly, building tension', wordsPerSec: 1.79, tags: { punchline: '<short pause>', acts: { payoff: '<long pause>' } } },
    punchActs: ['turn'],
    motion: { duration: 1.3, spring: 0, push: 1.5, shake: 0, punch: { scale: 1.06, frames: 36, flash: 0 } },
    transitions: { swap: { push: 'dip', rise: 'dip', wipe: 'dip' }, punchline: null },
    // Ink mode: a dark ink page with paper-coloured text and a red accent; tones keep their hue.
    grade: {
      field: COLOR.ink,
      paper: 0,
      tint: null,
      ink: COLOR.paper,
      inkSoft: '#D2C6AF',
      inkMuted: '#A99D87',
      accent: COLOR.tone.red,
      ochre: COLOR.tone.ochre,
      highlight: COLOR.penRed,
      blend: 'screen',
      grain: { opacity: 0.1, blend: 'screen' },
      tone: { ...COLOR.tone, ink: COLOR.paper },
    },
    captions: 'vox_serif',
    sfx: [
      { on: { at: 'act', act: 'turn' }, sound: 'riser', gainDb: -12 },
      { on: { at: 'act', act: 'turn' }, sound: 'sub_boom', gainDb: -5 },
      { on: { at: 'act', act: 'payoff' }, sound: 'sub_boom', gainDb: -8 },
    ],
  },
} as const satisfies Record<string, RegisterSpec>;

export type Register = keyof typeof REGISTERS;
export const REGISTER_IDS = Object.keys(REGISTERS) as [Register, ...Register[]];

export interface ResolvedStyle extends RegisterSpec {
  register: Register;
  /** The format row with its narration budget scaled to this register's measured speech rate. */
  format: FormatSpec;
}

/** The one combination of a format row and a register row (pure). */
export function resolveStyle(format: FormatSpec, register: Register): ResolvedStyle {
  const spec: RegisterSpec = REGISTERS[register];
  const k = spec.voice.wordsPerSec / REFERENCE_WORDS_PER_SEC;
  return { ...spec, register, format: { ...format, wordsPerSec: { min: format.wordsPerSec.min * k, max: format.wordsPerSec.max * k } } };
}

/** The prompt block appended after the cached bible, or null (documentary). */
export function registerRules(style: ResolvedStyle): string[] | null {
  const p = style.prompt;
  if (!p) return null;
  return [
    `Tone: ${style.label.toLowerCase()}. These rules override the bible's SENTENCES where they conflict.`,
    `Hook: ${p.hook}`,
    `Humor: ${p.humor}`,
    `Sentences: ${p.sentences}`,
    `Devices: ${p.devices}`,
    `Never: ${p.never}`,
    `Accuracy: ${p.accuracy}`,
    `The voice reads about ${style.voice.wordsPerSec} words per second; narration_words already accounts for it.`,
    'Never write vocal or stage tags (<pause>, [laughs]): code inserts delivery tags.',
  ];
}

/** Which beats are punchline beats: the first beat of every act in `punchActs`. */
export const punchlineBeats = (acts: readonly Act[], punchActs: readonly Act[]): boolean[] =>
  acts.map((a, i) => punchActs.includes(a) && acts[i - 1] !== a);

const TAG_RE = new RegExp(`(?:\\s*(?:${VOCAL_TAGS.join('|')})\\s*)+`, 'g');

/** The spoken words only: vocal tags removed, spacing restored (run before any text alignment). */
export const stripVocalTags = (text: string): string => text.replace(TAG_RE, ' ').trim();

/**
 * The TTS text: the narration of every beat joined by spaces, with the register's vocal tags
 * inserted by code (before an act's first beat, between beats, before a punchline beat's last
 * sentence). With no tags it is exactly the plain narration.
 */
export function voiceScript(beats: readonly { act: Act; narration: string }[], register: Register): string {
  const { tags } = REGISTERS[register].voice as RegisterSpec['voice'];
  const punch = punchlineBeats(beats.map((b) => b.act), REGISTERS[register].punchActs);
  return beats
    .map((b, i) => {
      const sentences = b.narration.split(/(?<=[.!?])\s+/);
      const body = punch[i] && tags.punchline ? [...sentences.slice(0, -1), tags.punchline, sentences.at(-1)].join(' ') : b.narration;
      const actTag = beats[i - 1]?.act !== b.act ? tags.acts?.[b.act] : undefined;
      const lead = i === 0 ? undefined : (actTag ?? tags.boundary);
      return lead ? `${lead} ${body}` : body;
    })
    .join(' ');
}

/**
 * Vox Beat Sheet: the Screenplay agent's output contract.
 *
 * One beat = one idea = one shot from a CLOSED Vox shot vocabulary, written against the exact
 * narration words that trigger it. The LLM never writes TSX, coordinates, seconds or styles:
 * it writes narration, picks a shot, fills typed props, and names the spoken phrase (`at`)
 * each element lands on. Timing is resolved later from real word timestamps.
 */
import { z } from 'zod';
import { NUMBER_UNITS, UNITS, WRITTEN_ONLY, figureParts, spokenFigure, type NumberUnit } from './format';
import { resolveSheetRefs } from './places';
import { ICONS, MAX_ICON_FAMILIES, type IconId } from './icon-manifest';
import { inflationProblem, shownValue } from './inflation';
import { REGISTER_IDS, resolveStyle } from './register';
import { speechUnits, tokenize } from './speech';
import { rankFigure, versusLayout } from './rows';
import { COLOR, LAYOUTS, type Aspect } from './tokens';

const ids = <T extends string>(obj: Record<T, unknown>) => z.enum(Object.keys(obj) as [T, ...T[]]);
/**
 * A map reference as the model writes it: a name ("Paris, FR", "Ottoman Empire"), an ISO code
 * ("FR", "US-CA"), a QID or a canonical id. checkBeatSheet resolves it (places.ts); a checked
 * sheet holds canonical ids only.
 */
const PlaceSchema = z.string().min(1).max(60);
const IconSchema = ids<IconId>(ICONS);
const UnitSchema = z.enum(NUMBER_UNITS);
const ToneSchema = z.enum(Object.keys(COLOR.tone) as [keyof typeof COLOR.tone, ...(keyof typeof COLOR.tone)[]]);
/**
 * Character caps for every on-screen string (they come from widget geometry). The zod schema
 * AND the screenplay prompt read this table, so the model is told exactly what is enforced.
 */
export const CHARS = {
  phrase: 60, headlineLine: 26, title: 34, sub: 40, label: 36, groupLabel: 24, markLabel: 22, quote: 140, by: 40, pointX: 10, part: 20, node: 18, nodeSub: 22,
  punchWord: 12, rankLabel: 18, side: 16, rowLabel: 14, item: 36, message: 48, name: 14,
} as const;
/**
 * Element counts for the diagram and list shots and map army arrows, [min, max]. The schema, the
 * prompt and the geometry tests (every count must fit the stage) all read this table.
 */
export const COUNTS = { splitParts: [2, 3], chainNodes: [2, 5], armies: [0, 2], pins: [0, 4], punchWords: [1, 3], rankItems: [3, 6], versusRows: [1, 4], checkItems: [2, 5], chatMessages: [2, 6] } as const;
/** A punch's full-bleed field (its colours are the grade's, VoxVideo.tsx PUNCH_FIELDS). */
export const PUNCH_FIELDS = ['ink', 'red', 'yellow', 'paper'] as const;
/** Which end of a scale wins: a ranking's #1, a versus row's winner (`none`: the row has no winner). */
export const BETTER = ['higher', 'lower', 'none'] as const;
export type Better = (typeof BETTER)[number];
/** With 2+ marks, the marks must span at least this share of the ruler, or they bunch up at one end. */
export const TIMELINE_MIN_FILL = 0.5;
const text = (max: number) => z.string().min(1).max(max);
/** A phrase copied verbatim from this beat's narration; the element appears when it is spoken. */
const Phrase = text(CHARS.phrase);
const Year = z.number().int().refine((y) => y !== 0, 'there is no year 0; use -1 for 1 BCE');
/** A money `value` in year `year`'s prices, shown in year `to`'s prices: code computes the adjusted figure (inflation.ts). */
const Inflation = z.object({ year: Year, to: Year });
/** An array whose length is a COUNTS row. */
const counted = <T extends z.ZodTypeAny>(item: T, [min, max]: readonly [number, number]) => z.array(item).min(min).max(max);
/** One side of a versus: its name and its data tone. */
const Side = z.object({ label: text(CHARS.side), tone: ToneSchema });

export const ACTS = ['cold_open', 'stakes', 'question', 'mechanism', 'history', 'turn', 'payoff', 'ending'] as const;
export type Act = (typeof ACTS)[number];

export const ShotSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('headline'),
    lines: z.array(text(CHARS.headlineLine)).min(1).max(2),
    highlight: Phrase,
  }),
  z.object({
    kind: z.literal('chapter'),
    title: text(CHARS.title),
  }),
  z.object({
    kind: z.literal('map'),
    /** A named view (geo-manifest MAP_VIEWS) or a country / admin-1 / polity to frame. */
    view: PlaceSchema,
    /** Draws that year's historical borders (the latest snapshot at or before it) and era names. */
    year: Year.optional(),
    title: z.object({ text: text(CHARS.title), sub: z.string().max(CHARS.sub).optional() }).optional(),
    /** Fills: a country or admin-1 area (modern), a polity alive then (with `year`), or an AWMC layer (ancient views). */
    layers: z
      .array(z.object({ layer: PlaceSchema, tone: ToneSchema, at: Phrase.optional() }))
      .max(3)
      .default([]),
    labels: z.array(z.object({ place: PlaceSchema, at: Phrase.optional() })).max(4).default([]),
    /** Pins drop onto their places on `at`; the label lands with them. */
    pins: z.array(z.object({ place: PlaceSchema, at: Phrase })).max(COUNTS.pins[1]).optional(),
    circle: z.object({ place: PlaceSchema, at: Phrase }).optional(),
    arrow: z.object({ from: PlaceSchema, to: PlaceSchema, at: Phrase }).optional(),
    /** Army arrows: thick tone arrows that advance along their route from their cue. */
    armies: z.array(z.object({ from: PlaceSchema, to: PlaceSchema, tone: ToneSchema, at: Phrase })).max(COUNTS.armies[1]).optional(),
  }),
  z.object({
    kind: z.literal('number'),
    /** Zero or negative only for signed units (rule unit_sign). */
    value: z.number(),
    unit: UnitSchema,
    label: text(CHARS.label),
    at: Phrase,
    inflation: Inflation.optional(),
    compare: z
      .object({ value: z.number(), unit: UnitSchema.optional(), label: text(CHARS.label), at: Phrase, inflation: Inflation.optional() })
      .optional(),
  }),
  z.object({
    kind: z.literal('pictogram'),
    title: text(CHARS.title),
    total: z.number().int().min(4).max(100),
    /** Every cell's glyph (squares when absent); a group's `icon` overrides it for that group's cells. */
    icon: IconSchema.optional(),
    /** What one cell stands for ("1 icon = 1,000 people"); a group then shows count × per. */
    per: z.object({ value: z.number().int().min(2), unit: UnitSchema }).optional(),
    groups: z
      .array(z.object({ count: z.number().int().min(1), label: text(CHARS.groupLabel), tone: ToneSchema, at: Phrase, icon: IconSchema.optional() }))
      .min(1)
      .max(3),
  }),
  z.object({
    kind: z.literal('timeline'),
    from: Year,
    to: Year,
    marks: z.array(z.object({ year: Year, label: text(CHARS.markLabel), at: Phrase.optional() })).min(1).max(6),
  }),
  z.object({
    kind: z.literal('quote'),
    text: text(CHARS.quote),
    by: text(CHARS.by),
    highlight: Phrase,
  }),
  z.object({
    kind: z.literal('line'),
    title: text(CHARS.title),
    points: z.array(z.object({ x: text(CHARS.pointX), y: z.number() })).min(3).max(24),
    alertFrom: z.number().int().min(1).optional(),
    at: Phrase,
  }),
  z.object({
    kind: z.literal('split'),
    whole: text(CHARS.title),
    /** The whole tears on this phrase; each part takes its tone and label on its own `at` (or with the tear). */
    at: Phrase,
    parts: z.array(z.object({ label: text(CHARS.part), tone: ToneSchema, at: Phrase.optional() })).min(COUNTS.splitParts[0]).max(COUNTS.splitParts[1]),
  }),
  z.object({
    kind: z.literal('chain'),
    title: text(CHARS.title).optional(),
    nodes: z
      .array(z.object({ label: text(CHARS.node), sub: text(CHARS.nodeSub).optional(), tone: ToneSchema.optional(), at: Phrase.optional() }))
      .min(COUNTS.chainNodes[0])
      .max(COUNTS.chainNodes[1]),
  }),
  z.object({
    kind: z.literal('punch'),
    /** One to three huge words, each slammed in on its phrase; the register sets how they land. */
    words: counted(z.object({ text: text(CHARS.punchWord).regex(/^\S+$/, 'one word per entry'), at: Phrase }), COUNTS.punchWords),
    field: z.enum(PUNCH_FIELDS).default('ink'),
  }),
  z.object({
    kind: z.literal('ranking'),
    title: text(CHARS.title),
    /** One unit and one scale for every item (shown once, under the title). */
    unit: UnitSchema,
    /** Which end is #1; code ranks the items by value, never the model. */
    better: z.enum(BETTER).exclude(['none']).default('higher'),
    items: counted(z.object({ label: text(CHARS.rankLabel), value: z.number(), at: Phrase }), COUNTS.rankItems),
  }),
  z.object({
    kind: z.literal('versus'),
    sides: z.tuple([Side, Side]),
    /** Each row lands on its phrase; code picks the row's winner from the values and `better`, and the overall winner from the rows. */
    rows: counted(z.object({ label: text(CHARS.rowLabel), unit: UnitSchema, left: z.number(), right: z.number(), better: z.enum(BETTER), at: Phrase }), COUNTS.versusRows),
  }),
  z.object({
    kind: z.literal('checklist'),
    title: text(CHARS.title).optional(),
    items: counted(z.object({ text: text(CHARS.item), mark: z.enum(['yes', 'no', 'maybe']), at: Phrase }), COUNTS.checkItems),
  }),
  z.object({
    kind: z.literal('chat'),
    /** Two generic participants: `a` on the left, `b` on the right (no real app, no real handles). */
    people: z.object({ a: text(CHARS.name), b: text(CHARS.name) }),
    messages: counted(z.object({ from: z.enum(['a', 'b']), text: text(CHARS.message), at: Phrase }), COUNTS.chatMessages),
  }),
]);
export type Shot = z.infer<typeof ShotSchema>;
export type ShotKind = Shot['kind'];

export const BeatSchema = z.object({
  id: z.string().min(1).max(24),
  act: z.enum(ACTS),
  /** Vocal tags ("<short pause>") are inserted by code from the register, never written here. */
  narration: z.string().min(1).regex(/^[^<>[\]]*$/, 'no tags in narration: delivery tags are inserted by code'),
  /** Beats that share a world are one continuous canvas: the camera moves, nothing cuts. */
  world: z.string().min(1).max(24).optional(),
  shot: ShotSchema,
});
export type Beat = z.infer<typeof BeatSchema>;

/** A beat continues the previous one when both share a world and a shot kind: one canvas, no cut. */
export const continues = (prev: Beat | undefined, beat: Beat): boolean => !!prev && !!beat.world && prev.world === beat.world && prev.shot.kind === beat.shot.kind;

export interface FormatSpec {
  aspect: Aspect;
  /** Default target_duration_sec when a request names none. */
  targetSec: number;
  /** Narration budget: total words = wordsPerSec × target_duration_sec. */
  wordsPerSec: { min: number; max: number };
  beatWords: { min: number; max: number };
  /** Roughly how often a new visual lands (prompt craft note). */
  visualEverySec: number;
  hookMaxWords: number | null;
  chapterCards: boolean;
  headlineChars: number;
}

/**
 * Delivery formats. A format fixes the frame and the pacing rules; the visual style is the same.
 * Add a format as a row: the editorial rules and the screenplay prompt read this table.
 * The short is a classic 60 s Short: 130-160 words (Gemini TTS "Puck" reads ~2.9 words/s, so it
 * lands under a minute), one visual about every 2 s.
 */
export const FORMATS = {
  explainer: { aspect: '16:9', targetSec: 120, wordsPerSec: { min: 2.1, max: 2.8 }, beatWords: { min: 4, max: 32 }, visualEverySec: 4, hookMaxWords: null, chapterCards: true, headlineChars: 26 },
  short: { aspect: '9:16', targetSec: 60, wordsPerSec: { min: 130 / 60, max: 160 / 60 }, beatWords: { min: 3, max: 12 }, visualEverySec: 2, hookMaxWords: 12, chapterCards: false, headlineChars: 16 },
} as const satisfies Record<string, FormatSpec>;
export type Format = keyof typeof FORMATS;

/** Total narration words [min, max] a format allows for a target duration. */
export const wordBudget = (f: FormatSpec, sec: number): [number, number] => [Math.round(f.wordsPerSec.min * sec), Math.round(f.wordsPerSec.max * sec)];

export const BeatSheetSchema = z.object({
  video_id: z.string().min(1),
  format: z.enum(Object.keys(FORMATS) as [Format, ...Format[]]).default('explainer'),
  /** The Tone (register.ts): one per video; documentary is the default. */
  register: z.enum(REGISTER_IDS).default('documentary'),
  title: z.string().min(1).max(80),
  topic: z.string().min(1),
  target_duration_sec: z.number().int().min(30).max(900),
  beats: z.array(BeatSchema).min(3),
});
export type BeatSheet = z.infer<typeof BeatSheetSchema>;

// ── Phrase matching ─────────────────────────────────────────────────────────

/** Re-exported: shot phrases and rules match on the same tokens the aligner uses. */
export { tokenize };

/** Index of the first token of `phrase` inside `tokens` (contiguous match), or -1. */
export function findPhrase(tokens: readonly string[], phrase: string): number {
  const p = tokenize(phrase);
  if (p.length === 0) return -1;
  for (let i = 0; i + p.length <= tokens.length; i++) {
    if (p.every((t, j) => tokens[i + j] === t)) return i;
  }
  return -1;
}

/** Every `at`/`highlight` phrase a shot declares, so rules and timing walk one list. */
export function shotPhrases(shot: Shot): string[] {
  const byKind: { [K in ShotKind]: (s: Extract<Shot, { kind: K }>) => (string | undefined)[] } = {
    headline: (s) => [s.highlight],
    chapter: () => [],
    map: (s) => [...s.layers.map((l) => l.at), ...s.labels.map((l) => l.at), ...(s.pins ?? []).map((p) => p.at), s.circle?.at, s.arrow?.at, ...(s.armies ?? []).map((a) => a.at)],
    number: (s) => [s.at, s.compare?.at],
    pictogram: (s) => s.groups.map((g) => g.at),
    timeline: (s) => s.marks.map((m) => m.at),
    quote: () => [],
    line: (s) => [s.at],
    split: (s) => [s.at, ...s.parts.map((p) => p.at)],
    chain: (s) => s.nodes.map((n) => n.at),
    punch: (s) => s.words.map((w) => w.at),
    ranking: (s) => s.items.map((i) => i.at),
    versus: (s) => s.rows.map((r) => r.at),
    checklist: (s) => s.items.map((i) => i.at),
    chat: (s) => s.messages.map((m) => m.at),
  };
  return (byKind[shot.kind] as (s: Shot) => (string | undefined)[])(shot).filter((p): p is string => !!p);
}

/**
 * Shots whose cue phrases (shotPhrases, in declared order) must be spoken in that order: a
 * diagram builds in reading order (the tear before its parts, parts and chain links left→right
 * or top→bottom), and so do punch words, versus rows, checklist rows and chat messages. A
 * ranking is not here: its rows re-sort as items arrive, in whatever order they are spoken.
 * Add a kind here when its widget builds sequentially.
 */
const ORDERED_CUE_SHOTS: ReadonlySet<ShotKind> = new Set(['split', 'chain', 'punch', 'versus', 'checklist', 'chat']);

// ── Editorial rules (Vox style bible), as data ──────────────────────────────

export const BANNED_PHRASES = ['in this video', 'lets dive in', 'dive into', 'fascinating', 'journey', 'buckle up', 'stay tuned', 'tapestry', 'delve'] as const;
const DEICTIC = ['this', 'these', 'here', 'look', 'see', 'notice'] as const;

export interface RuleViolation {
  rule: string;
  beatId?: string;
  message: string;
}

/** `doc`: the rule as the screenplay prompt states it (rules the model cannot infer from the shot docs). */
type Rule = { rule: string; doc?: string; check: (sheet: BeatSheet) => Omit<RuleViolation, 'rule'>[] };

const wordCount = (s: string) => tokenize(s).length;
const perBeat = (fn: (b: Beat, i: number, all: Beat[]) => string | null) => (sheet: BeatSheet) =>
  sheet.beats.flatMap((b, i, all) => {
    const msg = fn(b, i, all);
    return msg ? [{ beatId: b.id, message: msg }] : [];
  });

type NumberShot = Extract<Shot, { kind: 'number' }>;
/** A number shot's figures (the main one, then its comparison), each with its own unit. */
const figuresOf = (s: NumberShot) => [s, ...(s.compare ? [{ ...s.compare, unit: s.compare.unit ?? s.unit }] : [])];

/**
 * A typed figure a shot puts on screen, with the phrase it lands on. `values`: what the narration
 * may say there (a versus row shows two); `required`: the phrase must be the spoken number.
 */
type Figure = { at: string; values: number[]; unit: NumberUnit; inflation?: { year: number; to: number }; required: boolean; zero?: boolean };
/** Every shot kind that shows typed figures, as one row (rules unit_sign and number_matches_speech walk it). */
const FIGURES: { [K in ShotKind]?: (s: Extract<Shot, { kind: K }>) => Figure[] } = {
  number: (s) => figuresOf(s).map((f) => ({ at: f.at, values: [f.value], unit: f.unit, inflation: f.inflation, required: true })),
  pictogram: (s) => s.groups.map((g) => ({ at: g.at, values: [g.count * (s.per?.value ?? 1)], unit: s.per?.unit ?? 'count', required: false })),
  ranking: (s) => s.items.map((i) => ({ at: i.at, values: [i.value], unit: s.unit, required: false })),
  // A versus draws no bars, so a side may have none of something (zero wars won).
  versus: (s) => s.rows.map((r) => ({ at: r.at, values: [r.left, r.right], unit: r.unit, required: false, zero: true })),
};
const figures = (shot: Shot): Figure[] => (FIGURES[shot.kind] as ((s: Shot) => Figure[]) | undefined)?.(shot) ?? [];

/**
 * A spoken number on the `at` phrase must be one of `shown` as the screen shows it (same
 * magnitude and rounding); null when it is. With `required`, `at` must sit on a spoken number at all.
 */
function speechMismatch(narration: string, at: string, shown: readonly number[], unit: NumberUnit, required: boolean): string | null {
  const start = findPhrase(tokenize(narration), at);
  if (start < 0) return null; // phrases_spoken reports it
  const end = start + tokenize(at).length;
  const said = speechUnits(narration.split(/\s+/)).filter((u) => u.value !== undefined && u.from < end && u.to > start);
  const screen = (v: number, target: number) => (unit === 'year' ? String(v) : figureParts(v, unit, target).main);
  if (said.some((u) => shown.some((v) => screen(u.value!, v) === screen(v, v)))) return null;
  const want = `say ${shown.map((v) => `"${spokenFigure(v, unit)}"`).join(' or ')}`;
  if (said.length === 0) return required ? `the figure lands on "${at}", which must be the spoken number (${want})` : null;
  return `"${at}" says ${said.map((u) => u.value).join(' / ')} but the screen shows ${shown.map((v) => screen(v, v)).join(' / ')} ${UNITS[unit].spoken[1]}; ${want}`;
}

/** Every editorial rule is one row; add a rule here, never as a branch in the agent. */
export const BEAT_SHEET_RULES: readonly Rule[] = [
  {
    rule: 'word_budget',
    check: (s) => {
      const words = s.beats.reduce((n, b) => n + wordCount(b.narration), 0);
      const [lo, hi] = wordBudget(resolveStyle(FORMATS[s.format], s.register).format, s.target_duration_sec);
      return words < lo || words > hi ? [{ message: `narration has ${words} words; a ${s.target_duration_sec}s ${s.format} needs ${lo}-${hi}` }] : [];
    },
  },
  {
    rule: 'beat_length',
    check: (s) => {
      const { min, max } = FORMATS[s.format].beatWords;
      return perBeat((b) => {
        const n = wordCount(b.narration);
        return b.shot.kind !== 'chapter' && (n < min || n > max) ? `${n} words; one idea per beat is ${min}-${max} words in a ${s.format} (split or merge)` : null;
      })(s);
    },
  },
  {
    rule: 'hook_first',
    check: (s) => {
      const limit = FORMATS[s.format].hookMaxWords;
      if (limit === null) return [];
      const first = s.beats[0]!;
      const n = wordCount(first.narration);
      return n > limit || first.shot.kind !== 'headline'
        ? [{ beatId: first.id, message: `a ${s.format} opens with a headline hook of at most ${limit} words (~5 s) that lands the punchline; got a ${n}-word ${first.shot.kind} beat` }]
        : [];
    },
  },
  {
    rule: 'format_chapters',
    check: (s) => (FORMATS[s.format].chapterCards ? [] : perBeat((b) => (b.shot.kind === 'chapter' ? `no chapter cards in a ${s.format}` : null))(s)),
  },
  {
    rule: 'headline_fit',
    check: (s) =>
      perBeat((b) => {
        const max = FORMATS[s.format].headlineChars;
        const long = b.shot.kind === 'headline' ? b.shot.lines.find((l) => l.length > max) : undefined;
        return long ? `headline line "${long}" is over ${max} characters for a ${s.format}` : null;
      })(s),
  },
  {
    rule: 'unique_ids',
    check: perBeat((b, i, all) => (all.findIndex((x) => x.id === b.id) !== i ? `duplicate beat id "${b.id}"` : null)),
  },
  {
    rule: 'phrases_spoken',
    check: (s) =>
      s.beats.flatMap((b) => {
        const toks = tokenize(b.narration);
        return shotPhrases(b.shot)
          .filter((p) => findPhrase(toks, p) < 0)
          .map((p) => ({ beatId: b.id, message: `cue phrase "${p}" is not spoken verbatim in this beat's narration` }));
      }),
  },
  {
    rule: 'highlight_visible',
    check: perBeat((b) => {
      if (b.shot.kind === 'headline' && findPhrase(tokenize(b.shot.lines.join(' ')), b.shot.highlight) < 0)
        return `headline highlight "${b.shot.highlight}" must appear in the headline lines`;
      if (b.shot.kind === 'quote' && findPhrase(tokenize(b.shot.text), b.shot.highlight) < 0)
        return `quote highlight "${b.shot.highlight}" must appear in the quote text`;
      return null;
    }),
  },
  {
    rule: 'quote_spoken',
    check: perBeat((b) =>
      b.shot.kind === 'quote' && findPhrase(tokenize(b.narration), b.shot.highlight) < 0
        ? `the narration must read the highlighted words "${b.shot.highlight}" aloud`
        : null,
    ),
  },
  {
    rule: 'banned_phrases',
    check: perBeat((b) => {
      const toks = tokenize(b.narration);
      const hit = BANNED_PHRASES.find((p) => findPhrase(toks, p) >= 0);
      return hit ? `banned filler phrase "${hit}"` : null;
    }),
  },
  {
    rule: 'act_order',
    check: perBeat((b, i, all) =>
      i > 0 && ACTS.indexOf(b.act) < ACTS.indexOf(all[i - 1]!.act) ? `act "${b.act}" comes after "${all[i - 1]!.act}"; acts must move forward` : null,
    ),
  },
  {
    rule: 'cold_open_first',
    check: (s) => (s.beats[0]!.act !== 'cold_open' || s.beats[0]!.shot.kind === 'chapter' ? [{ beatId: s.beats[0]!.id, message: 'the video must open cold on a concrete anomaly (act cold_open, not a chapter card)' }] : []),
  },
  {
    rule: 'chapter_cards',
    check: perBeat((b, i, all) => {
      if (b.shot.kind !== 'chapter') return null;
      if (all[i - 1]?.shot.kind === 'chapter') return 'two chapter cards in a row';
      if (all.some((x, j) => j < i && x.act === b.act && x.shot.kind === 'chapter')) return `act "${b.act}" already has a chapter card`;
      return null;
    }),
  },
  {
    rule: 'pictogram_fit',
    check: perBeat((b) =>
      b.shot.kind === 'pictogram' && b.shot.groups.reduce((n, g) => n + g.count, 0) > b.shot.total ? 'pictogram groups add up to more than total' : null,
    ),
  },
  {
    rule: 'spoken_form',
    doc: `narration is read aloud: write numbers and units as words ("two point five trillion dollars", "minus forty degrees Celsius"), never the symbols ${WRITTEN_ONLY.symbols.join(' ')} or the abbreviations ${WRITTEN_ONLY.abbreviations.join(', ')}. Plain digits (years) are fine.`,
    check: perBeat((b) => {
      const symbol = [...b.narration].find((c) => WRITTEN_ONLY.symbols.includes(c));
      const abbr = tokenize(b.narration).find((t) => WRITTEN_ONLY.abbreviations.includes(t.replace(/^\d+/, '')));
      const hit = symbol ?? abbr;
      return hit ? `narration writes "${hit}"; the voice reads words, so spell numbers and units out` : null;
    }),
  },
  {
    rule: 'unit_sign',
    check: (s) =>
      s.beats.flatMap((b) =>
        figures(b.shot).flatMap((f) =>
          f.values
            .filter((v) => (v < 0 || (v === 0 && !f.zero)) && !UNITS[f.unit].signed)
            .map((v) => ({ beatId: b.id, message: `${f.unit} figures are positive (got ${v}); only ${NUMBER_UNITS.filter((u) => UNITS[u].signed).join(', ')} may be zero or negative` })),
        ),
      ),
  },
  {
    rule: 'inflation_known',
    check: (s) =>
      s.beats.flatMap((b) =>
        figures(b.shot).flatMap((f) => {
          const problem = f.inflation && inflationProblem(f.unit, f.inflation.year, f.inflation.to);
          return problem ? [{ beatId: b.id, message: problem }] : [];
        }),
      ),
  },
  {
    rule: 'number_matches_speech',
    doc: 'a number shot\'s `at` (and its compare `at`) sits on the spoken number, and that number equals the figure as the screen shows it (same magnitude and rounding; for an `inflation` figure, the adjusted amount the violation message gives you). A pictogram group, ranking item or versus row whose `at` is a spoken number must say what the screen shows there (count × per; the item\'s value; one of the row\'s two values).',
    check: (s) =>
      s.beats.flatMap((b) =>
        figures(b.shot)
          .filter((f) => !(f.inflation && inflationProblem(f.unit, f.inflation.year, f.inflation.to)))
          .map((f) => speechMismatch(b.narration, f.at, f.values.map((value) => shownValue({ value, unit: f.unit, inflation: f.inflation })), f.unit, f.required))
          .filter((m): m is string => !!m)
          .map((message) => ({ beatId: b.id, message })),
      ),
  },
  {
    rule: 'ranking_unit',
    doc: 'a ranking draws bars from zero: its unit is a positive quantity that counts (no year, one_in or temperature).',
    check: perBeat((b) => (b.shot.kind === 'ranking' && (!UNITS[b.shot.unit].count || UNITS[b.shot.unit].signed) ? `a ranking cannot rank in ${b.shot.unit}: its bars grow from zero` : null)),
  },
  {
    rule: 'ranking_values',
    doc: 'ranking items show one shared scale (the largest item\'s magnitude): every item must read as a distinct, non-zero figure on it; code ranks them, so never order items by rank yourself.',
    check: perBeat((b) => {
      if (b.shot.kind !== 'ranking') return null;
      const { unit, items } = b.shot;
      const shown = items.map((i) => rankFigure(i.value, unit, items.map((x) => x.value)));
      const zero = items.find((_, k) => !/[1-9]/.test(shown[k]!));
      const twin = items.find((_, k) => shown.indexOf(shown[k]!) !== k);
      if (zero) return `"${zero.label}" shows as ${shown[items.indexOf(zero)]} next to the largest item; rank things of a similar size`;
      return twin ? `"${twin.label}" shows the same figure (${shown[items.indexOf(twin)]}) as another item; ranks need distinct values` : null;
    }),
  },
  {
    rule: 'versus_fit',
    check: (s) => {
      const L = LAYOUTS[FORMATS[s.format].aspect];
      return perBeat((b) => {
        if (b.shot.kind !== 'versus') return null;
        const small = versusLayout(L, b.shot.rows).rows.findIndex((r) => r.value.px < L.readable);
        return small < 0 ? null : `versus row "${b.shot.rows[small]!.label}" is too wide for a ${s.format} (label plus value); shorten the label or use a smaller unit`;
      })(s);
    },
  },
  {
    rule: 'compare_same_dimension',
    doc: 'a comparison measures the same thing as its main figure (square miles may compare with square kilometers; dollars never with people, euros never with dollars).',
    check: perBeat((b) => {
      if (b.shot.kind !== 'number' || !b.shot.compare?.unit) return null;
      const [a, c] = [UNITS[b.shot.unit], UNITS[b.shot.compare.unit]];
      const ok = b.shot.unit === b.shot.compare.unit || (a.dim === c.dim && a.toBase !== null && c.toBase !== null);
      return ok ? null : `${b.shot.compare.unit} (${c.dim}) cannot be compared with ${b.shot.unit} (${a.dim})`;
    }),
  },
  {
    rule: 'icon_families',
    doc: `a pictogram draws one icon family; a video uses at most ${MAX_ICON_FAMILIES}.`,
    check: (s) => {
      const families = s.beats.map((b) => new Set(b.shot.kind === 'pictogram' ? [b.shot.icon, ...b.shot.groups.map((g) => g.icon)].filter((i): i is IconId => !!i).map((i) => ICONS[i].family) : []));
      const all = new Set(families.flatMap((f) => [...f]));
      return [
        ...s.beats.flatMap((b, i) => (families[i]!.size > 1 ? [{ beatId: b.id, message: `one pictogram mixes icon families (${[...families[i]!].join(', ')}); pick icons from one` }] : [])),
        ...(all.size > MAX_ICON_FAMILIES ? [{ message: `the video uses ${all.size} icon families; at most ${MAX_ICON_FAMILIES}` }] : []),
      ];
    },
  },
  {
    rule: 'timeline_range',
    check: perBeat(({ shot: s }) =>
      s.kind === 'timeline' && (s.from >= s.to || s.marks.some((m) => m.year < s.from || m.year > s.to))
        ? 'timeline needs from < to and every mark inside the range'
        : null,
    ),
  },
  {
    rule: 'timeline_fit',
    check: perBeat(({ shot: s }) => {
      if (s.kind !== 'timeline' || s.marks.length < 2) return null;
      const years = s.marks.map((m) => m.year);
      const fill = (Math.max(...years) - Math.min(...years)) / (s.to - s.from);
      return fill < TIMELINE_MIN_FILL ? `marks span ${Math.round(fill * 100)}% of the ruler; set from/to close around the marks (≥${TIMELINE_MIN_FILL * 100}%)` : null;
    }),
  },
  {
    rule: 'line_alert_range',
    check: perBeat((b) => (b.shot.kind === 'line' && b.shot.alertFrom !== undefined && b.shot.alertFrom >= b.shot.points.length ? 'alertFrom must index a point' : null)),
  },
  {
    rule: 'cues_in_order',
    check: perBeat((b) => {
      if (!ORDERED_CUE_SHOTS.has(b.shot.kind)) return null;
      const phrases = shotPhrases(b.shot);
      const idx = phrases.map((p) => findPhrase(tokenize(b.narration), p));
      const back = idx.findIndex((x, i) => i > 0 && x < idx[i - 1]!);
      return back > 0 ? `"${phrases[back]}" is spoken before "${phrases[back - 1]}"; a ${b.shot.kind} builds in the order its parts are spoken` : null;
    }),
  },
  {
    rule: 'chain_grows',
    check: perBeat((b, i, all) => {
      const [prev, shot] = [all[i - 1]?.shot, b.shot];
      if (shot.kind !== 'chain' || prev?.kind !== 'chain' || !continues(all[i - 1], b)) return null;
      const before = prev.nodes.map((n) => n.label);
      return before.every((l, j) => shot.nodes[j]?.label === l) ? null : `a chain continuing world "${b.world}" must start with the previous chain's nodes (${before.join(', ')}) in order, then add new ones`;
    }),
  },
  {
    rule: 'point_at_picture',
    check: (s) => {
      const minutes = Math.max(1, s.target_duration_sec / 60);
      const hits = s.beats.filter((b) => DEICTIC.some((d) => tokenize(b.narration).includes(d))).length;
      return hits < Math.floor(minutes) ? [{ message: `narration points at the picture ("this map", "these squares", "here") only ${hits} times; Vox does ~1-2 per minute` }] : [];
    },
  },
];

export type BeatSheetCheck = { ok: true; sheet: BeatSheet } | { ok: false; violations: RuleViolation[] };

/** Boundary validator: zod shape first, then every editorial rule. Fails loud with all violations. */
export function checkBeatSheet(raw: unknown): BeatSheetCheck {
  const parsed = BeatSheetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      violations: parsed.error.issues.map((i) => ({ rule: 'schema', message: `${i.path.join('.')}: ${i.message}` })),
    };
  }
  // Map references become canonical ids first, so every rule sees resolved places.
  const { sheet, violations: refs } = resolveSheetRefs(parsed.data);
  const violations = [...refs, ...BEAT_SHEET_RULES.flatMap((r) => r.check(sheet).map((v) => ({ rule: r.rule, ...v })))];
  return violations.length > 0 ? { ok: false, violations } : { ok: true, sheet };
}

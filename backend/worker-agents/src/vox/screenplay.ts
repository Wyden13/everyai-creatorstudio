/**
 * Vox Screenplay agent: topic → validated Beat Sheet.
 *
 * The prompt's catalogs (acts, shots, views, places, layers, units, icons, tones, banned phrases, number rules) are
 * GENERATED from the same tables the validator enforces, so prompt and rules cannot drift.
 * Every violation goes back to the model verbatim; after MAX_SCREENPLAY_ATTEMPTS it fails loud.
 */
import { parseLlmJson, type LlmCall, type LlmModel } from '../providers';
import {
  ACTS,
  BANNED_PHRASES,
  BEAT_SHEET_RULES,
  BETTER,
  CHARS,
  COUNTS,
  PUNCH_FIELDS,
  TIMELINE_MIN_FILL,
  BeatSchema,
  FORMATS,
  checkBeatSheet,
  wordBudget,
  type Beat,
  type BeatSheet,
  type Format,
  type FormatSpec,
  type ShotKind,
  type RuleViolation,
} from './beat-sheet';
import { NUMBER_UNITS, UNITS, formatFigure, spokenFigure, type NumberUnit } from './format';
import { ICONS, ICON_FAMILIES } from './icon-manifest';
import { INFLATION } from './inflation';
import { ANCIENT_LAYERS, HIST_SNAPSHOTS, MAP_VIEWS } from './geo-manifest';
import { knownPlaces, resolveSheetRefs, tier1Places } from './places';
import { registerRules, resolveStyle, type Register } from './register';
import { COLOR } from './tokens';

export const MAX_SCREENPLAY_ATTEMPTS = 3;

/** What each act is for; also the order acts must appear in. */
const ACT_PURPOSE: Record<(typeof ACTS)[number], string> = {
  cold_open: 'a concrete, dated, placed anomaly. No throat-clearing. The first line is a fact you can picture.',
  stakes: 'name the thing and say why it matters now.',
  question: 'an explicit pivot question ("So how did…?", "So what is this?").',
  mechanism: 'teach the minimum model, one term at a time, with one recurring visual system.',
  history: 'the people, dates and documents that drove it, in order.',
  turn: 'the complication: a reversal, an irony, a crisis.',
  payoff: 'a run of comparisons, one number per beat.',
  ending: 'return to the opening image and land an honest, quotable line. Never summarise.',
};

const C = CHARS;
const range = ([min, max]: readonly [number, number]) => `${min}-${max}`;
const SHOT_DOCS: Record<ShotKind, string> = {
  headline: `{kind:"headline", lines:[≤2 strings ≤${C.headlineLine} chars], highlight:"words in lines AND spoken"} — kinetic type on paper; yellow highlighter wipes behind \`highlight\` as it is spoken. Use for the cold open, the question, the ending.`,
  chapter: `{kind:"chapter", title:"≤${C.title} chars"} — full-frame italic serif card. At most one per act, never first, never two in a row. Narration can continue over it.`,
  map: `{kind:"map", view, year?, title?:{text ≤${C.title}, sub? ≤${C.sub}}, layers?:[{layer,tone,at?}] (≤3), labels?:[{place,at?}] (≤4), pins?:[{place,at}] (≤${COUNTS.pins[1]}), circle?:{place,at}, arrow?:{from,to,at}, armies?:[{from,to,tone,at}] (≤${COUNTS.armies[1]})} — real cartography, full-bleed, anywhere in the world (see MAPS). A layer fills a country, state or polity in its tone, bleeding in when \`at\` is spoken; labels/circles/arrows land on their phrase; a pin drops onto its place on \`at\` and its name lands with it (a place is labelled or pinned, never both). \`arrow\` is a thin pen pointer; \`armies\` are thick tone arrows that advance along a route (a campaign, an invasion, a migration). Code frames the camera so every referenced place is on screen.`,
  number: `{kind:"number", value, unit, label ≤${C.label}, at, inflation?:{year,to}, compare?:{value, unit?, label ≤${C.label}, at, inflation?}} — one big figure that counts up on \`at\`; optional second figure for the comparison. \`inflation\`: value is money in \`year\` prices and the screen shows it in \`to\` prices with "in <to> <currency>" under it; code computes the adjusted amount (same currency only: ${Object.entries(INFLATION).map(([u, t]) => `${u} ${t!.first}-${t!.last}`).join(', ')}).`,
  pictogram: `{kind:"pictogram", title ≤${C.title}, total (4-100), icon?, per?:{value,unit}, groups:[{count,label ≤${C.groupLabel},tone,at,icon?}] (≤3)} — a grid of \`total\` icons (squares when no icon) that fly in, then each group's cells regroup and take its tone on its phrase. \`per\` says what one cell stands for ("1 icon = 1,000 people"; a group then shows count × per). Use when a quantity is a share of a whole.`,
  timeline: `{kind:"timeline", from, to, marks:[{year,label ≤${C.markLabel},at?}] (≤6)} — a ruler; marks drop on their phrase. Years are integers, negative = BCE, no year 0. With 2+ marks, from/to hug the marks: the marks span ≥${TIMELINE_MIN_FILL * 100}% of the ruler.`,
  quote: `{kind:"quote", text ≤${C.quote}, by ≤${C.by}, highlight} — ONLY a real, well-attested quotation with its attribution; the narration must read the highlighted words aloud.`,
  line: `{kind:"line", title ≤${C.title}, points:[{x:"label ≤${C.pointX}",y:number}] (3-24), alertFrom?:integer point index, at} — a line that draws itself on \`at\`; segment from point alertFrom onward turns red.`,
  split: `{kind:"split", whole ≤${C.title}, at, parts:[{label ≤${C.part}, tone, at?}] (${range(COUNTS.splitParts)})} — an animated diagram: the whole (named in the title) tears on \`at\` and its parts pull apart, each taking its tone and label on its own phrase. Use when one thing divides (an empire in two, a church schism, a country partitioned). Speak \`at\` first, then the parts in order.`,
  chain: `{kind:"chain", title? ≤${C.title}, nodes:[{label ≤${C.node}, sub? ≤${C.nodeSub}, tone?, at?}] (${range(COUNTS.chainNodes)})} — an animated diagram: labelled nodes joined by arrows, each link drawing to its node on its phrase (a succession of rulers, a family line, cause → effect). Every arrow must mean "then" or "leads to": never use a chain for a plain list of items. Speak the nodes in order. To grow a chain across beats, give the beats one world and repeat the previous nodes first, then add new ones.`,
  punch: `{kind:"punch", words:[{text ≤${C.punchWord} chars, ONE word, at}] (${range(COUNTS.punchWords)}), field?: ${PUNCH_FIELDS.join(' | ')}} — one to three huge words on a full-bleed field, each slammed in on its phrase (the tone sets how it lands). For a punchline, a verdict, a one-word reaction. Speak the words in order.`,
  ranking: `{kind:"ranking", title ≤${C.title}, unit, better?: "higher" | "lower", items:[{label ≤${C.rankLabel}, value, at}] (${range(COUNTS.rankItems)})} — a leaderboard: each item's bar grows and its rank lands on its phrase, and the rows re-sort as items arrive. Code ranks the items by value (\`better\`: which end is #1, default higher) and highlights #1, so list them in the order they are spoken, never in rank order. A countdown speaks them from last to first. All items share one unit and one scale.`,
  versus: `{kind:"versus", sides:[{label ≤${C.side}, tone}, {label ≤${C.side}, tone}], rows:[{label ≤${C.rowLabel}, unit, left, right, better: ${BETTER.map((b) => `"${b}"`).join(' | ')}, at}] (${range(COUNTS.versusRows)})} — X vs Y: the two names land, VS slams between them, then each row's two values count up on its phrase. Code circles each row's winner from the values (\`better\`: does the higher or the lower value win; "none" for a plain fact) and marks the side that wins more rows, so never claim a winner the numbers do not give. Speak the rows in order.`,
  checklist: `{kind:"checklist", title? ≤${C.title}, items:[{text ≤${C.item}, mark: "yes" | "no" | "maybe", at}] (${range(COUNTS.checkItems)})} — myth vs fact, a verdict list: each item slides in on its phrase and the pen ticks it (yes), crosses and strikes it through (no) or squiggles it (maybe). Speak the items in order.`,
  chat: `{kind:"chat", people:{a ≤${C.name}, b ≤${C.name}}, messages:[{from: "a" | "b", text ≤${C.message}, at}] (${range(COUNTS.chatMessages)})} — a generic two-person text chat (no real app): typing dots, then each bubble pops in on its phrase and the chat scrolls as it fills. Only "the gist" of an exchange, framed so in the narration; never a verbatim quote of a real person. Speak the messages in order.`,
};

const list = (items: readonly string[]) => items.join(', ');
/** A figure each unit's catalog line shows: big enough for its magnitude words, negative where signed. */
const UNIT_EXAMPLE = (u: NumberUnit) => (u === 'year' ? 1453 : UNITS[u].signed ? -40 : UNITS[u].scales.length > 0 ? 2_500_000 : u === 'one_in' ? 4 : 40);

/** The cached, byte-stable style bible + catalogs (prompt-cache friendly). */
export const VOX_SCREENPLAY_BIBLE = `
VOX EXPLAINER — SCRIPT BIBLE
You write narration TO the picture, beat by beat. One beat = one idea = one shot.

ACTS (must appear in this order; skip any that do not fit):
${ACTS.map((a) => `- ${a}: ${ACT_PURPOSE[a]}`).join('\n')}

SENTENCES
- Word budget, beat length, hook and chapter-card rules depend on the format (given with each request as format_rules and narration_words).
- Conversational: contractions, short clauses, average ≤16 words per sentence, many sentences ≤8 words.
- Point at the picture at least once a minute: "this map", "these squares", "look at", "here".
- Numbers: one per beat, spoken as words, always with a comparison or denominator. Hedge estimates ("about", "roughly").
- Put dates and places at the start of sentences ("In 49 BCE, …"); each spoken date/place deserves a visual.
- Never invent quotes, numbers or events.
- Banned phrases: ${list(BANNED_PHRASES)}.

VISUAL GRAMMAR
- Every "at" / "highlight" phrase (≤${C.phrase} chars) is copied VERBATIM from that beat's narration; the element appears the moment it is spoken.
- Beats that continue the same map story share a "world" id: the camera glides between views instead of cutting. Repeat a layer/label (same id and tone) to keep it on screen across beats; change its tone to recolour it.
- Vary shots: never more than 3 beats of the same kind in a row.
- No act labels, chips or captions anywhere — chapters are full-frame chapter cards only.

SHOTS
${Object.entries(SHOT_DOCS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

MAPS
- views: modern ${list(Object.keys(MAP_VIEWS).filter((v) => !('ancient' in MAP_VIEWS[v as keyof typeof MAP_VIEWS])))}, or any country / state / province ("FR", "US-CA") to frame it. On a vertical (9:16) frame "world" is cropped about its centre: use americas, europe_africa or asia_pacific.
- ancient views (the Roman-era Mediterranean, era names like Londinium): ${list(Object.keys(MAP_VIEWS).filter((v) => 'ancient' in MAP_VIEWS[v as keyof typeof MAP_VIEWS]))}; they fill only ${Object.entries(ANCIENT_LAYERS).map(([id, l]) => `${id} (${l.label})`).join(', ')}. A world never mixes ancient and modern views.
- places, fills and framed views are written as names, not coordinates: "Paris", "Paris, FR", "Springfield, US-IL", "Georgia (US state)", an ISO code ("FR", "US-CA") or an id from known_places. Code checks each against a world gazetteer (every country, every state/province, ~7,300 cities, battle sites and landmarks, historical polities) and returns unknown or ambiguous names with the closest candidates; use the id it gives.
- modern maps fill countries and states/provinces. A map with "year" draws that year's historical borders instead (approximate, from the latest of these years at or before it: ${HIST_SNAPSHOTS.map((y) => (y < 0 ? `${-y} BCE` : y)).join(', ')}); it fills only polities alive then ("Ottoman Empire", "Kingdom of Italy"), never a modern country, and its places show their names of that time (Constantinople, Edo).
- famous places: ${tier1Places().join(', ')}.

CATALOG (use ONLY these ids)
- units (id: screen → spoken): ${NUMBER_UNITS.map((u) => `${u}: ${formatFigure(UNIT_EXAMPLE(u), u)} → "${spokenFigure(UNIT_EXAMPLE(u), u)}"`).join('; ')} ("year" and "one_in" swap instead of counting; only ${list(NUMBER_UNITS.filter((u) => UNITS[u].signed))} may be zero or negative)
- icons (${Object.entries(ICON_FAMILIES).map(([f, x]) => `${f}: ${x.name}`).join('; ')}): ${Object.keys(ICON_FAMILIES).map((f) => `${f}: ${list(Object.keys(ICONS).filter((id) => ICONS[id as keyof typeof ICONS].family === f))}`).join(' | ')}
- tones: red = the subject / alarm, teal = the other side, muted = gone or context, ochre = secondary, ink = neutral (${list(Object.keys(COLOR.tone))})

All "≤N" are hard character limits.
NUMBERS AND UNITS
${BEAT_SHEET_RULES.flatMap((r) => (r.doc ? [`- ${r.rule}: ${r.doc}`] : [])).join('\n')}

VALIDATED RULES: ${list(BEAT_SHEET_RULES.map((r) => r.rule))}. Violations are returned to you verbatim; fix every one.
`.trim();

/** Total narration words for one minute of target_duration_sec, as the prompt states it. */
const perMinute = (f: FormatSpec) => wordBudget(f, 60).join('-');

/** Format craft notes; the numbers come from FORMATS so prompt and validator agree. */
const FORMAT_GUIDE: Record<Format, (f: FormatSpec) => string[]> = {
  explainer: (f) => [
    `Long-form explainer, ${f.aspect}. Acts flow in order; one chapter card per act at most.`,
    `Pace: ${perMinute(f)} narration words per minute of target_duration_sec.`,
    `Each beat ${f.beatWords.min}-${f.beatWords.max} words (aim 10-20); a new visual idea every ~${f.visualEverySec} seconds.`,
    `Headline lines at most ${f.headlineChars} characters.`,
  ],
  short: (f) => [
    `YouTube Short, vertical ${f.aspect}, watched on a phone. Retention is everything.`,
    `A ${f.targetSec}-second Short is ${wordBudget(f, f.targetSec).join('-')} narration words in total (${perMinute(f)} per minute of target_duration_sec); the voice reads fast.`,
    `Beat 1 IS the hook: at most ${f.hookMaxWords} words (~5 seconds), a headline shot, stating the single most surprising TRUE claim and landing its punchline in the same breath. No setup, no "did you know", no greeting, no unanswered question.`,
    'Beat 2-3 open a loop (a tension or promise) that the ending closes.',
    `Every beat ${f.beatWords.min}-${f.beatWords.max} words: a new visual about every ${f.visualEverySec} seconds; never two of the same shot kind in a row.`,
    'Lots of maps, numbers and timelines: show, do not tell.',
    `No chapter cards. Headline lines at most ${f.headlineChars} characters (huge type on a phone).`,
    'End on a short, punchy line that echoes the hook so the replay loops naturally.',
    'Punchy is never a licence to exaggerate: every claim must be historically defensible.',
  ],
};

const OUTPUT_SHAPE = {
  video_id: 'string',
  format: 'explainer | short',
  title: 'string ≤80',
  topic: 'string',
  target_duration_sec: 120,
  beats: [{ id: 'b01', act: 'cold_open', narration: '…', world: 'optional id', shot: { kind: 'headline', lines: ['…'], highlight: '…' } }],
};

const describe = (v: readonly RuleViolation[]) => v.map((x) => `- [${x.rule}]${x.beatId ? ` ${x.beatId}` : ''}: ${x.message}`).join('\n');

export const SCREENPLAY_SYSTEM_PROMPT = 'You are the scriptwriter and art director of a Vox-style explainer. Return ONLY one valid JSON object. No markdown fences, no prose.';

/** Thrown when attempts run out; carries the last attempt so a later run can resume from it. */
export class ScreenplayRejected extends Error {
  constructor(message: string, readonly previous: unknown) {
    super(message);
  }
}

/** A previous attempt to continue from, and why it was rejected (validator, audit or a status flag). */
export interface ScreenplayResume {
  previous: unknown;
  feedback: string;
}

/** Asks the model, validates, and feeds every violation back until the sheet passes or attempts run out. */
async function untilValid<T>(
  llm: LlmCall,
  model: LlmModel,
  task: Record<string, unknown>,
  accept: (raw: unknown) => { ok: true; value: T } | { ok: false; violations: RuleViolation[] },
  resume?: ScreenplayResume,
): Promise<T> {
  // A retry edits the previous sheet instead of rewriting it, so fixes converge rather than
  // trading old violations for new ones.
  let feedback = resume?.feedback;
  let previous = resume?.previous;
  for (let attempt = 1; attempt <= MAX_SCREENPLAY_ATTEMPTS; attempt++) {
    const { text: raw } = await llm({
      nodeKind: 'screenplay',
      ...model,
      cachedContext: VOX_SCREENPLAY_BIBLE,
      systemPrompt: SCREENPLAY_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(
        previous === undefined
          ? { ...task, previous_attempt_violations: feedback }
          : { ...task, previous_attempt: previous, previous_attempt_violations: feedback, instruction: 'Return previous_attempt with ONLY these violations fixed; change nothing else.' },
      ),
    });
    let parsed: unknown;
    try {
      parsed = parseLlmJson(raw);
    } catch (e) {
      feedback = `Invalid JSON: ${(e as Error).message}`;
      continue;
    }
    previous = parsed;
    const result = accept(parsed);
    if (result.ok) return result.value;
    feedback = describe(result.violations);
  }
  throw new ScreenplayRejected(`Vox screenplay failed after ${MAX_SCREENPLAY_ATTEMPTS} attempts:\n${feedback}`, previous);
}

export function runVoxScreenplayAgent(opts: {
  videoId: string;
  format: Format;
  topic: string;
  targetDurationSec: number;
  /** Research notes / sources the script must stay faithful to. */
  research?: string;
  /** The Tone; documentary (default) sends no register block. */
  register?: Register;
  model: LlmModel;
  llm: LlmCall;
  resume?: ScreenplayResume;
}): Promise<BeatSheet> {
  const register = opts.register ?? 'documentary';
  const style = resolveStyle(FORMATS[opts.format], register);
  const rules = registerRules(style);
  const known = knownPlaces(`${opts.topic}\n${opts.research ?? ''}`);
  return untilValid(
    opts.llm,
    opts.model,
    {
      task: 'Write the beat sheet for this video.',
      video_id: opts.videoId,
      format: opts.format,
      format_rules: FORMAT_GUIDE[opts.format](style.format),
      // The register block rides in the request, after the cached bible, so the cache prefix never changes with the tone.
      ...(rules && { register_rules: rules }),
      topic: opts.topic,
      target_duration_sec: opts.targetDurationSec,
      narration_words: wordBudget(style.format, opts.targetDurationSec).join('-'),
      research: opts.research,
      // Retrieval pre-pass: the places the topic and research name, already resolved, so the model rarely guesses.
      ...(known.length > 0 && { known_places: known }),
      required_shape: OUTPUT_SHAPE,
    },
    (raw) => {
      // The register is the caller's choice, not the model's: code stamps it before validating.
      const r = checkBeatSheet(raw !== null && typeof raw === 'object' ? { ...raw, register } : raw);
      if (!r.ok) return r;
      return r.sheet.format === opts.format ? { ok: true, value: r.sheet } : { ok: false, violations: [{ rule: 'format', message: `format must be "${opts.format}"` }] };
    },
    opts.resume,
  );
}

/**
 * Scoped repair: rewrites ONE beat's shot to fix layout-audit violations, then re-validates the
 * whole sheet. Narration is locked (the audio already exists); other beats are never touched.
 */
const violationsOf = (sheet: BeatSheet): RuleViolation[] => {
  const r = checkBeatSheet(sheet);
  return r.ok ? [] : r.violations;
};
const violationKey = (v: RuleViolation) => `${v.rule}|${v.beatId ?? ''}|${v.message}`;

export function repairVoxBeat(opts: {
  sheet: BeatSheet;
  beatId: string;
  problems: readonly string[];
  model: LlmModel;
  llm: LlmCall;
}): Promise<BeatSheet> {
  const index = opts.sheet.beats.findIndex((b) => b.id === opts.beatId);
  if (index < 0) throw new Error(`repair: unknown beat ${opts.beatId}`);
  const before = new Set(violationsOf(opts.sheet).map(violationKey));
  return untilValid(
    opts.llm,
    opts.model,
    {
      task: 'The rendered frames of this beat failed the layout audit. Return ONLY the corrected beat object (same id, act and narration). The narration is LOCKED (already voiced): fix it by changing the shot (fewer labels, shorter text, a different view or shot kind).',
      beat: opts.sheet.beats[index],
      previous_beat: opts.sheet.beats[index - 1],
      next_beat: opts.sheet.beats[index + 1],
      audit_failures: opts.problems,
    },
    (raw) => {
      const beat = BeatSchema.safeParse(raw);
      if (!beat.success) return { ok: false, violations: beat.error.issues.map((i) => ({ rule: 'schema', message: `${i.path.join('.')}: ${i.message}` })) };
      const original = opts.sheet.beats[index]!;
      if (beat.data.narration !== original.narration) {
        return { ok: false, violations: [{ rule: 'narration_locked', beatId: opts.beatId, message: 'narration was already voiced; return it unchanged and fix the shot instead' }] };
      }
      const fixed: Beat = { ...beat.data, id: opts.beatId, act: original.act };
      if (JSON.stringify(fixed.shot) === JSON.stringify(original.shot)) {
        return { ok: false, violations: [{ rule: 'repair_unchanged', beatId: opts.beatId, message: 'the shot is unchanged, so it would fail the audit again; change the shot to fix the audit failures' }] };
      }
      const candidate: BeatSheet = { ...opts.sheet, beats: opts.sheet.beats.map((b, i) => (i === index ? fixed : b)) };
      // Repair owns one beat: it must leave that beat clean and add no new violation anywhere, but
      // problems other beats already had (e.g. a rule added after the sheet was written) are not its job.
      const blocking = violationsOf(candidate).filter((v) => v.beatId === opts.beatId || !before.has(violationKey(v)));
      // The repaired beat's map names become canonical ids, like every checked beat.
      return blocking.length === 0 ? { ok: true, value: resolveSheetRefs(candidate).sheet } : { ok: false, violations: blocking };
    },
  );
}

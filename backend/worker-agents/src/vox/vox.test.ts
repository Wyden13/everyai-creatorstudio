import { describe, expect, test } from 'bun:test';
import type { WordTimestamp } from '../providers';
import { MOTION_PROBE, auditFrame, auditMotion, frameChange, type AuditCheck, type AuditedText, type MotionSample } from './audit';
import { CHARS, COUNTS, FORMATS, ShotSchema, checkBeatSheet, findPhrase, shotPhrases, tokenize, wordBudget, type BeatSheet, type Format, type Shot } from './beat-sheet';
import { CHAIN, GLYPH_EM, SPLIT, chainLayout, splitLayout } from './diagram';
import { chatLayout, checklistLayout, rankOrder, rankSlots, rankingLayout, rowWinner, versusLayout, versusVerdict } from './rows';
import { clone, FIXTURE, scripted, SHOT_TOURS, toShort, voice } from './fixtures';
import { formatFigure } from './format';
import { produceVoxVideo } from './harness';
import { frameView } from './geo';
import { cameraAt, landingFrames, layersAt, pushScale, shuffled, transitionFor, transitionWindow, unitSlots } from './motion';
import { DECODE_LUMA, FLAT_ASSETS, auditFrames, auditTimeline, probeFrames, withVoxScene } from './render';
import type { TimedBeat } from './timeline';
import { MAX_SCREENPLAY_ATTEMPTS, VOX_SCREENPLAY_BIBLE, repairVoxBeat, runVoxScreenplayAgent } from './screenplay';
import { alignScript, compileTimeline, scriptWords } from './timing';
import { ASPECT_SPECS, CAPTION_LINE_EM } from '../remotion/primitives';
import { COLOR, FPS, LABEL_FONT_PX, LAYOUTS, MOTION, PUSH, TRANSITIONS, TRANSITION_MAX_SHARE, arrowPoint, labelRect, penArrow, toScreen, type Rect, type TransitionKind, type View } from './tokens';
import { CAPTION_STYLES, buildAssSubtitles } from '../remotion/captions';
import { MOTION_LIMITS, auditTimelineMotion } from './audit';
import { SFX, sfxCues, sfxMixGraph, type SfxRule } from './audio';
import { EASE, SHAKE_FRAMES, backOut, landing, progress, punchFlash, punchWord, shakeAt } from './motion';
import { REGISTERS, REGISTER_IDS, punchlineBeats, registerRules, resolveStyle, stripVocalTags, voiceScript, type Register } from './register';
import { PAPER_GRADE } from './tokens';
import type { Timeline } from './timeline';

const L169 = LAYOUTS['16:9'];
/** One valid fixture sheet per delivery format (and so per aspect). */
const FORMAT_SHEETS: [Format, () => BeatSheet][] = [
  ['explainer', clone],
  ['short', () => toShort(clone())],
];
const ZONE = L169.zone;

describe('formatFigure', () => {
  const rows: [string, number, Parameters<typeof formatFigure>[1], number | undefined, string][] = [
    ['area', 5_000_000, 'km2', undefined, '5 million km²'],
    ['count-up start never reads 0.0M', 0, 'km2', 5_000_000, '0 million km²'],
    ['count-up midway keeps target precision', 2_500_000, 'km2', 5_000_000, '3 million km²'],
    ['fractional millions', 2_500_000, 'people', undefined, '2.5 million people'],
    ['billions with currency', 1_200_000_000, 'usd', undefined, '$1.2 billion'],
    ['percent rounds', 50.6, 'percent', undefined, '51%'],
    ['plain count', 300, 'count', undefined, '300'],
    ['thousands', 50_000, 'soldiers', undefined, '50,000 soldiers'],
    ['BCE year', -753, 'year', undefined, '753 BCE'],
    ['CE year', 476, 'year', undefined, '476 CE'],
    ['year shows target, never counts', 1, 'year', 1453, '1453 CE'],
  ];
  for (const [name, value, unit, target, want] of rows) test(name, () => expect(formatFigure(value, unit, target)).toBe(want));
  test('year 0 does not exist', () => expect(() => formatFigure(0, 'year')).toThrow('no year 0'));
});

describe('phrases', () => {
  const rows: [string, string, string, number][] = [
    ['exact', 'This map shows the empire', 'this map', 0],
    ['punctuation and case ignored', 'In 117 CE, one city', '117 ce one', 1],
    ['apostrophes dropped', "today's United States", 'todays united', 0],
    ['not contiguous', 'one big city', 'one city', -1],
    ['empty phrase', 'anything', '...', -1],
  ];
  for (const [name, text, phrase, want] of rows) test(name, () => expect(findPhrase(tokenize(text), phrase)).toBe(want));
});

describe('checkBeatSheet rules', () => {
  /** Replaces beat 4 (narration "…about five million square kilometers…") with a number shot; `o` overrides its fields. */
  const figure3 = (o: Partial<Extract<Shot, { kind: 'number' }>>) => (s: BeatSheet) => void (s.beats[3]!.shot = { kind: 'number', value: 5_000_000, unit: 'km2', label: 'of territory', at: 'five million', ...o });
  /** Beat 4's shot swapped for a list shot; cues come from its narration ("It covered about five million … roughly half … United States."). */
  const shot3 = (shot: Shot) => (s: BeatSheet) => void (s.beats[3]!.shot = shot);
  const RANK_ITEMS = [
    { label: 'Rome', value: 5_000_000, at: 'five million' },
    { label: 'Han China', value: 6_500_000, at: 'roughly half' },
    { label: 'Parthia', value: 2_800_000, at: 'United States' },
  ];
  const rank3 = (o: Partial<Extract<Shot, { kind: 'ranking' }>>) => shot3({ kind: 'ranking', title: 'Largest empires', unit: 'km2', better: 'higher', items: RANK_ITEMS, ...o });
  type VersusRow = Extract<Shot, { kind: 'versus' }>['rows'][number];
  const vrow = (o: Partial<VersusRow>): VersusRow => ({ label: 'Area', unit: 'km2', left: 5_000_000, right: 9_800_000, better: 'higher', at: 'five million', ...o });
  const versus3 = (rows: VersusRow[]) => shot3({ kind: 'versus', sides: [{ label: 'Rome', tone: 'red' }, { label: 'USA', tone: 'teal' }], rows });
  const CHECK_ITEMS = [
    { text: 'Rome was tiny', mark: 'no' as const, at: 'It covered' },
    { text: 'Half of America', mark: 'yes' as const, at: 'roughly half' },
  ];
  const check3 = (items: Extract<Shot, { kind: 'checklist' }>['items']) => shot3({ kind: 'checklist', items });
  const CHAT_MESSAGES = [
    { from: 'a' as const, text: 'How big was it?', at: 'It covered' },
    { from: 'b' as const, text: 'About half of America.', at: 'roughly half' },
  ];
  const chat3 = (messages: Extract<Shot, { kind: 'chat' }>['messages']) => shot3({ kind: 'chat', people: { a: 'Ana', b: 'Ben' }, messages });
  test('fixture is valid', () => expect(checkBeatSheet(clone())).toEqual({ ok: true, sheet: FIXTURE }));

  const rows: [string, (s: BeatSheet) => void, string][] = [
    ['cue phrase not spoken', (s) => ((s.beats[1]!.shot as { layers: { at?: string }[] }).layers[0]!.at = 'this globe'), 'phrases_spoken'],
    ['headline highlight not on screen', (s) => ((s.beats[0]!.shot as { highlight: string }).highlight = 'everyone alive'), 'highlight_visible'],
    ['banned filler', (s) => (s.beats[4]!.narration = "Let's dive in: nothing that big ever lasts forever, it does not."), 'banned_phrases'],
    ['acts go backwards', (s) => (s.beats[4]!.act = 'cold_open'), 'act_order'],
    ['opens on a chapter card', (s) => (s.beats[0]!.shot = { kind: 'chapter', title: 'Rome' }), 'cold_open_first'],
    ['two chapter cards in a row', (s) => {
      s.beats[3]!.shot = { kind: 'chapter', title: 'Size' };
      s.beats[4]!.act = 'history';
      s.beats[4]!.shot = { kind: 'chapter', title: 'End' };
    }, 'chapter_cards'],
    ['unit groups exceed total', (s) => (s.beats[3]!.shot = { kind: 'pictogram', title: 'Seats', total: 4, groups: [{ count: 5, label: 'won', tone: 'red', at: 'five million' }] }), 'pictogram_fit'],
    ['timeline mark out of range', (s) => (s.beats[3]!.shot = { kind: 'timeline', from: -100, to: 100, marks: [{ year: 200, label: 'late' }] }), 'timeline_range'],
    ['timeline marks bunched at one end', (s) => (s.beats[3]!.shot = { kind: 'timeline', from: -800, to: 1500, marks: [{ year: -753, label: 'founded' }, { year: -509, label: 'republic' }] }), 'timeline_fit'],
    ['duplicate ids', (s) => (s.beats[4]!.id = 'b1'), 'unique_ids'],
    ['too few words for the duration', (s) => (s.target_duration_sec = 60), 'word_budget'],
    ['too many words for the duration', (s) => (s.target_duration_sec = 30) && (s.beats[4]!.narration += ' Nothing that big ever lasts, and that is the whole lesson of the long story of this empire.'), 'word_budget'],
    ['beat too long', (s) => (s.beats[4]!.narration = `${'very '.repeat(40)}that big`), 'beat_length'],
    ['never points at the picture', (s) => (s.beats[1]!.narration = s.beats[1]!.narration.replace('This map', 'The map')) && ((s.beats[1]!.shot as { layers: { at?: string }[] }).layers[0]!.at = 'The map'), 'point_at_picture'],
    ['quote highlight not read aloud', (s) => (s.beats[4]!.shot = { kind: 'quote', text: 'I came, I saw, I conquered.', by: 'Julius Caesar', highlight: 'I conquered' }), 'quote_spoken'],
    ['unknown place', (s) => ((s.beats[1]!.shot as { labels: { place: string }[] }).labels[0]!.place = 'atlantis'), 'place_unknown'],
    ['ambiguous place (no candidate in view)', (s) => ((s.beats[1]!.shot as { labels: { place: string }[] }).labels[0]!.place = 'Springfield'), 'place_ambiguous'],
    ['a modern country filled on an ancient view', (s) => ((s.beats[1]!.shot as { layers: { layer: string }[] }).layers[0]!.layer = 'France'), 'place_era'],
    ['a modern country filled on a historical map', (s) => void Object.assign(s.beats[1]!.shot, { view: 'europe', year: 1914, layers: [{ layer: 'FR', tone: 'red' }] }), 'place_era'],
    ['a polity filled outside its lifetime', (s) => void Object.assign(s.beats[1]!.shot, { view: 'europe', year: 1800, layers: [{ layer: 'German Empire', tone: 'red' }] }), 'place_era'],
    ['no historical borders before the first snapshot', (s) => void Object.assign(s.beats[1]!.shot, { view: 'europe', year: -4000, layers: [] }), 'map_year'],
    ['a place labelled and pinned', (s) => void Object.assign(s.beats[1]!.shot, { pins: [{ place: 'Rome', at: 'Egypt' }] }), 'map_places'],
    ['a world mixing ancient and modern views', (s) => void Object.assign(s.beats[2]!.shot, { view: 'europe', layers: [] }), 'map_world'],
    ['unknown named view', (s) => void Object.assign(s.beats[1]!.shot, { view: 'atlantis' }), 'place_unknown'],
    ['year zero', (s) => (s.beats[3]!.shot = { kind: 'timeline', from: -10, to: 10, marks: [{ year: 0, label: 'zero' }] }), 'schema'],
    ['headline line too long', (s) => ((s.beats[0]!.shot as { lines: string[] }).lines[0] = 'One city ruled the entire known world'), 'schema'],
    ['split: one part is no split', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'five million', parts: [{ label: 'All of it', tone: 'red' }] }), 'schema'],
    ['split: four parts', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'five million', parts: (['red', 'teal', 'ochre', 'muted'] as const).map((tone) => ({ label: tone, tone })) }), 'schema'],
    ['split: part label over its cap', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'five million', parts: [{ label: 'W'.repeat(CHARS.part + 1), tone: 'red' }, { label: 'East', tone: 'teal' }] }), 'schema'],
    ['split: a part spoken before the tear', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'roughly half', parts: [{ label: 'West', tone: 'red', at: 'five million' }, { label: 'East', tone: 'teal' }] }), 'cues_in_order'],
    ['split: parts spoken out of order', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'It covered', parts: [{ label: 'West', tone: 'red', at: 'roughly half' }, { label: 'East', tone: 'teal', at: 'five million' }] }), 'cues_in_order'],
    ['split: tear cue not spoken', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'tears apart', parts: [{ label: 'West', tone: 'red' }, { label: 'East', tone: 'teal' }] }), 'phrases_spoken'],
    ['chain: one node is no chain', (s) => (s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }] }), 'schema'],
    ['chain: six nodes', (s) => (s.beats[3]!.shot = { kind: 'chain', nodes: Array.from({ length: COUNTS.chainNodes[1] + 1 }, (_, i) => ({ label: `Ruler ${i}` })) }), 'schema'],
    ['chain: node label over its cap', (s) => (s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'W'.repeat(CHARS.node + 1) }, { label: 'Nero' }] }), 'schema'],
    ['chain: nodes spoken out of order', (s) => (s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Tiberius', at: 'roughly half' }, { label: 'Caligula', at: 'five million' }] }), 'cues_in_order'],
    ['chain: a continuing chain drops a node', (s) => {
      s.beats[3]!.world = s.beats[4]!.world = 'heirs';
      s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }, { label: 'Tiberius' }] };
      s.beats[4]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }, { label: 'Caligula' }] };
    }, 'chain_grows'],
    ['chain: a continuing chain reorders its nodes', (s) => {
      s.beats[3]!.world = s.beats[4]!.world = 'heirs';
      s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }, { label: 'Tiberius' }] };
      s.beats[4]!.shot = { kind: 'chain', nodes: [{ label: 'Tiberius' }, { label: 'Augustus' }, { label: 'Nero' }] };
    }, 'chain_grows'],
    ['map: three army arrows', (s) => ((s.beats[1]!.shot as { armies?: unknown[] }).armies = Array.from({ length: COUNTS.armies[1] + 1 }, () => ({ from: 'rome', to: 'carthage', tone: 'red', at: 'This map' }))), 'schema'],
    ['map: army cue not spoken', (s) => ((s.beats[1]!.shot as { armies?: unknown[] }).armies = [{ from: 'rome', to: 'carthage', tone: 'red', at: 'the legions march' }]), 'phrases_spoken'],
    ['number: screen shows 5.2 million, narration says five million', figure3({ value: 5_200_000 }), 'number_matches_speech'],
    ['number: off by a magnitude (5 thousand vs five million)', figure3({ value: 5_000 }), 'number_matches_speech'],
    ['number: the figure lands on a word that is no number', figure3({ at: 'It covered' }), 'number_matches_speech'],
    ['number: the comparison is not the number spoken', figure3({ compare: { value: 9_800_000, label: 'United States', at: 'roughly half' } }), 'number_matches_speech'],
    ['number: an inflation figure must say the adjusted amount', (s) => {
      s.beats[4]!.narration = 'In 1900, a thousand dollars bought what a thousand buys today.';
      s.beats[4]!.shot = { kind: 'number', value: 1000, unit: 'usd', label: 'then', at: 'a thousand dollars', compare: { value: 1000, inflation: { year: 1900, to: 2024 }, label: 'now', at: 'a thousand buys' } };
    }, 'number_matches_speech'],
    ['pictogram: a spoken group count must be count × per', (s) => {
      s.beats[3]!.narration = 'About five thousand soldiers held the Rhine, roughly half the army.';
      s.beats[3]!.shot = { kind: 'pictogram', title: 'Legions', total: 10, per: { value: 1000, unit: 'soldiers' }, groups: [{ count: 4, label: 'Rhine', tone: 'red', at: 'five thousand' }] };
    }, 'number_matches_speech'],
    ['compare: dollars against people', figure3({ unit: 'usd', compare: { value: 5_000_000, unit: 'people', label: 'people', at: 'five million' } }), 'compare_same_dimension'],
    ['compare: euros against dollars (no exchange rates)', figure3({ unit: 'usd', compare: { value: 5_000_000, unit: 'eur', label: 'euros', at: 'five million' } }), 'compare_same_dimension'],
    ['compare: area against length', figure3({ compare: { value: 5_000_000, unit: 'km', label: 'long', at: 'five million' } }), 'compare_same_dimension'],
    ['spoken form: a currency symbol', (s) => (s.beats[4]!.narration = "It cost $5, and it didn't last, because nothing that big ever does."), 'spoken_form'],
    ['spoken form: a percent sign', (s) => (s.beats[4]!.narration = "And 90% of it didn't last, because nothing that big ever does."), 'spoken_form'],
    ['spoken form: a degree sign', (s) => (s.beats[4]!.narration = "Winters hit 20° and it didn't last, because nothing that big ever does."), 'spoken_form'],
    ['spoken form: a unit abbreviation', (s) => (s.beats[3]!.narration = "It covered about five million km, roughly half the size of today's United States."), 'spoken_form'],
    ['spoken form: an abbreviation glued to digits', (s) => (s.beats[4]!.narration = "It ran at 60mph and didn't last, because nothing that big ever does."), 'spoken_form'],
    ['spoken form: a slash', (s) => (s.beats[4]!.narration = "And it didn't last 24/7, because nothing that big ever does."), 'spoken_form'],
    ['sign: a negative amount of money', figure3({ value: -5_000_000, unit: 'usd' }), 'unit_sign'],
    ['sign: zero people', figure3({ value: 0, unit: 'people' }), 'unit_sign'],
    ['inflation: no euro price table', figure3({ unit: 'eur', inflation: { year: 1990, to: 2020 } }), 'inflation_known'],
    ['inflation: a year before the table', figure3({ unit: 'usd', inflation: { year: 1700, to: 2024 } }), 'inflation_known'],
    ['inflation: a year after the table', figure3({ unit: 'usd', inflation: { year: 1900, to: 2090 } }), 'inflation_known'],
    ['icons: one pictogram mixes Phosphor and game-icons', (s) => (s.beats[3]!.shot = { kind: 'pictogram', title: 'Armies', total: 10, icon: 'person', groups: [{ count: 4, label: 'Legions', tone: 'red', at: 'five million', icon: 'centurion-helmet' }] }), 'icon_families'],
    ['icons: an id outside the catalog', (s) => (s.beats[3]!.shot = { kind: 'pictogram', title: 'Armies', total: 10, icon: 'unicorn' as 'person', groups: [{ count: 4, label: 'Legions', tone: 'red', at: 'five million' }] }), 'schema'],
    ['punch: four words', shot3({ kind: 'punch', field: 'ink', words: ['It', 'covered', 'five', 'million'].map((text) => ({ text, at: text })) }), 'schema'],
    ['punch: two words in one entry', shot3({ kind: 'punch', field: 'ink', words: [{ text: 'five million', at: 'five million' }] }), 'schema'],
    ['punch: a word over its cap', shot3({ kind: 'punch', field: 'ink', words: [{ text: 'W'.repeat(CHARS.punchWord + 1), at: 'five million' }] }), 'schema'],
    ['punch: an unknown field', shot3({ kind: 'punch', field: 'blue' as 'ink', words: [{ text: 'Half', at: 'roughly half' }] }), 'schema'],
    ['punch: words spoken out of order', shot3({ kind: 'punch', field: 'ink', words: [{ text: 'Half', at: 'roughly half' }, { text: 'Five', at: 'five million' }] }), 'cues_in_order'],
    ['punch: a word cue not spoken', shot3({ kind: 'punch', field: 'ink', words: [{ text: 'Twice', at: 'twice as big' }] }), 'phrases_spoken'],
    ['ranking: two items', rank3({ items: RANK_ITEMS.slice(0, 2) }), 'schema'],
    ['ranking: seven items', rank3({ items: Array.from({ length: COUNTS.rankItems[1] + 1 }, (_, i) => ({ label: `Empire ${i}`, value: (i + 1) * 1e6, at: 'It covered' })) }), 'schema'],
    ['ranking: a label over its cap', rank3({ items: [{ ...RANK_ITEMS[0]!, label: 'W'.repeat(CHARS.rankLabel + 1) }, ...RANK_ITEMS.slice(1)] }), 'schema'],
    ['ranking: "none" cannot rank', rank3({ better: 'none' as 'higher' }), 'schema'],
    ['ranking: in years (no bars from zero)', rank3({ unit: 'year', items: RANK_ITEMS.map((i, k) => ({ ...i, value: 100 + k, at: 'It covered' })) }), 'ranking_unit'],
    ['ranking: in degrees (signed)', rank3({ unit: 'celsius', items: RANK_ITEMS.map((i, k) => ({ ...i, value: 10 + k, at: 'It covered' })) }), 'ranking_unit'],
    ['ranking: two items show the same figure (5.0 million)', rank3({ items: [RANK_ITEMS[0]!, { ...RANK_ITEMS[1]!, value: 5_010_000 }, RANK_ITEMS[2]!] }), 'ranking_values'],
    ['ranking: an item shows as 0.0 beside the largest', rank3({ items: [...RANK_ITEMS.slice(0, 2), { ...RANK_ITEMS[2]!, value: 20_000 }] }), 'ranking_values'],
    ['ranking: an item cue says another number', rank3({ items: [{ ...RANK_ITEMS[0]!, value: 6_000_000 }, ...RANK_ITEMS.slice(1)] }), 'number_matches_speech'],
    ['ranking: a negative amount', rank3({ unit: 'usd', items: [{ ...RANK_ITEMS[2]!, value: -5 }, ...RANK_ITEMS.slice(0, 2)] }), 'unit_sign'],
    ['versus: five rows', versus3(Array.from({ length: COUNTS.versusRows[1] + 1 }, () => vrow({}))), 'schema'],
    ['versus: one side', shot3({ kind: 'versus', sides: [{ label: 'Rome', tone: 'red' }] as never, rows: [vrow({})] }), 'schema'],
    ['versus: a side name over its cap', shot3({ kind: 'versus', sides: [{ label: 'W'.repeat(CHARS.side + 1), tone: 'red' }, { label: 'USA', tone: 'teal' }], rows: [vrow({})] }), 'schema'],
    ['versus: rows spoken out of order', versus3([vrow({ at: 'roughly half' }), vrow({ at: 'five million' })]), 'cues_in_order'],
    ['versus: the cue says a number neither side shows', versus3([vrow({ left: 6_000_000 })]), 'number_matches_speech'],
    ['versus: a negative count', versus3([vrow({ unit: 'people', left: -3, at: 'It covered' })]), 'unit_sign'],
    ['versus: a row too wide for a phone', (s) => {
      toShort(s);
      shot3({ kind: 'versus', sides: [{ label: 'Rome', tone: 'red' }, { label: 'USA', tone: 'teal' }], rows: [vrow({ label: 'Rulers of Rome', unit: 'people', left: 2_500_000, right: 1_200_000, at: 'It covered' })] })(s);
    }, 'versus_fit'],
    ['checklist: one item', check3(CHECK_ITEMS.slice(0, 1)), 'schema'],
    ['checklist: six items', check3(Array.from({ length: COUNTS.checkItems[1] + 1 }, () => CHECK_ITEMS[0]!)), 'schema'],
    ['checklist: an unknown mark', check3([{ ...CHECK_ITEMS[0]!, mark: 'nah' as 'yes' }, CHECK_ITEMS[1]!]), 'schema'],
    ['checklist: an item over its cap', check3([{ ...CHECK_ITEMS[0]!, text: 'W'.repeat(CHARS.item + 1) }, CHECK_ITEMS[1]!]), 'schema'],
    ['checklist: items spoken out of order', check3([CHECK_ITEMS[1]!, CHECK_ITEMS[0]!]), 'cues_in_order'],
    ['chat: one message', chat3(CHAT_MESSAGES.slice(0, 1)), 'schema'],
    ['chat: seven messages', chat3(Array.from({ length: COUNTS.chatMessages[1] + 1 }, () => CHAT_MESSAGES[0]!)), 'schema'],
    ['chat: a third participant', chat3([{ ...CHAT_MESSAGES[0]!, from: 'c' as 'a' }, CHAT_MESSAGES[1]!]), 'schema'],
    ['chat: a message over its cap', chat3([{ ...CHAT_MESSAGES[0]!, text: 'W'.repeat(CHARS.message + 1) }, CHAT_MESSAGES[1]!]), 'schema'],
    ['chat: messages spoken out of order', chat3([CHAT_MESSAGES[1]!, CHAT_MESSAGES[0]!]), 'cues_in_order'],
  ];
  /** Valid variations that must NOT trip the diagram rules. */
  const validRows: [string, (s: BeatSheet) => void][] = [
    ['a chain in a new world starts fresh', (s) => {
      s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }, { label: 'Tiberius' }] };
      s.beats[4]!.shot = { kind: 'chain', nodes: [{ label: 'Nero' }, { label: 'Galba' }] };
    }],
    ['uncued chain nodes and split parts', (s) => {
      s.beats[3]!.shot = { kind: 'chain', nodes: [{ label: 'Augustus' }, { label: 'Tiberius' }] };
      s.beats[4]!.shot = { kind: 'split', whole: 'Rome', at: 'that big', parts: [{ label: 'West', tone: 'red' }, { label: 'East', tone: 'teal' }] };
    }],
    ['the same cue for the tear and its first part', (s) => (s.beats[3]!.shot = { kind: 'split', whole: 'Rome', at: 'five million', parts: [{ label: 'West', tone: 'red', at: 'five million' }, { label: 'East', tone: 'teal', at: 'roughly half' }] })],
    ['number: the cue is part of the spoken number ("million")', figure3({ at: 'million' })],
    ['number: a decimal magnitude is spoken as shown', (s) => {
      s.beats[3]!.narration = "It covered about five point two million square kilometers, roughly half of today's America.";
      s.beats[3]!.shot = { kind: 'number', value: 5_200_000, unit: 'km2', label: 'of territory', at: 'five point two million' };
    }],
    ['number: two point five trillion dollars', (s) => {
      s.beats[3]!.narration = 'It owed about two point five trillion dollars, roughly half of everything it made.';
      s.beats[3]!.shot = { kind: 'number', value: 2.5e12, unit: 'usd', label: 'of debt', at: 'two point five trillion' };
    }],
    ['number: a percent is spoken at screen rounding (50.6 → fifty-one)', (s) => {
      s.beats[3]!.narration = "About fifty-one percent of it was farmland, roughly half of today's United States.";
      s.beats[3]!.shot = { kind: 'number', value: 50.6, unit: 'percent', label: 'farmland', at: 'fifty-one percent' };
    }],
    ['number: one in four', (s) => {
      s.beats[3]!.narration = "About one in four people alive lived inside it, roughly half of today's world.";
      s.beats[3]!.shot = { kind: 'number', value: 4, unit: 'one_in', label: 'lived inside it', at: 'one in four' };
    }],
    ['number: a negative temperature', (s) => {
      s.beats[3]!.narration = "Winters fell to minus forty degrees Celsius, roughly half as cold as today's poles.";
      s.beats[3]!.shot = { kind: 'number', value: -40, unit: 'celsius', label: 'a winter night', at: 'minus forty' };
    }],
    ['number: zero degrees', (s) => {
      s.beats[3]!.narration = "The sea froze at about zero degrees Celsius, roughly half the winters back then.";
      s.beats[3]!.shot = { kind: 'number', value: 0, unit: 'celsius', label: 'freezing', at: 'zero degrees' };
    }],
    ['compare: square kilometers against square miles', (s) => {
      s.beats[3]!.narration = 'It covered five million square kilometers; America covers three point eight million square miles.';
      s.beats[3]!.shot = { kind: 'number', value: 5_000_000, unit: 'km2', label: 'Rome', at: 'five million', compare: { value: 3_800_000, unit: 'mi2', label: 'America', at: 'three point eight million' } };
    }],
    ['pictogram: icons from one family with a per, spoken as count × per', (s) => {
      s.beats[3]!.narration = 'About four thousand soldiers held the Rhine, roughly half the army there.';
      s.beats[3]!.shot = { kind: 'pictogram', title: 'Legions', total: 10, icon: 'centurion-helmet', per: { value: 1000, unit: 'soldiers' }, groups: [{ count: 4, label: 'Rhine', tone: 'red', at: 'four thousand', icon: 'roman-shield' }] };
    }],
    ['punch: one word on red', shot3({ kind: 'punch', field: 'red', words: [{ text: 'Half.', at: 'roughly half' }] })],
    ['punch: the field defaults to ink', (s) => (s.beats[3]!.shot = { kind: 'punch', words: [{ text: 'Half.', at: 'roughly half' }] } as never)],
    ['ranking: items in any spoken order; a cue that says the item\'s own value', rank3({ items: [RANK_ITEMS[1]!, RANK_ITEMS[0]!, { ...RANK_ITEMS[2]!, at: 'It covered' }] })],
    ['ranking: lowest first', rank3({ better: 'lower' })],
    ['ranking: better defaults to higher', (s) => (s.beats[3]!.shot = { kind: 'ranking', title: 'Largest', unit: 'km2', items: RANK_ITEMS } as never)],
    ['versus: the cue says the right side\'s value', versus3([vrow({ left: 9_800_000, right: 5_000_000 })])],
    ['versus: a side may have zero (no bars)', versus3([vrow({ label: 'Wars won', unit: 'count', left: 3, right: 0, at: 'It covered' })])],
    ['versus: a signed unit below zero, a row with no winner', versus3([vrow({ label: 'Winter', unit: 'celsius', left: -20, right: 5, better: 'none', at: 'It covered' })])],
    ['versus: four phone rows (ten-letter labels, the widest figures) fit', (s) => {
      toShort(s);
      versus3(['It covered', 'five million', 'roughly half', 'America'].map((at, i) => vrow({ label: 'W'.repeat(CHARS.rowLabel - 4), unit: 'km', left: 1000 + i, right: 2000 + i, at, ...(at === 'five million' && { unit: 'km2', left: 5_000_000, right: 9_800_000 }) })))(s);
    }],
    ['checklist and chat at their smallest', (s) => {
      check3(CHECK_ITEMS)(s);
      s.beats[4]!.shot = { kind: 'chat', people: { a: 'Ana', b: 'Ben' }, messages: [{ from: 'a', text: 'Did it last?', at: "didn't last" }, { from: 'a', text: 'Nope.', at: 'nothing that big' }] };
    }],
  ];
  for (const [name, mutate] of validRows) {
    test(`valid: ${name}`, () => {
      const s = clone();
      mutate(s);
      expect(checkBeatSheet(s)).toMatchObject({ ok: true });
    });
  }
  rows.push(
    ['short: a long hook breaks retention', (s) => (toShort(s), (s.beats[0]!.narration = 'In 117 CE, one city ruled about a quarter of everyone alive on the planet Earth.')), 'hook_first'],
    ['short: hook must be a headline', (s) => (toShort(s), (s.beats[0]!.shot = { kind: 'timeline', from: -100, to: 200, marks: [{ year: 117, label: 'peak' }] })), 'hook_first'],
    ['short: no chapter cards', (s) => (toShort(s), (s.beats[3]!.shot = { kind: 'chapter', title: 'Size' })), 'format_chapters'],
    ['short: a 13-word beat is too long (12 max)', (s) => (toShort(s), (s.beats[2]!.narration = 'Rome sat right in the middle of it, ruling every coast of the sea.')), 'beat_length'],
    ['short: a 2-word beat is too short (3 min)', (s) => (toShort(s), (s.beats[5]!.narration = 'By 476.')), 'beat_length'],
    ['short: 73 words are too few for a 60 s Short', (s) => (toShort(s), (s.target_duration_sec = 60)), 'word_budget'],
    ['short: headline lines fit a phone', (s) => (toShort(s), ((s.beats[4]!.shot as { lines: string[] }).lines = ['Nothing that big ever', 'lasts'])), 'headline_fit'],
  );
  for (const [tour, swap] of Object.entries(SHOT_TOURS)) {
    for (const [format, make] of FORMAT_SHEETS) {
      test(`shot tour "${tour}" is a valid ${format}`, () => {
        const sheet = make();
        swap(sheet);
        expect(checkBeatSheet(sheet)).toMatchObject({ ok: true });
      });
    }
  }
  for (const [name, mutate, rule] of rows) {
    test(name, () => {
      const s = clone();
      mutate(s);
      const r = checkBeatSheet(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.violations.map((v) => v.rule)).toContain(rule);
    });
  }
});

describe('alignScript', () => {
  const script = tokenize('In 117 CE one city ruled');
  test('exact provider tokens map 1:1', () => {
    const spans = alignScript(script, script.map((w, i) => ({ word: w, start_ms: i * 100, end_ms: i * 100 + 90 })));
    expect(spans.map((s) => s.start_ms)).toEqual([0, 100, 200, 300, 400, 500]);
  });
  test('ASR misspelling ("C," for CE) is interpolated between its neighbours', () => {
    const asr = ['In', '117', 'C,', 'one', 'city', 'ruled'].map((w, i) => ({ word: w, start_ms: i * 100, end_ms: i * 100 + 90 }));
    const ce = alignScript(script, asr)[2]!;
    expect(ce.start_ms).toBeGreaterThanOrEqual(190);
    expect(ce.end_ms).toBeLessThanOrEqual(300);
  });
  test('audio that is not this script fails loud', () => {
    expect(() => alignScript(script, [{ word: 'banana', start_ms: 0, end_ms: 10 }])).toThrow('alignment failed');
  });

  // Number-aware units. ASR words are 120 ms back to back; a matched unit splits its span evenly
  // over its script tokens. Each row: script text, ASR text, start_ms of every script token.
  const STEP = 120;
  const asrOf = (text: string) => text.split(' ').map((word, i) => ({ word, start_ms: i * STEP, end_ms: (i + 1) * STEP }));
  const unitRows: [string, string, string, number[]][] = [
    ['spelled cardinal ↔ digits (hyphenated)', 'for nine hundred seventy-seven years', 'for 977 years', [0, 120, 150, 180, 210, 240]],
    ['digit script ↔ spelled ASR', 'for 977 years', 'for nine hundred seventy-seven years', [0, 120, 480]],
    ['millions, ASR "5 million" as two words; British spelling folds', 'about five million square kilometres', 'About 5 million square kilometers,', [0, 120, 240, 360, 480]],
    ['scale chain ↔ grouped digits', 'two million five hundred thousand people', '2,500,000 people', [0, 24, 48, 72, 96, 120]],
    ['"a hundred"', 'a hundred days', '100 days', [0, 60, 120]],
    ['"one hundred and twenty"', 'one hundred and twenty men', '120 men', [0, 30, 60, 90, 120]],
    ['thousands comma', 'one thousand ships', '1,000 ships', [0, 60, 120]],
    ['decimal', 'five point five percent', '5.5 percent', [0, 40, 80, 120]],
    ['digit decimal in the script', 'grew 5.5 percent', 'grew five point five percent', [0, 120, 300, 480]],
    ['year read in pairs', 'in fourteen fifty-three it fell', 'In 1453, it fell', [0, 120, 160, 200, 240, 360]],
    ['year read in pairs ↔ spelled', 'by 1984', 'by nineteen eighty-four', [0, 120]],
    ['"ten" ↔ "10" next to a comma-split number', 'five to 476 ten after', 'five to 476, 10 after.', [0, 120, 240, 360, 480]],
    ['plain words unchanged', 'one city ruled', 'one city ruled', [0, 120, 240]],
    ['"two trillion" ↔ "2 trillion"', 'two trillion dollars', '2 trillion dollars', [0, 120, 240]],
    ['"two trillion" ↔ grouped digits', 'two trillion dollars', '2,000,000,000,000 dollars', [0, 60, 120]],
    ['"two point five trillion" ↔ "2.5 trillion"', 'two point five trillion dollars', '2.5 trillion dollars', [0, 60, 120, 180, 240]],
    ['decimal before a scale ↔ "5.2 million"', 'five point two million people', '5.2 million people', [0, 60, 120, 180, 240]],
    ['"minus forty" ↔ "minus 40"', 'minus forty degrees', 'minus 40 degrees', [0, 120, 240]],
    ['"negative" is a sign word too', 'negative five degrees', 'minus 5 degrees', [0, 120, 240]],
    ['a lone "minus" is a word', 'minus the tax', 'minus the tax', [0, 120, 240]],
    ['"a" before a noun stays a word', 'a republic', 'a republic', [0, 120]],
    ['short stems are not folded ("our" ≠ "or"): interpolated', 'our city', 'and or city', [0, 240]],
  ];
  for (const [name, text, asr, starts] of unitRows) {
    test(`units: ${name}`, () => expect(alignScript(text.split(' '), asrOf(asr)).map((s) => s.start_ms)).toEqual(starts));
  }

  // Regression from a live run (Gemini TTS + faster-whisper): "ten after" was interpolated 580 ms early.
  const live: WordTimestamp[] = [
    ['five', 51500, 51660], ['to', 51660, 51820], ['476,', 51820, 52540], ['10', 53120, 53340], ['after.', 53340, 53780],
    ['About', 29080, 29380], ['5', 29380, 29800], ['million', 29800, 30120], ['square', 30120, 30460], ['kilometers,', 30460, 30920],
  ].map(([word, start_ms, end_ms]) => ({ word, start_ms, end_ms }) as WordTimestamp).sort((x, y) => x.start_ms - y.start_ms);
  const liveRows: [string, string, number][] = [
    ['ten', 'ten after', 53120],
    ['million', 'five million square kilometres', 29750],
    ['kilometres', 'kilometres', 30460],
  ];
  const liveScript = 'About five million square kilometres. five to 476, ten after.'.split(' ');
  const liveSpans = alignScript(liveScript, live);
  for (const [token, phrase, start] of liveRows) {
    test(`live run: "${token}" in "${phrase}" lands on its spoken word`, () => {
      expect(liveSpans[findPhrase(liveScript.flatMap(tokenize), phrase) + tokenize(phrase).indexOf(token)]!.start_ms).toBe(start);
    });
  }
});

describe('compileTimeline', () => {
  const sheet = clone();
  const tl = compileTimeline(sheet, voice(sheet));
  const at = (id: string) => tl.beats.find((b) => b.id === id)!;
  test('beats tile the whole video in order', () => {
    expect(tl.beats[0]!.from).toBe(0);
    tl.beats.forEach((b, i) => expect(b.to).toBe(tl.beats[i + 1]?.from ?? tl.durationInFrames));
  });
  test('beat starts just before its first spoken word', () => {
    const firstWordOfB2 = sheet.beats[0]!.narration.split(/\s+/).length; // word index
    expect(at('b2').from).toBe(Math.round(((firstWordOfB2 * 300 - 120) / 1000) * FPS));
  });
  test('cue lands on the frame its phrase is spoken', () => {
    const idx = sheet.beats.slice(0, 1).reduce((n, b) => n + b.narration.split(/\s+/).length, 0) + 14; // "Egypt." is word index 14 of b2
    expect(at('b2').cues['Egypt']).toBe(Math.round(((idx * 300) / 1000) * FPS));
  });
  test('same-world beat carries layers/labels and moves the camera from the previous view', () => {
    expect(at('b3').carried).toEqual(['layer:rome_ce117:red', 'label:city:rome-it']);
    // It starts exactly where the previous camera ended, drift included: a glide, not a jump.
    expect(at('b3').camera!.from).toEqual(cameraAt(at('b2').camera!, at('b2').from, at('b2').to));
  });
  test('every beat carries its spoken words with their frames', () => {
    expect(at('b1').spoken.slice(0, 3)).toEqual([
      { token: 'in', frame: 0 },
      { token: '117', frame: Math.round(0.3 * FPS) },
      { token: 'ce', frame: Math.round(0.6 * FPS) },
    ]);
  });
  test('a same-world run shares one camera push span; other beats push over their own range', () => {
    expect(at('b2').push).toEqual({ from: at('b2').from, to: at('b3').to });
    expect(at('b3').push).toEqual(at('b2').push);
    expect(at('b4').push).toEqual({ from: at('b4').from, to: at('b4').to });
  });
  const cutRows: [Format, () => BeatSheet, TransitionKind[]][] = [
    ['explainer', clone, ['wipe', 'glide', 'push', 'push']],
    ['short', () => toShort(clone()), ['wipe', 'glide', 'rise', 'rise', 'wipe', 'rise']],
  ];
  for (const [format, make, kinds] of cutRows) {
    test(`${format}: no hard cuts, every beat after the first enters through a transition centred on its start`, () => {
      const s = make();
      const t = compileTimeline(s, voice(s));
      expect(t.beats[0]!.enter).toBeUndefined();
      expect(t.beats.slice(1).map((b) => b.enter!.kind)).toEqual(kinds);
      for (const b of t.beats.slice(1)) expect(b.enter!.from <= b.from && b.from <= b.enter!.to).toBe(true);
    });
  }
  test('a chain continuing its world glides in and carries exactly its previous nodes and title', () => {
    const s = clone();
    SHOT_TOURS['army arrows, split, growing chain']!(s);
    const [b4, b5] = compileTimeline(s, voice(s)).beats.slice(3);
    expect(b4!.carried).toEqual([]);
    expect(b5!.enter!.kind).toBe('glide');
    expect(b5!.carried).toEqual(['title:Who ruled after Augustus', 'node:0:Augustus', 'node:1:Tiberius', 'node:2:Caligula']);
    expect(b5!.push).toEqual(b4!.push);
  });
  test('recolouring a layer in the same world cross-fades from its previous tone', () => {
    const s = clone();
    (s.beats[2]!.shot as { layers: { tone: string }[] }).layers[0]!.tone = 'muted';
    const b3 = compileTimeline(s, voice(s)).beats[2]!;
    expect(b3.fading).toEqual([{ layer: 'rome_ce117', tone: 'red', at: undefined }]);
    expect(b3.carried).toEqual(['label:city:rome-it']);
  });
  test('a layer dropped in the same world fades out at the beat start; kept layers do not fade', () => {
    const s = clone();
    (s.beats[2]!.shot as { layers: unknown[] }).layers = [{ layer: 'rome_bce60', tone: 'red', at: 'every coast' }];
    expect(compileTimeline(s, voice(s)).beats[2]!.fading).toEqual([{ layer: 'rome_ce117', tone: 'red', at: undefined }]);
    expect(compileTimeline(clone(), voice(clone())).beats[2]!.fading).toEqual([]);
  });
  test('a new world starts with nothing carried and a still camera', () => {
    expect(at('b2').carried).toEqual([]);
    expect(at('b2').camera!.from).toEqual(at('b2').camera!.to);
  });
  test('captions use the written words, not ASR spellings', () => {
    expect(scriptWords(sheet, voice(sheet)).slice(0, 3).map((w) => w.word)).toEqual(['In', '117', 'CE,']);
  });
});

describe('wordBudget', () => {
  const rows: [string, Format, number, [number, number]][] = [
    ['a 60 s Short is 130-160 words', 'short', 60, [130, 160]],
    ['a 30 s Short', 'short', 30, [65, 80]],
    ['the explainer keeps ~2.1-2.8 words/s', 'explainer', 60, [126, 168]],
    ['a 120 s explainer', 'explainer', 120, [252, 336]],
  ];
  for (const [name, format, sec, want] of rows) test(name, () => expect(wordBudget(FORMATS[format], sec)).toEqual(want));
});

describe('formats → frames', () => {
  // YouTube Shorts UI: top bar ~110 px, right action rail ~100 px, bottom title block ~400 px.
  const SHORTS_UI = { top: 110, right: 1080 - 100, bottom: 1920 - 400 };
  const tall = ASPECT_SPECS['9:16'];
  const captionLine = { top: tall.height - tall.captionMarginBottom - tall.captionFontPx * CAPTION_LINE_EM, bottom: tall.height - tall.captionMarginBottom };
  const shortsRows: [string, boolean][] = [
    ['captions sit above the Shorts title block', captionLine.bottom <= SHORTS_UI.bottom],
    ['captions sit in the lower half (mid-screen / lower third)', captionLine.top >= tall.height / 2],
    ['captions stay left of the action rail', tall.width - tall.safePaddingX <= SHORTS_UI.right],
    ['the subtitle zone starts at the caption line', LAYOUTS['9:16'].zone.subtitles.y <= captionLine.top],
    ['the safe area ends where the captions begin', LAYOUTS['9:16'].zone.safe.y + LAYOUTS['9:16'].zone.safe.h <= LAYOUTS['9:16'].zone.subtitles.y],
    ['the safe area clears the top bar and the rail', LAYOUTS['9:16'].zone.safe.y >= SHORTS_UI.top && LAYOUTS['9:16'].zone.safe.x + LAYOUTS['9:16'].zone.safe.w <= SHORTS_UI.right],
  ];
  for (const [name, ok] of shortsRows) test(`9:16: ${name}`, () => expect(ok).toBe(true));
  test('16:9 captions keep their band', () => expect(LAYOUTS['16:9'].zone.subtitles).toEqual({ x: 0, y: 940, w: 1920, h: 140 }));
  test('a short compiles to a vertical 9:16 timeline; an explainer to 16:9', () => {
    const s = clone();
    s.format = 'short';
    expect(compileTimeline(s, voice(s))).toMatchObject({ aspect: '9:16', width: 1080, height: 1920 });
    expect(compileTimeline(clone(), voice(clone()))).toMatchObject({ aspect: '16:9', width: 1920, height: 1080 });
  });
  for (const [aspect, L] of Object.entries(LAYOUTS)) {
    for (const zone of ['title', 'stage'] as const) {
      test(`${aspect}: the ${zone} zone lies inside the title-safe area`, () => {
        const [z, safe] = [L.zone[zone], L.zone.safe];
        expect([z.x >= safe.x, z.y >= safe.y, z.x + z.w <= safe.x + safe.w, z.y + z.h <= safe.y + safe.h]).toEqual([true, true, true, true]);
      });
    }
  }
  test('vertical framing keeps map subjects inside the vertical stage', () => {
    const s = clone();
    s.format = 'short';
    const tl = compileTimeline(s, voice(s));
    const b2 = tl.beats[1]!;
    const stage = LAYOUTS['9:16'].zone.stage;
    for (const place of ['city:rome-it', 'city:alexandria-eg']) {
      const [x, y] = toScreen(b2.camera!.to, tl.geo!.maps[b2.map!]!.places[place]!.at, LAYOUTS['9:16']);
      expect(x).toBeGreaterThanOrEqual(stage.x);
      expect(x).toBeLessThanOrEqual(stage.x + stage.w);
      expect(y).toBeGreaterThanOrEqual(stage.y);
      expect(y).toBeLessThanOrEqual(stage.y + stage.h);
    }
  });
});

describe('frameView', () => {
  const base: View = [960, 540, 1920];
  const inStage = ZONE.stage.x + 400;
  test('keeps the requested view when every subject is on stage', () => expect(frameView(base, [[inStage, 540]], L169)).toEqual(base));
  test('no subjects keeps the view', () => expect(frameView(base, [], L169)).toEqual(base));
  const rows: [string, [number, number][]][] = [
    ['subject under the title zone', [[960, 60]]],
    ['subject in the subtitle band', [[960, 1000]]],
    ['subjects wider than the frame', [[-400, 540], [2400, 540]]],
  ];
  for (const [name, pts] of rows) {
    test(`re-frames: ${name}`, () => {
      const v = frameView(base, pts, L169);
      for (const p of pts) {
        const [x, y] = toScreen(v, p, L169);
        expect(x).toBeGreaterThanOrEqual(ZONE.stage.x);
        expect(x).toBeLessThanOrEqual(ZONE.stage.x + ZONE.stage.w);
        expect(y).toBeGreaterThanOrEqual(ZONE.stage.y);
        expect(y).toBeLessThanOrEqual(ZONE.stage.y + ZONE.stage.h);
      }
    });
  }
});

describe('auditFrame', () => {
  const t = (role: string, x: number, y: number, w: number, h: number, overflow = false): AuditedText => ({ beatId: 'b', role, x, y, w, h, overflow });
  const rows: [string, AuditedText[], AuditCheck[]][] = [
    ['clean frame', [t('title', 700, 70, 500, 60), t('label:rome', 900, 500, 90, 34)], []],
    ['act chip over the map title (the reported bug)', [t('chip', 54, 34, 250, 40), t('title', 180, 48, 300, 30)], ['text_overlap']],
    ['label in the subtitle band', [t('label:carthage', 744, 932, 126, 34)], ['outside_safe', 'subtitle_band']],
    ['label off the top edge', [t('label:rubicon', 941, 20, 110, 34)], ['outside_safe']],
    ['text overflows its box', [t('headline', 200, 400, 900, 100, true)], ['overflow']],
    ['tiny touch is tolerated', [t('a', 100, 100, 100, 40), t('b', 199, 100, 100, 40)], []],
  ];
  for (const [name, texts, checks] of rows) test(name, () => expect(auditFrame(1, texts, L169).map((v) => v.check).sort()).toEqual(checks.sort()));
});

describe('auditFrames', () => {
  const sheet = clone();
  const tl = compileTimeline(sheet, voice(sheet));
  test('layout is never audited inside a transition window (text is sliding off-frame by design)', () => {
    for (const { frame } of auditFrames(tl)) for (const b of tl.beats) if (b.enter) expect(frame >= b.enter.from && frame < b.enter.to).toBe(false);
  });
  test('the motion probe samples the whole video every MOTION_PROBE.everySec', () => {
    const frames = probeFrames(tl);
    expect(frames[0]).toBe(0);
    expect(frames[1]).toBe(Math.round(MOTION_PROBE.everySec * FPS));
    expect(frames.at(-1)!).toBeGreaterThan(tl.durationInFrames - frames[1]! - 1);
  });
  test('every beat is sampled, always inside its own range', () => {
    const frames = auditFrames(tl);
    expect(new Set(frames.map((f) => f.beatId))).toEqual(new Set(sheet.beats.map((b) => b.id)));
    for (const f of frames) {
      const b = tl.beats.find((x) => x.id === f.beatId)!;
      expect(f.frame).toBeGreaterThanOrEqual(b.from);
      expect(f.frame).toBeLessThan(b.to);
    }
  });
});

describe('motion maths', () => {
  // "in" at frame 10, then a word every 5 frames: "one" 25, "city" 30, "ruled" 35, "a" 45, "everyone" 60.
  const spoken = tokenize('In 117 CE one city ruled about a quarter of everyone').map((token, i) => ({ token, frame: 10 + i * 5 }));
  const S = 25;
  const landRows: [string, string, number[]][] = [
    ['each word lands on its spoken word', 'one city ruled', [25, 30, 35]],
    ['punctuation and case are ignored', 'One city, ruled!', [25, 30, 35]],
    ['an unspoken word lands wordStagger after its predecessor', 'one big city', [25, 25 + MOTION.wordStagger, 30]],
    ['silent words cascade from the start', 'they make deserts', [S, S + MOTION.wordStagger, S + 2 * MOTION.wordStagger]],
    ['a late-spoken word never leaves the frame empty for longer than wordWaitMax', 'everyone', [S - MOTION.wordStagger + MOTION.wordWaitMax]],
    ['words are matched in order, never back in time', 'ruled one', [35, 35 + MOTION.wordStagger]],
    ['a word spoken once but shown twice: the second is unspoken', 'city a a', [30, 45, 45 + MOTION.wordStagger]],
    ['no words', '', []],
  ];
  for (const [name, text, want] of landRows) test(`landingFrames: ${name}`, () => expect(landingFrames(text.split(/\s+/).filter(Boolean), spoken, S)).toEqual(want));

  const span = { from: 100, to: 200 };
  const pushRows: [string, number, number][] = [
    ['starts at the row start', 100, PUSH.headline[0]],
    ['ends at exactly 1 (the audited layout)', 200, 1],
    ['halfway is halfway', 150, (PUSH.headline[0] + 1) / 2],
    ['keeps moving past the span (outgoing transition layer)', 210, 1 + (1 - PUSH.headline[0]) / 10],
  ];
  for (const [name, frame, want] of pushRows) test(`pushScale: ${name}`, () => expect(pushScale('headline', span, frame)).toBeCloseTo(want, 9));
  test('pushScale: every push row ends at 1 and moves inward', () => {
    for (const [a, b] of Object.values(PUSH)) expect([a < b, b]).toEqual([true, 1]);
  });
  test('pushScale: a zero-length span does not divide by zero', () => expect(Number.isFinite(pushScale('quote', { from: 5, to: 5 }, 5))).toBe(true));

  const cam = { from: [100, 100, 1000] as View, to: [500, 300, 250] as View };
  test('cameraAt: starts at `from`, reaches `to` after cameraMove (then only drifts in)', () => {
    cameraAt(cam, 0, 0).forEach((v, i) => expect(v).toBeCloseTo(cam.from[i]!, 6));
    const done = cameraAt(cam, 0, MOTION.cameraMove);
    expect(done[0]).toBeCloseTo(500, 6);
    expect(done[1]).toBeCloseTo(300, 6);
    expect(done[2]).toBeLessThan(250);
    expect(cameraAt(cam, 0, MOTION.cameraMove + 30)[2]).toBeLessThan(done[2]);
  });
  test('cameraAt: a still camera keeps drifting from its first frame', () => expect(cameraAt({ from: cam.to, to: cam.to }, 0, 15)[2]).toBeLessThan(250));

  test('shuffled: a deterministic permutation per seed', () => {
    expect(shuffled(50, 'b3')).toEqual(shuffled(50, 'b3'));
    expect([...shuffled(50, 'b3')].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(shuffled(50, 'b3')).not.toEqual(shuffled(50, 'b4'));
  });
  const owners = [0, 0, 1, 1, 1, undefined, undefined];
  const scatter = [6, 0, 5, 1, 4, 2, 3];
  const slotRows: [string, number, number[]][] = [
    ['nothing regrouped: the scattered order', 0, [6, 0, 5, 1, 4, 2, 3]],
    ['first group takes the first slots, the rest compact in scattered order', 1, [0, 1, 6, 2, 5, 3, 4]],
    ['all groups regrouped, ungrouped squares after them', 2, [0, 1, 2, 3, 4, 5, 6]],
  ];
  for (const [name, k, want] of slotRows) {
    test(`unitSlots: ${name}`, () => {
      const slots = unitSlots(owners, scatter, k);
      expect(slots).toEqual(want);
      expect(new Set(slots).size).toBe(owners.length);
    });
  }

  const ruleRows: [string, Parameters<typeof transitionFor>, ReturnType<typeof transitionFor>][] = [
    ['same world glides', ['map', 'map', true, '16:9'], 'glide'],
    ['same world glides on a phone too', ['chain', 'chain', true, '9:16'], 'glide'],
    ['same world beats glide even out of a headline', ['headline', 'headline', true, '16:9'], 'glide'],
    ['headline hands over with the highlighter wipe', ['headline', 'map', false, '16:9'], 'wipe'],
    ['the wipe stays horizontal on a phone', ['headline', 'map', false, '9:16'], 'wipe'],
    ['quote wipes', ['quote', 'number', false, '16:9'], 'wipe'],
    ['into a chapter card wipes', ['line', 'chapter', false, '16:9'], 'wipe'],
    ['out of a chapter card wipes', ['chapter', 'pictogram', false, '16:9'], 'wipe'],
    ['maps of different worlds push', ['map', 'map', false, '16:9'], 'push'],
    ['data shots push', ['number', 'timeline', false, '16:9'], 'push'],
    ['diagrams push', ['split', 'chain', false, '16:9'], 'push'],
    ['a phone push rises instead', ['number', 'timeline', false, '9:16'], 'rise'],
    ['diagrams rise on a phone', ['map', 'split', false, '9:16'], 'rise'],
  ];
  for (const [name, args, want] of ruleRows) test(`transitionFor: ${name}`, () => expect(transitionFor(...args)).toBe(want));

  const windowRows: [string, Parameters<typeof transitionWindow>, { from: number; to: number }][] = [
    ['centred on the boundary', ['push', 100, 200, 200], { from: 100 - TRANSITIONS.push.frames / 2, to: 100 + TRANSITIONS.push.frames / 2 }],
    ['a glide has no window', ['glide', 100, 200, 200], { from: 100, to: 100 }],
    ['capped by a short neighbour', ['push', 100, 20, 200], { from: 100 - 3, to: 100 + 3 }],
  ];
  for (const [name, args, want] of windowRows) test(`transitionWindow: ${name}`, () => expect(transitionWindow(...args)).toEqual(want));
  test('transitionWindow: never longer than TRANSITION_MAX_SHARE of either beat', () => {
    for (const len of [10, 33, 60, 400]) {
      const w = transitionWindow('push', 0, len, 1000);
      expect(w.to - w.from).toBeLessThanOrEqual(Math.floor(len * TRANSITION_MAX_SHARE) + 1);
    }
  });

  const beats = [
    { id: 'a', from: 0, to: 100 },
    { id: 'b', from: 100, to: 200, enter: { kind: 'push' as const, from: 92, to: 108 } },
    { id: 'c', from: 200, to: 300, enter: { kind: 'glide' as const, from: 200, to: 200 } },
  ] as unknown as TimedBeat[];
  const layerRows: [string, number, string[]][] = [
    ['one beat alone', 50, ['a:solo']],
    ['window opens before the boundary: outgoing + incoming', 92, ['a:out', 'b:in']],
    ['window still open after the boundary', 107, ['a:out', 'b:in']],
    ['window closed', 108, ['b:solo']],
    ['a glide never overlaps', 200, ['c:solo']],
    ['before the boundary of a glide', 199, ['b:solo']],
    ['past the end: the last beat', 999, ['c:solo']],
  ];
  for (const [name, frame, want] of layerRows) test(`layersAt: ${name}`, () => expect(layersAt(beats, frame).map((l) => `${l.beat.id}:${l.side}`)).toEqual(want));
  test('layersAt: transition progress runs 0→1 across the window', () => {
    expect(layersAt(beats, 92)[1]).toMatchObject({ kind: 'push', t: 0 });
    expect(layersAt(beats, 100)[1]).toMatchObject({ t: 0.5 });
  });
});

describe('diagram geometry', () => {
  const disjoint = (a: Rect, b: Rect) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  const within = (r: Rect, box: Rect) => r.x >= box.x - 0.5 && r.y >= box.y - 0.5 && r.x + r.w <= box.x + box.w + 0.5 && r.y + r.h <= box.y + box.h + 0.5;
  const pairs = <T,>(xs: readonly T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));
  const counts = ([lo, hi]: readonly [number, number]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  for (const [aspect, L] of Object.entries(LAYOUTS)) {
    const stage = L.zone.stage;
    for (const n of counts(COUNTS.chainNodes)) {
      // Worst case: every label at its character cap, every node with a sub line.
      const nodes = Array.from({ length: n }, () => ({ label: 'W'.repeat(CHARS.node), sub: 'S'.repeat(CHARS.nodeSub) }));
      const g = chainLayout(L, nodes);
      const rings = g.points.map(([x, y]): Rect => ({ x: x - CHAIN.node, y: y - CHAIN.node, w: 2 * CHAIN.node, h: 2 * CHAIN.node }));
      test(`${aspect} chain of ${n}: nodes and labels fit the stage`, () => {
        for (const r of [...rings, ...g.labels]) expect(within(r, stage)).toBe(true);
      });
      test(`${aspect} chain of ${n}: labels never overlap each other or any node`, () => {
        for (const [a, b] of pairs(g.labels)) expect(disjoint(a, b)).toBe(true);
        for (const label of g.labels) for (const ring of rings) expect(disjoint(label, ring)).toBe(true);
      });
      test(`${aspect} chain of ${n}: labels stay legible and each link has room for its arrow`, () => {
        expect(g.headPx).toBeGreaterThanOrEqual(CHAIN.labelMinPx);
        for (const [a, b] of g.points.slice(1).map((p, i) => [g.points[i]!, p] as const)) expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(2 * CHAIN.inset + 22);
      });
      for (const k of counts([COUNTS.chainNodes[0], n - 1])) {
        test(`${aspect} chain growing ${k} → ${n}: labels never overlap mid-morph`, () => {
          const from = chainLayout(L, nodes.slice(0, k));
          for (const t of [0.25, 0.5, 0.75]) {
            // Only the carried labels are on screen while they slide; new nodes land once the morph is done.
            const mid = g.labels.slice(0, k).map((b, i) => {
              const a = from.labels[i]!;
              return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
            });
            for (const [a, b] of pairs(mid)) expect(disjoint(a, b)).toBe(true);
          }
        });
      }
    }
    for (const n of counts(COUNTS.splitParts)) {
      const g = splitLayout(L, Array.from({ length: n }, () => 'W'.repeat(CHARS.part)));
      // Parts at their widest separation: the tear gap plus the full drift.
      const shifted = (k: number, r: Rect): Rect => {
        const d = g.parts[k]!.shift * (SPLIT.gap + SPLIT.drift);
        return g.axis === 'x' ? { ...r, x: r.x + d } : { ...r, y: r.y + d };
      };
      const bbox = (poly: readonly (readonly [number, number])[]): Rect => {
        const [xs, ys] = [poly.map((p) => p[0]), poly.map((p) => p[1])];
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      };
      test(`${aspect} split into ${n}: fully separated parts stay inside the stage`, () => {
        g.parts.forEach((p, k) => expect(within(shifted(k, bbox(p.poly)), stage)).toBe(true));
      });
      test(`${aspect} split into ${n}: each label sits inside its own part and is legible`, () => {
        g.parts.forEach((p, k) => expect(within(shifted(k, p.label), shifted(k, bbox(p.poly)))).toBe(true));
        for (const [a, b] of pairs(g.parts.map((p, k) => shifted(k, p.label)))) expect(disjoint(a, b)).toBe(true);
        expect(g.labelPx).toBeGreaterThanOrEqual(SPLIT.labelMinPx);
      });
      test(`${aspect} split into ${n}: the parts tile the whole (no gap, no overlap before the tear)`, () => {
        const area = (poly: readonly (readonly [number, number])[]) => Math.abs(poly.reduce((a, [x, y], i) => a + x * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * y, 0)) / 2;
        expect(g.parts.reduce((a, p) => a + area(p.poly), 0)).toBeCloseTo(g.slab.w * g.slab.h, 3);
      });
    }
  }
});

describe('list shots: standings, geometry, cue timing, punch feel', () => {
  const rankRows: [string, number[], 'higher' | 'lower', number[]][] = [
    ['higher: the biggest is #1', [5, 6.5, 2.8], 'higher', [1, 0, 2]],
    ['lower: the smallest is #1', [5, 6.5, 2.8], 'lower', [1, 2, 0]],
    ['equal values keep their order', [3, 3, 1], 'higher', [0, 1, 2]],
    ['negative values rank as numbers', [-1, 2, 0], 'higher', [2, 0, 1]],
  ];
  for (const [name, values, better, want] of rankRows) test(`rankOrder: ${name}`, () => expect(rankOrder(values, better)).toEqual(want));
  // Ranks [1, 0, 2] (Rome, Han, Parthia), arriving Parthia, Rome, Han: a countdown.
  const slotRows: [string, number, (number | undefined)[]][] = [
    ['nothing arrived', 0, [undefined, undefined, undefined]],
    ['the first arrival takes the top slot', 1, [undefined, undefined, 0]],
    ['a better newcomer takes the top and pushes it down', 2, [0, undefined, 1]],
    ['all arrived: slots are the final ranks', 3, [1, 0, 2]],
  ];
  for (const [name, k, want] of slotRows) test(`rankSlots: ${name}`, () => expect(rankSlots([1, 0, 2], [2, 0, 1], k)).toEqual(want));
  test('rankSlots: after every arrival the arrived items fill the top slots, each once', () => {
    const [ranks, arrival] = [[3, 0, 4, 1, 5, 2], [2, 5, 0, 3, 1, 4]];
    for (let k = 0; k <= ranks.length; k++) expect(rankSlots(ranks, arrival, k).filter((x) => x !== undefined).sort()).toEqual(Array.from({ length: k }, (_, i) => i));
  });
  const winRows: [string, { left: number; right: number; better: 'higher' | 'lower' | 'none' }, 'left' | 'right' | null][] = [
    ['higher: the bigger value wins', { left: 5, right: 9.8, better: 'higher' }, 'right'],
    ['lower: the smaller value wins', { left: 5, right: 9.8, better: 'lower' }, 'left'],
    ['a tie has no winner', { left: 5, right: 5, better: 'higher' }, null],
    ['none: no winner whatever the values', { left: 1, right: 9, better: 'none' }, null],
    ['negative values compare as numbers', { left: -20, right: 5, better: 'lower' }, 'left'],
  ];
  for (const [name, row, want] of winRows) test(`rowWinner: ${name}`, () => expect(rowWinner(row)).toBe(want));
  const [L_, R_, N_] = [{ left: 2, right: 1, better: 'higher' as const }, { left: 1, right: 2, better: 'higher' as const }, { left: 1, right: 2, better: 'none' as const }];
  const verdictRows: [string, (typeof L_ | typeof N_)[], 'left' | 'right' | null][] = [
    ['the side winning more rows wins', [R_, R_, L_], 'right'],
    ['a draw has no winner', [R_, L_], null],
    ['rows with no winner do not count', [N_, N_, L_], 'left'],
    ['no row has a winner', [N_], null],
  ];
  for (const [name, rows, want] of verdictRows) test(`versusVerdict: ${name}`, () => expect(versusVerdict(rows).winner).toBe(want));

  const within = (r: Rect, box: Rect) => r.x >= box.x - 0.5 && r.y >= box.y - 0.5 && r.x + r.w <= box.x + box.w + 0.5 && r.y + r.h <= box.y + box.h + 0.5;
  const disjoint = (a: Rect, b: Rect) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  const counts = ([lo, hi]: readonly [number, number]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  /** Sentence-case text at a character cap, in five-letter words (wraps like real text). */
  const prose = (n: number) => 'Wwwww '.repeat(n).slice(0, n).trim();
  for (const [aspect, L] of Object.entries(LAYOUTS)) {
    const stage = L.zone.stage;
    for (const n of counts(COUNTS.rankItems)) {
      // Worst case: the widest figures (full digits below a million, "98,765") under a unit line.
      const items = Array.from({ length: n }, (_, i) => ({ value: 98_765 - i * 1000 }));
      const g = rankingLayout(L, items, 'people');
      test(`${aspect} ranking of ${n}: every slot's numeral, label, full bar and value fit the stage`, () => {
        for (let k = 0; k < n; k++) {
          const top = g.top + k * g.slot;
          const value = { x: g.bar.x + g.bar.w + 16, y: top + g.value.y, w: g.value.w - 16, h: L.rank.value.line };
          for (const r of [g.numeral, g.label, g.bar].map((r) => ({ ...r, y: top + r.y }))) expect(within(r, stage)).toBe(true);
          expect(within(value, stage)).toBe(true);
        }
        expect(g.head && within(g.head.box, stage)).toBe(true);
      });
      test(`${aspect} ranking of ${n}: a label at its cap fits one line, rows never overlap`, () => {
        expect(CHARS.rankLabel * GLYPH_EM.trackedCaps * L.rank.label.px).toBeLessThanOrEqual(g.label.w);
        expect(Math.max(g.numeral.y + g.numeral.h, g.bar.y + g.bar.h, g.value.y + L.rank.value.line)).toBeLessThanOrEqual(g.slot);
      });
    }
    for (const n of counts(COUNTS.versusRows)) {
      const rows = Array.from({ length: n }, (_, i) => ({ label: 'W'.repeat(aspect === '9:16' ? 10 : CHARS.rowLabel), unit: 'km2' as const, left: 5_000_000 + i, right: 9_800_000 }));
      const g = versusLayout(L, rows);
      const boxes = [...g.sides, ...g.rows.flatMap((r) => [...r.labels, ...r.values])];
      test(`${aspect} versus of ${n}: names, labels and values fit the stage, never overlap, and stay readable`, () => {
        for (const b of boxes) expect(within(b, stage)).toBe(true);
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(disjoint(a, b)).toBe(true)));
        for (const r of g.rows) expect(r.value.px).toBeGreaterThanOrEqual(L.readable);
      });
      test(`${aspect} versus of ${n}: the VS badge clears every value`, () => {
        const d = L.versus.badge;
        const badge = { x: g.badge[0] - d / 2, y: g.badge[1] - d / 2, w: d, h: d };
        for (const r of g.rows) for (const v of [...r.values, ...r.labels]) expect(disjoint(badge, v)).toBe(true);
      });
    }
    for (const n of counts(COUNTS.checkItems)) {
      const g = checklistLayout(L, Array.from({ length: n }, () => prose(CHARS.item)));
      test(`${aspect} checklist of ${n}: items at the cap fit their slots at a readable size`, () => {
        expect(g.text.px).toBeGreaterThanOrEqual(L.readable);
        for (const r of g.rows) {
          expect(within(r.box, stage) && within(r.text, stage)).toBe(true);
          for (const l of r.lines) expect(l.length * GLYPH_EM.text * g.text.px).toBeLessThanOrEqual(r.text.w);
        }
        g.rows.forEach((a, i) => g.rows.slice(i + 1).forEach((b) => expect(disjoint(a.text, b.text)).toBe(true)));
      });
    }
    test(`${aspect} chat: bubbles at the cap stay inside the stage width beside their avatars, and every line fits its bubble`, () => {
      const g = chatLayout(L, Array.from({ length: COUNTS.chatMessages[1] }, (_, i) => ({ from: i % 2 ? ('b' as const) : ('a' as const), text: prose(CHARS.message) })));
      for (const b of g.bubbles) {
        expect(b.x).toBeGreaterThanOrEqual(stage.x + L.chat.avatar);
        expect(b.x + b.w).toBeLessThanOrEqual(stage.x + stage.w - L.chat.avatar);
        for (const l of b.lines) expect(l.length * GLYPH_EM.text * L.chat.text.px).toBeLessThanOrEqual(b.w - 2 * L.chat.pad);
      }
    });
  }

  const LIST_TOURS = ['ranking countdown, punch', 'versus, checklist', 'six-item ranking, chat, punch'];
  const LIST_KINDS = new Set(['punch', 'ranking', 'versus', 'checklist', 'chat']);
  for (const [format, make] of FORMAT_SHEETS) {
    for (const tour of LIST_TOURS) {
      test(`${format} "${tour}": every list-shot element lands on the frame its phrase is spoken`, () => {
        const s = make();
        SHOT_TOURS[tour]!(s);
        const tl = compileTimeline(s, voice(s));
        const beats = tl.beats.filter((b) => LIST_KINDS.has(b.shot.kind));
        expect(beats.length).toBeGreaterThanOrEqual(2);
        for (const b of beats) {
          for (const p of shotPhrases(b.shot)) expect(`${p}@${b.cues[p]}`).toBe(`${p}@${Math.max(b.from, b.spoken[findPhrase(b.spoken.map((w) => w.token), p)]!.frame)}`);
        }
      });
    }
  }

  /** Per register, how a punch word looks `after` frames past its cue: [p, scale, flash] ranges ([lo, hi]). */
  const CUE = 100;
  const punchRows: [Register, string, number, [number, number] | null, [number, number] | null, [number, number] | null][] = [
    ['documentary', 'on its cue: not yet in, no flash', 0, [0, 0], [1.3, 1.3], [0, 0]],
    ['documentary', 'settled after its frames', 9, [1, 1], [1, 1], null],
    ['deadpan', 'a flat cut: full size, fully in, one frame after its cue', 1, [1, 1], [1, 1], [0, 0]],
    ['comedic', 'springs past full size mid-landing', 6, [1.02, 1.2], [0.9, 0.995], null],
    ['comedic', 'a soft flash on its cue', 0, null, null, [0.35, 0.35]],
    ['hype', 'slams in from far over size', 1, [0.4, 0.8], [1.2, 1.7], [0.7, 0.85]],
    ['hype', 'the flash is gone after flashDecay', MOTION.flashDecay, null, null, [0, 0]],
    ['wholesome', 'eases in gently', 6, [0.3, 0.95], [1, 1.15], [0, 0]],
    ['dramatic', 'a slow fade: still under half in after 10 frames', 10, [0, 0.6], [1, 1.06], [0, 0]],
    ['dramatic', 'settled after its long fade', 60, [1, 1], [1, 1], null],
  ];
  const inRange = (v: number, r: [number, number] | null) => r === null || (v >= r[0] - 1e-9 && v <= r[1] + 1e-9);
  for (const [register, name, after, p, scale, flash] of punchRows) {
    test(`punch feel, ${register}: ${name}`, () => {
      const feel = REGISTERS[register].motion;
      const w = punchWord(feel, CUE + after, CUE);
      const got = { p: w.p, scale: w.scale, flash: punchFlash(feel, CUE + after, [CUE]) };
      expect({ p: inRange(got.p, p), scale: inRange(got.scale, scale), flash: inRange(got.flash, flash), got }).toMatchObject({ p: true, scale: true, flash: true });
    });
  }
  test('punch feel: every register lands every word at full size within 2 s', () => {
    for (const r of REGISTER_IDS) {
      const w = punchWord(REGISTERS[r].motion, CUE + 60, CUE);
      expect(w.p).toBe(1);
      expect(w.scale).toBeCloseTo(1, 12);
    }
  });
});

describe('frozen-frame audit', () => {
  test('frameChange is the mean absolute luma difference', () => expect(frameChange([0, 10, 20, 30], [0, 10, 24, 26])).toBe(2));
  test('frameChange fails loud on mismatched frames', () => expect(() => frameChange([1, 2], [1])).toThrow('sizes differ'));
  const step = Math.round(MOTION_PROBE.everySec * FPS);
  /** Samples every probe step over [0, 240) with the given change per sample. */
  const samples = (change: (f: number) => number): MotionSample[] => Array.from({ length: 30 }, (_, i) => ({ frame: i * step, change: i === 0 ? Infinity : change(i * step) }));
  const still = MOTION_PROBE.stillLuma / 2;
  const moving = MOTION_PROBE.stillLuma * 10;
  const beat = (kind: TimedBeat['shot']['kind']) => [{ id: 'b', kind, from: 0, to: 240 }];
  const rows: [string, TimedBeat['shot']['kind'], (f: number) => number, string[]][] = [
    ['a shot that keeps moving passes', 'headline', () => moving, []],
    ['a frozen headline is flagged once, naming the beat', 'headline', () => still, ['b']],
    ['a still map is allowed (maps may hold)', 'map', () => still, []],
    ['a still shorter than frozenSec passes', 'number', (f) => (f >= 80 && f < 80 + 3 * step ? still : moving), []],
    ['a still of exactly frozenSec worth of samples is flagged', 'pictogram', (f) => (f >= 80 && f < 80 + 4 * step ? still : moving), ['b']],
    ['two separate stills are two violations', 'quote', (f) => ((f >= 16 && f < 64) || (f >= 128 && f < 176) ? still : moving), ['b', 'b']],
  ];
  for (const [name, kind, change, want] of rows) {
    test(name, () => {
      const v = auditMotion(samples(change), beat(kind), FPS);
      expect(v.map((x) => x.beatId)).toEqual(want);
      for (const x of v) expect(x.check).toBe('frozen_frame');
    });
  }
  test('the still run is reported with its frames and seconds', () => {
    const [v] = auditMotion(samples((f) => (f >= 80 && f < 80 + 4 * step ? still : moving)), beat('line'), FPS);
    expect(v!.message).toContain(`frames ${80 - step}-${80 + 3 * step}`);
  });
  test('samples outside the beat do not count toward it', () => expect(auditMotion(samples(() => still), [{ id: 'b', kind: 'headline', from: 0, to: 2 * step }], FPS)).toEqual([]));
});

describe('map labels and arrows', () => {
  for (const [format, make] of FORMAT_SHEETS) {
    for (const [tour, swap] of Object.entries(SHOT_TOURS)) {
      test(`${format} "${tour}": no map label sits on a pen or army arrow`, () => {
        const s = make();
        swap(s);
        const tl = compileTimeline(s, voice(s));
        for (const b of tl.beats) {
          if (b.shot.kind !== 'map') continue;
          const L = LAYOUTS[tl.aspect];
          const map = tl.geo!.maps[b.map!]!;
          const pt = (p: string) => toScreen(b.camera!.to, map.places[p]!.at, L);
          for (const route of [...(b.shot.arrow ? [b.shot.arrow] : []), ...(b.shot.armies ?? [])]) {
            const arrow = penArrow(pt(route.from), pt(route.to));
            for (const { place } of b.shot.labels) {
              const r = labelRect(map.places[place]!.name, pt(place), b.labelSides![place]!);
              const hits = Array.from({ length: 41 }, (_, i) => arrowPoint(arrow, i / 40)).filter(([x, y]) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
              expect(`${place}: ${hits.length}`).toBe(`${place}: 0`);
            }
          }
        }
      });
    }
  }
});

describe.skipIf(!Bun.which('chromium-browser'))('render sandbox (real headless Chromium)', () => {
  const pngSize = (b64: string) => {
    const png = Buffer.from(b64, 'base64');
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  /** Page viewport, mounted stage, and the ink height of a map label (LABEL_FONT_PX). */
  const MEASURE = `(() => {
    const stage = document.getElementById('root').firstElementChild.getBoundingClientRect();
    const ink = document.createRange(); ink.selectNodeContents(document.querySelector('[data-vox-role="label:city:rome-it"]'));
    return { page: [innerWidth, innerHeight], stage: [stage.width, stage.height], labelInkH: ink.getBoundingClientRect().height };
  })()`;
  for (const [format, make] of FORMAT_SHEETS) {
    const sheet = make();
    const tl = compileTimeline(sheet, voice(sheet));
    const size = [tl.width, tl.height];
    test(`${format}: the scene is mounted unscaled at ${size.join('x')}`, async () => {
      const b2 = tl.beats[1]!; // a map with a Rome label
      const r = await withVoxScene(tl, async (s) => {
        await s.renderFrame(b2.to - 3);
        return { ...(await s.evaluate<{ page: number[]; stage: number[]; labelInkH: number }>(MEASURE)), png: pngSize(await s.screenshot('png')) };
      });
      expect(r).toMatchObject({ ok: true, value: { page: size, stage: size, png: size } });
      // A stage scaled to fit the page measures the label well under its font size.
      expect(r.ok && r.value.labelInkH).toBeGreaterThanOrEqual(LABEL_FONT_PX);
    }, 60_000);
    for (const [tour, swap] of Object.entries(SHOT_TOURS)) {
      test(`${format}: shot tour "${tour}" passes the layout audit and the frozen-frame check`, async () => {
        const s = make();
        swap(s);
        const t = compileTimeline(s, voice(s));
        const r = await auditTimeline(t);
        expect(r).toMatchObject({ ok: true, value: { violations: [] } });
        if (r.ok) for (const f of r.value.restFrames) expect(pngSize(f.pngBase64)).toEqual(size);
      }, 60_000);
    }
    test(`${format}: the probe catches shots that stop moving (push frozen), never maps`, async () => {
      const frozen = { ...tl, beats: tl.beats.map((b) => ({ ...b, push: { from: -1e9, to: 1e9 } })) };
      const r = await auditTimeline(frozen);
      const flagged = r.ok ? new Set(r.value.violations.filter((v) => v.check === 'frozen_frame').map((v) => v.beatId)) : null;
      const kindOf = (id: string) => tl.beats.find((b) => b.id === id)!.shot.kind;
      expect(flagged && [...flagged].some((id) => kindOf(id) === 'headline')).toBe(true);
      expect(flagged && [...flagged].filter((id) => kindOf(id) === 'map')).toEqual([]);
    }, 60_000);
  }
  /**
   * Pre-roll: a shot whose cue comes late still shows ink on the stage soon after it starts (the
   * line draws as soon as its axis is built; a year's label and pen rule arrive before the year).
   * The cue is pushed to the end of the beat; ink is counted above the axis band (x labels excluded).
   */
  const preRollRows: [string, string, string][] = [
    ['a line draws before a late cue', 'pictogram, line', 'b4'],
    ['a year number shows its label and rule before a late cue', 'three-way split, year', 'b4'],
  ];
  for (const [format, make] of FORMAT_SHEETS) {
    for (const [name, tour, id] of preRollRows) {
      test(`${format}: pre-roll: ${name}`, async () => {
        const s = make();
        SHOT_TOURS[tour]!(s);
        const tl = compileTimeline(s, voice(s));
        const beat = tl.beats.find((b) => b.id === id)!;
        beat.cues = Object.fromEntries(Object.keys(beat.cues).map((p) => [p, beat.to - 10]));
        const scale = 0.5;
        const { stage } = LAYOUTS[tl.aspect].zone;
        const r = await withVoxScene(tl, async (sess) => {
          await sess.renderFrame((beat.enter?.to ?? beat.from) + MOTION.ruleDraw + 20);
          return sess.evaluate<number[]>(DECODE_LUMA(await sess.screenshot('png', undefined, scale)));
        });
        const w = Math.round(tl.width * scale);
        const ink = r.ok ? r.value.filter((l, i) => l < 110 && (i % w) / scale >= stage.x && (i % w) / scale < stage.x + stage.w && Math.floor(i / w) / scale >= stage.y && Math.floor(i / w) / scale < stage.y + stage.h * 0.85).length : -1;
        expect(ink).toBeGreaterThan(150);
      }, 60_000);
    }
  }
  /**
   * Phone fill: at rest, each 9:16 shot's ink (textures off) spans most of the stage, and no text
   * on it is under the phone's readable size. Rows at a count's worst case (six marks, five
   * nodes, a hundred pictogram cells) shrink to fit, so they carry their own floor.
   */
  const fillRows: [string, string, string, { w: number; h: number; fontPx: number }][] = [
    ['a two-mark timeline', 'headline, map, number', 'b6', { w: 0.55, h: 0.85, fontPx: 48 }],
    ['a six-mark timeline', 'annotated map, timeline, comparison, quote', 'b3', { w: 0.5, h: 0.85, fontPx: 32 }],
    ['a number with its comparison', 'annotated map, timeline, comparison, quote', 'b4', { w: 0.9, h: 0.85, fontPx: 48 }],
    ['a lone number', 'headline, map, number', 'b4', { w: 0.5, h: 0.6, fontPx: 48 }],
    ['a year', 'three-way split, year', 'b4', { w: 0.85, h: 0.25, fontPx: 48 }],
    ['a hundred pictogram cells in three groups', 'pictogram, line', 'b3', { w: 0.9, h: 0.9, fontPx: 48 }],
    ['a split in two', 'army arrows, split, growing chain', 'b3', { w: 0.95, h: 0.85, fontPx: 48 }],
    ['a split in three', 'three-way split, year', 'b3', { w: 0.95, h: 0.9, fontPx: 48 }],
    ['a chain of three', 'army arrows, split, growing chain', 'b4', { w: 0.6, h: 0.75, fontPx: 48 }],
    ['a chain of five', 'army arrows, split, growing chain', 'b5', { w: 0.5, h: 0.85, fontPx: 48 }],
    ['three punch words on ink', 'ranking countdown, punch', 'b5', { w: 0.98, h: 0.98, fontPx: 48 }],
    ['a four-item ranking', 'ranking countdown, punch', 'b3', { w: 0.9, h: 0.8, fontPx: 48 }],
    ['a six-item ranking', 'six-item ranking, chat, punch', 'b2', { w: 0.9, h: 0.85, fontPx: 48 }],
    ['a four-row versus', 'versus, checklist', 'b4', { w: 0.9, h: 0.85, fontPx: 48 }],
    ['a five-item checklist', 'versus, checklist', 'b5', { w: 0.8, h: 0.85, fontPx: 48 }],
    ['a six-message chat', 'six-item ranking, chat, punch', 'b3', { w: 0.85, h: 0.85, fontPx: 48 }],
    ['an icon pictogram with a per key', 'icon pictogram, negative temperature, inflation', 'b3', { w: 0.9, h: 0.8, fontPx: 48 }],
    ['a line', 'pictogram, line', 'b4', { w: 0.75, h: 0.7, fontPx: 48 }],
    ['a quote', 'annotated map, timeline, comparison, quote', 'b5', { w: 0.8, h: 0.6, fontPx: 48 }],
  ];
  /** Smallest font size of any text the beat shows. */
  const MIN_FONT_PX = (beatId: string) => `Math.min(...[...document.querySelectorAll('[data-vox-text][data-vox-beat="${beatId}"]')]
    .flatMap((el) => [el, ...el.querySelectorAll('*')])
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((el) => parseFloat(getComputedStyle(el).fontSize)))`;
  for (const [name, tour, id, want] of fillRows) {
    test(`short: ${name} fills the phone stage with readable text`, async () => {
      const s = toShort(clone());
      SHOT_TOURS[tour]!(s);
      const tl = compileTimeline(s, voice(s));
      const i = tl.beats.findIndex((b) => b.id === id);
      // At rest: before the next beat's transition starts moving this one off.
      const rest = (tl.beats[i + 1]?.enter?.from ?? tl.beats[i]!.to) - 3;
      const { stage } = LAYOUTS['9:16'].zone;
      const r = await withVoxScene(
        tl,
        async (sess) => {
          await sess.renderFrame(rest);
          return { luma: await sess.evaluate<number[]>(DECODE_LUMA(await sess.screenshot('png'))), fontPx: await sess.evaluate<number>(MIN_FONT_PX(id)) };
        },
        FLAT_ASSETS,
      );
      if (!r.ok) throw new Error(r.error);
      const paper = [0.299, 0.587, 0.114].reduce((l, k, i) => l + k * parseInt(COLOR.paper.slice(1 + 2 * i, 3 + 2 * i), 16), 0);
      const ink = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      r.value.luma.forEach((l, i) => {
        const [x, y] = [i % tl.width, Math.floor(i / tl.width)];
        if (Math.abs(l - paper) < 24 || x < stage.x || x >= stage.x + stage.w || y < stage.y || y >= stage.y + stage.h) return;
        [ink.x0, ink.y0, ink.x1, ink.y1] = [Math.min(ink.x0, x), Math.min(ink.y0, y), Math.max(ink.x1, x), Math.max(ink.y1, y)];
      });
      const got = { w: (ink.x1 - ink.x0) / stage.w, h: (ink.y1 - ink.y0) / stage.h, fontPx: r.value.fontPx };
      expect(got.w).toBeGreaterThanOrEqual(want.w);
      expect(got.h).toBeGreaterThanOrEqual(want.h);
      expect(got.fontPx).toBeGreaterThanOrEqual(want.fontPx);
    }, 60_000);
  }
  // A punch lands in its register's feel (flat cut, slam + shake + flash, slow fade): in every tone it passes both audits on a phone.
  for (const register of REGISTER_IDS) {
    test(`short, ${register}: a punch (and a ranking) pass the layout audit and the frozen-frame check`, async () => {
      const s = { ...toShort(clone()), register };
      SHOT_TOURS['ranking countdown, punch']!(s);
      const r = await auditTimeline(compileTimeline(s, voice(s)));
      expect(r).toMatchObject({ ok: true, value: { violations: [] } });
    }, 60_000);
  }
  test('an end year a mark already names is not printed twice', async () => {
    const s = toShort(clone());
    const tl = compileTimeline(s, voice(s));
    const b6 = tl.beats.find((b) => b.id === 'b6')!; // marks 117 and 476 on a -27…476 ruler
    const r = await withVoxScene(tl, async (sess) => {
      await sess.renderFrame(b6.to - 20);
      return sess.evaluate<string[]>(`[...document.querySelectorAll('[data-vox-role]')].map((e) => e.dataset.voxRole)`);
    });
    expect(r.ok && r.value.filter((role) => role.startsWith('end-'))).toEqual(['end-0']);
  }, 60_000);
});

describe('screenplay agent (LLM mocked at the I/O edge)', () => {
  const model = { providerId: 'anthropic', modelId: 'claude-opus-5-5' };
  const bad = clone();
  (bad.beats[0]!.shot as { highlight: string }).highlight = 'nowhere';

  test('feeds violations back and accepts the corrected sheet', async () => {
    const { calls, llm } = scripted(JSON.stringify(bad), '```json\n' + JSON.stringify(FIXTURE) + '\n```');
    expect(await runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 't', targetDurationSec: 30, model, llm })).toEqual(FIXTURE);
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).toContain('[highlight_visible] b1');
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt).toEqual(bad);
    expect(calls[0]!.cachedContext).toBe(VOX_SCREENPLAY_BIBLE);
  });
  test('the prompt states every enforced character cap', () => {
    for (const n of new Set(Object.values(CHARS))) expect(VOX_SCREENPLAY_BIBLE).toContain(`≤${n}`);
  });
  test('the prompt documents every shot kind and states every diagram count', () => {
    for (const kind of ShotSchema.options.map((o) => o.shape.kind.value)) expect(VOX_SCREENPLAY_BIBLE).toContain(`{kind:"${kind}"`);
    for (const [min, max] of Object.values(COUNTS)) expect(VOX_SCREENPLAY_BIBLE).toContain(min ? `(${min}-${max})` : `(≤${max})`);
  });
  test('the prompt never asks for sources or citations', () => expect(VOX_SCREENPLAY_BIBLE).not.toMatch(/source|cite/i));
  for (const [format, f] of Object.entries(FORMATS) as [Format, (typeof FORMATS)[Format]][]) {
    test(`${format}: the request states every enforced pacing number`, async () => {
      const { calls, llm } = scripted(JSON.stringify(FIXTURE));
      await runVoxScreenplayAgent({ videoId: 'vid', format, topic: 't', targetDurationSec: f.targetSec, model, llm }).catch(() => {});
      const req = JSON.parse(calls[0]!.userPrompt);
      const rules = req.format_rules.join('\n');
      const budget = wordBudget(f, f.targetSec).join('-');
      expect(req.narration_words).toBe(budget);
      const hook = f.hookMaxWords === null ? [] : [`at most ${f.hookMaxWords} words`];
      for (const n of [`${f.beatWords.min}-${f.beatWords.max} words`, `${f.headlineChars} characters`, wordBudget(f, 60).join('-'), `${f.visualEverySec} seconds`, ...hook]) expect(rules).toContain(n);
    });
  }
  test('invalid JSON is reported back, not swallowed', async () => {
    const { calls, llm } = scripted('{nope', JSON.stringify(FIXTURE));
    await runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 't', targetDurationSec: 30, model, llm });
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).toContain('Invalid JSON');
  });
  test('fails loud after the attempt budget', async () => {
    const { calls, llm } = scripted(JSON.stringify(bad));
    await expect(runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 't', targetDurationSec: 30, model, llm })).rejects.toThrow('highlight_visible');
    expect(calls).toHaveLength(MAX_SCREENPLAY_ATTEMPTS);
  });
  test('bible lists every catalog id the schema accepts', () => {
    for (const id of ['rome_ce117', "Hadrian's Wall", 'rome_region', 'europe_africa', 'km2', 'chapter', 'cold_open']) expect(VOX_SCREENPLAY_BIBLE).toContain(id);
  });

  const fixedB3 = { ...FIXTURE.beats[2]!, shot: { kind: 'map', view: 'mediterranean', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [{ place: 'city:rome-it' }] } };
  test('repair replaces only the failing beat', async () => {
    const { llm } = scripted(JSON.stringify(fixedB3));
    const out = await repairVoxBeat({ sheet: clone(), beatId: 'b3', problems: ['x'], model, llm });
    expect(out.beats[2]).toEqual(fixedB3 as never);
    expect(out.beats.filter((_, i) => i !== 2)).toEqual(FIXTURE.beats.filter((_, i) => i !== 2));
  });
  test('repair rejects a narration change (audio is already voiced)', async () => {
    const { calls, llm } = scripted(JSON.stringify({ ...fixedB3, narration: 'Something new to say about this map.' }), JSON.stringify(fixedB3));
    await repairVoxBeat({ sheet: clone(), beatId: 'b3', problems: ['x'], model, llm });
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).toContain('narration_locked');
  });
  // A violation another beat already had (here: a rule added after the sheet was written) is not repair's job.
  const withOldViolation = () => {
    const s = clone();
    s.beats[3]!.shot = { kind: 'timeline', from: -800, to: 1500, marks: [{ year: -753, label: 'founded' }, { year: -509, label: 'republic' }] };
    return s;
  };
  test('repair rejects an unchanged shot (it would fail the audit again)', async () => {
    const { calls, llm } = scripted(JSON.stringify(FIXTURE.beats[2]), JSON.stringify(fixedB3));
    await repairVoxBeat({ sheet: clone(), beatId: 'b3', problems: ['x'], model, llm });
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).toContain('repair_unchanged');
  });
  test('repair is not blocked by a violation another beat already had', async () => {
    const { calls, llm } = scripted(JSON.stringify(fixedB3));
    const out = await repairVoxBeat({ sheet: withOldViolation(), beatId: 'b3', problems: ['x'], model, llm });
    expect(calls).toHaveLength(1);
    expect(out.beats[2]).toEqual(fixedB3 as never);
  });
  test('repair is still blocked by a violation in its own beat', async () => {
    const unspoken = { ...fixedB3, shot: { ...fixedB3.shot, labels: [{ place: 'rome', at: 'words nobody says' }] } };
    const { calls, llm } = scripted(JSON.stringify(unspoken), JSON.stringify(fixedB3));
    await repairVoxBeat({ sheet: withOldViolation(), beatId: 'b3', problems: ['x'], model, llm });
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).toContain('phrases_spoken');
    expect(JSON.parse(calls[1]!.userPrompt).previous_attempt_violations).not.toContain('timeline_fit');
  });
});

describe('produceVoxVideo (sandbox mocked at the I/O edge)', () => {
  const sheet = clone();
  const violation = { beatId: 'b3', frame: 1, check: 'text_overlap' as const, message: 'a overlaps b' };
  const audits = (...rounds: (typeof violation)[][]) => {
    let n = 0;
    return async () => ({ ok: true as const, value: { violations: rounds[Math.min(n++, rounds.length - 1)]!, restFrames: [] } });
  };
  const base = { sheet, words: voice(sheet), audioPath: 'a.wav', outputPath: `${Bun.env.TMPDIR ?? '/tmp'}/vox-test-out.mp4`, render: async () => {} };

  test('clean audit renders straight away', async () => {
    const r = await produceVoxVideo({ ...base, audit: audits([]) });
    expect(r.state).toBe('Rendered');
  });
  test('failing beat is repaired, re-audited, then rendered', async () => {
    const repaired: string[] = [];
    const r = await produceVoxVideo({ ...base, audit: audits([violation], []), repair: async (s, id) => (repaired.push(id), s) });
    expect(r).toMatchObject({ state: 'Rendered', repairedBeats: ['b3'] });
    expect(repaired).toEqual(['b3']);
  });
  test('without a repairer, audit failures are returned, never rendered', async () => {
    let rendered = false;
    const r = await produceVoxVideo({ ...base, audit: audits([violation]), render: async () => void (rendered = true) });
    expect(r).toMatchObject({ state: 'AuditFailed', violations: [violation] });
    expect(rendered).toBe(false);
  });
  test('repairs stop after the round budget', async () => {
    const r = await produceVoxVideo({ ...base, audit: audits([violation]), repair: async (s) => s });
    expect(r).toMatchObject({ state: 'AuditFailed', repairedBeats: ['b3', 'b3'] });
  });
  test('sandbox crash is surfaced', async () => {
    const r = await produceVoxVideo({ ...base, audit: async () => ({ ok: false as const, stage: 'bundle' as const, error: 'boom' }) });
    expect(r).toEqual({ state: 'SandboxFailed', stage: 'bundle', error: 'boom' });
  });
});

describe('shared schemas', () => {
  test('committed shared/ JSON Schemas match the zod contracts (run scripts/emit-schemas.ts)', async () => {
    const { SHARED_SCHEMAS } = await import('./schemas');
    for (const [path, schema] of Object.entries(SHARED_SCHEMAS)) expect(await Bun.file(path).json()).toEqual(JSON.parse(JSON.stringify(schema)));
  });
});

// ── Tone (Register) ─────────────────────────────────────────────────────────

describe('Tone: resolveStyle (one register row × one format row)', () => {
  // Short of 60 s: narration budget scaled by the register's measured words/s (spike 2026-11-25) over Puck's 2.9.
  const rows: [Register, [number, number], string, string][] = [
    ['documentary', [130, 160], 'Puck', 'vox_clean'],
    ['deadpan', [101, 125], 'Schedar', 'vox_flat'],
    ['comedic', [115, 142], 'Puck', 'vox_clean'],
    ['hype', [139, 171], 'Fenrir', 'vox_hype'],
    ['wholesome', [101, 125], 'Sulafat', 'vox_clean'],
    ['dramatic', [80, 99], 'Algenib', 'vox_serif'],
  ];
  for (const [register, budget, voiceId, captions] of rows) {
    test(`${register}: a 60 s short is ${budget.join('-')} words, voice ${voiceId}, captions ${captions}`, () => {
      const style = resolveStyle(FORMATS.short, register);
      expect(wordBudget(style.format, 60)).toEqual(budget);
      expect(style).toMatchObject({ register, voice: { voiceId }, captions, format: { aspect: '9:16', beatWords: FORMATS.short.beatWords, hookMaxWords: 12 } });
    });
  }
  test('every row is covered', () => expect(rows.map((r) => r[0]).sort()).toEqual([...REGISTER_IDS].sort()));
  for (const f of Object.keys(FORMATS) as Format[]) {
    test(`documentary is today's ${f} exactly: same format row, paper grade, no prompt block, style, tags or SFX`, () => {
      const style = resolveStyle(FORMATS[f], 'documentary');
      expect(style.format).toEqual(FORMATS[f]);
      expect(style).toMatchObject({ grade: PAPER_GRADE, voice: { style: null, tags: {} }, sfx: [], motion: { duration: 1, spring: 0, push: 1, shake: 0 }, transitions: { swap: {}, punchline: null } });
      expect(registerRules(style)).toBeNull();
    });
  }
  for (const register of REGISTER_IDS) {
    test(`${register}: motion inside MOTION_LIMITS, a real caption style, known sounds, the Vox fonts`, () => {
      const { motion, captions, sfx } = REGISTERS[register];
      expect(motion.spring).toBeLessThanOrEqual(MOTION_LIMITS.spring);
      expect(motion.shake).toBeLessThanOrEqual(MOTION_LIMITS.shake);
      expect(motion.duration).toBeGreaterThanOrEqual(MOTION_LIMITS.durationMin);
      expect(motion.duration).toBeLessThanOrEqual(MOTION_LIMITS.durationMax);
      expect(motion.push).toBeGreaterThanOrEqual(MOTION_LIMITS.pushMin);
      expect(motion.push).toBeLessThanOrEqual(MOTION_LIMITS.pushMax);
      expect(['Libre Franklin', 'Source Serif 4']).toContain(CAPTION_STYLES[captions].fontName);
      for (const r of sfx as readonly SfxRule[]) expect(SFX[r.sound]).toBeDefined();
    });
  }
  test('only deadpan and comedic may cut', () =>
    expect(REGISTER_IDS.filter((r) => (REGISTERS[r].transitions.punchline as string | null) === 'cut')).toEqual(['deadpan', 'comedic']));
});

describe('Tone: screenplay prompt (register block after the cached bible)', () => {
  const model = { providerId: 'anthropic', modelId: 'claude-opus-5-5' };
  for (const register of REGISTER_IDS) {
    test(`${register}: the bible stays the cached prefix; the request ${register === 'documentary' ? 'has no register block' : 'carries the register block and its scaled budget'}`, async () => {
      const { calls, llm } = scripted(JSON.stringify(FIXTURE), JSON.stringify(FIXTURE), JSON.stringify(FIXTURE));
      const sheet = await runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 't', targetDurationSec: 30, register, model, llm }).catch(() => null);
      const req = JSON.parse(calls[0]!.userPrompt);
      expect(calls[0]!.cachedContext).toBe(VOX_SCREENPLAY_BIBLE);
      expect(VOX_SCREENPLAY_BIBLE).not.toContain('Tone:');
      expect(req.narration_words).toBe(wordBudget(resolveStyle(FORMATS.explainer, register).format, 30).join('-'));
      expect(req.register_rules).toEqual(registerRules(resolveStyle(FORMATS.explainer, register)) ?? undefined);
      if (register !== 'documentary') expect(req.register_rules[0]).toContain(`Tone: ${register}`);
      // The register is stamped by code; a sheet the budget accepts comes back in its register.
      if (sheet) expect(sheet.register).toBe(register);
    });
  }
  test('documentary sends exactly the pre-Tone request (no register_rules key)', async () => {
    const { calls, llm } = scripted(JSON.stringify(FIXTURE));
    await runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 't', targetDurationSec: 30, model, llm });
    expect(Object.keys(JSON.parse(calls[0]!.userPrompt))).toEqual(['task', 'video_id', 'format', 'format_rules', 'topic', 'target_duration_sec', 'narration_words', 'required_shape']);
  });
  test('comedic allows satire as data; documentary keeps the bible accuracy rules', () => {
    expect(registerRules(resolveStyle(FORMATS.short, 'comedic'))!.join('\n')).toMatch(/Satire is allowed/);
    expect(VOX_SCREENPLAY_BIBLE).toContain('Never invent quotes, numbers or events.');
  });
  test('the LLM may not write tags into narration', () => {
    const s = clone();
    s.beats[0]!.narration = `${s.beats[0]!.narration} <short pause>`;
    const r = checkBeatSheet(s);
    expect(r.ok === false && r.violations[0]!.message).toContain('no tags in narration');
  });
  test('the word budget follows the register', () => {
    const s = clone(); // 30 s explainer, within documentary's budget, too long for dramatic's slow voice
    expect(checkBeatSheet({ ...s, register: 'documentary' }).ok).toBe(true);
    const r = checkBeatSheet({ ...s, register: 'dramatic' });
    expect(r.ok === false && r.violations.map((v) => v.rule)).toEqual(['word_budget']);
  });
});

describe('Tone: vocal tags (inserted by code, stripped before alignment)', () => {
  const beats = [
    { act: 'cold_open', narration: 'Rome did not fall in 476.' },
    { act: 'turn', narration: 'It split. The West fell first.' },
    { act: 'turn', narration: 'The East kept going.' },
    { act: 'payoff', narration: 'For a thousand years.' },
    { act: 'ending', narration: 'Until 1453.' },
  ] as const;
  const plain = beats.map((b) => b.narration).join(' ');
  const rows: [Register, string][] = [
    ['documentary', plain],
    ['hype', plain],
    ['deadpan', 'Rome did not fall in 476. It split. <short pause> The West fell first. The East kept going. For a thousand years. <short pause> Until 1453.'],
    ['comedic', 'Rome did not fall in 476. It split. <short pause> The West fell first. The East kept going. For a thousand years. <chuckle> <short pause> Until 1453.'],
    ['wholesome', 'Rome did not fall in 476. It split. The West fell first. The East kept going. For a thousand years. <breath> Until 1453.'],
    ['dramatic', 'Rome did not fall in 476. It split. <short pause> The West fell first. The East kept going. <long pause> For a thousand years. Until 1453.'],
  ];
  for (const [register, want] of rows) {
    test(`${register}: tags land where the row says`, () => expect(voiceScript(beats, register)).toBe(want));
    test(`${register}: stripping the tags gives back the plain narration`, () => expect(stripVocalTags(voiceScript(beats, register))).toBe(plain));
  }
  test('punchline beats: the first beat of each punch act only', () =>
    expect(punchlineBeats(['cold_open', 'turn', 'turn', 'payoff', 'ending', 'ending'], ['turn', 'ending'])).toEqual([false, true, false, false, true, false]));
  test('a decimal is not a sentence end', () =>
    expect(voiceScript([{ act: 'turn', narration: 'It grew 5.5 times. Then it stopped.' }], 'deadpan')).toBe('It grew 5.5 times. <short pause> Then it stopped.'));
});

describe('Tone: motion feel', () => {
  const doc = REGISTERS.documentary.motion;
  test('back ease with no spring is the house ease-out', () => {
    for (const t of [0, 0.1, 0.37, 0.5, 0.9, 1]) expect(backOut(0)(t)).toBeCloseTo(EASE.out(t), 12);
  });
  test('a 1.7 spring overshoots about 10% and settles on 1', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => backOut(1.7)(i / 100)));
    expect(peak).toBeGreaterThan(1.08);
    expect(peak).toBeLessThan(1.12);
    expect(backOut(1.7)(1)).toBe(1);
  });
  const landRows: [string, Parameters<typeof landing>, number][] = [
    ['documentary lands exactly like the house progress', [doc, 5, 0, 9], progress(5, 0, 9)],
    ['a slower register is less far along', [{ ...doc, duration: 1.3 }, 5, 0, 9], progress(5, 0, 9 * 1.3)],
    ['a spring passes its target mid-landing', [{ ...doc, spring: 2 }, 6, 0, 9], backOut(2)(6 / 9)],
    ['done is done', [{ ...doc, duration: 0.7, spring: 2 }, 30, 0, 9], 1],
  ];
  for (const [name, args, want] of landRows) test(`landing: ${name}`, () => expect(landing(...args)).toBe(want));
  const pushRows: [string, number, number][] = [
    ['amplitude 1 is the PUSH row exactly', 1, PUSH.quote[0]],
    ['amplitude 1.5 starts further out', 1.5, 1 - (1 - PUSH.quote[0]) * 1.5],
    ['amplitude 0.7 starts closer', 0.7, 1 - (1 - PUSH.quote[0]) * 0.7],
  ];
  for (const [name, amp, start] of pushRows) {
    test(`pushScale: ${name}, and still ends at 1`, () => {
      expect(pushScale('quote', { from: 0, to: 100 }, 0, amp)).toBeCloseTo(start, 12);
      expect(pushScale('quote', { from: 0, to: 100 }, 100, amp)).toBe(1);
    });
  }
  const shakeRows: [string, number, readonly number[], number, boolean][] = [
    ['no shake in the feel: still', 0, [10], 10, false],
    ['shakes on the cue frame', 14, [10], 10, true],
    ['still shaking just before SHAKE_FRAMES', 14, [10], 10 + SHAKE_FRAMES - 1, true],
    ['stops after SHAKE_FRAMES', 14, [10], 10 + SHAKE_FRAMES, false],
    ['nothing before the cue', 14, [10], 9, false],
  ];
  for (const [name, shake, cues, frame, moves] of shakeRows) {
    test(`shakeAt: ${name}`, () => {
      const [x, y] = shakeAt({ ...doc, shake }, cues, frame);
      expect(Math.hypot(x, y) > 0).toBe(moves);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(shake * Math.SQRT2);
    });
  }
});

describe('Tone: compiled transitions and the register-gated motion audit', () => {
  const compiled = (register: Register, make: () => BeatSheet = clone) => {
    const s = { ...make(), register };
    return compileTimeline(s, voice(s));
  };
  // Fixture explainer: b2 wipe, b3 same-world glide, b4 push, b5 (the ending's first beat = punchline) push.
  const rows: [Register, string][] = [
    ['documentary', '- wipe glide push push'],
    ['deadpan', '- wipe glide push cut'],
    ['comedic', '- wipe glide push cut'],
    ['hype', '- wipe glide zoom zoom'],
    ['wholesome', '- wipe glide push push'],
    ['dramatic', '- dip glide dip dip'],
  ];
  for (const [register, kinds] of rows) {
    test(`${register}: transitions ${kinds}; the timeline carries the register's grade and feel and passes its own audit`, () => {
      const tl = compiled(register);
      expect(tl.beats.map((b) => b.enter?.kind ?? '-').join(' ')).toBe(kinds);
      expect(tl).toMatchObject({ register, grade: REGISTERS[register].grade });
      for (const b of tl.beats) expect(b.feel).toEqual(REGISTERS[register].motion);
      expect(auditTimelineMotion(tl)).toEqual([]);
    });
  }
  const withBeat = (tl: Timeline, id: string, patch: Partial<TimedBeat>): Timeline => ({ ...tl, beats: tl.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const cut = (tl: Timeline, id: string) => withBeat(tl, id, { enter: { kind: 'cut', from: tl.beats.find((b) => b.id === id)!.from, to: tl.beats.find((b) => b.id === id)!.from } });
  const auditRows: [string, () => Timeline, string[]][] = [
    ['a documentary cut is flagged', () => cut(compiled('documentary'), 'b5'), ['hard_cut:b5']],
    ['a deadpan cut into its punchline beat passes', () => cut(compiled('deadpan'), 'b5'), []],
    ['a deadpan cut into a non-punchline beat is flagged', () => cut(compiled('deadpan'), 'b4'), ['hard_cut:b4']],
    ['a hype cut is flagged (hype never cuts)', () => cut(compiled('hype'), 'b5'), ['hard_cut:b5']],
    ['overshoot on documentary is flagged', () => withBeat(compiled('documentary'), 'b4', { feel: { ...REGISTERS.documentary.motion, spring: 1.7 } }), ['register_motion:b4']],
    ['comedic overshoot within its row passes', () => withBeat(compiled('comedic'), 'b4', { feel: { ...REGISTERS.comedic.motion, spring: 1.7 } }), []],
    ['shake past the hard limit is flagged even for hype', () => withBeat(compiled('hype'), 'b4', { feel: { ...REGISTERS.hype.motion, shake: 20 } }), ['register_motion:b4']],
    ['shake on a register without shake is flagged', () => withBeat(compiled('dramatic'), 'b4', { feel: { ...REGISTERS.dramatic.motion, shake: 4 } }), ['register_motion:b4']],
    ['a push amplitude that would stop the camera is flagged', () => withBeat(compiled('deadpan'), 'b4', { feel: { ...REGISTERS.deadpan.motion, push: 0.2 } }), ['register_motion:b4']],
  ];
  for (const [name, make, want] of auditRows) test(`audit: ${name}`, () => expect(auditTimelineMotion(make()).map((v) => `${v.check}:${v.beatId}`)).toEqual(want));
  test('a slower register is audited after its slower entrances settle', () => {
    const [doc, slow] = [compiled('documentary'), compiled('dramatic')].map((tl) => auditFrames(tl).find((f) => f.beatId === 'b4')!.frame);
    expect(slow! - doc!).toBe(Math.ceil(MOTION.layerBleed * REGISTERS.dramatic.motion.duration) - MOTION.layerBleed);
  });
});

describe('Tone: SFX placement (from word-timed cue frames)', () => {
  const beat = (id: string, act: string, from: number, kind: string, enter: string | null, cues: Record<string, number>, spoken: number) =>
    ({ id, act, from, to: from + 60, shot: { kind }, cues, spoken: [{ token: 'w', frame: spoken }], ...(enter && { enter: { kind: enter, from, to: from } }) }) as unknown as TimedBeat;
  const tl = {
    fps: 30,
    beats: [beat('a', 'cold_open', 0, 'headline', null, {}, 2), beat('b', 'turn', 60, 'number', 'push', { five: 75 }, 64), beat('c', 'payoff', 120, 'number', 'glide', { ten: 150 }, 124)],
  } as unknown as Timeline;
  const rows: [string, SfxRule, string[], string[]][] = [
    ['a whoosh peaks on every non-glide beat change', { on: { at: 'transition' }, sound: 'whoosh', gainDb: -10 }, [], ['whoosh@1700']],
    ['an impact lands on each cue of the listed shots', { on: { at: 'cue', shots: ['number'] }, sound: 'impact', gainDb: -9 }, [], ['impact@2500', 'impact@5000']],
    ['cues of other shots are ignored', { on: { at: 'cue', shots: ['pictogram'] }, sound: 'impact', gainDb: -9 }, [], []],
    ['a stinger lands on a punchline beat’s first word', { on: { at: 'punchline' }, sound: 'stinger', gainDb: -12 }, ['turn'], ['stinger@2133']],
    ['no punch acts, no stinger', { on: { at: 'punchline' }, sound: 'stinger', gainDb: -12 }, [], []],
    ['a riser ends on the act’s first word', { on: { at: 'act', act: 'payoff' }, sound: 'riser', gainDb: -12 }, [], ['riser@2533']],
    ['a riser before the first word of the video starts at 0', { on: { at: 'act', act: 'cold_open' }, sound: 'riser', gainDb: -12 }, [], ['riser@0']],
    ['an act the video lacks places nothing', { on: { at: 'act', act: 'ending' }, sound: 'sub_boom', gainDb: -6 }, [], []],
  ];
  for (const [name, rule, punchActs, want] of rows) test(name, () => expect(sfxCues(tl, [rule], punchActs as never).map((c) => `${c.sound}@${c.startMs}`)).toEqual(want));
  test('cues from several rules come back sorted by start', () => {
    const cues = sfxCues(tl, REGISTERS.hype.sfx, []);
    expect(cues.map((c) => c.startMs)).toEqual([...cues.map((c) => c.startMs)].sort((x, y) => x - y));
  });
  test('documentary places no sound (the voice is muxed alone)', () => expect(sfxCues(tl, REGISTERS.documentary.sfx, [])).toEqual([]));
  test('the mix delays each cue, ducks the sum under the voice and limits', () => {
    const g = sfxMixGraph([{ sound: 'impact', startMs: 2500, gainDb: -9 }, { sound: 'whoosh', startMs: 1700, gainDb: -10 }], 1, 2);
    expect(g).toContain('[2:a]volume=-9dB,adelay=2500:all=1[s0]');
    expect(g).toContain('[3:a]volume=-10dB,adelay=1700:all=1[s1]');
    expect(g).toContain('[s0][s1]amix=inputs=2:normalize=0[fx]');
    expect(g).toContain('[fx][key]sidechaincompress');
    expect(g.endsWith('[aout]')).toBe(true);
  });
});

describe('Tone: caption styles', () => {
  const words = 'The West fell in 476 and the East kept going'.split(' ').map((word, i) => ({ word, start_ms: i * 300, end_ms: i * 300 + 280 }));
  const events = (style: Parameters<typeof buildAssSubtitles>[2]) => buildAssSubtitles(words, '9:16', style).split('\n').filter((l) => l.startsWith('Dialogue'));
  test('vox_clean is unchanged: no scale pop, highlighter-yellow active word', () => {
    expect(events('vox_clean').join('\n')).not.toContain('\\fscx');
    expect(events('vox_clean')[0]).toContain('{\\c&H0000F2FF}The');
  });
  test('vox_flat has no active-word colour', () => expect(events('vox_flat')[0]).toContain(`{\\c${CAPTION_STYLES.vox_flat.primaryAssColor}}The`));
  test('vox_hype: ALL CAPS, at most 2 words per cue, the spoken word pops to 115%', () => {
    const ev = events('vox_hype');
    expect(ev[0]).toContain('{\\c&H0000F2FF\\fscx115\\fscy115}THE{\\c&H00F1ECEC\\fscx100\\fscy100}');
    for (const e of ev) expect(e.split(',').slice(9).join(',').replace(/\{[^}]*\}/g, '').trim().split(/\s+/).length).toBeLessThanOrEqual(2);
  });
  test('vox_serif: Source Serif 4 italic, lowercase', () => {
    const ass = buildAssSubtitles(words, '9:16', 'vox_serif');
    expect(ass).toMatch(/Style: Default,Source Serif 4,\d+,[^,]+,[^,]+,[^,]+,[^,]+,0,-1,/);
    expect(ass).toContain('the');
    expect(ass).not.toMatch(/\bWest\b/);
  });
});

describe.skipIf(!Bun.which('chromium-browser'))('Tone: real render (headless Chromium)', () => {
  /** Field luma well under the ink and over it: dramatic is an ink page, every other register paper. */
  for (const register of REGISTER_IDS) {
    test(`${register}: the short passes the layout audit and the frozen-frame check, on a ${register === 'dramatic' ? 'dark ink' : 'paper'} field`, async () => {
      const s = { ...toShort(clone()), register };
      const tl = compileTimeline(s, voice(s));
      const r = await auditTimeline(tl);
      expect(r).toMatchObject({ ok: true, value: { violations: [] } });
      const luma = await withVoxScene(tl, async (sc) => {
        await sc.renderFrame(tl.beats[3]!.to - 3);
        const px = await sc.evaluate<number[]>(DECODE_LUMA(await sc.screenshot('png', undefined, 0.125)));
        return px.slice(0, 135 * 12).reduce((a, b) => a + b, 0) / (135 * 12); // the top band: field only
      }, FLAT_ASSETS);
      expect(luma.ok && (register === 'dramatic' ? luma.value < 40 : luma.value > 180)).toBe(true);
    }, 90_000);
  }
});

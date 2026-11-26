/** Shared test fixtures for the Vox engine and its harnesses (imported by tests only). */
import { computeLlmCost, type LlmReply, type LlmRequest, type SearchResult, type WordTimestamp } from '../providers';
import type { BeatSheet } from './beat-sheet';

/** A valid 30-second sheet; each test row mutates a clone of it. */
export const FIXTURE: BeatSheet = {
  video_id: 'vid',
  format: 'explainer',
  register: 'documentary',
  title: 'Rome at its peak',
  topic: 'Roman Empire',
  target_duration_sec: 30,
  beats: [
    { id: 'b1', act: 'cold_open', narration: 'In 117 CE, one city ruled about a quarter of everyone alive on Earth.', shot: { kind: 'headline', lines: ['One city ruled', 'a quarter of Earth'], highlight: 'a quarter' } },
    {
      id: 'b2',
      act: 'cold_open',
      world: 'peak',
      narration: 'This map shows the empire at its peak, from Britain all the way to Egypt.',
      shot: { kind: 'map', view: 'mediterranean', layers: [{ layer: 'rome_ce117', tone: 'red', at: 'This map' }], labels: [{ place: 'city:rome-it' }, { place: 'city:alexandria-eg', at: 'Egypt' }] },
    },
    {
      id: 'b3',
      act: 'cold_open',
      world: 'peak',
      narration: 'Rome sat right in the middle of it, ruling every coast of the sea.',
      shot: { kind: 'map', view: 'italy', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [{ place: 'city:rome-it' }, { place: 'site:carthage', at: 'every coast' }] },
    },
    { id: 'b4', act: 'history', narration: "It covered about five million square kilometers, roughly half the size of today's United States.", shot: { kind: 'number', value: 5_000_000, unit: 'km2', label: 'of territory', at: 'five million' } },
    { id: 'b5', act: 'ending', narration: "And it didn't last forever, because nothing that big ever does.", shot: { kind: 'headline', lines: ['Nothing that big', 'lasts forever'], highlight: 'that big' } },
  ],
};

export const clone = (): BeatSheet => structuredClone(FIXTURE);

/** Synthetic voiceover: every written word lasts 300 ms. */
export const voice = (sheet: BeatSheet): WordTimestamp[] =>
  sheet.beats.flatMap((b) => b.narration.split(/\s+/)).map((word, i) => ({ word, start_ms: i * 300, end_ms: i * 300 + 280 }));

/**
 * Makes a FIXTURE clone a valid 9:16 short: a phone-length hook and headlines, beats of at most
 * 12 words, and a looping ending. Beats 2-5 keep the cue phrases the shot tours use.
 */
export const toShort = (s: BeatSheet): BeatSheet => {
  s.format = 'short';
  s.beats[0]!.shot = { kind: 'headline', lines: ['One city ruled', 'a quarter'], highlight: 'a quarter' };
  s.beats[0]!.narration = 'One city ruled a quarter of everyone alive.';
  s.beats[1]!.narration = 'This map shows its peak, from Britain all the way to Egypt.';
  s.beats[2]!.narration = 'Rome sat right in the middle, ruling every coast of the sea.';
  s.beats[3]!.narration = "It covered about five million square kilometers, roughly half of today's America.";
  s.beats[4]!.narration = "And it didn't last, because nothing that big ever does.";
  s.beats[4]!.shot = { kind: 'headline', lines: ['That big', 'never lasts'], highlight: 'that big' };
  s.beats.push(
    { id: 'b6', act: 'ending', narration: 'By 476, the western half was gone for good.', shot: { kind: 'timeline', from: -27, to: 476, marks: [{ year: 117, label: 'Peak size' }, { year: 476, label: 'West falls', at: '476' }] } },
    { id: 'b7', act: 'ending', narration: 'One city, a quarter of the world, and then nothing.', shot: { kind: 'headline', lines: ['One city', 'then nothing'], highlight: 'one city' } },
  );
  return s;
};

/**
 * Shot tours: each swaps FIXTURE beats for denser shots so a real render puts every widget at
 * its worst-case geometry (six timeline marks, four map labels, a comparison, three pictogram groups,
 * icon cells with a per key, a negative temperature, an inflation-adjusted comparison, two army
 * arrows, three split parts, a five-node chain grown across two beats, a re-sorting countdown, a
 * six-item ranking, four versus rows, five checklist items, a scrolling six-message chat, punch
 * words on two fields). Cue phrases
 * come from narration that the explainer and the short share.
 */
export const SHOT_TOURS: Record<string, (s: BeatSheet) => void> = {
  'headline, map, number': () => {},
  'annotated map, timeline, comparison, quote': (s) => {
    s.beats[1]!.shot = {
      kind: 'map',
      view: 'mediterranean',
      title: { text: 'The empire at its peak', sub: '117 CE' },
      layers: [{ layer: 'rome_ce117', tone: 'red', at: 'This map' }],
      labels: [{ place: 'city:rome-it' }, { place: 'city:alexandria-eg', at: 'Egypt' }, { place: 'city:london-gb', at: 'Britain' }, { place: 'city:istanbul-tr' }],
      circle: { place: 'city:rome-it', at: 'This map' },
      arrow: { from: 'city:rome-it', to: 'city:alexandria-eg', at: 'Egypt' }
    };
    s.beats[2]!.shot = {
      kind: 'timeline',
      from: -753,
      to: 476,
      marks: [
        { year: -753, label: 'Rome founded' },
        { year: -509, label: 'Republic founded', at: 'sat' },
        { year: -264, label: 'Punic Wars', at: 'right' },
        { year: -27, label: 'Augustus rules', at: 'middle' },
        { year: 117, label: 'Peak size', at: 'ruling' },
        { year: 395, label: 'Split in two', at: 'every coast' },
      ],
    };
    s.beats[3]!.narration = 'It covered five million square kilometers; America covers nine point eight million.';
    s.beats[3]!.shot = { kind: 'number', value: 5_000_000, unit: 'km2', label: 'of territory', at: 'five million', compare: { value: 9_800_000, label: 'United States today', at: 'nine point eight million' } };
    s.beats[4]!.shot = { kind: 'quote', text: 'They make a desert and call it peace, and nothing that big ever lasts.', by: 'Tacitus, Agricola', highlight: 'that big' };
  },
  'pictogram, line': (s) => {
    s.beats[2]!.shot = { kind: 'pictogram', title: 'Out of every 100 people', total: 100, groups: [{ count: 25, label: 'Roman subjects', tone: 'red', at: 'Rome sat' }, { count: 40, label: 'Han China', tone: 'teal', at: 'middle' }, { count: 20, label: 'Everyone else', tone: 'muted', at: 'every coast' }] };
    s.beats[3]!.shot = { kind: 'line', title: 'Territory, million km²', points: ['-200', '-100', '0', '100', '200', '300', '400'].map((x, i) => ({ x, y: [1, 2, 4, 5, 4.5, 4, 2][i]! })), alertFrom: 4, at: 'five million' };
  },
  'regional maps': (s) => {
    s.beats[1]!.shot = { kind: 'map', view: 'britain_gaul', title: { text: 'The far north-west', sub: 'Britannia and Gaul' }, layers: [{ layer: 'rome_ce117', tone: 'red', at: 'This map' }], labels: [{ place: 'city:london-gb' }, { place: 'city:paris-fr' }, { place: 'site:trier' }, { place: 'site:hadrians-wall', at: 'Britain' }], circle: { place: 'site:hadrians-wall', at: 'Britain' } };
    s.beats[2]!.shot = { kind: 'map', view: 'east', layers: [{ layer: 'rome_ce117', tone: 'red' }], labels: [{ place: 'city:istanbul-tr' }, { place: 'city:antakya-tr' }, { place: 'city:jerusalem-il', at: 'middle' }, { place: 'city:alexandria-eg', at: 'every coast' }], arrow: { from: 'city:antakya-tr', to: 'city:alexandria-eg', at: 'Rome sat' } };
  },
  'army arrows, split, growing chain': (s) => {
    s.beats[1]!.shot = {
      kind: 'map',
      view: 'mediterranean',
      layers: [{ layer: 'rome_ce117', tone: 'muted', at: 'This map' }],
      labels: [{ place: 'city:rome-it' }, { place: 'site:carthage', at: 'from Britain' }, { place: 'city:alexandria-eg', at: 'Egypt' }],
      armies: [
        { from: 'city:rome-it', to: 'site:carthage', tone: 'red', at: 'from Britain' },
        { from: 'city:antakya-tr', to: 'city:alexandria-eg', tone: 'teal', at: 'Egypt' },
      ],
    };
    s.beats[2]!.shot = { kind: 'split', whole: 'The Roman Empire', at: 'Rome sat', parts: [{ label: 'Western Empire', tone: 'red', at: 'middle' }, { label: 'Eastern Empire', tone: 'teal', at: 'every coast' }] };
    const heirs = [
      { label: 'Augustus', sub: '27 BCE - 14 CE', tone: 'red' as const },
      { label: 'Tiberius', sub: '14 - 37 CE', at: 'five million' },
      { label: 'Caligula', sub: '37 - 41 CE', at: 'roughly half' },
    ];
    s.beats[3]!.world = 'heirs';
    s.beats[3]!.shot = { kind: 'chain', title: 'Who ruled after Augustus', nodes: heirs };
    s.beats[4]!.world = 'heirs';
    s.beats[4]!.shot = { kind: 'chain', title: 'Who ruled after Augustus', nodes: [...heirs.map(({ at: _, ...carried }) => carried), { label: 'Claudius', sub: '41 - 54 CE', at: 'because' }, { label: 'Nero', sub: '54 - 68 CE', tone: 'red', at: 'that big' }] };
  },
  'three-way split, year': (s) => {
    s.beats[2]!.shot = {
      kind: 'split',
      whole: 'Rome in 271 CE',
      at: 'Rome sat',
      parts: [{ label: 'Gallic Empire', tone: 'teal', at: 'right' }, { label: 'Rome', tone: 'red', at: 'middle' }, { label: 'Palmyrene Empire', tone: 'ochre', at: 'every coast' }],
    };
    s.beats[3]!.narration = 'Then in 476, roughly half of it, the West, was gone.';
    s.beats[3]!.shot = { kind: 'number', value: 476, unit: 'year', label: 'The West falls', at: '476' };
  },
  'icon pictogram, negative temperature, inflation': (s) => {
    s.beats[2]!.shot = {
      kind: 'pictogram',
      title: 'Legions on the frontier',
      total: 30,
      icon: 'centurion-helmet',
      per: { value: 5000, unit: 'soldiers' },
      groups: [{ count: 12, label: 'Rhine and Danube', tone: 'red', at: 'Rome sat' }, { count: 8, label: 'The East', tone: 'teal', at: 'every coast' }],
    };
    s.beats[3]!.narration = 'Winters on the Rhine fell to minus twenty degrees Celsius.';
    s.beats[3]!.shot = { kind: 'number', value: -20, unit: 'celsius', label: 'a Rhine winter night', at: 'minus twenty' };
    s.beats[4]!.narration = 'In 1900, a thousand dollars bought what thirty-eight thousand buys today.';
    s.beats[4]!.shot = { kind: 'number', value: 1000, unit: 'usd', label: 'savings in 1900', at: 'a thousand dollars', compare: { value: 1000, inflation: { year: 1900, to: 2024 }, label: 'the same money today', at: 'thirty-eight thousand' } };
  },
  // A countdown re-sorts on every arrival (each item beats the ones before it); three punch words on ink.
  'ranking countdown, punch': (s) => {
    s.beats[2]!.narration = 'The Kushans, Parthia, Rome, and Han China: the biggest empires then.';
    s.beats[2]!.shot = {
      kind: 'ranking',
      title: 'Largest empires, 100 CE',
      unit: 'km2',
      better: 'higher',
      items: [
        { label: 'Kushan Empire', value: 2_500_000, at: 'The Kushans' },
        { label: 'Parthia', value: 2_800_000, at: 'Parthia' },
        { label: 'Rome', value: 5_000_000, at: 'Rome' },
        { label: 'Han China', value: 6_500_000, at: 'Han China' },
      ],
    };
    s.beats[4]!.shot = { kind: 'punch', field: 'ink', words: [{ text: 'Nothing', at: 'nothing' }, { text: 'that', at: 'that big' }, { text: 'big.', at: 'big ever' }] };
  },
  // Four versus rows (one with no winner; the side with more wins gets the verdict); five checklist items, every mark.
  'versus, checklist': (s) => {
    s.beats[3]!.narration = 'It covered five million square kilometers; America covers nine point eight million.';
    s.beats[3]!.shot = {
      kind: 'versus',
      sides: [{ label: 'Rome', tone: 'red' }, { label: 'United States', tone: 'teal' }],
      rows: [
        { label: 'People', unit: 'people', left: 60_000_000, right: 335_000_000, better: 'higher', at: 'It covered' },
        { label: 'Area', unit: 'km2', left: 5_000_000, right: 9_800_000, better: 'higher', at: 'five million' },
        { label: 'Lasted', unit: 'years', left: 1229, right: 248, better: 'higher', at: 'America' },
        { label: 'Peak year', unit: 'year', left: 117, right: 2024, better: 'none', at: 'covers' },
      ],
    };
    s.beats[4]!.shot = {
      kind: 'checklist',
      title: 'Myth or fact?',
      items: [
        { text: 'Rome lasted forever, unchanged', mark: 'no', at: 'And' },
        { text: 'The West fell in 476', mark: 'yes', at: "it didn't" },
        { text: 'The East held on 1,000 more years', mark: 'yes', at: 'last' },
        { text: 'Rome fell in a single day', mark: 'no', at: 'because' },
        { text: 'Lead pipes caused the fall', mark: 'maybe', at: 'nothing that big' },
      ],
    };
  },
  // Six items at the label cap ranked lowest-first; six chat messages that overflow and scroll; two punch words on yellow.
  'six-item ranking, chat, punch': (s) => {
    s.beats[1]!.shot = {
      kind: 'ranking',
      title: 'Days to reach Rome',
      unit: 'days',
      better: 'lower',
      items: [
        { label: 'Sicily', value: 3, at: 'This map' },
        { label: 'Athens', value: 10, at: 'shows' },
        { label: 'Carthage', value: 4, at: 'its peak' },
        { label: 'Londinium, Britain', value: 29, at: 'from Britain' },
        { label: 'Antioch', value: 24, at: 'all the' },
        { label: 'Alexandria', value: 19, at: 'way' },
      ],
    };
    s.beats[2]!.shot = {
      kind: 'chat',
      people: { a: 'Carthage', b: 'Rome' },
      messages: [
        { from: 'a', text: 'So who runs the Mediterranean now?', at: 'Rome sat' },
        { from: 'b', text: 'Me. Every single coast of it, obviously.', at: 'right' },
        { from: 'a', text: 'Even our coast?', at: 'middle' },
        { from: 'b', text: 'Especially your coast.', at: 'ruling' },
        { from: 'a', text: 'That seems a little excessive, honestly.', at: 'every coast' },
        { from: 'b', text: 'We call it Mare Nostrum now: our sea. Visit us!', at: 'the sea' },
      ],
    };
    s.beats[3]!.shot = { kind: 'punch', field: 'yellow', words: [{ text: 'Five', at: 'five million' }, { text: 'million.', at: 'million square' }] };
  },
  // World maps: names and ISO codes as the model writes them (checkBeatSheet resolves them; compileTimeline too).
  'world map, US states': (s) => {
    s.beats[1]!.shot = {
      kind: 'map',
      view: 'world',
      title: { text: 'Two superpowers' },
      // On 9:16 the world is cropped about its subjects (London, Lagos): the far fills are pruned away, not drawn.
      layers: [{ layer: 'United States', tone: 'red', at: 'This map' }, { layer: 'China', tone: 'teal', at: 'all the way' }],
      labels: [],
      pins: [{ place: 'London', at: 'from Britain' }, { place: 'Lagos', at: 'Egypt' }],
    };
    s.beats[2]!.world = 'states';
    s.beats[2]!.shot = { kind: 'map', view: 'usa', layers: [{ layer: 'California', tone: 'red', at: 'Rome sat' }, { layer: 'US-TX', tone: 'teal', at: 'every coast' }], labels: [{ place: 'Los Angeles' }, { place: 'Houston', at: 'every coast' }, { place: 'New York' }] };
  },
  'modern region with pins': (s) => {
    s.beats[1]!.shot = { kind: 'map', view: 'east_asia', layers: [{ layer: 'JP', tone: 'red', at: 'This map' }], labels: [], pins: [{ place: 'Tokyo', at: 'This map' }, { place: 'Seoul', at: 'from Britain' }, { place: 'Shanghai', at: 'Egypt' }] };
    s.beats[2]!.shot = { kind: 'map', view: 'Japan', layers: [{ layer: 'JP', tone: 'red' }], labels: [], pins: [{ place: 'Tokyo', at: 'Rome sat' }, { place: 'Osaka', at: 'every coast' }] };
  },
  'historical snapshot (1914 Europe)': (s) => {
    s.beats[1]!.shot = {
      kind: 'map',
      view: 'europe',
      year: 1914,
      title: { text: 'Europe in 1914' },
      layers: [{ layer: 'German Empire', tone: 'red', at: 'This map' }, { layer: 'Austria-Hungary', tone: 'ochre', at: 'from Britain' }, { layer: 'Russian Empire', tone: 'teal', at: 'Egypt' }],
      labels: [{ place: 'Berlin' }, { place: 'Vienna', at: 'from Britain' }, { place: 'St Petersburg', at: 'Egypt' }],
    };
    s.beats[2]!.shot = { kind: 'map', view: 'Ottoman Empire', year: 1914, layers: [{ layer: 'Ottoman Empire', tone: 'red', at: 'Rome sat' }], labels: [{ place: 'Constantinople', at: 'every coast' }] };
  },
};

/** A reply as the LLM edge returns it; with search results it counts as one web_search unless told otherwise. */
export const llmReply = (text: string, searchResults: SearchResult[] = [], webSearchRequests = searchResults.length > 0 ? 1 : 0): LlmReply => ({
  text,
  usage: computeLlmCost('claude-opus-5-5', { inputTokens: 0, outputTokens: 0, webSearchRequests }),
  searchResults,
});

/** Scripted LLM edge: replies in order (last one repeats; a bare string is a reply with no tool use) and records every request. */
export const scripted = (...replies: (string | LlmReply | Error)[]) => {
  const calls: LlmRequest[] = [];
  const llm = async (req: LlmRequest): Promise<LlmReply> => {
    calls.push(req);
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    return typeof r === 'string' ? llmReply(r) : r;
  };
  return { calls, llm };
};

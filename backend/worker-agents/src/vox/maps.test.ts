import { describe, expect, test } from 'bun:test';
import { checkBeatSheet, type BeatSheet, type Shot } from './beat-sheet';
import { FIXTURE, SHOT_TOURS, clone, scripted, toShort, voice } from './fixtures';
import { clampToData } from './geo';
import { MAP_VIEWS, type GeoSourceId, type ProjectionId } from './geo-manifest';
import { knownPlaces, placeName, resolveRef, snapshotFor, type RefContext } from './places';
import { DECODE_LUMA, FLAT_ASSETS, withVoxScene } from './render';
import { VOX_SCREENPLAY_BIBLE, runVoxScreenplayAgent } from './screenplay';
import type { Timeline } from './timeline';
import { compileTimeline } from './timing';
import { LAYOUTS, toScreen } from './tokens';

type MapShot = Extract<Shot, { kind: 'map' }>;
const modern = (use: RefContext['use'] = 'place'): RefContext => ({ use, era: 'modern' });
const MED_BOX = MAP_VIEWS.mediterranean.bbox;

/**
 * The fixture with beats 2-3 (one world, cues "This map", "Egypt" / "Rome sat", "every coast")
 * swapped for these map shots; `b3: null` keeps the fixture's beat 3 in a world of its own.
 */
function mapSheet(b2: Partial<MapShot>, b3?: Partial<MapShot> | null, opts: { short?: boolean; ownWorld?: boolean } = {}): BeatSheet {
  const s = opts.short ? toShort(clone()) : clone();
  s.beats[1]!.shot = { kind: 'map', view: 'world', layers: [], labels: [], ...b2 } as MapShot;
  if (b3 === null || opts.ownWorld) s.beats[2]!.world = 'other';
  if (b3) s.beats[2]!.shot = { kind: 'map', view: 'world', layers: [], labels: [], ...b3 } as MapShot;
  const r = checkBeatSheet(s);
  if (!r.ok) throw new Error(r.violations.map((v) => `${v.rule}: ${v.message}`).join('\n'));
  return r.sheet;
}
const compiled = (sheet: BeatSheet, opts?: Parameters<typeof compileTimeline>[2]) => compileTimeline(sheet, voice(sheet), opts);
const mapOf = (tl: Timeline, i: number) => tl.geo!.maps[tl.beats[i]!.map!]!;
/** Every "x,y" pair of an SVG path string. */
const points = (d: string) => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

describe('place resolver', () => {
  /** [name, written, context, expected id or rule + an id the message must list]. */
  const rows: [string, string, RefContext, string | { rule: string; lists: string[] }][] = [
    ['exact canonical id', 'city:paris-fr', modern(), 'city:paris-fr'],
    ['plain name', 'Paris', modern(), 'city:paris-fr'],
    ['name with a country code', 'Paris, FR', modern(), 'city:paris-fr'],
    ['name with a state code', 'Springfield, US-IL', modern(), 'city:springfield-us-il'],
    ['alias', 'Türkiye', modern('fill'), 'country:TR'],
    ['common short name', 'USA', modern('fill'), 'country:US'],
    ['former name', 'Burma', modern('fill'), 'country:MM'],
    ['ISO 3166-1 alpha-2', 'FR', modern('fill'), 'country:FR'],
    ['ISO 3166-1 alpha-3', 'FRA', modern('fill'), 'country:FR'],
    ['ISO 3166-2', 'US-CA', modern('fill'), 'admin1:US-CA'],
    ['ISO 3166-2, lower case', 'us-ca', modern('fill'), 'admin1:US-CA'],
    ['Wikidata QID', 'Q90', modern(), 'city:paris-fr'],
    ['era name', 'Constantinople', modern(), 'city:istanbul-tr'],
    ['ancient era name', 'Londinium', { use: 'place', era: 'ancient' }, 'city:london-gb'],
    ['legacy ancient id', 'hadrians_wall', { use: 'place', era: 'ancient' }, 'site:hadrians-wall'],
    ['ancient layer id', 'rome_ce117', { use: 'fill', era: 'ancient' }, 'rome_ce117'],
    ['a city beats its same-named province', 'Rome', modern(), 'city:rome-it'],
    ['a city-state point is the city', 'Singapore', modern(), 'city:singapore-sg'],
    ['a city-state fill is the country', 'Singapore', modern('fill'), 'country:SG'],
    ['kind qualifier', 'Georgia (US state)', modern(), 'admin1:US-GA'],
    ['kind qualifier, country', 'Georgia (country)', modern(), 'country:GE'],
    ['country qualifier excludes the country itself', 'Georgia, US', modern(), 'admin1:US-GA'],
    ['ambiguous: country vs state', 'Georgia', modern(), { rule: 'place_ambiguous', lists: ['country:GE', 'admin1:US-GA'] }],
    ['ambiguous: same-sized cities', 'Birmingham', modern(), { rule: 'place_ambiguous', lists: ['city:birmingham-gb', 'city:birmingham-us'] }],
    ['ambiguous: many towns', 'Springfield', modern(), { rule: 'place_ambiguous', lists: ['city:springfield-us-il'] }],
    ['unknown: nearest candidates', 'Syrakusa', modern(), { rule: 'place_unknown', lists: ['city:siracusa-it', 'city:syracuse-us'] }],
    ['unknown: nothing close', 'Xqzzyville', modern(), { rule: 'place_unknown', lists: [] }],
    ['ranking by population', 'Syracuse', modern(), 'city:syracuse-us'],
    ['the view breaks the tie', 'Syracuse', { use: 'place', era: 'modern', bbox: MED_BOX }, 'city:siracusa-it'],
    ['polity alive in the snapshot', 'Ottoman Empire', { use: 'fill', era: 'historical', snapshot: 1914 }, 'polity:ottoman-empire'],
    ['polity by its short name', 'Ottoman', { use: 'fill', era: 'historical', snapshot: 1914 }, 'polity:ottoman-empire'],
    ['polity title stripped', 'Italy', { use: 'fill', era: 'historical', snapshot: 1914 }, 'polity:kingdom-of-italy'],
    ['modern country on a historical map suggests its polity', 'France', { use: 'fill', era: 'historical', snapshot: 1914 }, { rule: 'place_era', lists: ['polity:french-third-republic'] }],
    ['polity outside its lifetime', 'German Empire', { use: 'fill', era: 'historical', snapshot: 1800 }, { rule: 'place_era', lists: [] }],
    ['modern country on an ancient map', 'France', { use: 'fill', era: 'ancient' }, { rule: 'place_era', lists: [] }],
    ['no modern country labels on a historical map', 'FR', { use: 'place', era: 'historical', snapshot: 1914 }, { rule: 'place_era', lists: ['polity:french-third-republic'] }],
    ['cities keep working on a historical map', 'Vienna', { use: 'place', era: 'historical', snapshot: 1914 }, 'city:vienna-at'],
  ];
  for (const [name, raw, ctx, want] of rows) {
    test(name, () => {
      const r = resolveRef(raw, ctx);
      if (typeof want === 'string') return expect(r).toEqual({ ok: true, id: want });
      expect(r.ok ? 'resolved' : r.rule).toBe(want.rule);
      for (const id of want.lists) expect(r.ok ? '' : r.message).toContain(id);
    });
  }
  test('resolution is idempotent: a resolved id resolves to itself', () => {
    for (const [, raw, ctx] of rows) {
      const r = resolveRef(raw, ctx);
      if (r.ok) expect(resolveRef(r.id, ctx)).toEqual(r);
    }
  });
});

describe('era names and snapshots', () => {
  const names: [string, number | undefined, string][] = [
    ['city:istanbul-tr', 100, 'Byzantium'],
    ['city:istanbul-tr', 330, 'Constantinople'],
    ['city:istanbul-tr', 1929, 'Constantinople'],
    ['city:istanbul-tr', 1930, 'Istanbul'],
    ['city:istanbul-tr', undefined, 'Istanbul'],
    ['city:london-gb', 117, 'Londinium'],
    ['city:london-gb', 1914, 'London'],
    ['city:st-petersburg-ru', 1913, 'St Petersburg'],
    ['city:st-petersburg-ru', 1914, 'Petrograd'],
    ['city:st-petersburg-ru', 1950, 'Leningrad'],
    ['city:tokyo-jp', 1700, 'Edo'],
    ['country:US', undefined, 'United States'],
    ['site:cadiz', -100, 'Gades'],
  ];
  for (const [id, year, want] of names) test(`${id} in ${year ?? 'today'} is "${want}"`, () => expect(placeName(id, year)).toBe(want));

  const snapshots: [number, number | null][] = [
    [1914, 1914],
    [1916, 1914],
    [1919, 1914],
    [1920, 1920],
    [2030, 2024],
    [118, 117],
    [1, 1],
    [-1, -100],
    [-3000, -3000],
    [-3001, null],
  ];
  for (const [year, want] of snapshots) test(`year ${year} draws the ${want ?? 'no'} snapshot`, () => expect(snapshotFor(year)).toBe(want));

  test('a map shows era names of its year, an ancient view without a year shows 117 CE names', () => {
    const tl = compiled(mapSheet({ view: 'europe', year: 1914, labels: [{ place: 'Istanbul' }, { place: 'St Petersburg' }] }, { view: 'mediterranean', labels: [{ place: 'London' }, { place: 'Paris' }] }, { ownWorld: true }));
    expect(Object.values(mapOf(tl, 1).places).map((p) => p.name)).toEqual(['Constantinople', 'Petrograd']);
    expect(Object.values(mapOf(tl, 2).places).map((p) => p.name)).toEqual(['Londinium', 'Lutetia']);
  });
});

describe('map compilation', () => {
  /** [name, beat 2 shot, beat 3 shot (null: its own world), projection of beat 2's map]. */
  const projections: [string, Partial<MapShot>, Partial<MapShot> | null, ProjectionId][] = [
    ['the world is Equal Earth', { view: 'world' }, null, 'equal_earth'],
    ['a hemisphere is Equal Earth', { view: 'americas' }, null, 'equal_earth'],
    ['a mid-latitude region is conic', { view: 'europe' }, null, 'conic'],
    ['a region near the equator is Mercator', { view: 'southeast_asia' }, null, 'mercator'],
    ['a country near the equator is Mercator', { view: 'Indonesia' }, null, 'mercator'],
    ['a mid-latitude country is conic', { view: 'Japan' }, null, 'conic'],
    ['the USA is AlbersUsa', { view: 'usa' }, null, 'albers_usa'],
    ['a view may pin its projection', { view: 'russia' }, null, 'conic'],
    ['ancient views keep the AWMC projection', { view: 'mediterranean' }, null, 'ancient'],
    ['a historical map projects like a modern one', { view: 'europe', year: 1914 }, null, 'conic'],
    ['a world gliding from Europe to the world is one Equal Earth canvas', { view: 'europe' }, { view: 'world' }, 'equal_earth'],
    ['a world gliding from the USA to a state stays AlbersUsa', { view: 'usa' }, { view: 'California' }, 'albers_usa'],
  ];
  for (const [name, b2, b3, want] of projections) {
    test(`projection: ${name}`, () => {
      const tl = compiled(mapSheet(b2, b3));
      expect(mapOf(tl, 1).projection).toBe(want);
      if (b3) expect(mapOf(tl, 2).projection).toBe(want);
    });
  }

  test('pruning: only referenced fills and places are in the scene', () => {
    const tl = compiled(mapSheet({ view: 'europe', layers: [{ layer: 'FR', tone: 'red', at: 'This map' }], labels: [{ place: 'Paris' }], pins: [{ place: 'Berlin', at: 'Egypt' }] }, null));
    expect(Object.keys(mapOf(tl, 1).fills)).toEqual(['country:FR']);
    expect(Object.keys(mapOf(tl, 1).places).sort()).toEqual(['city:berlin-de', 'city:paris-fr']);
  });
  test('pruning: base paths are clipped to the frames their cameras show', () => {
    for (const short of [false, true]) {
      const tl = compiled(mapSheet({ view: 'europe' }, null, { short }));
      const L = LAYOUTS[tl.aspect];
      const [cx, cy, w] = tl.beats[1]!.camera!.to;
      const h = (w * L.height) / L.width;
      const slack = w * 0.15;
      for (const d of Object.values(mapOf(tl, 1).base)) {
        for (const [x, y] of points(d)) {
          expect(x).toBeGreaterThan(cx - w / 2 - slack);
          expect(x).toBeLessThan(cx + w / 2 + slack);
          expect(y).toBeGreaterThan(cy - h / 2 - slack);
          expect(y).toBeLessThan(cy + h / 2 + slack);
        }
      }
    }
  });
  test('pruning: a region ships far less land than the world', () => {
    const land = (view: string) => mapOf(compiled(mapSheet({ view }, null)), 1).base.land.length;
    expect(land('europe') * 2).toBeLessThan(land('world'));
  });
  test('pruning: a layer fading out in the next beat of its world is in that beat\'s map', () => {
    const tl = compiled(mapSheet({ view: 'europe', year: 1914, layers: [{ layer: 'German Empire', tone: 'red' }] }, { view: 'europe', year: 1920, layers: [{ layer: 'Weimar Republic', tone: 'red', at: 'Rome sat' }] }));
    expect(tl.beats[2]!.fading).toEqual([{ layer: 'polity:german-empire', tone: 'red', at: undefined }]);
    expect(Object.keys(mapOf(tl, 2).fills).sort()).toEqual(['polity:german-empire', 'polity:weimar-republic']);
  });
  /** Drawn-vertex budget per frame: every map of every tour, both aspects (research: ≤ 60k). */
  const VERTEX_BUDGET = 60_000;
  for (const [tour, swap] of Object.entries(SHOT_TOURS)) {
    for (const short of [false, true]) {
      test(`vertex budget: "${tour}" ${short ? '9:16' : '16:9'}`, () => {
        const s = short ? toShort(clone()) : clone();
        swap(s);
        const tl = compiled(s);
        for (const m of Object.values(tl.geo?.maps ?? {})) expect([...Object.values(m.base), ...Object.values(m.fills).map((f) => f.d)].reduce((n, d) => n + points(d).length, 0)).toBeLessThan(VERTEX_BUDGET);
      });
    }
  }

  test('the 9:16 world is a crop inside the globe, not the whole sphere', () => {
    const w = (short: boolean) => compiled(mapSheet({ view: 'world' }, null, { short })).beats[1]!.camera!.to[2];
    expect(w(true)).toBeLessThan(w(false) / 3);
  });
  for (const [aspect, L] of Object.entries(LAYOUTS)) {
    for (const id of Object.keys(MAP_VIEWS).filter((v) => 'ancient' in MAP_VIEWS[v as keyof typeof MAP_VIEWS])) {
      test(`${aspect} ${id}: the clamped ancient camera shows only geodata (clamping is idempotent)`, () => {
        const v = compiled(mapSheet({ view: id }, null, { short: aspect === '9:16' })).beats[1]!.camera!.to;
        expect(clampToData(v, L)).toEqual(v);
      });
    }
  }
  test('an ancient view centred outside the geodata fails loud', () => expect(() => clampToData([-9000, -9000, 100], LAYOUTS['16:9'])).toThrow('outside the geodata'));

  /** [name, beat 2 shot, sources]. */
  const sources: [string, Partial<MapShot>, GeoSourceId[]][] = [
    ['an ancient view', { view: 'mediterranean' }, ['awmc', 'world_atlas']],
    ['a modern view', { view: 'europe' }, ['natural_earth']],
    ['US states', { view: 'usa', layers: [{ layer: 'Texas', tone: 'red' }] }, ['natural_earth', 'us_atlas']],
    ['a historical snapshot', { view: 'europe', year: 1914 }, ['cliopatria', 'natural_earth']],
  ];
  for (const [name, b2, want] of sources) {
    test(`source manifest: ${name}`, () => {
      const s = mapSheet(b2, null);
      s.beats[2]!.shot = { kind: 'headline', lines: ['Rome sat'], highlight: 'Rome sat' };
      expect(compiled(s).sources).toEqual(want);
    });
  }

  /** [name, beat 2 shot, has hatched disputed areas]. */
  const disputed: [string, Partial<MapShot>, boolean][] = [
    ['a modern South Asia map', { view: 'south_asia' }, true],
    ['the modern world', { view: 'world' }, true],
    ['a historical map (no modern disputes)', { view: 'south_asia', year: 1914 }, false],
    ['an ancient view', { view: 'mediterranean' }, false],
  ];
  for (const [name, b2, want] of disputed) test(`disputed areas: ${name}`, () => expect(mapOf(compiled(mapSheet(b2, null)), 1).base.disputed.length > 0).toBe(want));
  test('historical maps are marked approximate, modern ones are not', () => {
    expect([{ view: 'europe', year: 1914 }, { view: 'mediterranean' }, { view: 'europe' }].map((b2) => mapOf(compiled(mapSheet(b2, null)), 1).approximate)).toEqual([true, true, false]);
  });
  test('historical maps never draw modern borders', () => {
    const m = mapOf(compiled(mapSheet({ view: 'europe', year: 1914 }, null)), 1);
    expect([m.base.admin1, m.base.disputed]).toEqual(['', '']);
    expect(m.base.borders).not.toBe(mapOf(compiled(mapSheet({ view: 'europe' }, null)), 1).base.borders);
  });

  test('worldview: the default is ISO; another worldview needs its pack built first (fail loud)', () => {
    const s = mapSheet({ view: 'south_asia', layers: [{ layer: 'IN', tone: 'red' }] }, null);
    expect(compiled(s).geo).not.toBeNull();
    expect(() => compiled(s, { worldview: 'ind' })).toThrow('geo-build.ts');
  });

  test('a Roman sheet written with the legacy ids checks to the canonical fixture', () => {
    const legacy = structuredClone(FIXTURE);
    (legacy.beats[1]!.shot as MapShot).labels = [{ place: 'rome' }, { place: 'alexandria', at: 'Egypt' }];
    (legacy.beats[2]!.shot as MapShot).labels = [{ place: 'rome' }, { place: 'carthage', at: 'every coast' }];
    const r = checkBeatSheet(legacy);
    expect(r.ok && r.sheet).toEqual(FIXTURE);
    expect(compiled(legacy).geo).toEqual(compiled(FIXTURE).geo);
  });
  test('compileTimeline fails loud on a name that does not resolve', () => {
    const s = clone();
    (s.beats[1]!.shot as MapShot).labels = [{ place: 'Atlantis' }];
    expect(() => compiled(s)).toThrow('Atlantis');
  });
});

describe('screenplay map prompt', () => {
  test('the bible lists the famous places and no longer bans maps outside the Mediterranean', () => {
    expect(VOX_SCREENPLAY_BIBLE).toContain('Tokyo JP');
    expect(VOX_SCREENPLAY_BIBLE).not.toContain('do not use map shots');
  });
  test('the retrieval pre-pass names the places the topic mentions, with ids', () => {
    const k = knownPlaces('How the Ottoman Empire took Constantinople in 1453, and what Venice did next');
    for (const id of ['city:istanbul-tr', 'polity:ottoman-empire', 'city:venice-it']) expect(k.join('\n')).toContain(id);
    expect(knownPlaces('nice reading on a sunny day')).toEqual([]);
  });
  test('the request carries known_places from the topic and research', async () => {
    const { calls, llm } = scripted(JSON.stringify(FIXTURE));
    await runVoxScreenplayAgent({ videoId: 'vid', format: 'explainer', topic: 'Why Japan', research: 'Tokyo and Osaka', targetDurationSec: 30, model: { providerId: 'anthropic', modelId: 'claude-opus-5-5' }, llm });
    expect(JSON.parse(calls[0]!.userPrompt).known_places.join('\n')).toContain('city:osaka-jp');
  });
});

describe.skipIf(!Bun.which('chromium-browser'))('map rendering (real headless Chromium)', () => {
  test('a disputed area is hatched, never tone-filled', async () => {
    // India filled red over South Asia; Srinagar sits inside the disputed Jammu and Kashmir polygon.
    const sheet = mapSheet({ view: 'south_asia', layers: [{ layer: 'IN', tone: 'red' }], labels: [{ place: 'Srinagar' }, { place: 'Nagpur' }] }, null);
    const tl = compiled(sheet);
    const b = tl.beats[1]!;
    const L = LAYOUTS[tl.aspect];
    const m = mapOf(tl, 1);
    const r = await withVoxScene(
      tl,
      async (s) => {
        await s.renderFrame(b.to - 3);
        return s.evaluate<number[]>(DECODE_LUMA(await s.screenshot('png')));
      },
      FLAT_ASSETS,
    );
    if (!r.ok) throw new Error(r.error);
    // Sample beside each dot (dot and label excluded): 24 px below it.
    const luma = (id: string) => {
      const [x, y] = toScreen(b.camera!.to, m.places[id]!.at, L).map(Math.round) as [number, number];
      return r.value[(y + 24) * L.width + x]!;
    };
    const [india, kashmir] = [luma('city:nagpur-in'), luma('city:srinagar-in')];
    // Red over paper multiplies dark; the hatch over land stays near the land's luma.
    expect(kashmir - india).toBeGreaterThan(40);
  }, 60_000);
});

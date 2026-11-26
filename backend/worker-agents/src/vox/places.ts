/**
 * Place resolver: turns what the Screenplay LLM writes ("Paris, FR", "US-CA", "Georgia (US
 * state)", "Ottoman Empire", "Q90", a canonical id) into canonical catalog ids at the schema edge
 * (checkBeatSheet). Unknown and ambiguous names become violations that list the closest
 * candidates, so the screenplay retry loop fixes them. No geocoder, no network: the catalog is
 * built once by scripts/geo-build.ts and the hand rows live in geo-manifest.ts.
 *
 * Pure: the catalog JSON is data, the index is built once on first use.
 */
import CATALOG from '../../assets/geo/catalog.json';
import type { BeatSheet, RuleViolation, Shot } from './beat-sheet';
import {
  ALIASES,
  ANCIENT_DEFAULT_YEAR,
  ANCIENT_LAYERS,
  CATALOG_FIELDS,
  DISPLAY_NAMES,
  ERA_NAMES,
  HIST_SNAPSHOTS,
  MAP_VIEWS,
  SITES,
  normalizeName,
  type BBox,
  type LonLat,
  type MapViewId,
} from './geo-manifest';

export type PlaceKind = 'country' | 'admin1' | 'city' | 'site' | 'polity' | 'ancient';

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  at?: LonLat;
  /** Framing box (main landmass) of countries and admin-1 rows. */
  bbox?: BBox;
  /** ISO 3166-1 alpha-2 (a country's own code too). */
  country?: string;
  /** ISO 3166-2 code of a city's admin-1 area. */
  admin1?: string;
  pop?: number;
  qid?: string;
  tier?: 1;
  /** Polity lifetime (Cliopatria), years. */
  from?: number;
  to?: number;
}

/** What a map draws: the AWMC Mediterranean, modern borders, or a year's historical borders. */
export type MapEra = 'ancient' | 'modern' | 'historical';
/** What a reference is for: a point (labels, pins, arrows), a fill, or a camera framing. */
export type RefUse = 'place' | 'fill' | 'view';

/**
 * The kinds each reference may name, per era. Modern borders never appear on a historical or
 * ancient map, polities only on the historical ones. Extend by editing a cell.
 */
export const REF_KINDS: Record<RefUse, Record<MapEra, readonly PlaceKind[]>> = {
  place: { modern: ['city', 'site', 'country', 'admin1'], historical: ['city', 'site', 'polity'], ancient: ['city', 'site'] },
  fill: { modern: ['country', 'admin1'], historical: ['polity'], ancient: ['ancient'] },
  view: { modern: ['country', 'admin1'], historical: ['country', 'admin1', 'polity'], ancient: [] },
};

/** Words a qualifier may use to name a kind ("Georgia (US state)", "Georgia (country)"). */
const KIND_WORDS: Record<string, { kind: PlaceKind; country?: string }> = {
  country: { kind: 'country' },
  nation: { kind: 'country' },
  state: { kind: 'admin1' },
  province: { kind: 'admin1' },
  region: { kind: 'admin1' },
  'us state': { kind: 'admin1', country: 'US' },
  city: { kind: 'city' },
  town: { kind: 'city' },
  empire: { kind: 'polity' },
  kingdom: { kind: 'polity' },
};

/**
 * Ranking weight of rows without a population (a US state and the city of Washington must
 * compare as rivals; a polity yields to a same-named city).
 */
const KIND_WEIGHT: Record<PlaceKind, number> = { country: 1e6, admin1: 2e6, city: 1e4, site: 1e6, polity: 5e4, ancient: 1e6 };
/** Two candidates within this population ratio are ambiguous: the model must qualify the name. */
const AMBIGUOUS_RATIO = 3;
/** How many candidates a violation lists. */
const CANDIDATES = 5;
/** A view's box is widened by this share when it disambiguates a name ("Syracuse" on the Mediterranean). */
const VIEW_MARGIN = 0.2;

/** Polity titles stripped into aliases ("Kingdom of Belgium" → "belgium", "Ottoman Empire" → "ottoman"). */
const POLITY_PREFIXES = ['the', 'kingdom of', 'republic of', 'empire of', 'sultanate of', 'principality of', 'duchy of', 'grand duchy of', 'emirate of', 'khanate of', 'caliphate of', 'county of', 'electorate of', 'state of', 'dominion of', 'commonwealth of', 'union of', 'federation of', 'protectorate of', 'colony of', 'imamate of', 'oriental republic of'];
const POLITY_SUFFIXES = ['empire', 'dynasty', 'kingdom', 'sultanate', 'republic', 'caliphate', 'khanate', 'shogunate', 'confederacy', 'confederation'];

// ── Index ────────────────────────────────────────────────────────────────────

const KIND_OF_PREFIX: Record<string, PlaceKind> = { country: 'country', admin1: 'admin1', city: 'city', site: 'site', polity: 'polity' };
export const kindOf = (id: string): PlaceKind | undefined => (id in ANCIENT_LAYERS ? 'ancient' : KIND_OF_PREFIX[id.split(':')[0]!]);

interface Index {
  byId: Map<string, Place>;
  byName: Map<string, Place[]>;
  byQid: Map<string, Place>;
  /** Snapshot year → polity ids alive then, and which polity holds each modern country. */
  snapshots: Map<number, { polities: Set<string>; byCountry: Record<string, string> }>;
}
type Catalog = { rows: unknown[][]; polities: [string, string, number, number, string | null][]; snapshots: { year: number; polities: number[]; byCountry: Record<string, number> }[] };

const polityAliases = (name: string): string[] => {
  const n = normalizeName(name);
  const pre = POLITY_PREFIXES.filter((p) => n.startsWith(`${p} `)).map((p) => n.slice(p.length + 1));
  const suf = POLITY_SUFFIXES.filter((s) => n.endsWith(` ${s}`)).map((s) => n.slice(0, -s.length - 1));
  return [...pre, ...suf];
};

let cached: Index | null = null;
function index(): Index {
  if (cached) return cached;
  const cat = CATALOG as unknown as Catalog;
  const rows = cat.rows.map((t) => {
    const { aliases = [], ...fields } = Object.fromEntries(CATALOG_FIELDS.flatMap((k, i) => (t[i] === null || t[i] === undefined ? [] : [[k, t[i]]]))) as Omit<Place, 'kind'> & { aliases?: string[] };
    return { place: { ...fields, kind: kindOf(fields.id)! } as Place, aliases };
  });
  const sites = Object.entries(SITES).map(([id, s]) => ({ place: { id, kind: 'site' as const, ...s }, aliases: [] }));
  const polities = cat.polities.map(([id, name, from, to, qid]) => ({ place: { id, kind: 'polity' as const, name, from, to, ...(qid && { qid }) }, aliases: polityAliases(name) }));
  const ancient = Object.entries(ANCIENT_LAYERS).map(([id, l]) => ({ place: { id, kind: 'ancient' as const, name: l.label }, aliases: [normalizeName(id)] }));
  const all: { place: Place; aliases: string[] }[] = [...rows, ...sites, ...polities, ...ancient];
  const byId = new Map(all.map(({ place }) => [place.id, place]));
  const byName = new Map<string, Place[]>();
  const add = (name: string, p: Place) => {
    const key = normalizeName(name);
    const list = byName.get(key) ?? [];
    if (key && !list.includes(p)) byName.set(key, [...list, p]);
  };
  for (const { place, aliases } of all) {
    add(place.name, place);
    for (const a of [...aliases, ...(ALIASES[place.id] ?? []), ...(ERA_NAMES[place.id] ?? []).map((e) => e.name)]) add(a, place);
    if (DISPLAY_NAMES[place.id]) add(DISPLAY_NAMES[place.id]!, place);
  }
  cached = {
    byId,
    byName,
    byQid: new Map(all.flatMap(({ place }) => (place.qid ? [[place.qid, place] as const] : []))),
    snapshots: new Map(cat.snapshots.map((s) => [s.year, { polities: new Set(s.polities.map((i) => cat.polities[i]![0])), byCountry: Object.fromEntries(Object.entries(s.byCountry).map(([cc, i]) => [cc, cat.polities[i]![0]])) }])),
  };
  return cached;
}

export const placeById = (id: string): Place | undefined => index().byId.get(id);

/** The snapshot a year draws: the latest at or before it; null before the first one. */
export const snapshotFor = (year: number): number | null => HIST_SNAPSHOTS.filter((y) => y <= year).at(-1) ?? null;

/** The name a place shows on a map of `year` (era names, then the display name). */
export function placeName(id: string, year: number | undefined): string {
  const era = year === undefined ? undefined : ERA_NAMES[id]?.find((e) => year < e.until);
  return era?.name ?? DISPLAY_NAMES[id] ?? placeById(id)?.name ?? id;
}

/** "Paris, FR (city:paris-fr)": how violations and the prompt name a candidate. */
export const describePlace = (p: Place): string => {
  const where: Record<PlaceKind, string | undefined> = {
    city: p.admin1 && p.country === 'US' ? p.admin1 : p.country,
    site: p.country,
    admin1: p.country && `region of ${p.country}`,
    country: 'country',
    polity: `${p.from}–${p.to}`,
    ancient: 'ancient layer',
  };
  const w = where[p.kind];
  return `${DISPLAY_NAMES[p.id] ?? p.name}${w ? `, ${w}` : ''} (${p.id})`;
};

// ── Resolution ───────────────────────────────────────────────────────────────

export interface RefContext {
  use: RefUse;
  era: MapEra;
  /** Historical maps: the snapshot whose polities are allowed. */
  snapshot?: number;
  /** The view's box, which breaks ties between same-named places. */
  bbox?: BBox;
}

export type Resolution =
  | { ok: true; id: string }
  | { ok: false; rule: 'place_unknown' | 'place_ambiguous' | 'place_era'; message: string };

const weight = (p: Place) => p.pop ?? KIND_WEIGHT[p.kind];
const allowed = (p: Place, ctx: RefContext) =>
  REF_KINDS[ctx.use][ctx.era].includes(p.kind) && (p.kind !== 'polity' || (ctx.snapshot !== undefined && index().snapshots.get(ctx.snapshot)!.polities.has(p.id)));
/**
 * A region yields to a same-named city inside its country: "Rome", "Singapore", "Berlin" mean the
 * city, not the province or the city-state's country row.
 */
const yieldToCities = (ps: Place[]) => ps.filter((p) => (p.kind !== 'admin1' && p.kind !== 'country') || !ps.some((c) => c.kind === 'city' && c.country === p.country));
const inBox = (p: Place, [w, s, e, n]: BBox) => {
  const [mx, my] = [(e - w) * VIEW_MARGIN, (n - s) * VIEW_MARGIN];
  return !!p.at && p.at[0] >= w - mx && p.at[0] <= e + mx && p.at[1] >= s - my && p.at[1] <= n + my;
};

/** Code forms that name exactly one row, tried in order; add a form as a row. */
const CODE_FORMS: [RegExp, (code: string) => Place | undefined][] = [
  [/^[a-z0-9]+:\S+$|^[a-z_0-9]+$/, (c) => index().byId.get(c)], // canonical id ("city:paris-fr", "rome_ce117")
  [/^[A-Z]{2}$/, (c) => index().byId.get(`country:${c}`)], // ISO 3166-1 alpha-2
  [/^[A-Za-z]{2}-[A-Za-z0-9]{1,3}$/, (c) => index().byId.get(`admin1:${c.toUpperCase()}`)], // ISO 3166-2
  [/^Q\d+$/, (c) => index().byQid.get(c)], // Wikidata
  [/^[A-Z]{3}$/, (c) => index().byName.get(c.toLowerCase())?.find((p) => p.kind === 'country')], // ISO 3166-1 alpha-3
];
const exact = (raw: string): Place | undefined => {
  const code = raw.trim();
  return CODE_FORMS.flatMap(([form, find]) => (form.test(code) ? [find(code)] : [])).find((p) => p !== undefined);
};

/** Narrows candidates by a qualifier: a kind word, a country, or an admin-1 area (never the qualifier itself). */
function qualify(candidates: Place[], qualifier: string): Place[] {
  const word = KIND_WORDS[normalizeName(qualifier)];
  if (word) return candidates.filter((p) => p.kind === word.kind && (!word.country || p.country === word.country));
  const q = exact(qualifier) ?? index().byName.get(normalizeName(qualifier))?.find((p) => p.kind === 'country' || p.kind === 'admin1');
  if (!q) return [];
  return candidates.filter((p) => p.id !== q.id && (q.kind === 'country' ? p.country === q.country : p.admin1 === q.id.slice('admin1:'.length)));
}

const levenshtein = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
};

/** The closest allowed rows to a name (edit distance, then size), for "did you mean" lists. */
function nearest(name: string, ctx: RefContext): Place[] {
  const key = normalizeName(name);
  const scored: [number, Place][] = [];
  for (const [k, places] of index().byName) {
    const d = k.startsWith(key) || key.startsWith(k) ? Math.abs(k.length - key.length) * 0.5 : levenshtein(key, k);
    if (d <= Math.max(2, key.length / 3)) for (const p of places) if (allowed(p, ctx)) scored.push([d, p]);
  }
  const seen = new Set<string>();
  return scored
    .sort((a, b) => a[0] - b[0] || weight(b[1]) - weight(a[1]))
    .map(([, p]) => p)
    .filter((p) => !seen.has(p.id) && !!seen.add(p.id))
    .slice(0, CANDIDATES);
}

const list = (ps: Place[]) => (ps.length > 0 ? ps.map(describePlace).join('; ') : 'none');

/** Why a known row is not allowed here, with what to use instead (the polity holding a modern country on a historical map). */
function eraMismatch(raw: string, p: Place, ctx: RefContext): Resolution {
  const kinds = REF_KINDS[ctx.use][ctx.era];
  const held = ctx.snapshot !== undefined && p.country ? index().snapshots.get(ctx.snapshot)!.byCountry[p.country] : undefined;
  const instead = held ? `In ${ctx.snapshot} that land was ${describePlace(placeById(held)!)}.` : `Candidates: ${list(nearest(p.name, ctx))}.`;
  const what = p.kind === 'polity' && kinds.includes('polity') ? `not on the ${ctx.snapshot} map (${p.from}–${p.to})` : `a ${p.kind}; on ${ctx.era} maps a ${ctx.use} must be ${kinds.join(' / ') || 'a named view'}`;
  return { ok: false, rule: 'place_era', message: `"${raw}" is ${what}. ${instead}` };
}

/** Resolves one reference to a canonical id, or explains why not. */
export function resolveRef(raw: string, ctx: RefContext): Resolution {
  const hit = exact(raw);
  if (hit) return allowed(hit, ctx) ? { ok: true, id: hit.id } : eraMismatch(raw, hit, ctx);
  const m = raw.match(/^(.*?)\s*(?:\(([^)]+)\)|,\s*([^,]+))$/);
  const [name, qualifier] = m ? [m[1]!, m[2] ?? m[3]] : [raw, undefined];
  const named = index().byName.get(normalizeName(name)) ?? [];
  const kinded = named.filter((p) => allowed(p, ctx));
  const qualified = qualifier ? qualify(kinded, qualifier) : kinded;
  const inView = ctx.bbox ? qualified.filter((p) => inBox(p, ctx.bbox!)) : [];
  const ranked = yieldToCities(inView.length > 0 ? inView : qualified).sort((a, b) => weight(b) - weight(a));
  const [top, second] = ranked;
  if (top && (!second || weight(second) * AMBIGUOUS_RATIO < weight(top))) return { ok: true, id: top.id };
  if (top) return { ok: false, rule: 'place_ambiguous', message: `"${raw}" is ambiguous: ${list(ranked.slice(0, CANDIDATES))}. Write the id, or qualify the name ("Name, CC" or "Name, US-CA").` };
  if (named.length > 0 && kinded.length === 0) return eraMismatch(raw, named.sort((a, b) => weight(b) - weight(a))[0]!, ctx);
  return { ok: false, rule: 'place_unknown', message: `"${raw}" is not in the catalog. Closest: ${list(nearest(name, ctx))}. Use one of these ids or qualify the name.` };
}

// ── Map shots ────────────────────────────────────────────────────────────────

type MapShot = Extract<Shot, { kind: 'map' }>;
export interface RefProblem {
  rule: string;
  message: string;
}

/** A map shot's era and snapshot: ancient views draw the AWMC pack, a `year` draws that year's borders. */
export function mapEra(shot: Pick<MapShot, 'view' | 'year'>): { era: MapEra; year?: number; snapshot?: number } {
  const named = MAP_VIEWS[shot.view as MapViewId];
  if (named && 'ancient' in named) return { era: 'ancient', year: shot.year ?? ANCIENT_DEFAULT_YEAR };
  if (shot.year === undefined) return { era: 'modern' };
  return { era: 'historical', year: shot.year, snapshot: snapshotFor(shot.year) ?? undefined };
}

/** The box a view frames: a named view's, or a country / admin-1 row's main landmass (polities: from geometry, in geo.ts). */
export const viewBox = (view: string): BBox | undefined => MAP_VIEWS[view as MapViewId]?.bbox ?? placeById(view)?.bbox;

/**
 * Resolves every reference in a map shot to canonical ids. Unresolved references stay as
 * written, with one problem each (the screenplay loop feeds them back).
 */
export function resolveMapShot(shot: MapShot): { shot: MapShot; problems: RefProblem[] } {
  const problems: RefProblem[] = [];
  const { era, year, snapshot } = mapEra(shot);
  if (era === 'historical' && snapshot === undefined) problems.push({ rule: 'map_year', message: `no historical borders before ${HIST_SNAPSHOTS[0]}; drop "year" or use a later one` });
  const named = shot.view in MAP_VIEWS;
  const viewRes = named ? ({ ok: true, id: shot.view } as const) : resolveRef(shot.view, { use: 'view', era, snapshot });
  if (!viewRes.ok) problems.push({ rule: viewRes.rule, message: `view ${viewRes.message} Named views: ${Object.keys(MAP_VIEWS).join(', ')}` });
  const view = viewRes.ok ? viewRes.id : shot.view;
  const bbox = viewBox(view);
  const ref = (use: RefUse, raw: string, where: string): string => {
    const r = resolveRef(raw, { use, era, snapshot, bbox });
    if (r.ok) return r.id;
    problems.push({ rule: r.rule, message: `${where}: ${r.message}` });
    return raw;
  };
  const resolved: MapShot = {
    ...shot,
    view,
    layers: shot.layers.map((l, i) => ({ ...l, layer: ref('fill', l.layer, `layers[${i}]`) })),
    labels: shot.labels.map((l, i) => ({ ...l, place: ref('place', l.place, `labels[${i}]`) })),
    ...(shot.pins && { pins: shot.pins.map((p, i) => ({ ...p, place: ref('place', p.place, `pins[${i}]`) })) }),
    ...(shot.circle && { circle: { ...shot.circle, place: ref('place', shot.circle.place, 'circle') } }),
    ...(shot.arrow && { arrow: { ...shot.arrow, from: ref('place', shot.arrow.from, 'arrow.from'), to: ref('place', shot.arrow.to, 'arrow.to') } }),
    ...(shot.armies && { armies: shot.armies.map((a, i) => ({ ...a, from: ref('place', a.from, `armies[${i}].from`), to: ref('place', a.to, `armies[${i}].to`) })) }),
  };
  const marked = [...resolved.labels, ...(resolved.pins ?? [])].map((l) => l.place);
  const twice = marked.find((p, i) => marked.indexOf(p) !== i);
  if (twice) problems.push({ rule: 'map_places', message: `${placeName(twice, year)} is labelled or pinned twice; mark a place once` });
  return { shot: resolved, problems };
}

// ── Prompt helpers ───────────────────────────────────────────────────────────

/** The famous places the prompt lists inline ("Tokyo JP"), largest first. */
export function tier1Places(): string[] {
  return [...index().byId.values()]
    .filter((p) => p.tier === 1)
    .sort((a, b) => weight(b) - weight(a))
    .map((p) => `${DISPLAY_NAMES[p.id] ?? p.name} ${p.country ?? ''}`.trim());
}

/** Max n-gram length the retrieval pre-pass tries ("Democratic Republic of the Congo" is 6 words). */
const NGRAM_MAX = 6;
/**
 * Retrieval pre-pass: the places a topic (and its research notes) name, as candidates with
 * canonical ids, so the model rarely guesses. Only capitalised phrases are tried (proper nouns,
 * not "nice" or "reading"); each phrase keeps its best-ranked rows.
 */
export function knownPlaces(text: string, max = 40): string[] {
  const words = text.split(/[^\p{L}\p{N}'’.-]+/u).filter(Boolean);
  const found = new Map<string, Place>();
  for (let i = 0; i < words.length; i++) {
    if (!/^\p{Lu}/u.test(words[i]!)) continue;
    for (let n = Math.min(NGRAM_MAX, words.length - i); n >= 1; n--) {
      const hits = index().byName.get(normalizeName(words.slice(i, i + n).join(' ')));
      if (!hits) continue;
      for (const p of yieldToCities(hits).sort((a, b) => weight(b) - weight(a)).slice(0, 3)) found.set(p.id, p);
      i += n - 1;
      break;
    }
  }
  return [...found.values()]
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, max)
    .map(describePlace);
}

// ── Sheets ───────────────────────────────────────────────────────────────────

/**
 * Resolves every map shot of a sheet (the checkBeatSheet edge). Beats sharing a world must also
 * share a base: an ancient view and a modern one cannot glide on one canvas.
 */
export function resolveSheetRefs(sheet: BeatSheet): { sheet: BeatSheet; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  const beats = sheet.beats.map((b) => {
    if (b.shot.kind !== 'map') return b;
    const r = resolveMapShot(b.shot);
    violations.push(...r.problems.map((p) => ({ ...p, beatId: b.id })));
    return { ...b, shot: r.shot };
  });
  const ancientWorlds = new Map<string, boolean>();
  for (const b of beats) {
    if (b.shot.kind !== 'map' || !b.world) continue;
    const ancient = mapEra(b.shot).era === 'ancient';
    const seen = ancientWorlds.get(b.world);
    if (seen !== undefined && seen !== ancient) violations.push({ rule: 'map_world', beatId: b.id, message: `world "${b.world}" mixes ancient views (${Object.keys(MAP_VIEWS).filter((v) => 'ancient' in MAP_VIEWS[v as MapViewId]).join(', ')}) with modern ones; give this beat its own world` });
    ancientWorlds.set(b.world, seen ?? ancient);
  }
  return { sheet: { ...sheet, beats }, violations };
}

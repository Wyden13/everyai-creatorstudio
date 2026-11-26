/**
 * One-off, deterministic geodata build for the Vox map widget.
 * Downloads pinned sources (sha256-checked) into .geo-cache/, then clips / dissolves / simplifies
 * them with mapshaper into the committed packs in assets/geo/. Run manually:
 *
 *   bun scripts/geo-build.ts                  every pack, ISO worldview
 *   bun scripts/geo-build.ts --worldview=ind  also the world pack of another worldview (into .geo-cache/packs/)
 *
 * Packs: mediterranean (AWMC, ancient views), world-<worldview> (Natural Earth land, countries,
 * disputed areas, lakes, rivers), admin1/<CC> (NE admin-1 per country; US from us-atlas),
 * hist/<year> (Cliopatria polities of one snapshot year, clipped to NE land), and catalog.json
 * (every place, country, admin-1 and polity row the resolver in src/vox/places.ts reads).
 * The LLM never draws geometry: it may only reference ids written here.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { mainBox } from '../src/vox/geo-shapes';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { CATALOG_FIELDS, HIST_SNAPSHOTS, PACK_CLIP, WORLDVIEWS, normalizeName, polityId, slug, type Worldview } from '../src/vox/geo-manifest';

const ROOT = resolve(import.meta.dir, '..');
const CACHE = join(ROOT, '.geo-cache');
const GEO = join(ROOT, 'assets/geo');
const MAPSHAPER = join(ROOT, 'node_modules/.bin/mapshaper');

const AWMC = 'https://raw.githubusercontent.com/AWMC/geodata/7ecf8bccea2efe1e1e9df2daf6001942de73fb87/Cultural-Data/political_shading';
/** natural-earth-vector tag v5.1.2. */
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson';
/** Cliopatria v0.2.1 (Seshat Global History Databank). */
const CLIO = 'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/5f433377139a6eeaeacbdc894b70f8805b72c8b5';

/** Pinned sources. Add a source as a row; the sha256 makes the build reproducible. */
const SOURCES = {
  land: { url: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json', sha256: '619477ff690c086885e45cb91707d783805561bd75ae8e437b7d4694b0204e0f' },
  bce60: { url: `${AWMC}/roman_empire_bce_60/roman_empire_bce_60.geojson`, sha256: 'e940ea2facff6163e02ab969d30b26f729c27e1e99db6eee655f7ebc8ac286d3' },
  ce117: { url: `${AWMC}/roman_empire_ce_117_extent/roman_empire_ce_117_extent.geojson`, sha256: '1ddd9ac15006e8b9ffd4d185d0302295c3d7c321e9bc8ae3fd627e12d128ba29' },
  provinces: { url: `${AWMC}/roman_empire_provinces%20post_diocletian/roman_empire_provinces%20post_diocletian.geojson`, sha256: '8e2a1743efc937e1a1c93b35d490ac19bacc07454909c89c0f7cbd3ac83605c1' },
  ne_disputed: { url: `${NE}/ne_50m_admin_0_breakaway_disputed_areas.geojson`, sha256: 'e91f0f9518b24355ceec6668f4df874d6f39db7d0bc9ec22d9b14429bfb6be01' },
  ne_lakes: { url: `${NE}/ne_50m_lakes.geojson`, sha256: 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52' },
  ne_rivers: { url: `${NE}/ne_50m_rivers_lake_centerlines.geojson`, sha256: 'f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51' },
  ne_admin1: { url: `${NE}/ne_10m_admin_1_states_provinces.geojson`, sha256: '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5' },
  ne_places: { url: `${NE}/ne_10m_populated_places.geojson`, sha256: '9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b' },
  us_states: { url: 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json', sha256: 'd76b391ccfa8bff601d51e3e3da5d43a89fa46cd5caca72ce731b383be5596d0' },
  cliopatria: { url: `${CLIO}/cliopatria.geojson.zip`, sha256: 'e10a4e429fca708788ff9e7572a95fce801fae55852d217cffabc1c59cd4eed4' },
} as const;

/** Region extent [west, south, east, north] in degrees; cameras are clamped inside it. */
const MED_BBOX = PACK_CLIP.join(',');
/** Approximate 395 CE East/West division (~19.5°E); good enough for an explainer, labelled approximate. */
const SPLIT_LON = 19.5;

/**
 * Committed-size budgets (bytes) per pack family; the build fails past them (repo budget ~8 MB).
 * Simplification is the knob: raise a percentage only with room in its budget.
 */
const BUDGET = { mediterranean: 600e3, world: 500e3, admin1: 1.6e6, hist: 3e6, catalog: 1.4e6 } as const;

/** Every ancient-pack layer is one mapshaper command line; add a layer as a row. */
const ANCIENT_LAYERS: Record<string, string[]> = {
  land: ['land.json', '-clip', `bbox=${MED_BBOX}`, '-simplify', '25%', 'keep-shapes'],
  rome_bce60: ['bce60.geojson', '-dissolve', '-clip', 'out/land.json', '-simplify', '20%', 'keep-shapes'],
  rome_ce117: ['ce117.geojson', '-dissolve', '-clip', 'out/land.json', '-simplify', '20%', 'keep-shapes'],
  rome_west_395: ['ce117.geojson', '-dissolve', '-clip', `bbox=-20,0,${SPLIT_LON},70`, '-clip', 'out/land.json', '-simplify', '20%', 'keep-shapes'],
  rome_east_395: ['ce117.geojson', '-dissolve', '-clip', `bbox=${SPLIT_LON},0,70,70`, '-clip', 'out/land.json', '-simplify', '20%', 'keep-shapes'],
  provinces_late: ['provinces.geojson', '-simplify', '20%'],
};

/**
 * World-pack layers (one mapshaper command each, `id` set for the TopoJSON id); add a layer as a
 * row. There is no land layer: land is the countries merged (geo.ts), so coasts and borders share
 * arcs. Antarctica is left out: it would dominate every world framing. Countries come from the
 * 10m worldview file (Natural Earth publishes worldviews only at 10m), simplified to ~50m density.
 */
const worldLayers = (countriesFile: string): Record<string, string[]> => ({
  countries: [countriesFile, '-filter', 'ISO_A2_EH !== "-99" && ISO_A2_EH !== "AQ"', '-each', 'id = "country:" + ISO_A2_EH', '-filter-fields', 'id', '-simplify', '4%', 'keep-shapes'],
  disputed: ['ne_disputed.geojson', '-each', `id = "disputed:" + BRK_NAME.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`, '-filter-fields', 'id', '-simplify', '35%', 'keep-shapes'],
  lakes: ['ne_lakes.geojson', '-filter', 'scalerank <= 4', '-filter-fields', '', '-simplify', '30%', 'keep-shapes'],
  rivers: ['ne_rivers.geojson', '-filter', 'featurecla === "River" && scalerank <= 5', '-filter-fields', '', '-simplify', '30%'],
});

async function fetchPinned(name: string, src: { url: string; sha256: string | null }, file: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`download failed ${res.status}: ${src.url}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (src.sha256 === null) throw new Error(`${name} has no pinned sha256 yet: check ${src.url} and pin ${got}`);
  if (got !== src.sha256) throw new Error(`sha256 mismatch for ${name}: ${got}`);
  return path;
}

async function run(cmd: string[], cwd = CACHE): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')}\n${await new Response(proc.stderr).text()}`);
}
const mapshaper = (args: string[]) => run([MAPSHAPER, '-quiet', ...args]);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const sizeOf = (path: string): number => (statSync(path).isDirectory() ? readdirSync(path).reduce((n, f) => n + sizeOf(join(path, f)), 0) : statSync(path).size);
function checkBudget(name: keyof typeof BUDGET, path: string): void {
  const bytes = sizeOf(path);
  console.log(`wrote ${path} (${kb(bytes)})`);
  if (bytes > BUDGET[name]) throw new Error(`${name} packs exceed the ${kb(BUDGET[name])} budget`);
}

/** Combines per-layer GeoJSON files into one TopoJSON pack (shared arcs, so borders match exactly). */
async function topoPack(layers: Record<string, string[]>, dir: string, out: string, idField = false): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const [name, cmd] of Object.entries(layers)) await mapshaper(['-i', ...cmd, '-o', 'format=geojson', join(dir, `${name}.json`)]);
  const files = Object.keys(layers).map((n) => join(dir, `${n}.json`));
  await mapshaper(['-i', ...files, 'combine-files', '-o', 'format=topojson', 'quantization=1e5', ...(idField ? ['id-field=id'] : []), out]);
}

// ── Catalog rows (read by src/vox/places.ts) ────────────────────────────────

type LonLat = [number, number];
type BBox = [number, number, number, number];
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Normalised aliases of a row (its name's own form excluded, duplicates dropped). */
const aliasesOf = (name: string, raw: (string | null | undefined)[]): string[] | undefined => {
  const own = normalizeName(name);
  const out = [...new Set(raw.flatMap((r) => (r ? r.split('|') : [])).map(normalizeName))].filter((a) => a && a !== own);
  return out.length > 0 ? out : undefined;
};

type Props = Record<string, string | number | null>;
const str = (p: Props, k: string) => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : undefined);

// ── Build ────────────────────────────────────────────────────────────────────

const worldviewArg = Bun.argv.find((a) => a.startsWith('--worldview='))?.slice('--worldview='.length) as Worldview | undefined;
if (worldviewArg && !(worldviewArg in WORLDVIEWS)) throw new Error(`unknown worldview "${worldviewArg}"; known: ${Object.keys(WORLDVIEWS).join(', ')}`);

mkdirSync(join(CACHE, 'out'), { recursive: true });
for (const [name, src] of Object.entries(SOURCES)) await fetchPinned(name, src, `${name}.${src.url.split('.').pop()}`);

// 1. Ancient pack (unchanged since the Roman sheets): land first, every empire layer is clipped to it.
await topoPack(ANCIENT_LAYERS, join(CACHE, 'out'), join(GEO, 'mediterranean.topo.json'));
checkBudget('mediterranean', join(GEO, 'mediterranean.topo.json'));

// 2. World pack per worldview: the ISO view is committed, others go to the gitignored cache.
for (const wv of ['iso', ...(worldviewArg && worldviewArg !== 'iso' ? [worldviewArg] : [])] as Worldview[]) {
  const row = WORLDVIEWS[wv];
  await fetchPinned(`worldview ${wv}`, { url: `${NE}/ne_10m_admin_0_countries_${wv}.geojson`, sha256: row.sha256 }, `ne_countries_${wv}.geojson`);
  const out = join(ROOT, row.pack);
  mkdirSync(join(out, '..'), { recursive: true });
  await topoPack(worldLayers(`ne_countries_${wv}.geojson`), join(CACHE, `out/world-${wv}`), out, true);
  checkBudget('world', out);
}

// 3. Admin-1 per country (NE 10m), the US from us-atlas (Census) instead.
const admin1Src = readJson<FeatureCollection<Geometry, Props>>(join(CACHE, 'ne_admin1.geojson'));
for (const dir of [join(GEO, 'admin1'), join(CACHE, 'out/admin1')]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
// Simplified once over the whole world (neighbours keep matching borders), then one pack per country.
await mapshaper([
  '-i', 'ne_admin1.geojson',
  '-filter', 'iso_a2 !== "US" && iso_a2 !== "-1" && iso_3166_2 && iso_3166_2.indexOf("~") < 0',
  '-each', 'id = "admin1:" + iso_3166_2',
  '-filter-fields', 'id',
  '-simplify', '5%', 'keep-shapes',
  '-split', 'id.slice(7).split("-")[0]',
  '-o', 'format=geojson', join(CACHE, 'out/admin1') + '/',
]);
const admin1Files = readdirSync(join(CACHE, 'out/admin1'));
for (let i = 0; i < admin1Files.length; i += 8) {
  await Promise.all(
    admin1Files.slice(i, i + 8).map((f) =>
      mapshaper(['-i', join(CACHE, 'out/admin1', f), 'name=admin1', '-o', 'format=topojson', 'quantization=1e5', 'id-field=id', join(GEO, 'admin1', f.replace(/\.json$/, '.topo.json'))]),
    ),
  );
}
const usNames = new Map(admin1Src.features.filter((f) => f.properties.iso_a2 === 'US').map((f) => [normalizeName(String(f.properties.name)), String(f.properties.iso_3166_2)]));
const usTopo = readJson<{ objects: { states: { geometries: { id?: string; properties?: { name: string } }[] } } }>(join(CACHE, 'us_states.json'));
const usStates = usTopo.objects.states.geometries.flatMap((g) => {
  const code = usNames.get(normalizeName(g.properties!.name));
  return code ? [{ ...g, id: `admin1:${code}`, properties: undefined }] : [];
});
writeFileSync(join(GEO, 'admin1', 'US.topo.json'), JSON.stringify({ ...usTopo, objects: { admin1: { ...usTopo.objects.states, geometries: usStates } } }));
checkBudget('admin1', join(GEO, 'admin1'));

// 4. Historical snapshots: Cliopatria POLITY rows alive in each snapshot year, clipped to NE land.
//    Rows of one polity alive in the same year (a range ending as the next begins) dissolve into one shape.
const clioDir = join(CACHE, 'cliopatria');
mkdirSync(clioDir, { recursive: true });
await run(['unzip', '-o', '-q', join(CACHE, 'cliopatria.zip'), '-d', clioDir]);
const clioFile = readdirSync(clioDir).find((f) => f.endsWith('.geojson'));
if (!clioFile) throw new Error('cliopatria zip holds no .geojson');
const clio = readJson<FeatureCollection<Geometry, Props>>(join(clioDir, clioFile));
const polities = clio.features.filter((f) => f.properties.Type === 'POLITY');
// The land mask is the ISO countries dissolved, so historical coasts match the modern packs' coasts.
await mapshaper(['-i', 'out/world-iso/countries.json', '-dissolve', '-o', 'format=geojson', 'out/hist-land.json']);
rmSync(join(GEO, 'hist'), { recursive: true, force: true });
mkdirSync(join(GEO, 'hist'), { recursive: true });
mkdirSync(join(CACHE, 'out/hist'), { recursive: true });
for (const year of HIST_SNAPSHOTS) {
  const alive = polities.filter((f) => (f.properties.FromYear as number) <= year && (f.properties.ToYear as number) >= year);
  const slice = { type: 'FeatureCollection', features: alive.map((f) => ({ type: 'Feature', properties: { id: polityId(String(f.properties.Name)) }, geometry: f.geometry })) };
  writeFileSync(join(CACHE, `out/hist/${year}.in.json`), JSON.stringify(slice));
  await mapshaper([
    '-i', `out/hist/${year}.in.json`, 'name=polities', '-clip', 'out/hist-land.json', '-dissolve', 'id', '-simplify', '15%', 'keep-shapes', '-filter', '!this.isNull',
    '-o', 'format=topojson', 'quantization=4e4', 'id-field=id', join(GEO, 'hist', `${year}.topo.json`),
  ]);
}
checkBudget('hist', join(GEO, 'hist'));

// 5. Catalog: countries (ISO view), admin-1 rows, cities, polities with their snapshot years.
const countriesSrc = readJson<FeatureCollection<Geometry, Props>>(join(CACHE, 'ne_countries_iso.geojson'));
const countries = countriesSrc.features
  .filter((f) => f.properties.ISO_A2_EH !== '-99' && f.properties.ISO_A2_EH !== 'AQ')
  .map((f) => {
    const p = f.properties;
    const name = str(p, 'ADMIN')!;
    return {
      id: `country:${p.ISO_A2_EH}`,
      name,
      at: [round(p.LABEL_X as number), round(p.LABEL_Y as number)] as LonLat,
      bbox: mainBox(f.geometry),
      country: String(p.ISO_A2_EH),
      pop: p.POP_EST as number,
      qid: str(p, 'WIKIDATAID'),
      aliases: aliasesOf(name, [str(p, 'NAME'), str(p, 'NAME_LONG'), str(p, 'NAME_EN'), str(p, 'FORMAL_EN'), str(p, 'NAME_SORT'), str(p, 'NAME_ALT'), str(p, 'ISO_A3_EH')]),
    };
  });
const countryAt = new Map(countries.map((c) => [c.country, c.at]));

const admin1 = admin1Src.features
  .filter((f) => f.properties.iso_a2 !== '-1' && str(f.properties, 'iso_3166_2') && !String(f.properties.iso_3166_2).includes('~'))
  .map((f) => {
    const p = f.properties;
    const name = str(p, 'name_en') ?? str(p, 'name') ?? str(p, 'gn_name') ?? String(p.iso_3166_2);
    return {
      id: `admin1:${p.iso_3166_2}`,
      name,
      at: [round(p.longitude as number), round(p.latitude as number)] as LonLat,
      bbox: mainBox(f.geometry),
      country: String(p.iso_a2),
      qid: str(p, 'wikidataid'),
      aliases: aliasesOf(name, [str(p, 'name'), str(p, 'name_alt'), str(p, 'abbrev'), str(p, 'postal') && `${p.iso_a2}-${p.postal}`]),
    };
  });
const admin1ByName = new Map(admin1.flatMap((a) => [a.name, ...(a.aliases ?? [])].map((n) => [`${a.country}|${normalizeName(n)}`, a.id.slice('admin1:'.length)] as const)));

const placesSrc = readJson<FeatureCollection<Geometry, Props>>(join(CACHE, 'ne_places.geojson'));
const cityIds = new Set<string>();
const cities = [...placesSrc.features]
  .sort((a, b) => (b.properties.POP_MAX as number) - (a.properties.POP_MAX as number))
  .map((f) => {
    const p = f.properties;
    const cc = String(p.ISO_A2);
    const name = str(p, 'NAME_EN') ?? str(p, 'NAME')!;
    const adm1 = str(p, 'ADM1NAME') && admin1ByName.get(`${cc}|${normalizeName(String(p.ADM1NAME))}`);
    const base = `city:${slug(str(p, 'NAMEASCII') ?? name)}-${cc.toLowerCase()}`;
    const id = cityIds.has(base) ? `${base}-${slug(adm1?.split('-')[1] ?? String(p.ADM1NAME ?? p.NE_ID))}` : base;
    cityIds.add(id);
    return {
      id,
      name,
      at: [round(p.LONGITUDE as number), round(p.LATITUDE as number)] as LonLat,
      country: cc,
      ...(adm1 && { admin1: adm1 }),
      pop: p.POP_MAX as number,
      qid: str(p, 'WIKIDATAID'),
      ...((p.SCALERANK as number) <= 2 && { tier: 1 as const }),
      aliases: aliasesOf(name, [str(p, 'NAME'), str(p, 'NAMEASCII'), str(p, 'NAMEALT'), str(p, 'NAMEPAR')]),
    };
  });

// Polities: one row per id (a name), alive over its rows' year span; snapshot membership per year.
const polityRows = new Map<string, { id: string; name: string; qid?: string; from: number; to: number }>();
for (const f of polities) {
  const p = f.properties;
  const id = polityId(String(p.Name));
  const row = polityRows.get(id);
  polityRows.set(id, {
    id,
    name: String(p.Name),
    qid: row?.qid ?? str(p, 'Wikidata'),
    from: Math.min(row?.from ?? Infinity, p.FromYear as number),
    to: Math.max(row?.to ?? -Infinity, p.ToYear as number),
  });
}
/** Per snapshot: its polity ids, and which polity holds each modern country's label point (resolver suggestions). */
const snapshots = HIST_SNAPSHOTS.map((year) => {
  const topo = readJson<Topology>(join(GEO, 'hist', `${year}.topo.json`));
  const fc = feature(topo, Object.values(topo.objects)[0]!) as unknown as FeatureCollection<Geometry>;
  const holds = (at: LonLat) => fc.features.find((f) => geoContains(f as Feature, at))?.id as string | undefined;
  const byCountry = Object.fromEntries([...countryAt].flatMap(([cc, at]) => {
    const id = holds(at);
    return id ? [[cc, id]] : [];
  }));
  return { year, polities: fc.features.map((f) => f.id as string).sort(), byCountry };
});
// Rows are tuples in CATALOG_FIELDS order (trailing blanks trimmed); snapshots point into `polities` by index.
const tuple = (r: Record<string, unknown>) => {
  const t = CATALOG_FIELDS.map((k) => r[k] ?? null);
  while (t.at(-1) === null) t.pop();
  return t;
};
const polityList = [...polityRows.values()].sort((a, b) => a.id.localeCompare(b.id));
const polityIndex = new Map(polityList.map((p, i) => [p.id, i]));
const catalog = {
  rows: [...countries, ...admin1, ...cities].map(tuple),
  polities: polityList.map((p) => [p.id, p.name, p.from, p.to, p.qid ?? null]),
  snapshots: snapshots.map((s) => ({ year: s.year, polities: s.polities.map((id) => polityIndex.get(id)!), byCountry: Object.fromEntries(Object.entries(s.byCountry).map(([cc, id]) => [cc, polityIndex.get(id)!])) })),
};
const catalogPath = join(GEO, 'catalog.json');
writeFileSync(catalogPath, JSON.stringify(catalog));
checkBudget('catalog', catalogPath);
console.log(`catalog: ${countries.length} countries, ${admin1.length} admin-1, ${cities.length} cities (${cities.filter((c) => c.tier === 1).length} tier 1), ${polityRows.size} polities, ${snapshots.length} snapshots`);

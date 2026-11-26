/**
 * The map vocabulary as data. The Screenplay LLM never writes coordinates or geometry: it names
 * views, places and fills, and src/vox/places.ts resolves every name to a canonical id from the
 * built catalog (assets/geo/catalog.json, scripts/geo-build.ts) plus the hand rows here.
 * Add a view, a site, an era name or an alias as a row.
 */

export type LonLat = readonly [lon: number, lat: number];
export type BBox = readonly [west: number, south: number, east: number, north: number];

// ── Naming rules (shared by the build and the resolver) ─────────────────────

/** Letters NFKD does not decompose. */
const FOLD: Record<string, string> = { ß: 'ss', ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };
/** Lowercase ASCII words: diacritics and apostrophes dropped, every other mark a space ("Hadrian's Wall" → "hadrians wall"). */
export const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[ßłøæœđðþı]/g, (c) => FOLD[c]!)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const slug = (s: string): string => normalizeName(s).replace(/ /g, '-');
/** A Cliopatria polity's id: its name, slugged ("German Empire" → polity:german-empire). */
export const polityId = (name: string): string => `polity:${slug(name)}`;

/**
 * Column order of assets/geo/catalog.json `rows` (countries, admin-1, cities as tuples, rarely set
 * fields last so trailing blanks are trimmed). Polities are `[id, name, from, to, qid]`.
 */
export const CATALOG_FIELDS = ['id', 'name', 'at', 'country', 'pop', 'qid', 'bbox', 'admin1', 'tier', 'aliases'] as const;

// ── Base packs ──────────────────────────────────────────────────────────────

/**
 * Natural Earth worldviews (points of view on disputed borders): an org setting, default `iso`.
 * Only the ISO pack is committed; another is built into the gitignored cache with
 * `bun scripts/geo-build.ts --worldview=<id>` once its sha256 is pinned here.
 */
const otherWorldview = (code: string) => ({ sha256: null, pack: `.geo-cache/packs/world-${code}.topo.json` });
export const WORLDVIEWS = {
  iso: { sha256: '60eb10aa951f5872507c9436937508b09be4b43dc9fa7aad7644f23ef12e1cad', pack: 'assets/geo/world-iso.topo.json' },
  ...Object.fromEntries(
    ['arg', 'bdg', 'bra', 'chn', 'deu', 'egy', 'esp', 'fra', 'gbr', 'grc', 'idn', 'ind', 'isr', 'ita', 'jpn', 'kor', 'mar', 'nep', 'nld', 'pak', 'prt', 'pse', 'rus', 'sau', 'swe', 'tlc', 'tur', 'twn', 'ukr', 'usa', 'vnm'].map((c) => [c, otherWorldview(c)]),
  ),
} as Record<'iso' | 'arg' | 'bdg' | 'bra' | 'chn' | 'deu' | 'egy' | 'esp' | 'fra' | 'gbr' | 'grc' | 'idn' | 'ind' | 'isr' | 'ita' | 'jpn' | 'kor' | 'mar' | 'nep' | 'nld' | 'pak' | 'prt' | 'pse' | 'rus' | 'sau' | 'swe' | 'tlc' | 'tur' | 'twn' | 'ukr' | 'usa' | 'vnm', { sha256: string | null; pack: string }>;
export type Worldview = keyof typeof WORLDVIEWS;
export const DEFAULT_WORLDVIEW: Worldview = 'iso';

/**
 * Cliopatria snapshot years (negative = BCE, no year 0). A map shot's `year` picks the latest
 * snapshot at or before it; borders between snapshots are approximate by construction.
 */
export const HIST_SNAPSHOTS = [
  -3000, -2500, -2000, -1500, -1200, -1000, -800, -600, -500, -400, -300, -200, -100, 1, 117, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200,
  1300, 1400, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1815, 1850, 1871, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1950, 1960, 1970, 1980, 1991, 2000,
  2010, 2024,
] as const;

/**
 * Where every dataset comes from, as data: the README asset table mirrors it and every timeline
 * carries the ids it used (Timeline.sources), so the Publisher can offer credits. Nothing is on screen.
 */
export const GEO_SOURCES = {
  natural_earth: { name: 'Natural Earth 5.1.2 (naturalearthdata.com)', licence: 'Public domain', credit: 'Made with Natural Earth (optional)' },
  world_atlas: { name: 'world-atlas 2.0.2 land-50m (Natural Earth)', licence: 'ISC; Natural Earth is public domain', credit: 'Made with Natural Earth (optional)' },
  us_atlas: { name: 'us-atlas 3.0.1 states-10m (U.S. Census Bureau cartographic boundaries)', licence: 'ISC; U.S. Census data is public domain', credit: '' },
  cliopatria: {
    name: 'Cliopatria v0.2.1, Seshat Global History Databank',
    licence: 'CC BY 4.0',
    credit: 'Historical borders: Cliopatria (Seshat Global History Databank), CC BY 4.0, simplified and clipped to Natural Earth land; borders are approximate',
  },
  awmc: { name: 'Ancient World Mapping Center geodata (commit 7ecf8bc)', licence: 'ODbL 1.0', credit: 'Ancient World Mapping Center' },
} as const;
export type GeoSourceId = keyof typeof GEO_SOURCES;

// ── Views ───────────────────────────────────────────────────────────────────

/** The projections a map can use (geo.ts PROJECTIONS makes each one). */
export type ProjectionId = 'ancient' | 'equal_earth' | 'conic' | 'mercator' | 'albers_usa';

/**
 * Camera framings (bbox in degrees). `ancient` views draw the AWMC Mediterranean pack; the rest
 * draw the modern (or, with a shot `year`, the historical) world. A view may pin its projection;
 * otherwise geo.ts PROJECTION_RULES picks one from the framed area. A view can also be any
 * country, admin-1 or polity id (framed on its main landmass).
 */
export const MAP_VIEWS = {
  // Ancient Mediterranean (AWMC pack).
  mediterranean: { bbox: [-11, 24, 47, 56], ancient: true },
  west: { bbox: [-11, 30, 22, 56], ancient: true },
  east: { bbox: [14, 26, 46, 48], ancient: true },
  italy: { bbox: [5, 36, 20, 47.5], ancient: true },
  rome_region: { bbox: [9.5, 39.5, 15.5, 44], ancient: true },
  britain_gaul: { bbox: [-8, 42, 10, 57], ancient: true },
  greece_anatolia: { bbox: [18, 34, 36, 44], ancient: true },
  egypt_levant: { bbox: [24, 27, 40, 37], ancient: true },
  // The world. On 9:16 a world view is cropped about its centre; the hemispheres are the phone framings.
  world: { bbox: [-180, -58, 180, 84], projection: 'equal_earth' },
  americas: { bbox: [-135, -56, -30, 72], projection: 'equal_earth' },
  europe_africa: { bbox: [-25, -36, 60, 72], projection: 'equal_earth' },
  asia_pacific: { bbox: [60, -48, 180, 72], projection: 'equal_earth' },
  // Regions.
  europe: { bbox: [-25, 34, 45, 71] },
  north_america: { bbox: [-170, 7, -50, 75] },
  usa: { bbox: [-125, 24, -66, 50], projection: 'albers_usa' },
  caribbean: { bbox: [-90, 9, -59, 27] },
  south_america: { bbox: [-82, -56, -34, 13] },
  africa: { bbox: [-18, -35, 52, 38] },
  middle_east: { bbox: [25, 12, 63, 42] },
  russia: { bbox: [25, 40, 180, 78], projection: 'conic' },
  central_asia: { bbox: [45, 30, 90, 55] },
  south_asia: { bbox: [60, 5, 98, 37] },
  east_asia: { bbox: [95, 18, 146, 54] },
  southeast_asia: { bbox: [92, -11, 141, 24] },
  oceania: { bbox: [110, -48, 180, 0] },
} as const satisfies Record<string, { bbox: BBox; ancient?: true; projection?: ProjectionId }>;
export type MapViewId = keyof typeof MAP_VIEWS;

/** Ancient views show era names for this year when a shot names none (the Roman peak, like the AWMC layers). */
export const ANCIENT_DEFAULT_YEAR = 117;

/**
 * AWMC fills on the ancient pack (the only fills ancient views can draw). `origin` is where the
 * fill bleeds in from; `year` sets era names on a shot that shows it without its own year.
 */
export const ANCIENT_LAYERS = {
  rome_bce60: { kind: 'area', label: 'Rome, 60 BCE', origin: 'city:rome-it', year: -60 },
  rome_ce117: { kind: 'area', label: 'Rome at its peak, 117 CE', origin: 'city:rome-it', year: 117 },
  rome_west_395: { kind: 'area', label: 'Western Empire, 395 CE (approx.)', origin: 'city:rome-it', year: 395 },
  rome_east_395: { kind: 'area', label: 'Eastern Empire, 395 CE (approx.)', origin: 'city:istanbul-tr', year: 395 },
  provinces_late: { kind: 'lines', label: 'Late Roman provinces', origin: 'city:rome-it', year: 300 },
} as const;
export type AncientLayerId = keyof typeof ANCIENT_LAYERS;

/**
 * Ancient pack extent: every AWMC layer is clipped to this box by scripts/geo-build.ts. Its
 * projected edge is ragged land and a curved sea margin, so no ancient camera may ever show past
 * it (geo.ts clampToData).
 */
export const PACK_CLIP: BBox = [-40, 0, 80, 75];

/** Ancient projection extent: the pack's whole region, fitted once into the 1920x1080 world. */
export const PACK_EXTENT: BBox = [-14, 20, 50, 58];

// ── Hand rows on top of the built catalog ───────────────────────────────────

/**
 * Places Natural Earth lacks: ancient sites, battles, landmarks (Pleiades / Wikipedia coordinates).
 * `tier: 1` rows are listed in the prompt.
 */
export const SITES = {
  'site:carthage': { name: 'Carthage', at: [10.32, 36.85], country: 'TN', tier: 1 },
  'site:cadiz': { name: 'Cádiz', at: [-6.29, 36.53], country: 'ES' },
  'site:trier': { name: 'Trier', at: [6.64, 49.75], country: 'DE' },
  'site:izmit': { name: 'İzmit', at: [29.92, 40.77], country: 'TR' },
  'site:actium': { name: 'Actium', at: [20.77, 38.95], country: 'GR' },
  'site:alesia': { name: 'Alesia', at: [4.5, 47.54], country: 'FR' },
  'site:cannae': { name: 'Cannae', at: [16.13, 41.3], country: 'IT' },
  'site:rubicon': { name: 'Rubicon', at: [12.4, 44.1], country: 'IT' },
  'site:dacia': { name: 'Dacia', at: [23.31, 45.62], country: 'RO' },
  'site:ctesiphon': { name: 'Ctesiphon', at: [44.58, 33.09], country: 'IQ' },
  'site:hadrians-wall': { name: "Hadrian's Wall", at: [-2.3, 55.0], country: 'GB', tier: 1 },
  'site:sirmium': { name: 'Sirmium', at: [19.6, 44.97], country: 'RS' },
  'site:troy': { name: 'Troy', at: [26.24, 39.96], country: 'TR' },
  'site:waterloo': { name: 'Waterloo', at: [4.41, 50.68], country: 'BE', tier: 1 },
  'site:normandy-beaches': { name: 'Normandy beaches', at: [-0.6, 49.35], country: 'FR' },
  'site:verdun': { name: 'Verdun', at: [5.38, 49.16], country: 'FR' },
  'site:gallipoli': { name: 'Gallipoli', at: [26.4, 40.25], country: 'TR' },
  'site:chernobyl': { name: 'Chernobyl', at: [30.1, 51.39], country: 'UA', tier: 1 },
  'site:suez-canal': { name: 'Suez Canal', at: [32.35, 30.6], country: 'EG', tier: 1 },
  'site:panama-canal': { name: 'Panama Canal', at: [-79.68, 9.12], country: 'PA', tier: 1 },
  'site:strait-of-hormuz': { name: 'Strait of Hormuz', at: [56.4, 26.57], country: 'IR', tier: 1 },
  'site:strait-of-gibraltar': { name: 'Strait of Gibraltar', at: [-5.6, 35.95], country: 'ES' },
  'site:bosporus': { name: 'Bosporus', at: [29.06, 41.12], country: 'TR' },
  'site:strait-of-malacca': { name: 'Strait of Malacca', at: [100.5, 3.2], country: 'MY' },
  'site:mount-everest': { name: 'Mount Everest', at: [86.93, 27.99], country: 'NP', tier: 1 },
  'site:great-wall': { name: 'Great Wall', at: [116.57, 40.43], country: 'CN', tier: 1 },
  'site:pearl-harbor': { name: 'Pearl Harbor', at: [-157.95, 21.35], country: 'US' },
} as const satisfies Record<string, { name: string; at: LonLat; country: string; tier?: 1 }>;

/**
 * Era names: a place shows `name` while the map's year is before `until` (rows in year order),
 * then its modern name. Ancient views without a year use ANCIENT_DEFAULT_YEAR.
 */
export const ERA_NAMES: Record<string, readonly { until: number; name: string }[]> = {
  'city:london-gb': [{ until: 500, name: 'Londinium' }],
  'city:paris-fr': [{ until: 360, name: 'Lutetia' }],
  'city:milan-it': [{ until: 500, name: 'Mediolanum' }],
  'city:marseille-fr': [{ until: 500, name: 'Massilia' }],
  'site:cadiz': [{ until: 711, name: 'Gades' }],
  'site:trier': [{ until: 500, name: 'Treveri' }],
  'city:tarragona-es': [{ until: 714, name: 'Tarraco' }],
  'city:antakya-tr': [{ until: 1939, name: 'Antioch' }],
  'site:izmit': [{ until: 1337, name: 'Nicomedia' }],
  'city:istanbul-tr': [
    { until: 330, name: 'Byzantium' },
    { until: 1930, name: 'Constantinople' },
  ],
  'city:york-gb': [{ until: 500, name: 'Eboracum' }],
  'city:cologne-de': [{ until: 500, name: 'Colonia' }],
  'city:vienna-at': [{ until: 500, name: 'Vindobona' }],
  'city:lyon-fr': [{ until: 500, name: 'Lugdunum' }],
  'city:beijing-cn': [
    { until: 1403, name: 'Dadu' },
  ],
  'city:st-petersburg-ru': [
    { until: 1914, name: 'St Petersburg' },
    { until: 1924, name: 'Petrograd' },
    { until: 1991, name: 'Leningrad' },
  ],
  'city:volgograd-ru': [
    { until: 1925, name: 'Tsaritsyn' },
    { until: 1961, name: 'Stalingrad' },
  ],
  'city:new-york-us': [{ until: 1664, name: 'New Amsterdam' }],
  'city:mumbai-in': [{ until: 1995, name: 'Bombay' }],
  'city:chennai-in': [{ until: 1996, name: 'Madras' }],
  'city:kolkata-in': [{ until: 2001, name: 'Calcutta' }],
  'city:ho-chi-minh-city-vn': [{ until: 1976, name: 'Saigon' }],
  'city:tokyo-jp': [{ until: 1868, name: 'Edo' }],
  'city:jakarta-id': [{ until: 1942, name: 'Batavia' }],
  'city:oslo-no': [{ until: 1925, name: 'Christiania' }],
  'city:gdansk-pl': [{ until: 1945, name: 'Danzig' }],
  'city:kaliningrad-ru': [{ until: 1946, name: 'Königsberg' }],
  'city:harare-zw': [{ until: 1982, name: 'Salisbury' }],
};

/**
 * Names models use that the catalog spells differently (normalised on load). Era names and site
 * names are aliases already.
 */
export const ALIASES: Record<string, readonly string[]> = {
  'country:US': ['USA', 'US', 'United States', 'America', 'the United States', 'the US'],
  'country:GB': ['UK', 'United Kingdom', 'Britain', 'Great Britain', 'England'],
  'country:TR': ['Turkey', 'Türkiye', 'Turkiye'],
  'country:MM': ['Burma', 'Myanmar'],
  'country:SZ': ['Swaziland', 'Eswatini'],
  'country:CZ': ['Czechia', 'Czech Republic'],
  'country:NL': ['Holland', 'the Netherlands'],
  'country:CI': ['Ivory Coast', "Cote d'Ivoire"],
  'country:CD': ['DR Congo', 'DRC', 'Congo-Kinshasa', 'Democratic Republic of the Congo'],
  'country:CG': ['Republic of the Congo', 'Congo-Brazzaville'],
  'country:KR': ['South Korea', 'Korea'],
  'country:KP': ['North Korea'],
  'country:RU': ['Russia', 'Russian Federation'],
  'country:CN': ['China', "People's Republic of China", 'PRC'],
  'country:TW': ['Taiwan'],
  'country:IR': ['Iran', 'Persia'],
  'country:VN': ['Vietnam', 'Viet Nam'],
  'country:LA': ['Laos'],
  'country:MK': ['North Macedonia', 'Macedonia'],
  'country:CV': ['Cape Verde', 'Cabo Verde'],
  'country:TL': ['East Timor', 'Timor-Leste'],
  'country:VA': ['Vatican', 'Vatican City', 'the Vatican'],
  'country:AE': ['UAE', 'Emirates'],
  'city:new-york-us': ['New York City', 'NYC'],
  'city:washington-d-c-us': ['Washington DC', 'Washington, D.C.', 'DC'],
  'city:ho-chi-minh-city-vn': ['Saigon'],
  'city:beijing-cn': ['Peking'],
  'city:kiev-ua': ['Kyiv', 'Kiev'],
  'site:strait-of-hormuz': ['Hormuz'],
  'site:great-wall': ['Great Wall of China'],
};

/** On-screen names where the catalog's is too long or not the common English one. */
export const DISPLAY_NAMES: Record<string, string> = {
  'country:US': 'United States',
  'country:CD': 'DR Congo',
  'country:CG': 'Congo',
  'country:CF': 'Central African Rep.',
  'country:BA': 'Bosnia and Herzegovina',
  'country:GB': 'United Kingdom',
  'country:KR': 'South Korea',
  'country:KP': 'North Korea',
  'country:TZ': 'Tanzania',
  'country:RS': 'Serbia',
  'country:BS': 'Bahamas',
  'country:CZ': 'Czechia',
  'country:MK': 'North Macedonia',
  'country:TL': 'East Timor',
  'country:SZ': 'Eswatini',
  'country:AE': 'United Arab Emirates',
  'country:VA': 'Vatican City',
};

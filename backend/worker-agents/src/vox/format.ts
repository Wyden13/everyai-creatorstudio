/**
 * Number and year formatting for on-screen figures, and the words a narrator says for them. Pure;
 * shared by the schema validator, the screenplay prompt, the widgets and tests. A count-up always
 * formats with the TARGET's magnitude and unit, so a counter can never read "0.0M km²": it reads
 * "0 million km²" → "5 million km²".
 */
import { numberWords, tokenize } from './speech';

/** What a unit measures. Comparisons (`compare_same_dimension`) and their bars only pair one dimension. */
export type Dimension = 'money' | 'count' | 'length' | 'area' | 'mass' | 'speed' | 'duration' | 'temperature' | 'energy' | 'power' | 'data' | 'density' | 'volume' | 'share' | 'ratio' | 'year';
type Scale = 'million' | 'billion' | 'trillion';

export interface UnitSpec {
  dim: Dimension;
  /**
   * Factor to the dimension's base unit, used ONLY to size comparison bars (a spoken unit is never
   * rewritten: the narration says "square miles", the screen shows square miles). null: the unit
   * compares only with itself (currencies: no exchange rates are shipped).
   */
  toBase: number | null;
  /** Glyphs before the digits ("$"). */
  prefix: string;
  /** Glyphs after the digits. No leading space: they stick to the digits ("%", "°C"); a leading space: they sit on the small unit line (" km²"). */
  suffix: string;
  /** Words said after the number, [singular, plural] ("" for none). */
  spoken: readonly [string, string];
  /** Words said before the number ("one in" four). */
  lead?: string;
  /** Magnitude words this unit may use on screen and in speech ("2.5 trillion dollars"); below them, full digits. */
  scales: readonly Scale[];
  /** Counts up (else swaps in whole: Vox years never roll). */
  count: boolean;
  /** Zero and negative values allowed (temperatures). */
  signed: boolean;
  /** Fixed fraction digits where a convention exists (percent: 0). */
  decimals?: number;
}

const BIG = ['million', 'billion', 'trillion'] as const;
const YEAR_S = 31_557_600;
const row = (dim: Dimension, toBase: number | null, suffix: string, spoken: readonly [string, string], scales: readonly Scale[] = BIG, extra: Partial<UnitSpec> = {}): UnitSpec => ({
  dim, toBase, prefix: '', suffix, spoken, scales, count: true, signed: false, ...extra,
});
const money = (prefix: string, suffix: string, spoken: readonly [string, string]) => row('money', null, suffix, spoken, BIG, { prefix });

/**
 * Every unit a number shot may use, as data: add a unit as a row (the schema enum, the prompt
 * catalog, the narration symbol lint and the formatter all read this table). Glyph coverage of
 * every prefix/suffix is checked against Libre Franklin (€ £ ¥ ₹ ° ² − are all in it).
 */
export const UNITS = {
  usd: money('$', '', ['dollar', 'dollars']),
  eur: money('€', '', ['euro', 'euros']),
  gbp: money('£', '', ['pound', 'pounds']),
  jpy: money('¥', '', ['yen', 'yen']),
  // ¥ is the yen's on screen; the yuan is spelled so the two never read alike.
  cny: money('', ' yuan', ['yuan', 'yuan']),
  inr: money('₹', '', ['rupee', 'rupees']),
  m: row('length', 1, ' m', ['meter', 'meters'], []),
  km: row('length', 1e3, ' km', ['kilometer', 'kilometers']),
  mi: row('length', 1609.344, ' miles', ['mile', 'miles']),
  km2: row('area', 1e6, ' km²', ['square kilometer', 'square kilometers']),
  mi2: row('area', 2_589_988.110336, ' sq mi', ['square mile', 'square miles']),
  hectares: row('area', 1e4, ' hectares', ['hectare', 'hectares']),
  kg: row('mass', 1, ' kg', ['kilogram', 'kilograms']),
  tonnes: row('mass', 1e3, ' tonnes', ['tonne', 'tonnes']),
  lb: row('mass', 0.45359237, ' lb', ['pound', 'pounds']),
  kmh: row('speed', 1 / 3.6, ' km/h', ['kilometer per hour', 'kilometers per hour'], []),
  mph: row('speed', 0.44704, ' mph', ['mile per hour', 'miles per hour'], []),
  seconds: row('duration', 1, ' seconds', ['second', 'seconds']),
  minutes: row('duration', 60, ' minutes', ['minute', 'minutes']),
  hours: row('duration', 3600, ' hours', ['hour', 'hours']),
  days: row('duration', 86_400, ' days', ['day', 'days']),
  weeks: row('duration', 604_800, ' weeks', ['week', 'weeks']),
  months: row('duration', YEAR_S / 12, ' months', ['month', 'months']),
  years: row('duration', YEAR_S, ' years', ['year', 'years']),
  decades: row('duration', YEAR_S * 10, ' decades', ['decade', 'decades']),
  centuries: row('duration', YEAR_S * 100, ' centuries', ['century', 'centuries']),
  // Signed, so never drawn as bars; toBase is the size of one degree.
  celsius: row('temperature', 1, '°C', ['degree Celsius', 'degrees Celsius'], [], { signed: true }),
  fahrenheit: row('temperature', 5 / 9, '°F', ['degree Fahrenheit', 'degrees Fahrenheit'], [], { signed: true }),
  kwh: row('energy', 3.6e6, ' kWh', ['kilowatt-hour', 'kilowatt-hours']),
  twh: row('energy', 3.6e15, ' TWh', ['terawatt-hour', 'terawatt-hours'], []),
  w: row('power', 1, ' W', ['watt', 'watts'], []),
  mw: row('power', 1e6, ' MW', ['megawatt', 'megawatts'], []),
  gw: row('power', 1e9, ' GW', ['gigawatt', 'gigawatts'], []),
  // Decimal SI (a gigabyte is 10^9 bytes), never GiB; the ladder replaces magnitude words.
  mb: row('data', 1e6, ' MB', ['megabyte', 'megabytes'], []),
  gb: row('data', 1e9, ' GB', ['gigabyte', 'gigabytes'], []),
  tb: row('data', 1e12, ' TB', ['terabyte', 'terabytes'], []),
  pb: row('data', 1e15, ' PB', ['petabyte', 'petabytes'], []),
  per_km2: row('density', 1, ' people/km²', ['person per square kilometer', 'people per square kilometer'], []),
  liters: row('volume', 1, ' liters', ['liter', 'liters']),
  barrels: row('volume', 158.987294928, ' barrels', ['barrel', 'barrels']),
  percent: row('share', 1, '%', ['percent', 'percent'], [], { decimals: 0 }),
  one_in: row('ratio', 1, '', ['', ''], [], { prefix: '1 in ', lead: 'one in', count: false }),
  people: row('count', 1, ' people', ['person', 'people']),
  soldiers: row('count', 1, ' soldiers', ['soldier', 'soldiers']),
  count: row('count', 1, '', ['', '']),
  year: row('year', null, '', ['', ''], [], { count: false }),
} as const satisfies Record<string, UnitSpec>;
export type NumberUnit = keyof typeof UNITS;
export const NUMBER_UNITS = Object.keys(UNITS) as [NumberUnit, ...NumberUnit[]];

/**
 * What narration must never contain because TTS misreads it and alignment tokenises it oddly:
 * every symbol and every abbreviation the unit table writes on screen (single letters such as
 * "m" are left out: they are ordinary words too). Derived, so a new unit row extends the lint.
 */
const written = Object.values(UNITS as Record<string, UnitSpec>);
export const WRITTEN_ONLY = {
  symbols: [...new Set(written.flatMap((u) => [...`${u.prefix}${u.suffix}`].filter((c) => /[^\p{L}\p{N}\s]/u.test(c))))],
  abbreviations: [...new Set(written.flatMap((u) => tokenize(u.suffix).filter((t) => t.length > 1 && !tokenize(u.spoken.join(' ')).includes(t))))],
};

const MAGNITUDES = [
  { min: 1e12, div: 1e12, word: 'trillion' },
  { min: 1e9, div: 1e9, word: 'billion' },
  { min: 1e6, div: 1e6, word: 'million' },
  { min: 0, div: 1, word: '' },
] as const;

/** The magnitude a figure of this unit is shown and said with: the largest the unit allows that `target` reaches. */
const magnitude = (spec: UnitSpec, target: number) => MAGNITUDES.find((m) => Math.abs(target) >= m.min && (m.word === '' || spec.scales.includes(m.word)))!;

export function formatYear(year: number): string {
  if (!Number.isInteger(year) || year === 0) throw new Error(`invalid year ${year} (there is no year 0)`);
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}

function decimalsFor(scaled: number): number {
  return Number.isInteger(scaled) || Math.abs(scaled) >= 100 ? 0 : 1;
}

export interface FigureParts {
  /** The big glyphs: sign, digits and attached signs ("51%", "$1.2", "−40°C", "1 in 4"). */
  main: string;
  /** The small line under it: magnitude + unit words + base year ("million people", "in 2024 dollars"), may be empty. */
  unit: string;
}

/**
 * Splits a figure into big + small parts, using the magnitude and precision chosen by `target`.
 * `inYear`: the figure is money in that year's prices (inflation-adjusted), said on the unit line.
 */
export function figureParts(value: number, unit: NumberUnit, target: number = value, inYear?: number): FigureParts {
  if (unit === 'year') return { main: formatYear(target), unit: '' };
  const spec: UnitSpec = UNITS[unit];
  const mag = magnitude(spec, target);
  const decimals = spec.decimals ?? decimalsFor(target / mag.div);
  const num = (Math.abs(value) / mag.div).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const attached = spec.suffix.startsWith(' ') ? '' : spec.suffix;
  // A suffix that is the spoken word itself agrees in number ("1 hectare", "2 hectares").
  const word = spec.suffix.trim() === spec.spoken[1] && Math.abs(target) === 1 && !mag.word ? spec.spoken[0] : spec.suffix.trim();
  const line = [mag.word, attached ? '' : word, inYear === undefined ? '' : `in ${inYear} ${spec.spoken[1]}`];
  return { main: `${value < 0 ? '−' : ''}${spec.prefix}${num}${attached}`, unit: line.filter(Boolean).join(' ') };
}

/** One-line form of a figure ("5 million km²"), for captions and prompts. */
export function formatFigure(value: number, unit: NumberUnit, target: number = value): string {
  const p = figureParts(value, unit, target);
  return p.unit ? `${p.main} ${p.unit}` : p.main;
}

/** What the narrator says for a figure, at the magnitude and precision the screen shows ("two point five trillion dollars"). */
export function spokenFigure(value: number, unit: NumberUnit): string {
  const spec: UnitSpec = UNITS[unit];
  const mag = magnitude(spec, value);
  const scaled = value / mag.div;
  const word = spec.spoken[Math.abs(value) === 1 ? 0 : 1];
  return [spec.lead, numberWords(scaled, spec.decimals ?? decimalsFor(scaled)), mag.word, word].filter(Boolean).join(' ');
}

/** Whether a figure of this unit animates by counting (else it swaps in whole). */
export function unitCounts(unit: NumberUnit): boolean {
  return UNITS[unit].count;
}

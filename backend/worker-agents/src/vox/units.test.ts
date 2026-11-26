import { describe, expect, test } from 'bun:test';
import ICON_PATHS from '../../assets/icons/icons.json';
import { checkBeatSheet } from './beat-sheet';
import { clone, SHOT_TOURS, toShort, voice } from './fixtures';
import { UNITS, WRITTEN_ONLY, figureParts, formatFigure, spokenFigure, type NumberUnit } from './format';
import { ICONS, ICON_FAMILIES, type IconPath } from './icon-manifest';
import { INFLATION, inflate, inflationProblem, shownValue } from './inflation';
import { VOX_SCREENPLAY_BIBLE } from './screenplay';
import { numberWords, speechUnits } from './speech';
import { compileTimeline } from './timing';

/**
 * One row per unit: a value, its on-screen form, and what the narrator says. Each row is checked
 * three ways: the formatter, the spoken form, and that the spoken form reads back (alignment) as
 * the same value the screen shows.
 */
const UNIT_ROWS: [NumberUnit, number, string, string][] = [
  ['usd', 2e12, '$2 trillion', 'two trillion dollars'],
  ['eur', 3_400_000, '€3.4 million', 'three point four million euros'],
  ['gbp', 850, '£850', 'eight hundred fifty pounds'],
  ['jpy', 1.2e9, '¥1.2 billion', 'one point two billion yen'],
  ['cny', 18e12, '18 trillion yuan', 'eighteen trillion yuan'],
  ['inr', 5e6, '₹5 million', 'five million rupees'],
  ['m', 8849, '8,849 m', 'eight thousand eight hundred forty-nine meters'],
  ['km', 384_400, '384,400 km', 'three hundred eighty-four thousand four hundred kilometers'],
  ['mi', 93e6, '93 million miles', 'ninety-three million miles'],
  ['km2', 5e6, '5 million km²', 'five million square kilometers'],
  ['mi2', 3_800_000, '3.8 million sq mi', 'three point eight million square miles'],
  ['hectares', 1, '1 hectare', 'one hectare'],
  ['kg', 70, '70 kg', 'seventy kilograms'],
  ['tonnes', 37e9, '37 billion tonnes', 'thirty-seven billion tonnes'],
  ['lb', 2.5, '2.5 lb', 'two point five pounds'],
  ['kmh', 300, '300 km/h', 'three hundred kilometers per hour'],
  ['mph', 60, '60 mph', 'sixty miles per hour'],
  ['seconds', 9.58, '9.6 seconds', 'nine point six seconds'],
  ['minutes', 45, '45 minutes', 'forty-five minutes'],
  ['hours', 24, '24 hours', 'twenty-four hours'],
  ['days', 1, '1 day', 'one day'],
  ['weeks', 6, '6 weeks', 'six weeks'],
  ['months', 18, '18 months', 'eighteen months'],
  ['years', 13.8e9, '13.8 billion years', 'thirteen point eight billion years'],
  ['decades', 3, '3 decades', 'three decades'],
  ['centuries', 12, '12 centuries', 'twelve centuries'],
  ['celsius', -40, '−40°C', 'minus forty degrees Celsius'],
  ['celsius', 0, '0°C', 'zero degrees Celsius'],
  ['fahrenheit', 98.6, '98.6°F', 'ninety-eight point six degrees Fahrenheit'],
  ['kwh', 10_500, '10,500 kWh', 'ten thousand five hundred kilowatt-hours'],
  ['twh', 29_000, '29,000 TWh', 'twenty-nine thousand terawatt-hours'],
  ['w', 60, '60 W', 'sixty watts'],
  ['mw', 1200, '1,200 MW', 'one thousand two hundred megawatts'],
  ['gw', 22.5, '22.5 GW', 'twenty-two point five gigawatts'],
  ['mb', 700, '700 MB', 'seven hundred megabytes'],
  ['gb', 128, '128 GB', 'one hundred twenty-eight gigabytes'],
  ['tb', 2, '2 TB', 'two terabytes'],
  ['pb', 1.5, '1.5 PB', 'one point five petabytes'],
  ['per_km2', 8000, '8,000 people/km²', 'eight thousand people per square kilometer'],
  ['liters', 2e9, '2 billion liters', 'two billion liters'],
  ['barrels', 100e6, '100 million barrels', 'one hundred million barrels'],
  ['percent', 50.6, '51%', 'fifty-one percent'],
  ['one_in', 4, '1 in 4', 'one in four'],
  ['people', 2_500_000, '2.5 million people', 'two point five million people'],
  ['soldiers', 50_000, '50,000 soldiers', 'fifty thousand soldiers'],
  ['count', 300, '300', 'three hundred'],
  ['year', 1453, '1453 CE', 'one thousand four hundred fifty-three'],
];

describe('units', () => {
  test('every unit has a row', () => expect(new Set(UNIT_ROWS.map(([u]) => u))).toEqual(new Set(Object.keys(UNITS) as NumberUnit[])));
  for (const [unit, value, screen, spoken] of UNIT_ROWS) {
    test(`${unit} ${value}: on screen "${screen}"`, () => expect(formatFigure(value, unit)).toBe(screen));
    test(`${unit} ${value}: spoken "${spoken}"`, () => expect(spokenFigure(value, unit)).toBe(spoken));
    test(`${unit} ${value}: "${spoken}" aligns as the number on screen`, () => {
      const said = speechUnits(spoken.split(' ')).flatMap((u) => (u.value === undefined ? [] : [u.value]));
      expect(said.some((v) => figureParts(v, unit, value).main === figureParts(value, unit).main)).toBe(true);
    });
  }
  test('an inflation figure names its base year on the unit line', () => expect(figureParts(38_000, 'usd', 38_000, 2024)).toEqual({ main: '$38,000', unit: 'in 2024 dollars' }));
  test('a count-up toward a negative target keeps its sign and unit', () => expect(figureParts(-20, 'celsius', -40).main).toBe('−20°C'));
  test('the narration lint bans every written-only symbol and abbreviation the table writes', () => {
    expect(WRITTEN_ONLY.symbols.sort()).toEqual(['$', '%', '/', '£', '¥', '°', '₹', '€'].sort());
    expect(WRITTEN_ONLY.abbreviations).toEqual(expect.arrayContaining(['km', 'mph', 'kg', 'kwh', 'gb']));
    expect(WRITTEN_ONLY.abbreviations).not.toContain('people');
  });
});

describe('numberWords ↔ speechUnits', () => {
  const rows: [number, number, string][] = [
    [0, 0, 'zero'],
    [7, 0, 'seven'],
    [42, 0, 'forty-two'],
    [100, 0, 'one hundred'],
    [1453, 0, 'one thousand four hundred fifty-three'],
    [2_000_000_000_000, 0, 'two trillion'],
    [1_000_200, 0, 'one million two hundred'],
    [2.5, 1, 'two point five'],
    [3.05, 2, 'three point zero five'],
    [-40, 0, 'minus forty'],
  ];
  for (const [n, decimals, words] of rows) {
    test(`${n} → "${words}" → ${n}`, () => {
      expect(numberWords(n, decimals)).toBe(words);
      expect(speechUnits(words.split(' '))).toEqual([{ key: `#${n}`, from: 0, to: words.split(/[ -]/).length, value: n }]);
    });
  }
  test('1.15 million reads back exactly (decimal, not float, scaling)', () => expect(speechUnits('one point one five million'.split(' '))[0]!.value).toBe(1_150_000));
});

describe('inflation', () => {
  /**
   * Known values, computed from each source's published annual index (copied from the source, not
   * from the baked table): BLS CPI-U 2023 = 304.702, 2024 = 313.689, 1913 = 9.883 (mean of its 12
   * months); Minneapolis Fed 1800 = 51, 1913 = 9.9 on 1967=100 is spliced, so its ratio 2024/1800
   * (942.7 / 51) holds; ONS CDKO 1900 = 9.2, 2024 = 1525.5, 1974 = 108.5.
   */
  const rows: [string, NumberUnit, number, number, number, number][] = [
    ['USD one year', 'usd', 100, 2023, 2024, (100 * 313.689) / 304.702],
    ['USD since the BLS series began', 'usd', 1, 1913, 2024, 313.689 / 9.883],
    ['USD before 1913 (Minneapolis Fed history)', 'usd', 1, 1800, 2024, 942.7 / 51],
    ['USD backwards in time', 'usd', 313.689, 2024, 1913, 9.883],
    ['GBP since 1900', 'gbp', 1, 1900, 2024, 1525.5 / 9.2],
    ['GBP since 1974', 'gbp', 100, 1974, 2025, (100 * 1588.6) / 108.5],
    ['same year is the same money', 'gbp', 42, 1950, 1950, 42],
  ];
  for (const [name, unit, amount, from, to, want] of rows) {
    test(name, () => expect(inflate(amount, unit, from, to) / want).toBeCloseTo(1, 2));
  }
  const problems: [string, NumberUnit, number, number, string][] = [
    ['a currency without a table', 'eur', 1990, 2020, 'no price table for eur'],
    ['a year before the table', 'usd', 1799, 2024, '1799 is outside'],
    ['a year after the table', 'gbp', 1900, 2026, '2026 is outside'],
  ];
  for (const [name, unit, from, to, want] of problems) {
    test(`refused: ${name}`, () => {
      expect(inflationProblem(unit, from, to)).toContain(want);
      expect(() => inflate(1, unit, from, to)).toThrow(want);
    });
  }
  test('the shown amount is rounded to two significant digits', () => expect(shownValue({ value: 1000, unit: 'usd', inflation: { year: 1900, to: 2024 } })).toBe(38_000));
  test('every table is contiguous and names its source and licence', () => {
    for (const t of Object.values(INFLATION)) {
      expect(t!.index).toHaveLength(t!.last - t!.first + 1);
      expect(t!.index.every((v) => v > 0)).toBe(true);
      for (const src of t!.sources) expect(src.licence.length).toBeGreaterThan(0);
    }
  });
});

describe('icon catalog', () => {
  const paths = ICON_PATHS as Record<string, IconPath>;
  test('150-250 ids, each with extracted path data from its family', () => {
    const ids = Object.keys(ICONS);
    expect(ids.length).toBeGreaterThanOrEqual(150);
    expect(ids.length).toBeLessThanOrEqual(250);
    expect(Object.keys(paths).sort()).toEqual(ids.sort());
    for (const [id, { family }] of Object.entries(ICONS)) {
      // A copy: Bun's toMatchObject writes asymmetric matchers into the object it checks, which would blank the shared icon paths.
      expect({ ...paths[id] }).toMatchObject({ family, viewBox: expect.stringMatching(/^0 0 \d+ \d+$/), d: expect.stringMatching(/^M/) });
      expect(family in ICON_FAMILIES).toBe(true);
    }
  });
  test('game-icons (CC BY 3.0) carry their author for credits', () => {
    for (const [id, { family }] of Object.entries(ICONS)) if (family === 'game-icons') expect(paths[id]!.author).toBeTruthy();
  });
  test('the screenplay prompt lists every icon id', () => {
    for (const id of Object.keys(ICONS)) expect(VOX_SCREENPLAY_BIBLE).toContain(id);
  });
  test('a timeline carries only the icons its sheet uses', () => {
    const s = toShort(clone());
    SHOT_TOURS['icon pictogram, negative temperature, inflation']!(s);
    expect(checkBeatSheet(s)).toMatchObject({ ok: true });
    expect(Object.keys(compileTimeline(s, voice(s)).icons)).toEqual(['centurion-helmet']);
    expect(compileTimeline(clone(), voice(clone())).icons).toEqual({});
  });
});

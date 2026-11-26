/**
 * Same-currency inflation adjustment from the baked annual price tables
 * (assets/inflation/cpi.json, built by scripts/inflation-build.ts; sources and licences are in
 * the table). Pure; the validator, the prompt and the number widget share it, so the figure on
 * screen, the figure the narration must say and the figure the model is told are one number.
 * No cross-currency conversion: there is no free, clean historical FX source.
 */
import CPI from '../../assets/inflation/cpi.json';
import type { NumberUnit } from './format';

export interface PriceTable {
  first: number;
  last: number;
  base: string;
  sources: { name: string; url: string; licence: string }[];
  index: number[];
}

/** Currencies with a price table; add one as a row in the build script. */
export const INFLATION: Partial<Record<NumberUnit, PriceTable>> = CPI;

/** Why `amount` of `unit` cannot be moved from year `from` to year `to`, or null when it can. */
export function inflationProblem(unit: NumberUnit, from: number, to: number): string | null {
  const t = INFLATION[unit];
  if (!t) return `no price table for ${unit}; inflation adjusts ${Object.keys(INFLATION).join(', ')} only`;
  const off = [from, to].find((y) => y < t.first || y > t.last);
  return off === undefined ? null : `${unit} prices cover ${t.first}-${t.last}; ${off} is outside`;
}

/** `amount` of `unit` in year `from`'s prices, expressed in year `to`'s prices. Throws outside the table (validate first). */
export function inflate(amount: number, unit: NumberUnit, from: number, to: number): number {
  const problem = inflationProblem(unit, from, to);
  if (problem) throw new Error(problem);
  const t = INFLATION[unit]!;
  return (amount * t.index[to - t.first]!) / t.index[from - t.first]!;
}

/**
 * The amount a money figure shows: adjusted to `inflation.to` prices (rounded to two significant
 * digits: an index ratio is an estimate, and the narration says "about thirty-eight thousand")
 * when it has an `inflation`, else its own value.
 */
export const shownValue = (f: { value: number; unit: NumberUnit; inflation?: { year: number; to: number } }): number =>
  f.inflation ? Number(inflate(f.value, f.unit, f.inflation.year, f.inflation.to).toPrecision(2)) : f.value;

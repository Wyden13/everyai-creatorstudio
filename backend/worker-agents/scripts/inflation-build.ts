/**
 * One-off, deterministic build of the annual price-index tables behind inflation-adjusted money
 * figures (src/vox/inflation.ts). Downloads each source, extracts its annual series, checks the
 * series' sha256 (the pages around the numbers change; the numbers must not), and writes ONE
 * committed table to assets/inflation/cpi.json. Run manually:
 *
 *   bun scripts/inflation-build.ts
 *
 * The LLM never supplies an index or an adjusted figure: code computes it from this table.
 * Licences were checked when the sources were pinned (2026-11-25); they are written into the
 * table next to the numbers so a credit list can be generated from it.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT = join(ROOT, 'assets/inflation/cpi.json');
/** Last complete year of every series (a partial year would skew its annual average). */
const LAST_YEAR = 2025;
/** BLS published no October 2025 CPI (federal shutdown), so 2025 has no annual average from monthly data: USD ends at 2024. */
const USD_LAST_YEAR = 2024;

type Series = Map<number, number>;
interface Source {
  url: string;
  /** sha256 of the extracted series as JSON [[year, value], ...]. */
  sha256: string;
  name: string;
  licence: string;
  extract: (body: string) => Series;
}

const cells = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]!.replace(/<[^>]*>|&nbsp;/g, '').trim());

/** Pinned sources. Add a source as a row; a changed series fails the build loud. */
const SOURCES = {
  // BLS CPI-U, U.S. city average, all items, not seasonally adjusted (1982-84=100), via FRED
  // (BLS blocks scripted downloads). Annual average = mean of the 12 months, as BLS publishes it.
  bls: {
    url: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS&cosd=1913-01-01&coed=${USD_LAST_YEAR}-12-01`,
    sha256: 'b655ee1a8adf065490e83aa52b28972ebaf4b5857e45ce08369096bb1fd18e46',
    name: 'U.S. Bureau of Labor Statistics, CPI-U all items, U.S. city average (CPIAUCNS, via FRED)',
    licence: 'Public domain (U.S. federal government work); citation requested by FRED',
    extract: (csv) => {
      const months = csv.trim().split('\n').slice(1).map((l) => l.split(','));
      const years = Map.groupBy(months, ([date]) => Number(date!.slice(0, 4)));
      return new Map([...years].map(([y, ms]) => {
        if (ms.length !== 12 || ms.some(([, v]) => !/^\d+(\.\d+)?$/.test(v!.trim()))) throw new Error(`BLS ${y}: not 12 published months`);
        return [y, Math.round((ms.reduce((s, [, v]) => s + Number(v), 0) / 12) * 1000) / 1000];
      }));
    },
  },
  // Minneapolis Fed "Consumer Price Index, 1800-" (1967=100): BLS Handbook of Labor Statistics
  // historical series before 1913 (Vermont farmers 1800-51, Hoover 1851-90, Rees 1890-1912).
  // Only 1800-1913 is used (1913 to splice onto BLS). The site's disclaimer reads "may be used
  // for research and informational purposes"; the series themselves were compiled by the BLS.
  mpls: {
    url: 'https://www.minneapolisfed.org/about-us/monetary-policy/inflation-calculator/consumer-price-index-1800-',
    sha256: '7ea77dc4a92630d6210a0a0a9b8f9b3f3871f48c43009bfd49bddde23897e60a',
    name: 'Federal Reserve Bank of Minneapolis, Consumer Price Index 1800- (BLS historical series before 1913)',
    licence: 'Series compiled by the U.S. BLS (public domain); Minneapolis Fed site terms: research and informational use',
    extract: (html) => {
      const table = html.slice(html.indexOf('name="CPI Beginning 1800"'), html.indexOf('</table>', html.indexOf('name="CPI Beginning 1800"')));
      const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]!)).filter((c) => /^\d{4}$/.test(c[0] ?? ''));
      return new Map(rows.map(([y, v]) => [Number(y), Number(v)] as const).filter(([y]) => y <= 1913));
    },
  },
  // ONS CDKO: long-run price index 1800-, Jan 1974=100 (RPI from 1947, spliced composite before).
  ons: {
    url: 'https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/cdko/mm23',
    sha256: '89b0af998425ff00b44d38c9a12e28ddedce12f63b7bd546709828c4a9b8488d',
    name: 'Office for National Statistics, CDKO long-run price index 1800- (Jan 1974=100)',
    licence: 'Open Government Licence v3.0 (attribution: "Source: Office for National Statistics licensed under the Open Government Licence v3.0")',
    extract: (csv) =>
      new Map(
        csv
          .split('\n')
          .map((l) => l.match(/^"(\d{4})","([\d.]+)"/))
          .filter((m): m is RegExpMatchArray => !!m)
          .map((m) => [Number(m[1]), Number(m[2])] as const)
          .filter(([y]) => y <= LAST_YEAR),
      ),
  },
} as const satisfies Record<string, Source>;

async function fetchSeries(id: string, src: Source): Promise<Series> {
  // curl over HTTP/1.1: FRED resets HTTP/2 streams from scripted clients.
  const proc = Bun.spawn(['curl', '-sSfL', '--http1.1', '-m', '120', src.url], { stdout: 'pipe', stderr: 'pipe' });
  const body = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`download failed: ${src.url}\n${await new Response(proc.stderr).text()}`);
  const series = src.extract(body);
  const got = createHash('sha256').update(JSON.stringify([...series])).digest('hex');
  if (got !== src.sha256) throw new Error(`sha256 mismatch for ${id} series: ${got} (review the change, then pin it)`);
  return series;
}

const [bls, mpls, ons] = await Promise.all(Object.entries(SOURCES).map(([id, src]) => fetchSeries(id, src)));
/** Pre-1913 Minneapolis values rescaled so 1913 meets the BLS index (1982-84=100). */
const splice = bls!.get(1913)! / mpls!.get(1913)!;
const usd = new Map([...[...mpls!].filter(([y]) => y < 1913).map(([y, v]) => [y, Number((v * splice).toPrecision(4))] as const), ...bls!]);

const table = (series: Series, base: string, sources: Source[]) => {
  const years = [...series.keys()].sort((a, b) => a - b);
  years.forEach((y, i) => {
    if (i > 0 && y !== years[i - 1]! + 1) throw new Error(`gap in series before ${y}`);
  });
  return { first: years[0]!, last: years.at(-1)!, base, sources: sources.map(({ name, url, licence }) => ({ name, url, licence })), index: years.map((y) => series.get(y)!) };
};

mkdirSync(join(ROOT, 'assets/inflation'), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({
    usd: table(usd, '1982-84=100', [SOURCES.bls, SOURCES.mpls]),
    gbp: table(ons!, 'Jan 1974=100', [SOURCES.ons]),
  })}\n`,
);
console.log(`wrote ${OUT}`);

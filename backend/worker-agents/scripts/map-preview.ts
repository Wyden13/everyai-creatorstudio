/**
 * Map preview + Chromium benchmark (dev tool, no network, no keys):
 *
 *   bun scripts/map-preview.ts [outDir]     default ~/Downloads/map-preview/
 *
 * Compiles every map shot tour (fixtures.ts SHOT_TOURS) in both formats, renders each map beat
 * in the real headless-Chromium sandbox, writes its resting frame as a PNG, and times
 * renderFrame + screenshot over a run of consecutive frames (the cost a full render pays per
 * frame). A headline beat of the same sheet is timed as the baseline.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBeatSheet, type BeatSheet } from '../src/vox/beat-sheet';
import { SHOT_TOURS, clone, toShort, voice } from '../src/vox/fixtures';
import { withVoxScene } from '../src/vox/render';
import { compileTimeline } from '../src/vox/timing';

const OUT = Bun.argv[2] ?? join(Bun.env.HOME ?? '.', 'Downloads', 'map-preview');
/** Consecutive frames timed per beat. */
const BENCH_FRAMES = 30;
const FORMATS: [string, () => BeatSheet][] = [
  ['16x9', clone],
  ['9x16', () => toShort(clone())],
];
const MAP_TOURS = Object.keys(SHOT_TOURS).filter((t) => /map|world|region|snapshot/.test(t));

mkdirSync(OUT, { recursive: true });
const rows: string[] = [];
for (const tour of MAP_TOURS) {
  for (const [aspect, make] of FORMATS) {
    const raw = make();
    SHOT_TOURS[tour]!(raw);
    const checked = checkBeatSheet(raw);
    if (!checked.ok) throw new Error(`${tour}: ${checked.violations.map((v) => v.message).join('; ')}`);
    const tl = compileTimeline(checked.sheet, voice(checked.sheet));
    const props = JSON.stringify(tl).length;
    const r = await withVoxScene(tl, async (s) => {
      const timed = async (from: number) => {
        const ms: number[] = [];
        for (let f = from; f < from + BENCH_FRAMES; f++) {
          const t0 = performance.now();
          await s.renderFrame(f);
          await s.screenshot('png');
          ms.push(performance.now() - t0);
        }
        return ms.sort((a, b) => a - b);
      };
      const out: string[] = [];
      for (const b of tl.beats.filter((x) => x.shot.kind === 'map' || x.shot.kind === 'headline')) {
        const ms = await timed(b.from + 10);
        const mean = ms.reduce((a, x) => a + x, 0) / ms.length;
        const rest = (tl.beats[tl.beats.indexOf(b) + 1]?.enter?.from ?? b.to) - 3;
        await s.renderFrame(rest);
        if (b.shot.kind === 'map') writeFileSync(join(OUT, `${tour.replace(/[^a-z0-9]+/gi, '-')}-${aspect}-${b.id}.png`), Buffer.from(await s.screenshot('png'), 'base64'));
        out.push(`${tour} | ${aspect} | ${b.id} ${b.shot.kind}${b.map ? ` (${tl.geo!.maps[b.map]!.era})` : ''} | mean ${mean.toFixed(0)} ms, p95 ${ms[Math.floor(ms.length * 0.95)]!.toFixed(0)} ms | props ${(props / 1024).toFixed(0)} KB`);
      }
      return out;
    });
    if (!r.ok) throw new Error(`${tour} ${aspect}: sandbox ${r.stage}: ${r.error}`);
    rows.push(...r.value);
  }
}
console.log(rows.join('\n'));
console.log(`frames in ${OUT}`);

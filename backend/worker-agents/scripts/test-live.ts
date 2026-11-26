/**
 * Runs live harness tests against real APIs (they cost money).
 *   bun run test:live              every stage, in pipeline order
 *   bun run test:live scout        only that stage (reads earlier stages' checkpoints in .runs/<LIVE_RUN>/, see src/harness/live-run.ts)
 * Keys come from the repo root .env (see src/harness/env.ts); LIVE=1 un-skips the tests.
 */
import { resolve } from 'node:path';
import { HARNESSES } from '../src/harness/registry';

/** The provider smoke first, then every harness in pipeline (registry) order: each reads the artifact before it. */
const STAGES = ['providers', ...Object.keys(HARNESSES)];

const asked = process.argv.slice(2);
const unknown = asked.filter((n) => !STAGES.includes(n));
if (unknown.length > 0) {
  console.error(`unknown live test(s): ${unknown.join(', ')}. Available: ${STAGES.join(', ')}`);
  process.exit(2);
}
const picked = STAGES.filter((s) => asked.length === 0 || asked.includes(s));
const proc = Bun.spawn(['bun', 'test', ...picked.map((s) => `./src/harness/${s}.live.test.ts`)], {
  cwd: resolve(import.meta.dir, '..'),
  env: { ...process.env, LIVE: '1' },
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(await proc.exited);

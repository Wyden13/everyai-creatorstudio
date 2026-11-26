/**
 * Emits language-agnostic JSON Schemas into shared/schemas/ from their zod source of truth.
 * Run after changing a contract: bun scripts/emit-schemas.ts (a test fails on drift).
 */
import { writeFileSync } from 'node:fs';
import { SHARED_SCHEMAS } from '../src/vox/schemas';

for (const [path, schema] of Object.entries(SHARED_SCHEMAS)) {
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`wrote ${path}`);
}

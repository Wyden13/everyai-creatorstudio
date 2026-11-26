/** shared/ JSON Schemas generated from the zod contracts (see scripts/emit-schemas.ts). */
import { resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BeatSheetSchema } from './beat-sheet';

const SHARED = resolve(import.meta.dir, '../../../../shared/schemas');

export const SHARED_SCHEMAS: Record<string, object> = {
  [`${SHARED}/vox-beat-sheet.schema.json`]: {
    ...zodToJsonSchema(BeatSheetSchema, { name: 'VoxBeatSheet', target: 'jsonSchema7' }),
    $id: 'https://everyai.creatorstudio/schemas/vox-beat-sheet.schema.json',
    description: 'Vox Screenplay output: one beat = one idea = one shot from the closed Vox shot vocabulary. Editorial rules live in backend/worker-agents/src/vox/beat-sheet.ts.',
  },
};

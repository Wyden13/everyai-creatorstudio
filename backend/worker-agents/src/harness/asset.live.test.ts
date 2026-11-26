import { beforeAll, describe, expect, test } from 'bun:test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ASSETS_DIR, ingestAsset, localAssetStore, type IngestResult } from '../assets/store';
import { AssetGenInputSchema, assetHarness, type AssetRequest } from './asset';
import { hasProviderKey, LIVE, LIVE_TIMEOUT_MS } from './env';
import { liveBudgetUsd, liveMediaPath, liveStage } from './live-run';

/** Where the owner looks at the results. */
const LOOK_DIR = join(Bun.env.HOME ?? '.', 'Downloads', 'asset-spike');

/** One row per built-in provider; a row whose key is not set is skipped (and left out of the run). */
const ROWS: { name: string; providerId: string; request: Omit<AssetRequest, 'refs' | 'tags'>; mime: string }[] = [
  {
    name: 'Nano Banana: a small character expression grid',
    providerId: 'google_gemini',
    request: { id: 'spike_expressions', kind: 'expression_grid', description: 'An original friendly explainer mascot: a small round teal blob with big eyes and stubby arms. 2x2 grid: happy, surprised, thinking, worried.', resolution: '1K', aspect: '1:1' },
    mime: 'image/jpeg',
  },
  {
    name: 'Recraft: a vector icon',
    providerId: 'recraft',
    request: { id: 'spike_icon', kind: 'icon', description: 'A magnifying glass over a small globe.', resolution: '1K' },
    mime: 'image/svg+xml',
  },
];
const present = ROWS.filter((r) => hasProviderKey(r.providerId));

describe.skipIf(!LIVE)('asset (live: Claude prompt + real image providers → Asset Storage tool)', () => {
  const stored = new Map<string, IngestResult>();
  beforeAll(async () => {
    if (present.length === 0) return;
    const input = AssetGenInputSchema.parse({ requests: present.map((r) => r.request), budgetUsd: liveBudgetUsd, outDir: liveMediaPath('assets') });
    const { output } = await liveStage(assetHarness, input);
    const store = localAssetStore(ASSETS_DIR);
    mkdirSync(LOOK_DIR, { recursive: true });
    for (const asset of output.assets) {
      const result = await ingestAsset(store, asset);
      stored.set(asset.requestId, result);
      copyFileSync(asset.path, join(LOOK_DIR, basename(asset.path)));
      console.log(JSON.stringify({ asset: asset.requestId, outcome: result.outcome, id: result.record.id, status: result.record.lifecycle.status, media: result.record.media, source: result.record.source, lookAt: join(LOOK_DIR, basename(asset.path)) }));
    }
  }, LIVE_TIMEOUT_MS);

  for (const row of ROWS) {
    test.skipIf(!hasProviderKey(row.providerId))(row.name, () => {
      const { record } = stored.get(row.request.id)!;
      expect(record.lifecycle).toEqual({ status: 'Ready' });
      expect([record.storage.mime, record.source.provider, record.source.flags]).toEqual([row.mime, row.providerId, ['ai_generated']]);
      expect(record.source.generator!.costUsd).toBeGreaterThan(0);
    });
  }
});

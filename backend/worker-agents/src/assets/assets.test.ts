import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessSession } from '../harness/contract';
import type { z } from 'zod';
import { AssetGenInputSchema, assetHarness, imageMenu, MAX_ASSET_ATTEMPTS } from '../harness/asset';
import { sessionSpendUsd } from '../harness/spend';
import { EDGE_TIMEOUTS, type RetryDeps } from '../retry';
import { scripted } from '../vox/fixtures';
import { IMAGE_ADAPTERS, IMAGE_PROVIDERS, actualImageUsd, callImageGen, estimateImageUsd, imageModel, type ImageGenCall, type ImageGenRequest } from './image-gen';
import {
  ASSET_STATUSES,
  ASSET_TRANSITIONS,
  assetIdFor,
  ingestAsset,
  localAssetStore,
  readReadyAsset,
  sha256Hex,
  transitionAsset,
  updateAssetStatus,
  type AssetDraft,
  type AssetEvent,
  type AssetLifecycle,
  type AssetStatus,
} from './store';

const TMP = Bun.env.TMPDIR ?? '/tmp';
const dirs: string[] = [];
const tmpDir = () => {
  const d = mkdtempSync(join(TMP, 'assets-test-'));
  dirs.push(d);
  return d;
};
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// ── Test bytes: just enough of each format for the media probes ──
const png = (colorType: number, w = 64, h = 32) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b[24] = 8;
  b[25] = colorType;
  return b;
};
const jpeg = (w: number, h: number, extra = '') =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14), Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3]), Buffer.alloc(9), Buffer.from(extra)]);
const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4"/></svg>');

const deps = (log: string[] = []): RetryDeps => ({ sleep: async () => {}, random: () => 0, now: () => 0, log: (l) => void log.push(l), timeouts: EDGE_TIMEOUTS });

type FetchCall = { url: string; init: RequestInit };
const fakeFetch = (...replies: (() => Response)[]) => {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return replies[Math.min(calls.length - 1, replies.length - 1)]!();
  }) as unknown as typeof fetch;
  return calls;
};
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });
const body = (c: FetchCall) => JSON.parse(c.init.body as string);
const header = (c: FetchCall, name: string) => (c.init.headers as Record<string, string>)[name];

describe('provider specs (shared/model-registry.json)', () => {
  test('every image provider has an adapter, and both built-ins are registered', () => {
    expect(IMAGE_PROVIDERS.map((p) => p.id)).toEqual(['google_gemini', 'recraft']);
    for (const p of IMAGE_PROVIDERS) expect(IMAGE_ADAPTERS[p.id]).toBeDefined();
    expect(IMAGE_PROVIDERS.map((p) => p.secretName)).toEqual(['GEMINI_API_KEY', 'RECRAFT_API_KEY']);
  });

  // provider, model, resolution, estimated USD
  const estimates: [string, string, '1K' | '2K' | '4K', number][] = [
    ['google_gemini', 'gemini-nano-banana-2.1', '1K', 0.0336],
    ['google_gemini', 'gemini-nano-banana-2.1', '2K', 0.0504],
    ['google_gemini', 'gemini-nano-banana-2.1', '4K', 0.1134],
    ['google_gemini', 'gemini-3-pro-image', '1K', 0.1344],
    ['recraft', 'recraftv4_1_vector', '1K', 0.08],
    ['recraft', 'recraftv4_1_flash_v2', '1K', 0.007],
  ];
  for (const [provider, model, res, usd] of estimates) {
    test(`estimate ${model} ${res} = $${usd}`, () => expect(estimateImageUsd(imageModel(provider, model).price, res)).toBeCloseTo(usd, 6));
  }

  test('unknown or non-image model lookup fails loud', () => {
    expect(() => imageModel('google_gemini', 'gemini-2.5-flash')).toThrow('no image_gen model');
    expect(() => imageModel('nope', 'x')).toThrow('no image_gen model');
  });

  // name, price of, usage, actual USD (or error)
  const actuals: [string, string, string, Parameters<typeof actualImageUsd>[1], number | string][] = [
    ['nano tokens (a real 1K reply: 13 in, 217 text + 653 thought, 1120 image)', 'google_gemini', 'gemini-nano-banana-2.1', { unit: '1m_tokens', inputTokens: 13, textOutputTokens: 870, imageOutputTokens: 1120 }, 0.040144],
    ['recraft per image', 'recraft', 'recraftv4_1_vector', { unit: 'image', images: 1 }, 0.08],
    ['usage unit differs from the price unit', 'recraft', 'recraftv4_1_vector', { unit: '1m_tokens', inputTokens: 1, textOutputTokens: 0, imageOutputTokens: 0 }, 'billed per 1m_tokens'],
  ];
  for (const [name, provider, model, usage, want] of actuals) {
    test(`actual cost: ${name}`, () => {
      const price = imageModel(provider, model).price;
      if (typeof want === 'string') expect(() => actualImageUsd(price, usage)).toThrow(want);
      else expect(actualImageUsd(price, usage)).toBeCloseTo(want, 5);
    });
  }
});

describe('image menu (request → eligible models)', () => {
  const both = () => true;
  const geminiOnly = (id: string) => id === 'google_gemini';
  // name, configured, kind, output, resolution, refs, choices cheapest first
  const rows: [string, (id: string) => boolean, Parameters<typeof imageMenu>[2], string[]][] = [
    ['raster grid, both configured', both, { kind: 'expression_grid', output: 'raster', resolution: '1K', refs: 0 }, ['recraft/recraftv4_1_flash_v2', 'google_gemini/gemini-nano-banana-2.1', 'google_gemini/gemini-3-pro-image']],
    ['vector icon → Recraft vector only', both, { kind: 'icon', output: 'vector', resolution: '1K', refs: 0 }, ['recraft/recraftv4_1_vector']],
    ['transparent → SVG counts (no png_alpha model yet)', both, { kind: 'prop', output: 'transparent', resolution: '1K', refs: 0 }, ['recraft/recraftv4_1_vector']],
    ['vector without a Recraft key → nothing', geminiOnly, { kind: 'logo', output: 'vector', resolution: '1K', refs: 0 }, []],
    ['4K raster → only models with 4K', both, { kind: 'illustration', output: 'raster', resolution: '4K', refs: 0 }, ['google_gemini/gemini-nano-banana-2.1', 'google_gemini/gemini-3-pro-image']],
    ['2 refs drop models without reference support', both, { kind: 'character_sheet', output: 'raster', resolution: '1K', refs: 2 }, ['google_gemini/gemini-nano-banana-2.1', 'google_gemini/gemini-3-pro-image']],
    ['14 refs is the Gemini maximum', both, { kind: 'character_sheet', output: 'raster', resolution: '1K', refs: 14 }, ['google_gemini/gemini-nano-banana-2.1', 'google_gemini/gemini-3-pro-image']],
    ['15 refs → nothing', both, { kind: 'character_sheet', output: 'raster', resolution: '1K', refs: 15 }, []],
    ['nothing configured → nothing', () => false, { kind: 'icon', output: 'raster', resolution: '1K', refs: 0 }, []],
  ];
  for (const [name, configured, req, choices] of rows) {
    test(name, () => expect(imageMenu(IMAGE_PROVIDERS, configured, req).map((m) => m.choice)).toEqual(choices));
  }

  test('good_for_kind comes from the registry row', () => {
    const menu = imageMenu(IMAGE_PROVIDERS, () => true, { kind: 'expression_grid', output: 'raster', resolution: '1K', refs: 0 });
    expect(Object.fromEntries(menu.map((m) => [m.modelId, m.goodForKind]))).toEqual({ recraftv4_1_flash_v2: false, 'gemini-nano-banana-2.1': true, 'gemini-3-pro-image': false });
  });
});

describe('image adapters (fetch faked at the edge)', () => {
  const nano: ImageGenRequest & { apiKey: string } = { providerId: 'google_gemini', modelId: 'gemini-nano-banana-2.1', apiKey: 'k', prompt: 'a grid', refs: [{ bytes: Buffer.from('ref'), mime: 'image/png' }], aspect: '1:1', resolution: '1K' };
  const final = jpeg(1024, 1024, 'c2pa');
  const interaction = {
    id: 'i1',
    status: 'completed',
    usage: { total_input_tokens: 13, total_output_tokens: 1337, total_thought_tokens: 653, output_tokens_by_modality: [{ modality: 'image', tokens: 1120 }] },
    steps: [
      { type: 'thought', content: [{ type: 'image', mime_type: 'image/jpeg', data: Buffer.from('interim').toString('base64') }] },
      { type: 'model_output', content: [{ type: 'text', text: 'here' }, { type: 'image', mime_type: 'image/jpeg', data: final.toString('base64') }] },
    ],
  };

  test('Nano Banana: Interactions request shape, final model_output image, cost from usage, bytes untouched', async () => {
    const calls = fakeFetch(json(interaction));
    const out = await callImageGen(nano, deps());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect([header(calls[0]!, 'x-goog-api-key'), header(calls[0]!, 'Api-Revision')]).toEqual(['k', '2026-05-20']);
    expect(body(calls[0]!)).toEqual({
      model: 'gemini-nano-banana-2.1',
      input: [{ type: 'text', text: 'a grid' }, { type: 'image', mime_type: 'image/png', data: Buffer.from('ref').toString('base64') }],
      response_format: { type: 'image', aspect_ratio: '1:1', image_size: '1K' },
    });
    expect([Buffer.from(out.bytes).equals(final), out.mime, out.costUsd]).toEqual([true, 'image/jpeg', 0.040144]);
  });

  // name, adapter request, fetch replies, error (or fetch count when it succeeds)
  const rows: [string, ImageGenRequest & { apiKey: string }, (() => Response)[], string | number][] = [
    ['retries a 503, then succeeds', nano, [json({ error: 'busy' }, 503), json(interaction)], 2],
    ['a 401 is fatal at once', nano, [json({ error: 'bad key' }, 401)], 'API error 401'],
    ['no image in the reply fails loud', nano, [json({ status: 'failed', steps: [] })], 'returned no image (interaction status: failed)'],
    ['a non-image model is rejected before any call', { ...nano, modelId: 'gemini-2.5-flash' }, [], 'not eligible'],
    ['too many refs are rejected before any call', { ...nano, providerId: 'recraft', modelId: 'recraftv4_1_vector' }, [], 'at most 0 reference images'],
    ['an unsupported resolution is rejected before any call', { ...nano, resolution: '2K', providerId: 'recraft', modelId: 'recraftv4_1_vector', refs: [] }, [], 'has no 2K output'],
    ['Recraft without an image fails loud', { ...nano, providerId: 'recraft', modelId: 'recraftv4_1_vector', refs: [] }, [json({ data: [] })], 'Recraft returned no image'],
  ];
  for (const [name, req, replies, want] of rows) {
    test(name, async () => {
      const log: string[] = [];
      const calls = fakeFetch(...(replies.length ? replies : [json({})]));
      const run = callImageGen(req, deps(log));
      if (typeof want === 'string') {
        await expect(run).rejects.toThrow(want);
        if (replies.length === 0) expect(calls).toHaveLength(0);
      } else {
        await run;
        expect([calls.length, log.length]).toEqual([want, want - 1]);
      }
    });
  }

  test('Recraft: bearer auth, vector request, SVG sniffed, price per image', async () => {
    const calls = fakeFetch(json({ data: [{ b64_json: SVG.toString('base64') }], credits: 80 }));
    const out = await callImageGen({ providerId: 'recraft', modelId: 'recraftv4_1_vector', apiKey: 'rk', prompt: 'an icon', refs: [], aspect: '1:1', resolution: '1K' }, deps());
    expect(calls[0]!.url).toBe('https://external.api.recraft.ai/v1/images/generations');
    expect(header(calls[0]!, 'authorization')).toBe('Bearer rk');
    expect(body(calls[0]!)).toEqual({ prompt: 'an icon', model: 'recraftv4_1_vector', n: 1, size: '1:1', response_format: 'b64_json' });
    expect([out.mime, out.costUsd, out.providerMeta]).toEqual(['image/svg+xml', 0.08, { credits: 80 }]);
  });

  test('Recraft raster asks for PNG', async () => {
    const calls = fakeFetch(json({ data: [{ b64_json: png(6).toString('base64') }] }));
    const out = await callImageGen({ providerId: 'recraft', modelId: 'recraftv4_1_flash_v2', apiKey: 'rk', prompt: 'an icon', refs: [], aspect: '16:9', resolution: '1K' }, deps());
    expect([body(calls[0]!).image_format, body(calls[0]!).size, out.mime, out.costUsd]).toEqual(['png', '16:9', 'image/png', 0.007]);
  });
});

describe('asset lifecycle (transition table)', () => {
  const events: AssetEvent[] = [{ type: 'process' }, { type: 'ready' }, { type: 'fail', error: 'probe' }, { type: 'archive' }, { type: 'restore' }];
  // Every status × event; '-' = rejected.
  const expected: Record<AssetStatus, Record<AssetEvent['type'], AssetStatus | '-'>> = {
    Uploaded: { process: 'Processing', ready: '-', fail: 'Failed', archive: '-', restore: '-' },
    Processing: { process: '-', ready: 'Ready', fail: 'Failed', archive: '-', restore: '-' },
    Ready: { process: '-', ready: '-', fail: '-', archive: 'Archived', restore: '-' },
    Failed: { process: 'Processing', ready: '-', fail: '-', archive: '-', restore: '-' },
    Archived: { process: '-', ready: '-', fail: '-', archive: '-', restore: 'Ready' },
  };
  const from = (status: AssetStatus): AssetLifecycle => (status === 'Failed' ? { status, error: 'earlier' } : { status });
  for (const status of ASSET_STATUSES) {
    for (const event of events) {
      const want = expected[status][event.type];
      test(`${status} --${event.type}--> ${want === '-' ? 'rejected' : want}`, () => {
        if (want === '-') expect(() => transitionAsset(from(status), event)).toThrow(`cannot ${event.type} while ${status}`);
        else expect(transitionAsset(from(status), event)).toEqual(want === 'Failed' ? { status: want, error: 'probe' } : { status: want });
      });
    }
  }
  test('the table has exactly the expected cells', () => {
    const cells = Object.fromEntries(ASSET_STATUSES.map((s) => [s, Object.fromEntries(Object.entries(expected[s]).filter(([, v]) => v !== '-'))]));
    expect(ASSET_TRANSITIONS).toEqual(cells as typeof ASSET_TRANSITIONS);
  });
});

describe('Asset Storage tool', () => {
  const source = { origin: 'generated' as const, provider: 'google_gemini', retrievedAt: '2026-11-25T00:00:00.000Z', flags: ['ai_generated'], generator: { model: 'gemini-nano-banana-2.1', promptHash: sha256Hex('p'), costUsd: 0.04 }, synthId: true };
  const draftOf = async (dir: string, name: string, bytes: Uint8Array, mime: string, extra: Partial<AssetDraft> = {}): Promise<AssetDraft> => {
    const path = join(dir, name);
    await Bun.write(path, bytes);
    return { kind: 'expression_grid', label: 'Grid', description: 'd', tags: ['mascot'], path, mime, source, ...extra };
  };
  const now = () => new Date('2026-11-25T12:00:00.000Z');

  // name, bytes, mime, final lifecycle, media, c2pa
  const rows: [string, Uint8Array, string, AssetLifecycle, object, boolean][] = [
    ['PNG with alpha', png(6), 'image/png', { status: 'Ready' }, { w: 64, h: 32, hasAlpha: true, vector: false }, false],
    ['PNG without alpha', png(2), 'image/png', { status: 'Ready' }, { w: 64, h: 32, hasAlpha: false, vector: false }, false],
    ['JPEG with embedded C2PA', jpeg(1024, 768, 'c2pa'), 'image/jpeg', { status: 'Ready' }, { w: 1024, h: 768, hasAlpha: false, vector: false }, true],
    ['SVG', SVG, 'image/svg+xml', { status: 'Ready' }, { hasAlpha: true, vector: true }, false],
    ['truncated PNG fails processing', png(6).subarray(0, 14), 'image/png', { status: 'Failed', error: 'PNG has no IHDR chunk' }, {}, false],
    ['a mime with no probe fails processing', png(6), 'image/webp', { status: 'Failed', error: 'no media probe for image/webp; add a MEDIA_PROBES row (src/assets/store.ts)' }, {}, false],
  ];
  for (const [name, bytes, mime, lifecycle, media, c2pa] of rows) {
    test(`ingest: ${name}`, async () => {
      const dir = tmpDir();
      const store = localAssetStore(join(dir, 'store'));
      const { outcome, record } = await ingestAsset(store, await draftOf(dir, 'a', bytes, mime), now);
      const sha = sha256Hex(bytes);
      expect(outcome).toBe('Stored');
      expect(record).toEqual({
        id: assetIdFor(sha),
        kind: 'expression_grid',
        lifecycle,
        storage: { backend: 'local', key: join('blobs', sha.slice(0, 2), sha), sha256: sha, bytes: bytes.byteLength, mime },
        media,
        label: 'Grid',
        description: 'd',
        tags: ['mascot'],
        source: { ...source, c2pa },
        createdAt: '2026-11-25T12:00:00.000Z',
      });
      expect(JSON.parse((await store.readRecord(record.id))!)).toEqual(record);
    });
  }

  test('the same bytes twice: one blob, one record, the first metadata kept', async () => {
    const dir = tmpDir();
    const store = localAssetStore(join(dir, 'store'));
    const first = await ingestAsset(store, await draftOf(dir, 'a', png(6), 'image/png'), now);
    const second = await ingestAsset(store, await draftOf(dir, 'b', png(6), 'image/png', { label: 'Other', kind: 'icon' }), now);
    const other = await ingestAsset(store, await draftOf(dir, 'c', png(6, 65), 'image/png'), now);
    expect([second.outcome, second.record]).toEqual(['Deduplicated', first.record]);
    expect(other.record.id).not.toBe(first.record.id);
    expect(readdirSync(join(dir, 'store', 'records')).sort()).toEqual([`${first.record.id}.json`, `${other.record.id}.json`].sort());
  });

  test('a Failed asset is reprocessed when ingested again with the right mime', async () => {
    const dir = tmpDir();
    const store = localAssetStore(join(dir, 'store'));
    const wrong = await ingestAsset(store, await draftOf(dir, 'a', png(6), 'image/webp'), now);
    const again = await ingestAsset(store, await draftOf(dir, 'a', png(6), 'image/png'), now);
    expect([wrong.record.lifecycle.status, again.outcome, again.record.lifecycle, again.record.storage.mime, again.record.id]).toEqual(['Failed', 'Reprocessed', { status: 'Ready' }, 'image/png', wrong.record.id]);
  });

  test('a separate C2PA manifest is stored as its own blob', async () => {
    const dir = tmpDir();
    const store = localAssetStore(join(dir, 'store'));
    await Bun.write(join(dir, 'm.c2pa'), 'manifest');
    const { record } = await ingestAsset(store, await draftOf(dir, 'a', png(6), 'image/png', { c2paPath: join(dir, 'm.c2pa') }), now);
    expect([record.source.c2pa, record.c2paManifest?.sha256, Buffer.from(await store.getBlob(record.c2paManifest!.key)).toString()]).toEqual([true, sha256Hex('manifest'), 'manifest']);
  });

  test('archive / restore through the table; only Ready assets are readable as references', async () => {
    const dir = tmpDir();
    const store = localAssetStore(join(dir, 'store'));
    const { record } = await ingestAsset(store, await draftOf(dir, 'a', png(6), 'image/png'), now);
    expect(Buffer.from((await readReadyAsset(store, record.id)).bytes).equals(png(6))).toBe(true);
    expect((await updateAssetStatus(store, record.id, { type: 'archive' })).lifecycle).toEqual({ status: 'Archived' });
    await expect(updateAssetStatus(store, record.id, { type: 'archive' })).rejects.toThrow('cannot archive while Archived');
    await expect(readReadyAsset(store, record.id)).rejects.toThrow('is Archived, not Ready');
    expect((await updateAssetStatus(store, record.id, { type: 'restore' })).lifecycle).toEqual({ status: 'Ready' });
    await expect(readReadyAsset(store, 'asset_missing')).rejects.toThrow('no asset asset_missing');
  });

  test('a corrupt record fails loud', async () => {
    const dir = tmpDir();
    const store = localAssetStore(join(dir, 'store'));
    await store.writeRecord('asset_bad', '{"id":1}');
    await expect(readReadyAsset(store, 'asset_bad')).rejects.toThrow('corrupt asset record asset_bad');
  });
});

describe('Asset Generation harness (LLM and image edges faked)', () => {
  const model = { providerId: 'anthropic', modelId: 'claude-opus-5-5', effort: 'low' as const };
  const pick = (choice: string, prompt = 'An original round mascot, four expressions in a 2x2 grid, flat background') => JSON.stringify({ choice, prompt, label: 'Mascot grid', tags: ['mascot', 'grid'] });
  const NANO = 'google_gemini/gemini-nano-banana-2.1';
  const fakeImages = (bytes: Uint8Array = jpeg(1024, 1024), mime = 'image/jpeg', costUsd = 0.04) => {
    const calls: ImageGenRequest[] = [];
    const call: ImageGenCall = async (req) => {
      calls.push(req);
      if (req.prompt.includes('explode')) throw new Error('Gemini image API error 500: boom');
      return { bytes, mime, costUsd, providerMeta: {} };
    };
    return { calls, imageGen: { google_gemini: call } };
  };
  const refBytes = png(6);
  const assetRefs = async (id: string) => {
    if (id !== 'asset_ref') throw new Error(`no asset ${id}`);
    return { bytes: refBytes, mime: 'image/png' };
  };
  const request = (id: string, extra: object = {}) => ({ id, kind: 'expression_grid' as const, description: 'Our mascot Pip: happy, surprised, thinking, worried', ...extra });
  const prompt = (req: { userPrompt: string } | undefined) => JSON.parse(req!.userPrompt);
  /** The harness input with its schema defaults applied (run() takes the parsed type). */
  const input = (raw: z.input<typeof AssetGenInputSchema>) => AssetGenInputSchema.parse(raw);

  test('picks from the menu, generates, writes the file, records provenance and cost; output pipes into storage', async () => {
    const dir = tmpDir();
    const { calls: llmCalls, llm } = scripted(pick(NANO));
    const { calls, imageGen } = fakeImages();
    const r = await assetHarness.run(input({ requests: [request('grid')], outDir: dir }), { llm, model, imageGen, assetRefs });
    expect(r.state).toBe('Done');
    if (r.state !== 'Done') return;
    const sent = prompt(llmCalls[0]);
    expect(llmCalls[0]).toMatchObject({ nodeKind: 'asset_generation', effort: 'low' });
    expect([sent.menu.map((m: { choice: string }) => m.choice), sent.budget, sent.request.output, sent.request.aspect]).toEqual([
      [NANO, 'google_gemini/gemini-3-pro-image'],
      { budget_usd: 5, spent_usd: 0, remaining_usd: 5 },
      'raster',
      '1:1',
    ]);
    expect(calls).toEqual([{ providerId: 'google_gemini', modelId: 'gemini-nano-banana-2.1', prompt: JSON.parse(pick(NANO)).prompt, refs: [], aspect: '1:1', resolution: '1K' }]);
    const [asset] = r.output.assets;
    expect(asset).toMatchObject({
      requestId: 'grid',
      kind: 'expression_grid',
      label: 'Mascot grid',
      tags: ['mascot', 'grid'],
      path: join(dir, 'grid.jpg'),
      mime: 'image/jpeg',
      source: { origin: 'generated', provider: 'google_gemini', flags: ['ai_generated'], synthId: true, generator: { model: 'gemini-nano-banana-2.1', promptHash: sha256Hex(JSON.parse(pick(NANO)).prompt), costUsd: 0.04 } },
    });
    expect(r.session.messages.at(-1)).toEqual({ role: 'image', providerId: 'google_gemini', modelId: 'gemini-nano-banana-2.1', promptChars: JSON.parse(pick(NANO)).prompt.length, refs: 0, costUsd: 0.04 });
    expect(sessionSpendUsd(r.session)).toBe(0.04);
    const stored = await ingestAsset(localAssetStore(join(dir, 'store')), asset!);
    expect([stored.outcome, stored.record.lifecycle.status, stored.record.media, stored.record.source.generator]).toEqual(['Stored', 'Ready', { w: 1024, h: 1024, hasAlpha: false, vector: false }, asset!.source.generator]);
  });

  test('budget is a planning input only: a tiny budget still generates, and the second request sees the first spend', async () => {
    const { calls: llmCalls, llm } = scripted(pick(NANO));
    const { calls, imageGen } = fakeImages();
    const r = await assetHarness.run(input({ requests: [request('a'), request('b')], budgetUsd: 0.01, outDir: tmpDir() }), { llm, model, imageGen, assetRefs });
    expect([r.state, calls.length]).toEqual(['Done', 2]);
    expect(prompt(llmCalls[1]).budget).toEqual({ budget_usd: 0.01, spent_usd: 0.04, remaining_usd: -0.03 });
  });

  test('reference images: asset ids through assetRefs, files read from disk', async () => {
    const dir = tmpDir();
    await Bun.write(join(dir, 'style.png'), refBytes);
    const { llm } = scripted(pick(NANO));
    const { calls, imageGen } = fakeImages();
    const parsed = input({ requests: [request('grid', { refs: [{ assetId: 'asset_ref' }, { path: join(dir, 'style.png') }] })], outDir: dir });
    const r = await assetHarness.run(parsed, { llm, model, imageGen, assetRefs });
    expect(r.state).toBe('Done');
    expect(calls[0]!.refs.map((x) => [Buffer.from(x.bytes).equals(refBytes), x.mime])).toEqual([[true, 'image/png'], [true, 'image/png']]);
    expect(assetHarness.inputFiles!(parsed)).toEqual([join(dir, 'style.png')]);
  });

  // name, request, LLM replies, error, LLM calls, image calls
  const failures: [string, ReturnType<typeof request>, string[], string, number, number][] = [
    ['vector with only Gemini configured fails before the LLM', request('icon', { kind: 'icon' }), [pick(NANO)], 'no configured image provider makes vector', 0, 0],
    ['a choice off the menu, three times', request('g'), [pick('recraft/recraftv4_1_vector')], `no valid model reply after ${MAX_ASSET_ATTEMPTS} attempts`, MAX_ASSET_ATTEMPTS, 0],
    ['not JSON, three times', request('g'), ['sure!'], 'not JSON', MAX_ASSET_ATTEMPTS, 0],
    ['the image call fails', request('g'), [pick(NANO, 'please explode this prompt now ok')], 'request g: Gemini image API error 500', 1, 1],
    ['an unknown reference asset', request('g', { refs: [{ assetId: 'asset_gone' }] }), [pick(NANO)], 'no asset asset_gone', 1, 0],
  ];
  for (const [name, req, replies, error, llmN, imageN] of failures) {
    test(`fails: ${name}`, async () => {
      const { calls: llmCalls, llm } = scripted(...replies);
      const { calls, imageGen } = fakeImages();
      const r = await assetHarness.run(input({ requests: [req], outDir: tmpDir() }), { llm, model, imageGen, assetRefs });
      expect(r.state === 'Failed' && r.error).toContain(error);
      expect([llmCalls.length, calls.length]).toEqual([llmN, imageN]);
    });
  }

  test('an invalid reply is fed back once, then the fix is used', async () => {
    const { calls: llmCalls, llm } = scripted(pick('nope/x'), pick(NANO));
    const r = await assetHarness.run(input({ requests: [request('g')], outDir: tmpDir() }), { llm, model, ...fakeImages(), assetRefs });
    expect(r.state).toBe('Done');
    expect(prompt(llmCalls[1])).toMatchObject({ previous_reply: pick('nope/x'), instruction: 'Fix every problem and reply again.' });
    expect(prompt(llmCalls[1]).problems).toContain('choice');
  });

  test('resume: done requests are kept, the failure is shown, spend carries over', async () => {
    const dir = tmpDir();
    const { llm } = scripted(pick(NANO), pick(NANO, 'please explode this prompt now ok'));
    const first = await assetHarness.run(input({ requests: [request('a'), request('b')], outDir: dir }), { llm, model, ...fakeImages(), assetRefs });
    expect(first.state === 'Failed' && first.session.lastOutput).toMatchObject({ assets: [{ requestId: 'a' }] });
    const retry = scripted(pick(NANO));
    const { calls, imageGen } = fakeImages();
    const resumed = await assetHarness.run(input({ requests: [request('a'), request('b')], outDir: dir }), { llm: retry.llm, model, imageGen, assetRefs }, first.session as HarnessSession);
    expect(resumed.state === 'Done' && resumed.output.assets.map((a) => a.requestId)).toEqual(['a', 'b']);
    expect(calls).toHaveLength(1);
    expect(prompt(retry.calls[0]).previous_failure).toContain('request b');
    expect(prompt(retry.calls[0]).budget.spent_usd).toBe(0.04);
  });

  test('duplicate request ids are rejected at the boundary', async () => {
    const r = await assetHarness.run({ requests: [request('a'), request('a')], outDir: tmpDir() } as never, { ...scripted(pick(NANO)), model, ...fakeImages(), assetRefs });
    expect(r.state === 'Failed' && r.error).toContain('request ids must be unique');
  });
});

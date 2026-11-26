/**
 * Asset Storage tool (no LLM, AGENTS.md §3): stores asset bytes content-addressed by sha256
 * behind `AssetStore`, plus one metadata record per asset with an explicit lifecycle and its
 * `source` provenance as plain data. Nothing here branches on provenance; it is recorded as given
 * (plus whether the bytes carry an embedded C2PA manifest). Original bytes are kept untouched, so
 * any C2PA a provider embedded survives; a separate manifest is stored as its own blob.
 *
 * Stores: `localAssetStore` (a gitignored dir) now. A Drive/S3 store implements the same four
 * byte-level methods over src/storage.ts (`uploadToGoogleDrive`, S3) later.
 */
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

export const ASSET_KINDS = ['character_sheet', 'expression_grid', 'part', 'prop', 'icon', 'logo', 'illustration'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Where an asset came from and under what terms, as reported. Plain data the org/user reads and acts on. */
export const SourceInfoSchema = z.object({
  origin: z.enum(['upload', 'connector', 'generated']),
  /** ProviderSpec id (registry provider id). */
  provider: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourceId: z.string().optional(),
  licenseName: z.string().optional(),
  licenseUrl: z.string().url().optional(),
  holder: z.string().optional(),
  creditLine: z.string().max(300).optional(),
  termsUrl: z.string().url().optional(),
  retrievedAt: z.string().datetime(),
  /** Labels such as 'ai_generated', 'trademark', 'person'. */
  flags: z.array(z.string().max(32)).max(8),
  generator: z.object({ model: z.string(), promptHash: z.string().regex(/^[0-9a-f]{64}$/), costUsd: z.number().nonnegative() }).optional(),
  /** The bytes carry (or came with) a C2PA manifest. */
  c2pa: z.boolean().optional(),
  /** The provider reports a SynthID watermark on its outputs. */
  synthId: z.boolean().optional(),
  parentId: z.string().optional(),
});
export type SourceInfo = z.infer<typeof SourceInfoSchema>;

/** What the Asset Storage tool ingests: a file on disk plus its metadata (the Asset Generation harness output pipes in as-is). */
export const AssetDraftSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  label: z.string().min(1).max(36),
  description: z.string().max(1000),
  tags: z.array(z.string().max(40)).max(12),
  path: z.string().min(1),
  mime: z.string().min(1),
  /** A separate C2PA manifest file returned by the provider. */
  c2paPath: z.string().optional(),
  source: SourceInfoSchema,
});
export type AssetDraft = z.infer<typeof AssetDraftSchema>;

export const ASSET_STATUSES = ['Uploaded', 'Processing', 'Ready', 'Failed', 'Archived'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetEvent = { type: 'process' } | { type: 'ready' } | { type: 'fail'; error: string } | { type: 'archive' } | { type: 'restore' };

/**
 * Every legal lifecycle move: status × event → next status. A cell that is absent is a rejected
 * transition and throws. Add behaviour as a row here, never as a branch in `transitionAsset`.
 * Failed → process is a retry (re-ingesting the same bytes); Archived assets leave menus but keep their bytes.
 */
export const ASSET_TRANSITIONS: { readonly [S in AssetStatus]: Partial<Record<AssetEvent['type'], AssetStatus>> } = {
  Uploaded: { process: 'Processing', fail: 'Failed' },
  Processing: { ready: 'Ready', fail: 'Failed' },
  Ready: { archive: 'Archived' },
  Failed: { process: 'Processing' },
  Archived: { restore: 'Ready' },
};

const LifecycleSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('Uploaded') }),
  z.object({ status: z.literal('Processing') }),
  z.object({ status: z.literal('Ready') }),
  z.object({ status: z.literal('Failed'), error: z.string() }),
  z.object({ status: z.literal('Archived') }),
]);
export type AssetLifecycle = z.infer<typeof LifecycleSchema>;

export function transitionAsset(from: AssetLifecycle, event: AssetEvent): AssetLifecycle {
  const next = ASSET_TRANSITIONS[from.status][event.type];
  if (!next) throw new Error(`asset cannot ${event.type} while ${from.status}`);
  return next === 'Failed' ? { status: next, error: (event as Extract<AssetEvent, { type: 'fail' }>).error } : { status: next };
}

const StorageRefSchema = z.object({ backend: z.enum(['local', 'gdrive', 's3']), key: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().nonnegative(), mime: z.string() });
export type StorageRef = z.infer<typeof StorageRefSchema>;

const MediaSchema = z.object({ w: z.number().int().positive().optional(), h: z.number().int().positive().optional(), hasAlpha: z.boolean().optional(), vector: z.boolean().optional() });
export type MediaInfo = z.infer<typeof MediaSchema>;

export const AssetRecordSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{2,31}$/),
  kind: z.enum(ASSET_KINDS),
  lifecycle: LifecycleSchema,
  storage: StorageRefSchema,
  c2paManifest: StorageRefSchema.optional(),
  media: MediaSchema,
  label: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  source: SourceInfoSchema,
  createdAt: z.string().datetime(),
});
export type AssetRecord = z.infer<typeof AssetRecordSchema>;

/** Bytes and record text only; parsing, hashing and the lifecycle stay in this module, so every backend gets them. */
export interface AssetStore {
  backend: StorageRef['backend'];
  /** Writes a blob under its hash (a no-op when it exists) and returns its key. */
  putBlob(sha256: string, bytes: Uint8Array): Promise<string>;
  getBlob(key: string): Promise<Uint8Array>;
  readRecord(id: string): Promise<string | null>;
  writeRecord(id: string, text: string): Promise<void>;
}

export const ASSETS_DIR = resolve(import.meta.dir, '../../.assets');

/** `<root>/blobs/<sha[0:2]>/<sha>` + `<root>/records/<id>.json`; writes go through a rename, so a crash never leaves half a file. */
export function localAssetStore(root: string): AssetStore {
  const atomicWrite = async (path: string, data: Uint8Array | string) => {
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(`${path}.tmp`, data);
    renameSync(`${path}.tmp`, path);
  };
  return {
    backend: 'local',
    async putBlob(sha256, bytes) {
      const key = join('blobs', sha256.slice(0, 2), sha256);
      if (!(await Bun.file(join(root, key)).exists())) await atomicWrite(join(root, key), bytes);
      return key;
    },
    getBlob: async (key) => Bun.file(join(root, key)).bytes(),
    async readRecord(id) {
      const f = Bun.file(join(root, 'records', `${id}.json`));
      return (await f.exists()) ? f.text() : null;
    },
    writeRecord: (id, text) => atomicWrite(join(root, 'records', `${id}.json`), text),
  };
}

export const sha256Hex = (data: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(data).digest('hex');

/** The id is derived from the content, so the same bytes are always the same asset. */
export const assetIdFor = (sha256: string) => `asset_${sha256.slice(0, 16)}`;

/** Reads width/height/alpha per mime. A mime without a row fails processing (the asset becomes Failed). */
const MEDIA_PROBES: Readonly<Record<string, (b: Buffer) => MediaInfo>> = {
  'image/png': (b) => {
    if (b.toString('latin1', 12, 16) !== 'IHDR') throw new Error('PNG has no IHDR chunk');
    const colorType = b[25]!;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), hasAlpha: colorType === 4 || colorType === 6 || b.includes('tRNS'), vector: false };
  },
  'image/jpeg': (b) => {
    // Walk the marker segments to the first start-of-frame (SOF0..SOF15 except DHT/JPG/DAC).
    for (let i = 2; i + 9 < b.length; i += 2 + b.readUInt16BE(i + 2)) {
      if (b[i] !== 0xff) throw new Error(`JPEG marker expected at byte ${i}`);
      const m = b[i + 1]!;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), hasAlpha: false, vector: false };
    }
    throw new Error('JPEG has no start-of-frame marker');
  },
  'image/svg+xml': (b) => {
    if (!/<svg[\s>]/.test(b.toString('utf8', 0, 4096))) throw new Error('SVG has no <svg> element');
    return { hasAlpha: true, vector: true };
  },
};

/** An embedded C2PA manifest (JUMBF box labelled "c2pa") anywhere in the bytes. */
const hasEmbeddedC2pa = (b: Buffer) => b.includes('c2pa');

const save = (store: AssetStore, record: AssetRecord) => store.writeRecord(record.id, JSON.stringify(AssetRecordSchema.parse(record), null, 2));

export async function readAssetRecord(store: AssetStore, id: string): Promise<AssetRecord | null> {
  const text = await store.readRecord(id);
  if (text === null) return null;
  try {
    return AssetRecordSchema.parse(JSON.parse(text));
  } catch (e) {
    throw new Error(`corrupt asset record ${id}: ${(e as Error).message}`);
  }
}

export type IngestResult = { outcome: 'Stored' | 'Reprocessed' | 'Deduplicated'; record: AssetRecord };

/**
 * Ingests one draft: hash → same hash already stored → that record, untouched (`Deduplicated`),
 * unless it is `Failed`, which is processed again under the new draft's mime (`Reprocessed`); otherwise blob + record
 * `Uploaded` (`Stored`). Then `Processing` → media probe → `Ready`, or `Failed` with the probe
 * error. Each step is written, so a crash leaves the record in the step it reached.
 */
export async function ingestAsset(store: AssetStore, rawDraft: AssetDraft, now: () => Date = () => new Date()): Promise<IngestResult> {
  const draft = AssetDraftSchema.parse(rawDraft);
  const bytes = Buffer.from(await Bun.file(draft.path).bytes());
  const sha256 = sha256Hex(bytes);
  const id = assetIdFor(sha256);
  const existing = await readAssetRecord(store, id);
  if (existing && existing.storage.sha256 !== sha256) throw new Error(`asset id ${id} collides: stored sha256 ${existing.storage.sha256}, new ${sha256}`);
  if (existing && existing.lifecycle.status !== 'Failed') return { outcome: 'Deduplicated', record: existing };
  const blob = async (b: Uint8Array, mime: string): Promise<StorageRef> => {
    const hash = sha256Hex(b);
    return { backend: store.backend, key: await store.putBlob(hash, b), sha256: hash, bytes: b.byteLength, mime };
  };
  const manifest = draft.c2paPath ? await Bun.file(draft.c2paPath).bytes() : undefined;
  const c2paManifest = manifest && (await blob(manifest, 'application/c2pa'));
  // A Failed asset is reprocessed with the new draft's mime (the usual fix: the first draft declared the wrong one).
  const uploaded: AssetRecord = existing ? { ...existing, storage: { ...existing.storage, mime: draft.mime } } : {
    id,
    kind: draft.kind,
    lifecycle: { status: 'Uploaded' },
    storage: await blob(bytes, draft.mime),
    ...(c2paManifest && { c2paManifest }),
    media: {},
    label: draft.label,
    description: draft.description,
    tags: draft.tags,
    source: { ...draft.source, c2pa: draft.source.c2pa || c2paManifest !== undefined || hasEmbeddedC2pa(bytes) },
    createdAt: now().toISOString(),
  };
  if (!existing) await save(store, uploaded);
  let record: AssetRecord = { ...uploaded, lifecycle: transitionAsset(uploaded.lifecycle, { type: 'process' }) };
  await save(store, record);
  const probe = MEDIA_PROBES[record.storage.mime];
  try {
    if (!probe) throw new Error(`no media probe for ${record.storage.mime}; add a MEDIA_PROBES row (src/assets/store.ts)`);
    record = { ...record, media: probe(bytes), lifecycle: transitionAsset(record.lifecycle, { type: 'ready' }) };
  } catch (e) {
    record = { ...record, lifecycle: transitionAsset(record.lifecycle, { type: 'fail', error: (e as Error).message }) };
  }
  await save(store, record);
  return { outcome: existing ? 'Reprocessed' : 'Stored', record };
}

/** Archives or restores a stored asset (processing events belong to `ingestAsset`). Rejected moves throw. */
export async function updateAssetStatus(store: AssetStore, id: string, event: Extract<AssetEvent, { type: 'archive' | 'restore' }>): Promise<AssetRecord> {
  const record = await readAssetRecord(store, id);
  if (!record) throw new Error(`no asset ${id}`);
  const next = { ...record, lifecycle: transitionAsset(record.lifecycle, event) };
  await save(store, next);
  return next;
}

/** A Ready asset's bytes (e.g. as a reference image). Any other status fails loud. */
export async function readReadyAsset(store: AssetStore, id: string): Promise<{ bytes: Uint8Array; mime: string; record: AssetRecord }> {
  const record = await readAssetRecord(store, id);
  if (!record) throw new Error(`no asset ${id}`);
  if (record.lifecycle.status !== 'Ready') throw new Error(`asset ${id} is ${record.lifecycle.status}, not Ready`);
  return { bytes: await store.getBlob(record.storage.key), mime: record.storage.mime, record };
}

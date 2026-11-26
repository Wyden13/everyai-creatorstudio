/**
 * Pluggable image-generation providers.
 *
 * A provider is DATA (a `ProviderSpec` parsed from shared/model-registry.json: models, outputs,
 * reference limits, prices) plus one small ADAPTER here that speaks its HTTP API and normalises
 * the reply to `ImageGenResult`. Add a provider as a registry row plus an `IMAGE_ADAPTERS` row;
 * harnesses never special-case a provider. Every call goes through `withRetry`/`fetchBody`.
 */
import { z } from 'zod';
import modelRegistry from '../../../../shared/model-registry.json';
import { validateModelForNode } from '../contracts';
import { requestJson } from '../providers';
import { REAL_RETRY_DEPS, type RetryDeps } from '../retry';

export const RESOLUTIONS = ['1K', '2K', '4K'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
export const ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;
export type Aspect = (typeof ASPECTS)[number];
/** What a model can emit. `png_alpha` = PNG with a real transparent background. */
export const IMAGE_OUTPUTS = ['jpg', 'png', 'png_alpha', 'svg'] as const;
export type ImageOutput = (typeof IMAGE_OUTPUTS)[number];

/** How a provider bills. Add a billing unit as a union member plus a `PRICE_UNITS` row. */
const PriceSchema = z.discriminatedUnion('unit', [
  z.object({ unit: z.literal('image'), usd: z.number().nonnegative(), notes: z.string().optional() }),
  z.object({
    unit: z.literal('1m_tokens'),
    input_usd: z.number().nonnegative(),
    /** Text and thinking output. */
    text_output_usd: z.number().nonnegative(),
    image_output_usd: z.number().nonnegative(),
    /** Output image tokens per resolution (the provider's published counts). */
    image_tokens: z.record(z.enum(RESOLUTIONS), z.number().int().positive()),
    notes: z.string().optional(),
  }),
]);
export type Price = z.infer<typeof PriceSchema>;

const ImageModelSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    outputs: z.array(z.enum(IMAGE_OUTPUTS)).min(1),
    resolutions: z.array(z.enum(RESOLUTIONS)).min(1),
    max_refs: z.number().int().nonnegative(),
    /** The provider watermarks every output with SynthID (reported by the provider; plain data). */
    synthid: z.boolean(),
    /** Asset kinds this model is a good default for (a hint to the Asset Generation harness). */
    good_for: z.array(z.string()).min(1),
    price: PriceSchema,
  })
  .refine(({ price, resolutions }) => price.unit === 'image' || resolutions.every((r) => r in price.image_tokens), 'every resolution needs an image_tokens count');
export type ImageModel = z.infer<typeof ImageModelSchema>;

export const ProviderSpecSchema = z.object({
  id: z.string(),
  label: z.string(),
  capability: z.literal('image_gen'),
  /** Org Vault key name; env.ts maps it to env vars for live tests. */
  secretName: z.string(),
  models: z.array(ImageModelSchema).min(1),
});
export type ProviderSpec = z.infer<typeof ProviderSpecSchema>;

/** Every registry provider with image_gen models, parsed once at load (a bad row fails loud). */
type RegistryModel = { id: string; label: string; capabilities: string[]; image?: object };
export const IMAGE_PROVIDERS: readonly ProviderSpec[] = modelRegistry.providers.flatMap((p) => {
  const models = (p.models as RegistryModel[]).filter((m) => m.capabilities.includes('image_gen'));
  if (models.length === 0) return [];
  return [ProviderSpecSchema.parse({ id: p.id, label: p.label, capability: 'image_gen', secretName: p.secret_key_name, models: models.map((m) => ({ ...m.image, id: m.id, label: m.label })) })];
});

export function imageModel(providerId: string, modelId: string): ImageModel {
  const model = IMAGE_PROVIDERS.find((p) => p.id === providerId)?.models.find((m) => m.id === modelId);
  if (!model) throw new Error(`no image_gen model ${providerId}/${modelId} in shared/model-registry.json`);
  return model;
}

/** What one call actually used, as the provider reports it. */
export type ImageUsage = { unit: 'image'; images: number } | { unit: '1m_tokens'; inputTokens: number; textOutputTokens: number; imageOutputTokens: number };

const usd = (n: number) => Number(n.toFixed(6));

/** Estimate before a call (for choosing) and actual cost after it, per billing unit. */
const PRICE_UNITS: { [U in Price['unit']]: { estimate: (p: Extract<Price, { unit: U }>, r: Resolution) => number; actual: (p: Extract<Price, { unit: U }>, u: Extract<ImageUsage, { unit: U }>) => number } } = {
  image: { estimate: (p) => p.usd, actual: (p, u) => p.usd * u.images },
  '1m_tokens': {
    estimate: (p, r) => (p.image_tokens[r]! * p.image_output_usd) / 1e6,
    actual: (p, u) => (u.inputTokens * p.input_usd + u.textOutputTokens * p.text_output_usd + u.imageOutputTokens * p.image_output_usd) / 1e6,
  },
};
type AnyUnit = { estimate: (p: Price, r: Resolution) => number; actual: (p: Price, u: ImageUsage) => number };

/** Estimated USD of one image (output image tokens only; thinking is extra and unknown before the call). */
export const estimateImageUsd = (price: Price, resolution: Resolution) => usd((PRICE_UNITS[price.unit] as AnyUnit).estimate(price, resolution));

export function actualImageUsd(price: Price, usage: ImageUsage): number {
  if (usage.unit !== price.unit) throw new Error(`usage is billed per ${usage.unit} but the price is per ${price.unit}`);
  return usd((PRICE_UNITS[price.unit] as AnyUnit).actual(price, usage));
}

export interface ImageRef {
  bytes: Uint8Array;
  mime: string;
}

export interface ImageGenRequest {
  providerId: string;
  modelId: string;
  prompt: string;
  refs: readonly ImageRef[];
  aspect: Aspect;
  resolution: Resolution;
}

export interface ImageGenResult {
  bytes: Uint8Array;
  mime: string;
  costUsd: number;
  /** A separate C2PA manifest, when the provider returns one apart from the image bytes. */
  c2pa?: Uint8Array;
  /** Provider ids, raw usage etc., kept as data. */
  providerMeta: Record<string, unknown>;
}

/** One provider's call with its key already bound (env.ts / the Vault). */
export type ImageGenCall = (req: ImageGenRequest) => Promise<ImageGenResult>;
/** The image edge: one bound call per configured provider. A provider without a key has no row. */
export type ImageGenEdges = Readonly<Partial<Record<string, ImageGenCall>>>;

type Adapter = (req: ImageGenRequest & { apiKey: string }, model: ImageModel, deps: RetryDeps) => Promise<ImageGenResult>;

/** Mime from the leading bytes, for providers whose reply does not say. */
const MAGIC: readonly [mime: string, test: (b: Uint8Array) => boolean][] = [
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8],
  ['image/webp', (b) => Buffer.from(b.subarray(8, 12)).toString() === 'WEBP'],
  ['image/svg+xml', (b) => /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(Buffer.from(b.subarray(0, 512)).toString())],
];
export function sniffMime(bytes: Uint8Array): string {
  const hit = MAGIC.find(([, test]) => test(bytes));
  if (!hit) throw new Error('image bytes are not PNG, JPEG, WebP or SVG');
  return hit[0];
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

/** Gemini Interactions API (current Nano Banana docs, Api-Revision 2026-05-20). Output is JPEG only. */
const nanoBanana: Adapter = async (req, model, deps) => {
  type Content = { type: string; data?: string; mime_type?: string };
  type Interaction = {
    id?: string;
    status?: string;
    usage?: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number; output_tokens_by_modality?: { modality: string; tokens: number }[] };
    steps?: { type: string; content?: Content[] }[];
  };
  const data = await requestJson<Interaction>(
    'Gemini image',
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey, 'Api-Revision': '2026-05-20' },
      body: JSON.stringify({
        model: req.modelId,
        input: [{ type: 'text', text: req.prompt }, ...req.refs.map((r) => ({ type: 'image', mime_type: r.mime, data: b64(r.bytes) }))],
        response_format: { type: 'image', aspect_ratio: req.aspect, image_size: req.resolution },
      }),
    },
    deps,
  );
  // Thought steps may hold interim images; the final image is the last model_output image.
  const image = data.steps?.filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).filter((c) => c.type === 'image' && c.data).at(-1);
  if (!image) throw new Error(`Gemini image returned no image (interaction status: ${data.status ?? 'none'})`);
  const u = data.usage ?? {};
  const imageOutputTokens = (u.output_tokens_by_modality ?? []).filter((m) => m.modality === 'image').reduce((n, m) => n + m.tokens, 0);
  const usage: ImageUsage = {
    unit: '1m_tokens',
    inputTokens: u.total_input_tokens ?? 0,
    textOutputTokens: (u.total_output_tokens ?? 0) - imageOutputTokens + (u.total_thought_tokens ?? 0),
    imageOutputTokens,
  };
  const bytes = Buffer.from(image.data!, 'base64');
  return { bytes, mime: image.mime_type ?? sniffMime(bytes), costUsd: actualImageUsd(model.price, usage), providerMeta: { interactionId: data.id, usage: data.usage } };
};

/** Recraft generations API; vector models return SVG. Reference images are not wired (max_refs 0 in the registry). */
const recraft: Adapter = async (req, model, deps) => {
  const data = await requestJson<{ data?: { b64_json?: string }[]; credits?: number }>(
    'Recraft',
    'https://external.api.recraft.ai/v1/images/generations',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
      body: JSON.stringify({ prompt: req.prompt, model: req.modelId, n: 1, size: req.aspect, response_format: 'b64_json', ...(!model.outputs.includes('svg') && { image_format: 'png' }) }),
    },
    deps,
  );
  const encoded = data.data?.[0]?.b64_json;
  if (!encoded) throw new Error('Recraft returned no image');
  const bytes = Buffer.from(encoded, 'base64');
  return { bytes, mime: sniffMime(bytes), costUsd: actualImageUsd(model.price, { unit: 'image', images: 1 }), providerMeta: { credits: data.credits } };
};

/** One adapter per provider id in the registry. */
export const IMAGE_ADAPTERS: Readonly<Record<string, Adapter>> = { google_gemini: nanoBanana, recraft };

/** Validates capability, model and reference count at the boundary, then calls the provider's adapter. */
export async function callImageGen(opts: ImageGenRequest & { apiKey: string }, deps: RetryDeps = REAL_RETRY_DEPS): Promise<ImageGenResult> {
  const check = validateModelForNode('asset_image', opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  const model = imageModel(opts.providerId, opts.modelId);
  if (!model.resolutions.includes(opts.resolution)) throw new Error(`${opts.modelId} has no ${opts.resolution} output (has ${model.resolutions.join(', ')})`);
  if (opts.refs.length > model.max_refs) throw new Error(`${opts.modelId} takes at most ${model.max_refs} reference images, got ${opts.refs.length}`);
  const adapter = IMAGE_ADAPTERS[opts.providerId];
  if (!adapter) throw new Error(`no image adapter for provider ${opts.providerId}; add an IMAGE_ADAPTERS row (src/assets/image-gen.ts)`);
  return adapter(opts, model, deps);
}

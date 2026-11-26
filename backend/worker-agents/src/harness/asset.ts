/**
 * Asset Generation harness: typed asset requests → generated image files + provenance as data.
 *   per request: code builds a closed menu of registry image models (output need, resolution,
 *   reference count, configured providers) → the LLM picks one and writes the provider-ready
 *   prompt (violations fed back, ≤ MAX_ASSET_ATTEMPTS) → the injected imageGen edge generates →
 *   the file is written to `outDir`.
 * Its output (`assets`) pipes straight into the Asset Storage tool (src/assets/store.ts `ingestAsset`).
 * The run's budget is shown to the model as a planning input; code never refuses for budget.
 * Resume skips requests already generated (kept in `lastOutput`) and shows the model the failure.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ASPECTS, IMAGE_PROVIDERS, RESOLUTIONS, estimateImageUsd, imageModel, type Aspect, type ImageOutput, type ProviderSpec, type Resolution } from '../assets/image-gen';
import { ASSET_KINDS, AssetDraftSchema, sha256Hex, type AssetKind } from '../assets/store';
import { DEFAULT_BUDGET_USD } from '../checkpoint';
import { parseLlmJson } from '../providers';
import { defineHarness } from './contract';
import { roundUsd, sessionSpendUsd } from './spend';

export const MAX_ASSET_ATTEMPTS = 3;

/** Which model outputs satisfy each output need. Add a need as a row. */
export const OUTPUT_NEEDS = {
  raster: ['jpg', 'png', 'png_alpha'],
  transparent: ['png_alpha', 'svg'],
  vector: ['svg'],
} as const satisfies Record<string, readonly ImageOutput[]>;
export type OutputNeed = keyof typeof OUTPUT_NEEDS;

/** Per asset kind: default output need and aspect, and how a provider prompt for it must read. Add a kind as a row. */
export const KIND_RULES: { readonly [K in AssetKind]: { output: OutputNeed; aspect: Aspect; guide: string } } = {
  character_sheet: { output: 'raster', aspect: '16:9', guide: 'One original character shown front, three-quarter, side and back in one row: identical proportions, outfit, colours and line weight in every view; neutral standing pose; plain flat light background; no text or labels.' },
  expression_grid: { output: 'raster', aspect: '1:1', guide: "One original character's head and shoulders in an even grid, one expression per cell exactly as listed; identical design, colours and line weight in every cell; plain flat background; thin gutters; no text or labels." },
  part: { output: 'vector', aspect: '1:1', guide: 'One isolated body part or costume piece for a cut-out puppet rig (a mouth shape, eyes, a hat), centred, flat colours, no background, no text.' },
  prop: { output: 'vector', aspect: '1:1', guide: 'One isolated object, centred, flat shapes, no background scene, no text.' },
  icon: { output: 'vector', aspect: '1:1', guide: 'One simple icon with a bold silhouette readable at 64 px, flat, no text.' },
  logo: { output: 'vector', aspect: '1:1', guide: 'A logo mark; a wordmark only if the description gives its text verbatim, spelled exactly.' },
  illustration: { output: 'raster', aspect: '16:9', guide: 'A full-frame flat editorial illustration: bold shapes, limited palette, clear focal subject, no text.' },
};

const AssetRefSchema = z.union([z.object({ assetId: z.string().min(1) }), z.object({ path: z.string().min(1) })]);

export const AssetRequestSchema = z.object({
  /** Names the output file. */
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/),
  kind: z.enum(ASSET_KINDS),
  description: z.string().min(1).max(1000),
  /** Style / character references: org-library asset ids or image files. */
  refs: z.array(AssetRefSchema).default([]),
  /** Defaults to the kind's KIND_RULES output. */
  output: z.enum(Object.keys(OUTPUT_NEEDS) as [OutputNeed, ...OutputNeed[]]).optional(),
  aspect: z.enum(ASPECTS).optional(),
  resolution: z.enum(RESOLUTIONS).default('1K'),
  tags: z.array(z.string().max(40)).max(12).default([]),
});
export type AssetRequest = z.infer<typeof AssetRequestSchema>;

export const AssetGenInputSchema = z.object({
  requests: z
    .array(AssetRequestSchema)
    .min(1)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, 'request ids must be unique'),
  /** The run's spend budget (RunContext.budgetUsd): a planning input for the model, never a refusal in code. */
  budgetUsd: z.number().positive().default(DEFAULT_BUDGET_USD),
  outDir: z.string().min(1),
});

export const GeneratedAssetSchema = AssetDraftSchema.extend({ requestId: z.string() });
export const AssetGenOutputSchema = z.object({ assets: z.array(GeneratedAssetSchema) });

/** One model the request may use, with its estimated price for this request. */
export interface MenuRow {
  choice: string;
  providerId: string;
  modelId: string;
  label: string;
  outputs: readonly ImageOutput[];
  goodForKind: boolean;
  estimatedUsd: number;
}

/** The closed menu for one request: registry models a configured provider can serve, cheapest first. */
export function imageMenu(providers: readonly ProviderSpec[], configured: (providerId: string) => boolean, req: { kind: AssetKind; output: OutputNeed; resolution: Resolution; refs: number }): MenuRow[] {
  const accepted: readonly ImageOutput[] = OUTPUT_NEEDS[req.output];
  return providers
    .filter((p) => configured(p.id))
    .flatMap((p) =>
      p.models
        .filter((m) => m.outputs.some((o) => accepted.includes(o)) && m.resolutions.includes(req.resolution) && m.max_refs >= req.refs)
        .map((m) => ({ choice: `${p.id}/${m.id}`, providerId: p.id, modelId: m.id, label: m.label, outputs: m.outputs, goodForKind: m.good_for.includes(req.kind), estimatedUsd: estimateImageUsd(m.price, req.resolution) })),
    )
    .sort((a, b) => a.estimatedUsd - b.estimatedUsd);
}

const EXTENSION: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp' };

const SYSTEM_PROMPT = `You prepare one image-generation call for an asset library used by an animated documentary studio.
You get one asset request, the rule for its kind, a closed menu of image models (with estimated price), and the run's budget.
1. Pick exactly one menu row by its "choice" id. Prefer the cheapest row with good_for_kind = true; pick a pricier row only when the request clearly needs it, and stay well inside the remaining budget.
2. Write the provider-ready prompt: concrete, visual, self-contained, following the kind rule exactly. Describe an ORIGINAL design: never name or imitate an existing character, franchise or artist. When reference images are attached to the call, say how to use them (match this character / this style).
3. Give a short label (<= 36 chars) and up to 12 lowercase search tags.
Reply with ONLY one JSON object, no prose and no markdown fences:
{"choice":"<menu choice id>","prompt":"…","label":"…","tags":["…"]}`;

export const assetHarness = defineHarness({
  id: 'asset',
  capability: 'llm_text',
  systemPrompt: SYSTEM_PROMPT,
  tools: [
    { id: 'image_menu', kind: 'coded', description: 'registry image models filtered by output need, resolution, reference count and configured providers' },
    { id: 'image_gen', kind: 'coded', description: 'pluggable image providers (src/assets/image-gen.ts): Nano Banana, Recraft' },
  ],
  input: AssetGenInputSchema,
  output: AssetGenOutputSchema,
  edges: ['llm', 'model', 'imageGen', 'assetRefs'],
  inputFiles: (input) => input.requests.flatMap((r) => r.refs.flatMap((ref) => ('path' in ref ? [ref.path] : []))),
  async body({ input, edges, resume, llm }) {
    const assets = resume?.lastOutput === undefined ? [] : AssetGenOutputSchema.parse(resume.lastOutput).assets;
    let spentUsd = resume ? sessionSpendUsd(resume) : 0;
    let failure = resume?.failure;
    mkdirSync(input.outDir, { recursive: true });
    for (const request of input.requests.filter((r) => !assets.some((a) => a.requestId === r.id))) {
      const rule = KIND_RULES[request.kind];
      const output = request.output ?? rule.output;
      const aspect = request.aspect ?? rule.aspect;
      const failed = (error: string) => ({ state: 'Failed' as const, error: `request ${request.id}: ${error}`, partial: { assets } });
      const menu = imageMenu(IMAGE_PROVIDERS, (id) => edges.imageGen[id] !== undefined, { kind: request.kind, output, resolution: request.resolution, refs: request.refs.length });
      if (menu.length === 0) {
        return failed(`no configured image provider makes ${output} (${OUTPUT_NEEDS[output].join('/')}) at ${request.resolution} with ${request.refs.length} reference image(s); configured: ${Object.keys(edges.imageGen).join(', ') || 'none'}`);
      }
      const Reply = z.object({
        choice: z.enum(menu.map((m) => m.choice) as [string, ...string[]]),
        prompt: z.string().min(20).max(4000),
        label: z.string().min(1).max(36),
        tags: z.array(z.string().max(40)).max(12),
      });
      let feedback: { previous_reply: string; problems: string } | undefined;
      let reply: z.infer<typeof Reply> | undefined;
      for (let attempt = 1; attempt <= MAX_ASSET_ATTEMPTS && !reply; attempt++) {
        const answer = await llm({
          nodeKind: 'asset_generation',
          ...edges.model,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: JSON.stringify({
            request: { kind: request.kind, description: request.description, output, aspect, resolution: request.resolution, reference_images: request.refs.length, tags: request.tags },
            kind_rule: rule.guide,
            menu: menu.map((m) => ({ choice: m.choice, label: m.label, outputs: m.outputs, good_for_kind: m.goodForKind, estimated_usd: m.estimatedUsd })),
            budget: { budget_usd: input.budgetUsd, spent_usd: roundUsd(spentUsd), remaining_usd: roundUsd(input.budgetUsd - spentUsd) },
            ...(failure && { previous_failure: failure }),
            ...(feedback && { ...feedback, instruction: 'Fix every problem and reply again.' }),
          }),
        });
        spentUsd += answer.usage.estimatedUsd;
        const parsed = (() => {
          try {
            return Reply.safeParse(parseLlmJson(answer.text));
          } catch (e) {
            return { success: false as const, error: { message: `not JSON: ${(e as Error).message}` } };
          }
        })();
        if (parsed.success) reply = parsed.data;
        else feedback = { previous_reply: answer.text, problems: parsed.error.message };
      }
      if (!reply) return failed(`no valid model reply after ${MAX_ASSET_ATTEMPTS} attempts: ${feedback!.problems}`);
      failure = undefined;
      const row = menu.find((m) => m.choice === reply.choice)!;
      try {
        const refs = await Promise.all(request.refs.map(async (ref) => ('assetId' in ref ? edges.assetRefs(ref.assetId) : { bytes: await Bun.file(ref.path).bytes(), mime: Bun.file(ref.path).type })));
        const image = await edges.imageGen[row.providerId]!({ providerId: row.providerId, modelId: row.modelId, prompt: reply.prompt, refs, aspect, resolution: request.resolution });
        spentUsd += image.costUsd;
        const extension = EXTENSION[image.mime];
        if (!extension) throw new Error(`${row.choice} returned ${image.mime}; add an EXTENSION row`);
        const path = join(input.outDir, `${request.id}.${extension}`);
        await Bun.write(path, image.bytes);
        const c2paPath = image.c2pa && `${path}.c2pa`;
        if (c2paPath) await Bun.write(c2paPath, image.c2pa!);
        assets.push({
          requestId: request.id,
          kind: request.kind,
          label: reply.label,
          description: request.description,
          tags: [...new Set([...request.tags, ...reply.tags])].slice(0, 12),
          path,
          mime: image.mime,
          ...(c2paPath && { c2paPath }),
          source: {
            origin: 'generated',
            provider: row.providerId,
            retrievedAt: new Date().toISOString(),
            flags: ['ai_generated'],
            generator: { model: row.modelId, promptHash: sha256Hex(reply.prompt), costUsd: image.costUsd },
            synthId: imageModel(row.providerId, row.modelId).synthid,
            ...(c2paPath && { c2pa: true }),
          },
        });
      } catch (e) {
        return failed((e as Error).message);
      }
    }
    return { state: 'Done', output: { assets } };
  },
});

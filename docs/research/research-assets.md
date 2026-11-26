# Research: Asset Library, Asset Creation, Real-World Assets (backend/worker-agents, Vox engine)

Revision 2 (2026-11-25). Owner decisions applied: (a) no hard-coded cost caps (budget is an org/user setting, default $5/video); (b) the platform assumes no legal responsibility. Copyright, trademark, likeness, AI disclosure and each provider's ToS belong to the org/user and the providers they register. So this revision has NO legal gates, rights judges or enforced attribution: licence/source/provenance are plain per-asset data the user can read and act on, and every provider (image gen, stock, logos, vision, video) is pluggable. Legal-risk content is cut to one line at the end of section 6.

Evidence grading: [V] read on a vendor/official page this session; [S] search summary only; [K] my own knowledge, not re-verified. Prices are a 2026-11-25 snapshot. Models churn every 6-12 months (Nano Banana 2.5 Flash Image shuts down 2027-03-15; gpt-image-1.5 reported deprecated 2026-12-01; gpt-image-2 shows a retirement notice on OpenRouter), which is one more reason providers must be pluggable and prices must live in data, not code.

---

## 0. What the repo already gives us

- `src/vox/beat-sheet.ts`: the LLM writes a `BeatSheet`; each beat has one `shot` from a closed discriminated union (`headline, chapter, map, number, units, timeline, quote, line, split, chain`). Everything the LLM may reference is a CLOSED id table turned into `z.enum` (`geo-manifest.ts`: `PLACES`, `MAP_LAYERS`, `MAP_VIEWS`; `COLOR.tone`). Strings have char caps in `CHARS`. `at` is a phrase copied from the beat's narration, resolved to frames from word timestamps. Violations are fed back up to 3 times. `FORMATS` is a table (short 9:16, explainer 16:9).
- `src/vox/README.md`: "nothing on screen is still except maps (and, later, real pictures)". Photos are already a planned exception and still need camera motion.
- Rendering: Chromium frame capture + FFmpeg (`remotion/visual-sandbox.ts`), audit pass incl. `auditMotion` (frozen frames). Widgets are pure functions of the frame, which favours rigs that are pure functions of `(data, frame)`.
- Existing: `src/storage.ts` (Drive / S3 adapter), `src/media-cache.ts` (LRU + byte range), `src/connectors/pexels.ts` and `freesound.ts`, `shared/connectors.json`, `shared/model-registry.json` (capability classes `llm_text, llm_code, tts, search, publish`), `src/harness/contract.ts` (harness = prompt + tools + zod I/O + injected edges, resumable session). No asset tables yet (`backend/db/migrations/0001_init.sql`, `0002_seed_dev.sql` only).
- AGENTS.md invariants still binding: keys server-side/Vault only, capability-typed routing (add `llm_vision`, `image_gen`, `video_gen`, `stock_search`, `logo_search`), exactly two video styles (brand kit must not become a theme system), Architect builds data, not rig code.

---

## 1. PROVIDER PLUGGABILITY (new, applies to all three parts)

The org registers whichever API it likes. Each provider is a row of data plus a small adapter that normalises its output to one zod-validated shape. No provider is special-cased in harnesses.

```ts
// shared/providers.schema.json (zod source in src/providers.ts)
const ProviderSpec = z.object({
  id: z.string(),                                   // 'recraft','nano_banana','pexels','wikimedia','brandfetch','my_custom_s3_stock'
  kind: z.enum(['image_gen','stock_search','logo_search','vision','video_gen','sound_search']),
  capability: z.enum(['image_gen','stock_search','logo_search','llm_vision','video_gen','search']),
  secretName: z.string().optional(),                // Org Vault key name; adapters get the key injected
  models: z.array(z.object({
    id: z.string(), label: z.string(),
    outputs: z.array(z.enum(['png','png_alpha','svg','jpg','mp4'])),
    maxRefs: z.number().int().optional(),
    price: z.object({ unit: z.enum(['image','megapixel','second','request','1m_tokens']), usd: z.number(), notes: z.string().optional() }).optional(),
  })),
  // Plain data the platform copies onto assets from this provider (no enforcement):
  defaultSource: z.object({ licenseName: z.string().optional(), licenseUrl: z.string().url().optional(), termsUrl: z.string().url().optional(), note: z.string().optional() }).optional(),
});

// The adapter interfaces (one per kind, code, injected as edges like llm/tts today)
type ImageGenEdge  = (req: { model: string; prompt: string; refs: Uint8Array[]; size: string; background: 'auto'|'transparent' }) => Promise<{ bytes: Uint8Array; mime: string; costUsd: number; providerMeta: Record<string,unknown> }>;
type StockEdge     = (req: { query: string; kind: 'photo'|'video'|'sound'; orientation?: string; limit: number }) => Promise<Candidate[]>;
type LogoEdge      = (req: { brand: string; domain?: string }) => Promise<Candidate[]>;
type Candidate     = { sourceId: string; url: string; title?: string; description?: string; w?: number; h?: number; durationSec?: number; source: SourceInfo };
```

- Built-in adapters I recommend shipping (each about 50-100 lines, all behind the same edge): `recraft`, `nano_banana` (Gemini API), `openai_image`, `ideogram`, `flux_bfl` for image gen; `wikimedia`, `smithsonian`, `nasa`, `loc`, `europeana`, `pexels`, `pixabay`, `shutterstock` for stock; `brandfetch`, `logo_dev` for logos; `veo`, `kling`, `runway` for video.
- A generic "OpenAPI-style custom provider" adapter (URL template + JSON path mapping + header from Vault) lets an org plug in an API we did not write, with the response still validated at the edge against the `Candidate` / image result schema (fail loud at boundaries).
- Capability routing from AGENTS.md still applies: the UI only offers a provider/model for a node whose capability matches. A status flag per provider (last success, latency, quota errors) feeds ordinary pipes (e.g. failing flag -> tool that switches the preferred provider).
- The price field is data used by the cost ledger (section 4), not a gate.

---

## 2. ORGANIZATION ASSET LIBRARY

### 2.1 Recommendation

Postgres is the system of record for metadata, source/provenance, tags and usage history. Bytes live in the existing storage adapter (Drive cold, S3 hot), content-addressed by sha256, with derivatives (thumbnail, web size, alpha cutout, depth map, focal boxes) made once at ingest and cached on the worker via `media-cache.ts`. A vision harness ("Asset Tagger") captions and tags on upload. At screenplay time a deterministic tool builds a per-video "asset menu" (a closed catalog of about 40-60 rows: id, kind, label, `useWhen`), which becomes a `z.enum` exactly like `PLACES`. The LLM picks ids; the validator rejects unknown ids and structural mistakes (below) and feeds the violation back. The brand kit is a bundle of ids, not a theme.

### 2.2 Storage

| Concern | Design |
|---|---|
| Originals | `storage = {backend:'gdrive'|'s3', key, sha256, bytes, mime}`; S3 key `org/{orgId}/assets/{sha256[0:2]}/{sha256}`, Drive file id for Drive |
| Derivatives | beside the original: `thumb_512.webp`, `web_1920.jpg`, `alpha.png`, `depth.png`, `proxy.mp4`, `waveform.json`; render never touches an original |
| Serving at render | worker pulls through `media-cache.ts` into a local LRU; Drive is cold storage only (API rate limits [K]) |
| External originals | downloaded and stored on selection (hash + source record), so renders never depend on a third-party URL |
| Secrets | provider and storage keys come from the Vault through injected edges |
| Health | status flag "Asset storage": bytes used, Drive quota, untagged backlog |

### 2.3 Data shapes

Provenance/licence is plain, user-readable data. Nothing in the platform branches on it except optional user-set filters.

```ts
const SourceInfo = z.object({                      // "where did this come from and under what terms" as DATA
  origin: z.enum(['upload','connector','generated']),
  provider: z.string().optional(),                 // ProviderSpec.id
  sourceUrl: z.string().url().optional(),
  sourceId: z.string().optional(),
  licenseName: z.string().optional(),              // free text as the source reports it: "CC BY-SA 4.0", "CC0", "Pexels License", "Owned"
  licenseUrl: z.string().url().optional(),
  holder: z.string().optional(),                   // author / photographer / owner
  creditLine: z.string().max(300).optional(),      // ready-to-paste credit, if the source supplied one
  termsUrl: z.string().url().optional(),
  retrievedAt: z.string().datetime().optional(),
  expiresAt: z.string().date().optional(),         // e.g. a cached-logo term or a stock licence the user entered
  note: z.string().max(500).optional(),            // free note by the user
  flags: z.array(z.string().max(32)).max(8),       // user/auto labels: 'trademark','person','ai_generated','editorial', ...
  generator: z.object({ model: z.string(), promptHash: z.string(), costUsd: z.number(), c2pa: z.boolean().optional(), synthId: z.boolean().optional() }).optional(),
  parentId: z.string().optional(),                 // derived from (cutout of X, vector of Y)
});

const AssetSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{2,31}$/),  // stable slug: 'logo_acme_dark', 'photo_forum_ruins'
  orgId: z.string(),
  kind: z.enum(['logo','mascot_kit','character_part','icon','illustration','photo','clip','sound','music','font','palette','lottie']),
  status: z.enum(['Uploaded','Processing','Ready','Failed','Archived']),   // explicit lifecycle, no booleans
  storage: StorageRefSchema,
  media: z.object({ w: z.number().int().optional(), h: z.number().int().optional(), durationSec: z.number().optional(), hasAlpha: z.boolean().optional(), fps: z.number().optional(), loudnessLufs: z.number().optional() }),
  source: SourceInfo,
  tags: z.object({                                 // machine-written, human-editable
    label: z.string().max(36), caption: z.string().max(240), useWhen: z.string().max(140),
    subjects: z.array(z.string()).max(12), keywords: z.array(z.string()).max(20),
    ocrText: z.string().max(300).optional(), palette: z.array(Hex).max(5),
    focus: z.array(z.object({ id: z.string(), box: Box4, label: z.string() })).max(5),   // normalised boxes for Ken Burns and 9:16 crop
    brandMarks: z.array(z.string()).max(5),        // detected logos (informational flag, no enforcement)
    quality: z.object({ sharpness: z.number(), watermark: z.boolean(), lowRes: z.boolean() }),
    orientationFit: z.object({ '16:9': z.number(), '9:16': z.number() }),
  }),
  embedding: z.array(z.number()).optional(),       // pgvector over label+caption+keywords
});
```

Postgres (migration `0003_assets.sql`, flat):

```sql
CREATE TYPE asset_status AS ENUM ('Uploaded','Processing','Ready','Failed','Archived');
CREATE TABLE assets (
  id text PRIMARY KEY, org_id uuid NOT NULL REFERENCES orgs(id),
  kind text NOT NULL, status asset_status NOT NULL,
  storage jsonb NOT NULL, media jsonb NOT NULL, source jsonb NOT NULL, tags jsonb NOT NULL,
  embedding vector(768), sha256 text NOT NULL, created_by uuid, created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, sha256)
);
CREATE INDEX assets_search ON assets USING gin (to_tsvector('english', (tags->>'label') || ' ' || (tags->>'caption')));
CREATE TABLE asset_uses (video_id text, asset_id text, beat_id text, shot_kind text, PRIMARY KEY (video_id, asset_id, beat_id));
CREATE TABLE providers (org_id uuid, id text, spec jsonb NOT NULL, secret_name text, PRIMARY KEY (org_id, id));
CREATE TABLE brand_kits (org_id uuid PRIMARY KEY, kit jsonb NOT NULL);
```

`asset_uses` is the one table worth having beyond the obvious: it answers "which videos used this asset?" when the user decides to swap or remove something. A "Credits" export tool reads `asset_uses` and `source.creditLine` and returns a text block the user can paste or choose to have the Publisher append. It is a convenience, off unless the org enables it; nothing validates it.

Lifecycle (explicit transition table): `Uploaded -> Processing -> Ready | Failed`, `Ready <-> Archived`. Only `Ready` assets enter menus. There is no approval or licence gate. Optional org setting: "require a manager to review tags before an asset becomes Ready", implemented as an extra `NeedsReview` state only if the org switches it on.

### 2.4 Auto-captioning / tagging on upload: "Asset Tagger" harness

A harness (system prompt, `llm_vision` capability, zod output = `tags`). Prompt rules: describe only what is visible; give counts rather than names for people; report visible logos in `brandMarks` (informational) and OCR text; propose 1-5 focus boxes; rate crop-fit for 9:16 and 16:9. Coded tools it uses: `exif_read` (author/copyright/date become suggestions written into `source.holder`/`note`, labelled as extracted), `palette_extract`, `ocr`, `audio_features` (bpm, LUFS, silence), `embed`, `phash` (dedupe). Vision cost is on the order of a cent or two per image [K, verify against the model's token price]. Live test per project rule: `bun run test:live asset-tagger`.

### 2.5 Closed catalog for the Screenplay LLM

1. `buildAssetMenu(orgId, topic, format)` (tool, no LLM): status `Ready`, `orientationFit[format]>0.5`, ranked by pgvector similarity + keyword overlap, top 40-60, plus brand-kit assets. Optional org-set filters (for example "exclude assets flagged `editorial`", "exclude past `expiresAt`") are plain predicates over `source`; they are user preferences, not platform rules. Rows: `{id, kind, label, useWhen, hasAlpha, durationSec?}`. The LLM never sees URLs or paths.
2. The Screenplay harness builds `AssetId = z.enum(menu.ids)` per run (cache by menu hash).
3. New shot kinds (a row in `ShotSchema` AND in `SHOTS` in `VoxVideo.tsx`, as the README says):

```ts
z.object({ kind: z.literal('photo'), asset: AssetId, move: z.enum(['push','pull','pan_l','pan_r','parallax','cutout_pop']),
           focus: FocusId.optional(), caption: text(CHARS.label).optional(), at: Phrase.optional() }),
z.object({ kind: z.literal('clip'),  asset: AssetId, trim: z.enum(['start','best','end']), at: Phrase.optional() }),
z.object({ kind: z.literal('logo'),  asset: AssetId, variant: z.enum(['full','mark','mono']), at: Phrase }),
z.object({ kind: z.literal('cast'),  /* section 3.6 */ }),
```

4. Structural editorial rules only (table rows in `BEAT_SHEET_RULES`): at most 2 `photo` beats in a row; a `logo` `at` phrase must contain the asset's name (so the logo lands when the brand is spoken); a `clip` must not exceed its `durationSec`; each `photo` needs a focus for 9:16; the same asset not reused more than N times per video. These are quality rules, not legal ones.

### 2.6 Brand kit

```ts
const BrandKitSchema = z.object({
  name: z.string(),
  logos: z.object({ full: AssetId, mark: AssetId, mono: AssetId.optional(), onDark: AssetId.optional() }),
  colors: z.object({ primary: Hex, accent: Hex, neutral: Hex }),     // roles only; Vox tokens stay (see Q3)
  fonts: z.object({ display: AssetId.optional(), body: AssetId.optional() }),
  mascot: z.string().optional(),                                      // CharacterKit id (section 3.6)
  watermark: z.object({ asset: AssetId, corner: z.enum(['tl','tr','bl','br']), opacity: z.number() }).optional(),
  intro: AssetId.optional(), outro: AssetId.optional(), musicBed: AssetId.optional(),
  voice: z.string().optional(), bannedWords: z.array(z.string()),
});
```

### 2.7 Fit

| Component | Kind |
|---|---|
| Asset Tagger | Harness (`llm_vision`) |
| Asset store, derivative maker, menu builder, credits export | Tools |
| Provider registry + adapters | Tools (edges) |
| Asset storage and provider health | Status flags |

Pipes: provider-failing flag -> if/else tool -> switch preferred provider; untagged-backlog flag -> re-run Tagger.

---

## 3. CREATION OF NEW ASSETS

### 3.1 Image-generation comparison (snapshot; each is just a pluggable adapter)

| Provider / model | Alpha | SVG | Consistency | Price | Notes |
|---|---|---|---|---|---|
| Nano Banana 2.1 `gemini-nano-banana-2.1`, 3.1 Flash `gemini-3.1-flash-image`, Lite `gemini-3.1-flash-lite-image`, Pro `gemini-3-pro-image` [V] | not documented; key out | no | 4 character refs (5 on Pro), 14 refs total, multi-turn edit; thinking always on, billed | 2.1: 1K $0.0336, 2K $0.0504, 4K $0.113; 3.1 Flash: 0.5K $0.045, 1K $0.067, 2K $0.101, 4K $0.151; Lite 1K $0.0336; Pro 1K/2K $0.134, 4K $0.24; batch 50% off on 2.1/Lite/2.5 | SynthID on all outputs [V]; Vertex adds C2PA [S]; Google claims no ownership of output [S] |
| OpenAI gpt-image-2 | `background:"transparent"` accepted in preview, thin edge halo reported [S] | no | ~5 refs via edits [S] | $8 in / $30 out per 1M image tokens [V]; 1024² about $0.006 / $0.053 / $0.211 low/med/high [S estimate] | C2PA + SynthID [S] |
| Recraft V4 / V4.1 [V] | remove-bg $0.01 | native SVG | style from reference images ($0.005) | raster $0.035, vector $0.08 (Pro raster $0.21, Pro vector $0.30), Styles vector $0.05, vectorize $0.01 (Pro $0.04), image-to-image $0.04 / $0.08 | ToS ownership terms not on the pricing page |
| Ideogram 4.x / 3.0 [V] | transparent endpoint $0.03-$0.42 | SVG $0.13-$0.32; image-to-SVG $0.10; Layerize $0.09 | Character Reference (3.0) $0.10-$0.20; custom model $40 to train, $0.06-$0.20 per image | 4.5: $0.03 / $0.06 / $0.10; 3.0: $0.03 / $0.06 / $0.09 | says it claims no ownership [V] |
| FLUX.2 (BFL) [V partial] | no | no | multi-reference edit | klein from $0.014-0.015, pro from $0.03, flex $0.05, max $0.07; Kontext pro $0.04, max $0.08; reference images billed by MP | `dev` weights non-commercial; klein open-weight terms per size to check |
| Imagen | not verified this session | | | | |

Recommended defaults the org can override: Recraft vector for parts, props, icons and logos (only true SVG; style pinning); Nano Banana for character sheets and expression grids (strongest documented reference handling); Ideogram or gpt-image-2 for text-in-image and transparent stickers; FLUX klein/pro or Nano Banana batch for cheap volume. Everything non-SVG needs a cutout for alpha: BiRefNet (MIT per search [S]; check weights) or a provider's remove-bg at $0.01.

Generated assets store `source.generator` and flags like `ai_generated` as plain data, and keep the original bytes (re-encoding strips C2PA/metadata [S]). That is all the platform does about provenance.

### 3.2 Animating a character without free-form LLM animation code

| Option | Verdict |
|---|---|
| **A. Coded SVG puppet rig, a pure function `render(kit, timeline, frame)` (RECOMMENDED)** | Deterministic, frame-seekable in the Chromium sandbox, audited by the existing motion audit, art is data (SVG/PNG parts) that can come from any provider or upload |
| B. Rive (`.riv`) | Org-authored hero mascots only. Runtimes MIT, no royalties [S]; exports on paid plans [S]; React docs deprecate state-machine "inputs" for Data Binding [S]; `@remotion/rive` docs list `artboard`/`animation` props, state-machine inputs unconfirmed [V]. Own clock, needs a hand-authored file |
| C. Lottie / dotLottie | Asset kind `lottie` for stings, animated logos, lower thirds. Free, deterministic (`goToAndStop(frame)`), authored in After Effects. Not a character rig |
| D. Image-to-video (Veo, Kling, Runway) | Optional provider-pluggable "b-roll clip" tier. Non-deterministic, 4-8 s clips, character drift, no control of lip-sync, unrepairable per frame, cost scales with seconds |
| E. Audio-driven talking-head (Hedra Character-3, Sync lipsync-2) | Optional adapter for photoreal faces or a face on a still. Hedra $0.025/s 540p, $0.05/s 720p, $0.0625/s 1080p (about $1.50-$3.75/min) [S via Hedra page]; Sync lipsync-2 $0.04-$0.05/s on existing video, 512x512 face render [S]. Not tested on flat cartoons by any source found |
| F. Spine / DragonBones | Not recommended (another proprietary runtime) |

### 3.3 Lip-sync from our word timestamps

1. Default, no new dependency: `align.ts` word times -> phonemes via a CMU dictionary (`cmu-pronouncing-dictionary`) with a letter-to-sound fallback for out-of-vocabulary words -> viseme class -> spread across the word's `[start,end]` by class weights; minimum hold about 3 frames at 30 fps; collapse repeats. Pure function `visemeTrack(words)`, unit-testable with scripted fakes.
2. Precision option: Rhubarb Lip Sync on the TTS audio with the dialog text. Nine shapes A-F (+G, H, X rest), JSON/TSV/XML output, English-only default recogniser with a language-independent phonetic mode, WAV/OGG input [V]. I did not read its LICENSE.md ([K] I recall MIT, verify).
3. Shape set = Rhubarb's nine (A closed P/B/M, B clenched, C open, D wide, E rounded, F pucker, G teeth-on-lip F/V, H L, X rest). Mouth shapes lead audio by 1-2 frames; a pause over about 8 frames returns to X.

### 3.4 Image-to-video price points (optional tiers)

| Model | $/s |
|---|---|
| Veo 3.1 Lite | 0.05 (720p), 0.08 (1080p); image-to-video, 4/6/8 s clips [S] |
| Veo 3.1 Fast | 0.15, cut to 0.10 (720p) / 0.12 (1080p) from 2026-04-07 [S] |
| Veo 3.1 Standard | 0.40 (720p/1080p), 0.60 (4K) [S]; "ingredients" up to 3 reference images [S] |
| Gemini Omni 1.2 Flash | about 0.07 (720p), 0.104 (1080p), 0.209 (4K upsampled) [V] |
| Kling 3.0 | about 0.13 (720p with audio) to 0.168 (1080p); fal Pro 0.224 [S]; Elements = reusable character from 2-4 images |
| Runway Gen-4 Turbo / 4.5 / Aleph 2.0 | about 0.05 / 0.12 / 0.28 [S] |

Full-video cost range for 60 s: about $3 (Lite) to $24 (Veo Standard); realistic hero-shot use of 15-25 s is $1-$10. No source tested flat-2D style retention; test with our own character sheet before offering it.

### 3.5 Oversimplified-style character sets: how it is built, and how to build the approach originally

What research could establish: the channel is run by Stuart Webster; no first-party description of the animation workflow was found [V]. A creator-focused article says After Effects and Photoshop make every character, background and effect; characters have blocky bodies, flexible stick-like limbs and oversized heads; faces lack noses and ears in favour of expressive eyebrows and mouths; historical figures are told apart by period clothing; backgrounds hide gags; countries are blobs with eyes; the narrator voices every character [V via creatorhandbook.net]. The pipeline analysis below is my inference plus the standard After Effects cut-out puppet technique (layer swaps for expressions/mouths, driven by sliders/expressions; Duik and Joysticks 'n Sliders are common tools [S]).

Transferable principles:
1. Identity = silhouette + one accessory (hat, helmet, beard, flag) + one flat colour. N characters = one body rig x N costume/prop/colour rows.
2. Emotion lives in a tiny face vocabulary: big eyes, thick brows, a few mouth shapes. Brow angle and eye openness do most of the acting.
3. A handful of poses (stand, point, shrug, flinch, march, fall, celebrate) reused, with expression swaps popped on the beat rather than tweened. Cheap and part of the comedy timing.
4. Constant cheap motion: idle bob/breath, camera push, squash-and-stretch on arrival, bounce on punchlines, mouth flap. Fits the "nothing is still" rule.
5. Staging is a tableau (1-3 characters, props, a background gag), recurring cast builds audience recognition.

Reproducing the approach with an original design: use different body geometry (for example round "bean" or capsule bodies with a thick outline), our palette (graphite `#0B0C0F`, violet `#8B6CFF`, `COLOR.tone`), and our own face grammar (for example dot or half-moon eyes plus one expressive brow ribbon), so nothing is a copy of their characters or art.

### 3.6 Original Character Kit: parts are data the LLM picks, code renders

```ts
const CharacterKit = z.object({
  id: z.string(),
  body: z.object({ shape: z.enum(['bean','capsule','block']), height: z.number(), headScale: z.number(), limb: z.enum(['stick','noodle','mitten']), strokeWidth: z.number() }),  // PARAMETRIC, code-drawn
  skin: z.record(ToneId, Hex),
  face: z.object({
    eyes:  z.record(EyeId,  PartRef),                 // open, wide, half, closed, squint, side_l, side_r, dead ...
    brows: z.record(BrowId, PartRef.or(BrowParams)),  // neutral, angry, sad, raised, smug, worried, flat; params = angle, arch, thickness
    mouths: z.object({ visemes: z.record(VisemeId, PartRef), emotions: z.record(MouthEmotionId, PartRef) }),
    extras: z.record(ExtraId, PartRef),               // sweat, blush, tear, vein, sparkle
  }),
  costumes: z.record(CostumeId, z.object({ layers: z.array(z.object({ slot: SlotId, art: PartRef, z: z.number() })), tint: ToneId.optional() })),
  props:    z.record(PropId, z.object({ art: PartRef, hold: z.enum(['hand_r','hand_l','head','back','ground']), scale: z.number() })),
  hands:    z.record(HandId, PartRef),
  anchors:  z.record(SlotId, z.object({ x: z.number(), y: z.number(), rot: z.number() })),
});
// PartRef = { asset: AssetId (SVG or alpha PNG in the org library), pivot: [x,y], bbox }
// MOTIONS: a code TABLE of parametric keyframes (like TRANSITION_RULES): idle_bob, talk_nod, point, shrug, flinch, march, fall, celebrate, facepalm, slide_in

z.object({ kind: z.literal('cast'),
  stage: StageId,                               // hand-built closed backgrounds: 'plain','hall','field','ship'
  actors: z.array(z.object({ id: ActorId, kit: KitId, costume: CostumeId.optional(), prop: PropId.optional(), slot: z.enum(['l','c','r']) })).min(1).max(3),
  speaker: ActorId.optional(),
  cues: z.array(z.object({ who: ActorId, at: Phrase, expression: ExpressionId.optional(), motion: MotionId.optional(), prop: PropId.optional(), costume: CostumeId.optional() })).max(6),
})
```

A pure compiler (timing.ts style) turns cues into per-frame `ActorState{pose, expression, mouth, propHold, offset}`. Blinks are scheduled at compile time from a seed (no hidden timers). Idle bob is always on. Mouth = `visemeTrack` when `who===speaker`, else the expression's resting mouth. Audit rules reuse the table pattern: actor inside safe area, bounded overlap, mouth not frozen while speaking, every referenced prop/costume exists.

How generated or org-uploaded art plugs in ("Part Ingest"):
1. Source art: org upload (SVG / alpha PNG), or any registered image provider (Recraft vector parts; Nano Banana character sheet with front view, expression grid and mouth grid on a flat background).
2. Tools: background removal, trim, optional vectorize, normalise units.
3. "Part Slotter" harness (`llm_vision`) proposes `slot`, `pivot`, `bbox`, `anchor` as data; the user confirms or drags in a Kit Builder UI. A deterministic render of the part on the reference body plus an optional vision check ("does this sit like a hat?") catches bad fits. This is a quality check, not a rights check.
4. Prefer parametric over swapped wherever possible (brows, eye openness, pupil offset, colours, limb thickness), so the art needed per kit is mostly the mouth set, a few costumes and props.
5. Cost for a new kit: roughly 30-60 generated parts/sheets at $0.035-$0.13 = about $1-$6 one-off [computed].
6. The Architect may build kit parts and stages as data; it never writes rig code.

Fit: Character Designer = harness (`llm_text` that drives `image_gen` tools, plus a vision-judge variant to score results); Part Slotter = harness (`llm_vision`); generation, background removal, vectorize, viseme track, motion table, rig renderer, cast compiler = tools/code; Kit Builder = frontend; provider health = status flag. "Generated asset failed the fit check twice" flag -> if/else tool -> restart Character Designer with its session, the part and the failure, per the "everything pipes" rule.

---

## 4. REAL-WORLD ASSET CONNECTIONS

### 4.1 Connector catalog (each is a pluggable `StockEdge`/`LogoEdge`; "terms" column is what the adapter copies into `source` as data)

| Source | Content | API facts | What the adapter writes to `source` |
|---|---|---|---|
| Wikimedia Commons | photos, maps, scans, SVG logos, audio, video | Action API `imageinfo` + `extmetadata` returns licence short name, artist, credit, usage terms, restrictions [S]; Commons Structured Data `depicts` (P180) [K]; descriptive User-Agent expected [K]; no key. Licences are a mix of PD / CC0 / CC BY / CC BY-SA / GFDL; BY and BY-SA ask for a credit line [V] | `licenseName`, `licenseUrl`, `holder`, `creditLine`, flags from restriction templates |
| Smithsonian Open Access | 3M+ images, CC0 [V] | api.data.gov key; some objects have metadata but no media file [V] | `CC0`, object id, flag `trademark` if logo seen |
| NASA / JPL | images.nasa.gov; JPL | no key [K]; generally not copyrighted in US, insignia/logo restricted, third-party items marked [V]; JPL credit "Courtesy NASA/JPL-Caltech" [V] | `Public domain (NASA)`, creditLine |
| Library of Congress | prints & photographs, maps | loc.gov JSON, no key [K]; per-item rights advisory [K] | rights advisory text verbatim |
| Europeana | EU heritage | API key; per-item rights statement URI; filter open reusability [K] | rights statement URI |
| Pexels | photos + video | existing `connectors/pexels.ts` covers video; add photos; about 200 req/hour [S]; API terms forbid bulk collection for ML training [S] | `Pexels License`, photographer |
| Pixabay | photo/vector/video/music | free key, about 100 req/min [S] | `Pixabay Content Licence` |
| Unsplash | photos | API guidelines ask for hotlinking + download ping [S]; awkward for store-and-render | skip by default; a pluggable adapter can be added |
| Shutterstock | stock | public API tiers with monthly licensing downloads [S] | licence id / download receipt |
| Getty, Storyblocks | premium | contract-only API [S] | org registers its own credentials |
| Brandfetch | logos + brand data | Logo API free, no attribution asked; Brand API 1 credit per call, overage $0.10; cached content licensed 30 days [S] | `expiresAt = retrievedAt + 30d` as data |
| logo.dev | logos | free plan asks for an attribution link; credit = 1 cent; Brand API 5 credits [S] | `termsUrl`, note |
| Freesound (existing connector) | sound | per-sound licence on the API [K] | licence name as reported |

Connectors only normalise and copy what the source says. They do not decide whether a use is permitted.

### 4.2 Picture Researcher (a harness)

1. The Screenplay writes a `photo` shot with either an org `AssetId` or an open `need` (typed: `{subject, period?, orientation}`, no URLs). Open needs resolve before voiceover/render. If unresolved, a code-drawn fallback shot from a fallback table is used so no beat breaks.
2. Fan out over the org's registered stock/logo providers in the org's preferred order (org library first, then connectors).
3. Deterministic filter (tool): resolution for the aspect, crop fit, not recently used, optional org predicates over `source` (for example exclude a licence name the user chooses).
4. Verification, see 4.4.
5. The winner is downloaded, hashed, tagged by the Asset Tagger, stored as a `Ready` asset with full `source` data, and logged in `asset_uses`.

### 4.3 Making photos move (constant-motion rule)

All heavy work happens once at ingest; render is a pure function of `(frame, derivatives)`.

| Technique | Method | Cost / notes |
|---|---|---|
| Ken Burns (push/pull/pan) | transform from a start box to an end box, easing from `motion.ts`, boxes from `tags.focus` so the move lands on the subject and survives a 9:16 crop | free; default for every photo |
| 2.5D parallax | depth map at ingest (Depth Anything V3; some checkpoints are Apache-2.0, giant/large are CC-BY-NC [S], so pin the checkpoint), then displace a mesh or split into 3-4 depth bands with the background inpainted (Qwen-Image-Layered, Apache-2.0, produces RGBA layers [S]); bands move at different speeds | self-hosted GPU, seconds per image; QA with a vision judge for stretching and halos |
| Cut-out (paper look) | background removal (BiRefNet MIT [S], SAM-class) then subject on a paper texture with torn edge, shadow, slight wobble; `assets/textures` already exist | cents or free self-hosted; matches the Vox aesthetic |
| Clips | trim to beat, loop-safe, speed ramp | `clip` shot |
| Generative i2v | section 3.4 | opt-in, budget-dependent |

### 4.4 Verifying that a picture depicts what the narration says (quality check)

1. Metadata first: compare the `need` to source title/description/categories/`depicts`, and the period to the item's date (a 1960s photo cannot illustrate a Roman scene).
2. Embedding prefilter (SigLIP/CLIP-class) to drop the weakest half before spending LLM tokens [K].
3. Vision judge (harness, `llm_vision`): input image, narration, `need`, metadata. Output `{depicts:'yes'|'partly'|'no', whatIsVisible, mismatch[], visibleText, hasWatermark, anachronism, safeCropFor:{'16:9','9:16'}, confidence}`. It describes unnamed people as "a person" and relies on source metadata for names.
4. An if/else tool accepts when metadata matches or `depicts==='yes'` above a threshold; otherwise try the next candidate; after K failures return `NoMatch` and use the fallback shot. The judge's evidence stays in the session for resumption.
5. Live test: `bun run test:live picture-researcher`, keys from env.

---

## 5. Cost across price points (no hard-coded caps)

Budget is an org/user setting piped into the code, default $5 per video. A declarative table of tiers plus a pure planner; nothing is gated by a constant.

```ts
const TIERS = {  // estimated $ per video, from provider price data in the registry (never hard-coded in logic)
  free:    { usd: 0,    does: ['org library','free connectors','coded rig','Ken Burns','self-hosted cutout'] },
  verify:  { usd: 0.10, does: ['vision tagging of new assets','vision verification of 10-20 candidates'] },
  parts:   { usd: 0.40, does: ['3-5 Recraft vector props/icons at $0.08'] },
  illus:   { usd: 1.0,  does: ['~20 Nano Banana 2.1 2K illustrations at $0.05'] },
  i2vLite: { usd: 1.6,  does: ['20-25 s Veo 3.1 Lite i2v at $0.05-0.08/s'] },
  i2vFast: { usd: 3.0,  does: ['20 s Veo 3.1 Fast at $0.10-0.15/s'] },
  premium: { usd: 12,   does: ['30 s Veo 3.1 Standard at $0.40/s, or Kling at $0.13-0.22/s'] },
} as const;
```

- `planAssets(budgetUsd, tiers, preferences)` is a pure function; a `costLedger` tool records `generator.costUsd` per asset and returns remaining budget. A "Budget" status flag turns amber below a configurable fraction and pipes into a tool that downgrades remaining beats to cheaper tiers. Out of budget mid-video means downgrade per beat via the fallback table, never fail the video.
- Default stack marginal cost per video about $0-$0.60. Org-library tagging about $0.01-$0.02 per asset [estimate]. New character kit about $1-$6 one-off.

---

## 6. Recommended stack

| Need | Pick | Price | Notes |
|---|---|---|---|
| Library | Postgres metadata + existing Drive/S3 adapter, sha256 keys, LRU cache | existing infra | provenance as plain `source` data |
| Providers | `ProviderSpec` registry + per-kind adapters + generic custom adapter | n/a | org registers any API; Vault keys |
| Tagging / verification | `llm_vision` harness (any vision model in the registry) | about 1-2 cents/image | |
| Retrieval | pgvector + keyword search, menu of 40-60 | free | closed `z.enum` per run |
| New vector parts/icons/logos | Recraft V4.1 vector (default) | $0.08 (Pro $0.30), vectorize $0.01, style $0.005 | |
| Character sheets | Nano Banana 2.1 (Pro for hard cases) | $0.034-$0.134 | |
| Text/stickers | gpt-image-2 or Ideogram | token-billed / $0.03-$0.42 | alpha halo reported on gpt-image-2 |
| Character animation | Coded SVG rig + viseme track | free | deterministic |
| Org-authored motion | Lottie (v1), Rive (later) | Rive exports paid | |
| Premium motion (optional) | Veo 3.1 Lite/Fast, Kling 3 | $0.05-$0.22/s | budget-selected |
| Real photos | Wikimedia, Smithsonian, NASA, LoC, Europeana, Pexels/Pixabay, any registered API | free or org plan | |
| Logos | org logos first; Brandfetch / logo.dev / Wikimedia SVG | free to $0.10 per brand call | |
| Photo motion | Ken Burns + depth-band parallax + BiRefNet cut-out | self-hosted | pin checkpoints |

Risks (engineering): provider/model churn (mitigated by pluggable registry and prices as data); verification false positives (metadata first, then vision); generated parts not fitting a rig (fit check at ingest); unverified vendor facts flagged [S]/[K] above (Rhubarb licence, Imagen status, Europeana/LoC API details, FLUX klein terms by size, Veo Lite i2v/reference support, Hedra and Sync on flat cartoons, Rive per-frame control in Remotion).

Legal note (one line, per owner decision): the platform assumes no legal responsibility; copyright, trademark, likeness, AI-disclosure and provider-ToS compliance rest with the org/user and its registered providers, and the platform only stores source/licence/provenance as plain data they can act on.

---

## 7. Open design questions for the product owner (recommended answer in brackets)

1. Library scope: per-org only? [Yes; connector picks are copied into the org library with their `source` data.]
2. Review step: should assets go straight to `Ready` or wait for a person? [Straight to `Ready`; an org switch adds a `NeedsReview` state.]
3. May the brand kit restyle Vox (colours, fonts)? [No: logo, watermark, mascot, intro/outro, music bed and one accent tone role only; the two-styles rule stays.]
4. Catalog size: whole library or retrieval-selected menu? [Retrieval menu of 40-60 plus brand rows, with an explicit "no good match" outcome that triggers a Researcher need.]
5. Open `need`s for outside photos or library ids only? [Both, with a code-drawn fallback shot.]
6. Credits: should the platform produce them? [Provide the credits export tool; the Publisher appends it only if the org enables it. Nothing validates it.]
7. Which providers ship built in? [Image gen: Recraft + Nano Banana first, then OpenAI, Ideogram, FLUX. Stock: Wikimedia, Smithsonian, NASA, Pexels. Logos: Brandfetch. Plus the generic custom adapter.]
8. Image-to-video in v1? [No; ship the rig first, add Veo Lite/Fast as an opt-in tier after an in-house character-sheet test.]
9. Rig v1 scope? [Parametric bean body, 9 viseme mouths, about 8 eyes, 7 brows, 6 motions, 3 stages, one original house cast, plus a mascot-from-upload path.]
10. Rive and Lottie? [Lottie in v1; Rive only after per-frame control is proven in the sandbox.]
11. Lip-sync? [CMUdict + word timestamps by default; Rhubarb optional after a licence read and an A/B on 5 clips.]
12. Depth/cut-out compute? [Self-hosted at ingest with pinned checkpoints, with a status flag.]
13. Budget exhausted mid-video? [Downgrade per beat via fallback table, notify, never fail.]
14. Custom provider adapter: allow orgs to register arbitrary HTTP APIs? [Yes, with response validated against the shared schema at the edge and the key kept in the Vault.]
15. Optional user filters over `source` (for example exclude by licence name or by `expiresAt`): offer them? [Yes, as org preferences applied by the menu builder, not as platform policy.]

## Sources read this session (primary)

- Gemini image models/pricing: https://aistudio.google.com/docs/pricing and https://aistudio.google.com/docs/image-generation
- Recraft pricing: https://www.recraft.ai/docs/api-reference/pricing.md
- OpenAI pricing: https://developers.openai.com/api/docs/pricing; transparent-background post: https://community.openai.com/t/transparent-backgrounds-are-now-available-in-preview-for-gpt-image-2-in-the-api/1391541/5
- Ideogram pricing: http://ideogram.ai/pricing/?pricing_tab=api
- FLUX pricing summary: https://developer.puter.com/tutorials/flux-api-pricing/
- Rhubarb: https://github.com/DanielSWolf/rhubarb-lip-sync (LICENSE text not read)
- Remotion Rive: https://www.remotion.dev/docs/rive/remotionrivecanvas
- Creator Handbook on OverSimplified: https://www.creatorhandbook.net/oversimplified-a-youtube-empire/
- Search-summary only (not opened): Veo/Kling/Runway price comparisons, Hedra/Sync, Brandfetch/logo.dev, Smithsonian, NASA guidelines, Pexels/Unsplash terms, Depth Anything V3 and BiRefNet licence variants, Qwen-Image-Layered.

# AI & Remotion Worker (`backend/worker-agents/`)

A **Bun (TypeScript)** background worker service that runs every harness (system prompt + tools + LLM call; see the root `AGENTS.md` §3), the tools they call, and Remotion video rendering.

## What It Does

- Consumes durable jobs from Redis dispatched by `backend/core/` and streams live stdout/progress logs back via Redis Pub/Sub.
- **Capability-typed provider layer (`providers.ts`):** routes each harness and tool to its configured key and an eligible model:
  - `llm_text` / `llm_code`: Anthropic Claude, OpenAI, Google Gemini.
  - `tts`: Gemini TTS (`gemini-3.8-flash-tts`), ElevenLabs (`/with-timestamps`), Google Cloud TTS, OpenAI TTS.
  - `search`: Claude's server-side `web_search` tool (on the Anthropic key).
  - `publish`: YouTube Data API v3, Ayrshare / Upload-Post API.
  - `image_gen`: pluggable image providers in `src/assets/image-gen.ts` (Nano Banana via the Gemini Interactions API, Recraft); models, outputs, reference limits and prices are data in `shared/model-registry.json`.
  - **Retries (`retry.ts`):** every provider call goes through one `withRetry` + `fetchBody`. `RETRY_POLICY` lists what is retried (HTTP 429/500/502/503/504/529, socket errors, idle timeouts, a stream cut before its `stop_reason`, mid-stream `overloaded_error`/`api_error`); anything else (400/401/403/404, bad JSON, `refusal`/`max_tokens`/`pause_turn`) fails at once. Backoff is exponential with full jitter (base 1 s, cap 30 s, 4 attempts, 120 s total wait); `retry-after-ms`/`retry-after` win over the computed wait. Every retry logs `[retry] <provider> attempt n/4 failed (<cause>); waiting <ms> ms`; the final error lists every attempt. Idle timeouts: 90 s with no bytes on the Anthropic stream, 10 min on non-streamed replies. Billing: a retried HTTP error bills nothing; a dropped stream's last reported usage is added to the reply's usage (output tokens only arrive in `message_delta`, so a stream cut before it counts input only, a lower bound).
- **Pipeline harnesses** (each has a live test; outputs pipe into the next):
  1. **Scout:** uses the web search tool to find and rank topics.
  2. **Screenplay:** writes a validated beat sheet (`src/vox/`); every rule violation is fed back for a targeted fix. Pauses at `NeedsApproval`.
  3. **Voiceover:** TTS of the locked narration, plus a word-alignment tool for exact word timestamps.
  4. **Animation:** compiles the beat sheet into a word-synced timeline, renders it with the hand-written style widgets (Vox now, 3Blue1Brown via `worker-manim`), audits every frame, and repairs only failing beats. The LLM never writes animation code. Maps work anywhere in the world: the model names places, code resolves them against a baked gazetteer and draws Natural Earth, us-atlas or Cliopatria (historical) borders; the input takes the org's `worldview`, the output lists the datasets drawn (`sources`) for the Publisher (see `src/vox/README.md` "World maps").
  5. **Compiler:** muxes audio and burns word captions with FFmpeg for `16:9` and `9:16`.
  6. **Publisher:** prepares metadata, waits for sign-off, publishes, and syncs stats.
- **Asset Generation harness + Asset Storage tool** (off the video pipeline; see Assets below).
- **Architect harness:** builds status flags and tools, and harnesses only as admin-approved compositions of existing tools (root `AGENTS.md` §3).

## Why It's Here

TypeScript/Bun is the native ecosystem for Remotion, Zod structured outputs, and modern AI SDKs. Running this as a thin worker decoupled from `backend/core/` keeps the Zig control plane fast and crash-isolated from Chromium/FFmpeg rendering.

## Harnesses (`src/harness/`)

Every harness implements one contract (`src/harness/contract.ts`) and is listed in `HARNESSES` (`src/harness/registry.ts`): `scout`, `screenplay`, `repair`, `voiceover` (tool-only stage), `animation`, `asset`. Each run returns `Done | Failed` plus a resumable session. See [`src/harness/README.md`](src/harness/README.md).

## Assets (`src/assets/`, `src/harness/asset.ts`)

- **Asset Generation harness** (`asset`): input `{ requests, budgetUsd (default 5), outDir }`; each request = `{ id, kind: character_sheet | expression_grid | part | prop | icon | logo | illustration, description, refs: [{ assetId } | { path }], output?: raster | transparent | vector, aspect?, resolution (1K default), tags }`. Code builds a closed menu of registry models a configured provider can serve (output need, resolution, reference count), cheapest first; the LLM picks one row and writes the provider-ready prompt from the kind's rule (`KIND_RULES`), up to 3 attempts with violations fed back. The `imageGen` edge generates; every image call is recorded in the session with its actual cost (`role: 'image'`), so checkpoint spend includes it. The budget is shown to the model as planning data; code never refuses for budget. Resume keeps finished requests.
- **Providers** (`src/assets/image-gen.ts`): `ProviderSpec` rows are parsed from `shared/model-registry.json` (`image_gen` models with `outputs`, `resolutions`, `max_refs`, `synthid`, `good_for`, `price` per image or per 1M tokens). One adapter per provider (`IMAGE_ADAPTERS`), each through `requestJson` → `withRetry`/`fetchBody`. Nano Banana (`gemini-nano-banana-2.1`, `gemini-3-pro-image`) returns JPEG only (the API rejects `image/png`) with C2PA embedded and SynthID; cost comes from the reply's token usage. Recraft (`recraftv4_1_vector` SVG, `recraftv4_1_flash_v2` PNG) is priced per image. Add a provider = registry rows + one adapter row + a `KEY_ENV` row in `src/harness/env.ts`.
- **Asset Storage tool** (`src/assets/store.ts`, no LLM): `ingestAsset(store, draft)` hashes the bytes (sha256; id `asset_<sha16>`), dedups (same bytes → the existing record, unless it is `Failed`, which is reprocessed), writes the blob and a record, then runs the lifecycle `Uploaded → Processing → Ready | Failed` (media probe: PNG/JPEG size and alpha, SVG); `Ready ↔ Archived` via `updateAssetStatus`. Every move is a row in `ASSET_TRANSITIONS`; anything else throws. `source` (origin, provider, generator model / prompt hash / cost, licence and credit fields as reported, retrievedAt, flags like `ai_generated`, `c2pa`, `synthId`) is plain data; nothing branches on it. Original bytes are stored untouched (embedded C2PA survives); a separate manifest becomes its own blob. `localAssetStore(.assets/)` (gitignored) now; a Drive/S3 store implements the same four methods over `src/storage.ts` later.
- Live: `bun run test:live asset` generates a Nano Banana expression grid (plus a Recraft vector icon when `RECRAFT_API_KEY` is set), stores it in `.assets/`, and copies it to `~/Downloads/asset-spike/`.

## Checkpoints and spend (`src/checkpoint.ts`)

The runner, not the harness, takes a checkpoint after every stage: `runStage({ store, ctx, harness, input, edges, force? })`.

- **Input hash:** the input JSON (keys sorted), harness id, system prompt, tools, model config, and the contents of the files the harness declares in `inputFiles` (animation: the voiceover audio).
- **Decision:** matching `Done` → `Reuse` (no call); matching `Failed` → `Resume` with the saved session; otherwise `Fresh` (`NoCheckpoint`, `InputChanged`, or `Forced` when `force` is set). A rerun upstream that changes its output changes every later stage's hash, so the downstream stages rerun; an identical output keeps them.
- **Corrupt checkpoints fail loud** (bad JSON, bad shape, wrong stage, an output the stage schema rejects), also when forced; inspect or delete the file. Writes go through a rename, so a crash never leaves half a file.
- **Store:** `CheckpointStore` (`read`, `write`, `stages`, `mediaPath`) holds bytes only; `localCheckpointStore(RUNS_DIR)` is `.runs/<runId>/<stage>.json`. Postgres/Drive is a second implementation later.
- **Spend:** each checkpoint's `spentUsd` is everything the stage spent in this run, all attempts included: LLM usage from `computeLlmCost`, image calls at the adapter's actual cost, TTS by audio seconds (`TTS_USD_PER_AUDIO_SEC` in `src/harness/spend.ts`; a TTS model without a price fails before the call). `runSpend(store, ctx)` gives the run total per stage against `ctx.budgetUsd`.
- **Budget:** `RunContextSchema` = `{ runId, budgetUsd }`, `budgetUsd` default `DEFAULT_BUDGET_USD` (5 USD per video), an org/user setting piped in for harnesses that plan against it. There are no hard-coded spend caps; `guardrails.ts` takes its daily limits as parameters.
- Not hashed: edge implementations (e.g. `VIDEO_CODEC`); force the stage after changing one.

## Tests

**Unit tests** (no network, no keys; fakes are injected at the I/O edge):

```sh
bun test
bun run typecheck
```

**Live tests** call real APIs and **cost money**. Each harness has `src/harness/<id>.live.test.ts`. They are skipped unless `LIVE=1`; the `test:live` script sets it and loads the repo root `.env`:

```sh
bun run test:live              # providers smoke, then scout → screenplay → repair → voiceover → animation
bun run test:live providers    # cheapest check: one streamed reply + one web_search
bun run test:live scout        # only that harness
```

Live tests are one checkpointed run (see Checkpoints below) in `backend/worker-agents/.runs/<LIVE_RUN>/` (gitignored): each stage writes `<id>.json` (output, session, input hash, spend) plus its media (`voiceover.wav`, `animation.mp4`), and the next stage reads it. A stage runs alone as long as the stage before it has a `Done` checkpoint there. Rerunning reuses every stage whose input is unchanged, so no paid call repeats; each stage logs whether it was reused, resumed or run fresh, and the run's spend against its budget.

| Variable (repo root `.env`) | Needed by | Notes |
|---|---|---|
| `ANTHROPIC_TEST_API_KEY` (or `ANTHROPIC_API_KEY`) | providers, scout, screenplay, repair, animation | |
| `GEMINI_API_KEY` | voiceover | Gemini TTS `gemini-3.8-flash-tts`, voice Puck |
| `ALIGN_PYTHON` | voiceover | optional; defaults to `.venv-align/bin/python` (see Word alignment below); `ffmpeg` on `PATH` |
| `VIDEO_CODEC` | animation | `libx264` (default) or `libopenh264` (Fedora's FFmpeg has no libx264) |
| `LIVE_MODEL`, `LIVE_EFFORT` | LLM harnesses | default `claude-opus-5-5`, `high` (`low`…`max`) |
| `LIVE_NICHE` | scout | the niche to scout |
| `LIVE_TOPIC` | screenplay | pin the topic instead of reading the top scouted one |
| `LIVE_RUN` | every stage | run id, default `live` (`.runs/<id>/`); a new id starts a clean run |
| `LIVE_FORCE` | every stage | comma list of stages to rerun despite a matching checkpoint, e.g. `screenplay,voiceover` |
| `LIVE_BUDGET_USD` | every stage | the run's budget, default `5`; reported, never enforced |

A missing key or tool fails the test before any request is sent. Key values are never printed.

## Word alignment

Gemini TTS returns no word timestamps, so the Voiceover stage aligns words with faster-whisper (`scripts/align_words.py`, model `small.en`, CPU). One-time setup, pinned:

```sh
python3 -m venv .venv-align && .venv-align/bin/pip install -r scripts/requirements-align.txt
```

The first run downloads the whisper model (~470 MB) into the Hugging Face cache.


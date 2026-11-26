# TODO — Backend (`backend/core`, `backend/db`, `backend/mcp`, `backend/worker-agents`, `backend/worker-manim`)

All backend code must follow `caveman-code` guidelines (explicit state transitions, fail-loud validation at boundaries, zero hidden global state).

## Phase 1: Database Schema (`backend/db/`)
- [x] Write initial SQL migration (`migrations/0001_init.sql`), idempotent dev seed (`migrations/0002_seed_dev.sql`), and migration runner (`migrate.sh`).
- [ ] Install & configure non-containerized PostgreSQL on dev/prod VM and run `./backend/db/migrate.sh`.

## Phase 2: Anole Core Control Plane (`backend/core/` — Zig 0.17.x)
- [x] Initialize Zig 0.17 project with `xuckless/Anole` v0.6.1 (`.profile = .web`, `.redis = true`, `.sqlite = false`).
- [x] Implement Self-Auth & RBAC (`org:admin`, `org:manager`, Argon2id, XChaCha20-Poly1305 sealed cookie sessions, `GET /api/auth/csrf`, `anole.middleware.Cors`).
- [x] Implement AES-256-GCM Encrypted Org Key Vault (`vault.zig`, `/api/vault` admin CRUD + `/api/internal/vault/decrypt` worker-only endpoint).
- [x] Implement Model Capability Validator (`domain.zig`, `POST /api/nodes/:id/validate-model`), Yjs WebSocket room relay (`GET /ws/board/:workspace_id`), SSE event hub (`GET /api/events/:workspace_id`), Pipeline Run & Approval endpoints, Admin-gated Widget endpoints, and `GET /api/topics/made`.
- [x] Wire optional `server.postgres(.{})` (`DATABASE_URL`) and `server.redis(.{})` (`REDIS_URL`, `LPUSH creatorstudio:jobs:agents`).
- [ ] Replace remaining in-memory dev maps in `main.zig` with live SQL queries when `state.db != null`.
- [ ] Add HTTP/3 WebTransport listener once production TLS certs are configured.
- [ ] Configure optional Anole `-Dlambda` build target for Google Cloud Run burst workloads if needed.

## Phase 3: Internal MCP Servers & Skills (`backend/mcp/`, `shared/skills/`)
- [x] Create lean `SKILL.md` library (`design-system`, `social-connectors`, `publisher-pipeline`, `aggregator-scheduler`) + progressive-disclosure skill router (`skills.ts`).
- [x] Build in-process scoped JSON-RPC 2.0 MCP router (`backend/mcp/src/registry.ts`) across `mcp-studio-board`, `mcp-org-connectors`, `mcp-social-analytics`, and `mcp-media-storage` with component write-ownership guards.

## Phase 4: Bun AI, Architect & Remotion Worker (`backend/worker-agents/` — TypeScript)
- [x] Implement capability-typed multimodal Provider Adapters (`providers.ts`), Scout + Auto-Scheduler (`scheduler.ts`), Screenplay (`gate | auto`), Voiceover (`/with-timestamps`), Remotion primitives + composition runner (`remotion/runner.ts`), Burned-In Captions ASS engine (`remotion/captions.ts`), and FFmpeg 16:9 / 9:16 Compiler (`compiler.ts`).
- [x] Implement multimodal Architect Agent (`clarify` | `plan` | `edit`), `POST /api/architect/turn`, executable MCP-backed `WidgetPipelineRegistry` + `/api/widgets/:slug/data` & `/refresh` endpoints (`widget-runtime.ts`, `architect-http.ts`).
- [x] Implement Publisher Agent (`gate | scheduled | auto`), YouTube Data API v3 + Ayrshare adapters, YouTube analytics poller (`analytics.ts`), Google Drive OAuth2 / Org Vault storage (`storage.ts`), HTTP Byte Range + LRU media cache (`media-cache.ts`), Spend Guardrails (`guardrails.ts`), and `Bun.RedisClient` consumer daemon (`daemon.ts`).

## Phase 5: Manim CE Worker (`backend/worker-manim/` — Python)
- [x] Build AST static safety sandbox (`sandbox.py`), native `16:9`/`9:16` transparent renderer + standalone ASS caption burn + POSIX `rlimit` CPU/memory isolation (`worker.py`), Redis job daemon + 15s health heartbeat publisher (`daemon.py`), and unit tests (`tests/test_worker.py`).
- [ ] Install Manim CE + Cairo/Pango/LaTeX system deps in local/VM `.venv`.

## Phase 7: Harness Contract & Live Tests (ROADMAP M24, current)
- [x] 0. Shared harness contract + `bun run test:live <harness>` (keys from env; no Vault/DB/frontend).
- [x] 1. Sandbox renders at the timeline's real size (9:16 bug).
- [x] 2. Short rules: 60 s / ~130–160 words, beats ≤12 words, no sources, mid-screen word captions.
- [x] 3. Constant motion: kinetic type, living numbers/charts, diagram shots, no hard cuts, frozen-frame audit.
- [x] Live-test one by one: Scout (Claude `web_search`) → Screenplay → Voiceover (Gemini TTS + alignment) → Animation.
- [x] Retries with backoff on every provider call (`retry.ts`: `RETRY_POLICY` table, full jitter, `retry-after`, idle timeouts, dropped-stream retry with usage kept).
- [x] Per-stage checkpoints (`src/checkpoint.ts`): each stage saves output + input hash (input JSON, harness id, system prompt, tools, model config, input file contents) under `.runs/<runId>/<stage>.json`; a matching `Done` is reused, a matching `Failed` resumes with its session, a change reruns that stage and everything it changes downstream; `force` is explicit; a corrupt checkpoint fails loud. Live tests run as one checkpointed run (`LIVE_RUN`, `LIVE_FORCE`, `LIVE_BUDGET_USD`).
- [x] Spend per stage in its checkpoint (LLM usage + TTS by audio seconds, every attempt counted); `budgetUsd` on the run context (default $5/video), reported by `runSpend`, no hard-coded caps.
- [ ] Move checkpoints to Postgres/Drive behind the same `CheckpointStore` interface; decide who may run one `runId` at a time (no locking yet).
- [ ] Move `TTS_USD_PER_AUDIO_SEC` (`src/harness/spend.ts`) next to `MODEL_PRICING_USD_PER_M` in `providers.ts`; drop the now-unused `runLive`/`readLive`/`LIVE_DIR` from `src/harness/env.ts`.
- [ ] Same retry policy for the non-provider fetch edges (`connectors/*`, `storage.ts`, `agents/publisher.ts`, `analytics.ts`).
- [ ] 3Blue1Brown Manim scene catalog; install Manim CE + Cairo/Pango/LaTeX.
- [ ] 9:16 sizing pass: chain, units and timeline use ~⅓ of the phone frame with tiny labels; scale diagrams/pictograms to fill the stage.
- [ ] Wrap Architect and Publisher in the harness contract (they still pass keys to `callLlm` directly).
- [ ] Publisher: expose each asset's source/licence metadata (e.g. map data "Ancient World Mapping Center", ODbL) as data the user may add to the description. The user decides; the platform never enforces it.
- [ ] Publisher: offer the platform's disclosure fields (e.g. YouTube "altered or synthetic content") as user-set options, prefilled from provenance data (the TTS C2PA manifest is kept as `<audio>.c2pa`). The user decides and is responsible.
- [ ] Remove serpapi/exa/tavily from `shared/model-registry.json` (their code is gone) and any frontend selectors for them.
- [x] Remove the old free-form path (`agents/animation.ts`, `remotion/theme-widgets.tsx`, storyboard `agents/screenplay.ts`/`voiceover.ts`) once its replacements pass live tests.

## Phase 8: Range: Tone, Shots, Units, World Map, Assets (M25, decided 2026-11-25)
Research: `docs/research/research-tone-shots.md`, `research-maps-units.md`, `research-assets.md`. Order: tone → shots → units → world map → assets → 3Blue1Brown (inherits the Vox screenplay and engine work).
- [ ] Gemini TTS style spike → single Interactions path (`speech_metadata.style`, code-inserted vocal tags; no silent fallback; alignment coverage detects leaked instructions).
- [x] Tone (`Register` in code, "Tone" in UI): documentary (default), deadpan, comedic, hype, wholesome, dramatic as one data table (prompt rules, voice, style, words/sec, motion scale/overshoot, push, transitions, grade tint, caption style, SFX). Same Vox fonts/layouts; dramatic gets ink paper. Satire allowed in comedic. One tone per video; `resolveStyle(format, register)`. Built: `src/vox/register.ts` (`REGISTERS`), previews in ~/Downloads/tone-preview/.
- [x] Audio: procedural FFmpeg SFX per tone, ducked under voice. Music (CC0 loops) later.
- [x] Shots batch 1: punch, ranking/countdown, versus (winner computed in code), checklist/myth-fact, chat. Built: schema + rules (`ranking_unit`, `ranking_values`, `versus_fit`, list shots in `cues_in_order` / `number_matches_speech` / `unit_sign`), `src/vox/rows.ts` (standings + geometry), widgets in `VoxVideo.tsx`, punch feel per register (`motion.punch`), 9:16 sizing as layout data (icon pictogram grid, line labels/end value, quote attribution, title sub); previews in ~/Downloads/shots-preview/.
- [ ] World-map pins (map work); 9:16 map label size (`LABEL_FONT_PX` 28 px) still under 48 px.
- [x] Units: "trillion" in alignment; UnitSpec rows (money usd/eur/gbp/jpy/cny/inr, length, area, mass, speed, duration, temperature, energy, power, data, density, volume, one-in-N); `number_matches_speech`, `compare_same_dimension`; rename shot `units` → `pictogram` with Phosphor + game-icons icons; USD/GBP same-currency inflation from baked tables, base year shown.
- [ ] Units follow-ups: decide the licence questions on the baked price data (USD 1800-1912 comes from the Minneapolis Fed page, whose disclaimer says "research and informational purposes"; GBP uses ONS CDKO (OGL v3) because the Bank of England millennium dataset is a website resource licensed for non-commercial use only, which would also give GBP back to 1209 with permission); USD 2025 once BLS publishes an annual average without October 2025.
- [x] World map: Natural Earth 5.x (worldview = org setting, default ISO; disputed areas hatched), us-atlas, Cliopatria historical snapshots (~50-60 years, era names), places resolved from names/ISO codes in code (violations list nearest candidates); per-sheet pruned GeoScene; 9:16 hemisphere/region crops now, globe later. Built: `src/vox/places.ts` (resolver, `knownPlaces`), `geo.ts` (`compileMaps`, `PROJECTION_RULES`), packs from `scripts/geo-build.ts` (~5.6 MB), map pins; previews and benchmark via `bun scripts/map-preview.ts` (~/Downloads/map-preview/).
- [ ] World map follow-ups: pin the sha256 of the other NE worldviews and wire the org setting from Postgres into the animation input; validate places against an AlbersUsa world (a non-US place there fails at compile, not in the screenplay loop); cross-fade historical borders when a world changes snapshot (they swap at the beat boundary today); orthographic globe for 9:16 (P4); Publisher: show `sources` from the animation output.
- [ ] Assets: an **Asset Generation harness** (Recraft for vector parts/icons/logos, Nano Banana for character sheets; pluggable providers via `ProviderSpec` + custom HTTP adapter, models/prices in `shared/model-registry.json`) piping into an **Asset Storage tool** (Drive/S3 bytes + metadata + `source` provenance as plain data). Connectors: Wikimedia Commons, Pexels/Pixabay, Smithsonian/NASA/LoC, Brandfetch.
  - [x] `asset` harness (`src/harness/asset.ts`): closed model menu per request → LLM picks + writes the provider prompt → `imageGen` edge; budget is a planning input only; live test (`bun run test:live asset`, Nano Banana expression grid ≈ $0.05).
  - [x] `ProviderSpec` from `shared/model-registry.json` (`image_gen` capability) + Nano Banana (Interactions API, JPEG + embedded C2PA, token-priced) and Recraft (SVG/PNG, per-image) adapters (`src/assets/image-gen.ts`). Recraft is unit-tested only until `RECRAFT_API_KEY` exists; its vector model id `recraftv4_1_vector` follows Recraft's naming but was not listed verbatim in its docs.
  - [x] Asset Storage tool (`src/assets/store.ts`): sha256 content addressing + dedup, `ASSET_TRANSITIONS` lifecycle, media probe, `source` provenance as data, local `.assets/` store.
  - [ ] Drive/S3 `AssetStore` over `src/storage.ts`; Postgres `assets` table (`0003_assets.sql`); reference images for Recraft (`style_reference_urls`); generic custom HTTP provider adapter; stock/logo connectors; emit asset schemas into `shared/schemas/` (needs a row in `src/vox/schemas.ts`).
- [ ] Characters: coded SVG puppet rig (original kit inspired by the Oversimplified approach: simple body, swappable eyes/brows/9 viseme mouths, costume/prop slots, motion table); lip-sync from word timestamps; `cast` shot. Image-to-video later, opt-in.
- [ ] Budget: org/user setting (default $5/video) read by asset tiers; downgrade per beat, never fail on budget.

## Phase 6: Connectors Pack #1 & Long-Form Chunked Pipeline (M20–M21)
- [ ] Build Org Vault Connectors + MCP tools for **Reddit**, **X (Twitter)**, **Yahoo Finance**, **Pexels** (stock video/images), and **Freesound** (audio/music bed + `-24 LUFS` auto-ducking).
- [ ] Build **Long-Form Video Essay Pipeline (10–120 min)** using a linked-list `ChapterChunk` graph (`prevId`/`nextId`) for chunked screenplay, voiceover, animation, and FFmpeg concat.
- [ ] Implement **VM Capacity Preflight Gate** (`checkVmRenderCapacity`) returning a clear error if a render exceeds VM RAM/disk limits.

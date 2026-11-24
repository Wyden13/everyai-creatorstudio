# Roadmap — EveryAI CreatorStudio

Phased delivery plan from initial monorepo scaffold to full autonomous content production and dynamic AI board building.

---

## Milestone 0: Foundation, Contracts & UI Port (Weeks 1–2)
**Goal:** Working monorepo, strict cross-language contracts, and the copied `creator-studio` UI running cleanly on React 19 + Vite (and Tauri v2 shell).
- [x] Define `shared/` JSON Schemas: model capability registry, node/edge/workspace schema, pipeline storyboard schema, declarative widget schema, and event bus protocol.
- [x] Port `frontend/web/src/creator-studio/` from Preact to React 19 + Vite without losing any visual fidelity (`corners.ts`, `physics.ts`, `studio.css`, 4 node archetypes, Workspaces, History tabs).
- [x] Initialize `frontend/desktop/` Tauri v2 shell pointing to `frontend/web/`.
- [x] Bootstrap `backend/core/` (Anole Zig), `backend/db/` (PostgreSQL schema), `backend/worker-agents/` (Bun), and `backend/worker-manim/` (Python).

## Milestone 1: Auth, Org Vault & Real-Time Board Sync (Weeks 3–4)
**Goal:** Both partners log in with RBAC, store encrypted org API keys, and collaborate live on the same canvas.
- [x] Self-hosted Auth + RBAC (`org:admin`, `org:manager`) in Anole (`-Dauth`), Argon2id password verification, and XChaCha20-Poly1305 sealed cookie sessions.
- [x] Envelope-encrypted API Key Vault (`AES-256-GCM` with server master key + masked display hints); CRUD endpoints gated to `org:admin`.
- [x] Capability-typed Provider & Model Registry enforced in both `backend/core` and `frontend/web` Inspector (TTS strictly separated from LLM/Codegen).
- [x] Self-hosted Yjs sync over Anole WebSockets (`websocket.Rooms`) + explicit frontend `SyncState` client (`sync.ts`).
- [x] Server-to-board live status badges & streaming stdout/render log push via Anole SSE `Topics` (`/api/events/:workspace_id` + `/api/internal/events`).

## Milestone 2: Core Pipeline — Scout → Screenplay → Voiceover (Weeks 5–6)
**Goal:** End-to-end automated research, human-gated or auto-advancing script generation, and word-timestamped narration.
- [x] Durable pipeline run state machine & Anole endpoints (`POST /api/runs`, `GET /api/runs/:workspace_id`, `POST /api/runs/:run_id/approve`, `POST /api/internal/vault/decrypt`) in `backend/core/` and `backend/worker-agents/`.
- [x] **Trend Scout Agent:** SerpApi (Google Trends + News) + Exa.ai/Tavily adapters + deterministic velocity/novelty scorer.
- [x] **Screenplay Agent (`gate` | `auto` mode):** Structured Output Zod storyboard (`hook`, `scenes[]`, `narration`, `visual_directive`, `animation_engine`, `aspect_ratios`) using any eligible LLM (Claude / GPT / Gemini); pauses at `NeedsApproval` in `gate` mode or advances straight to Voiceover in `auto` mode.
- [x] **Voiceover Agent:** ElevenLabs `/with-timestamps` (character-to-word alignment) + Google Cloud TTS / OpenAI TTS support.
- [x] Frontend Screenplay **Approval gate / Auto** toggle wired cleanly in `store.ts` and `inspector.tsx`.

## Milestone 3: Programmatic Animation & Multi-Aspect Rendering (Weeks 7–9)
**Goal:** Automated 16:9 (YouTube) and 9:16 (Shorts/Reels/TikTok) video generation combining Remotion and Manim CE.
- [ ] Curated **Remotion** visual primitive library (Vox-style charts, map callouts, kinetic typography, data cards) with responsive `aspectRatio` layout props (`16:9` and `9:16` native layouts, never cropped).
- [ ] **Code-Based Animation Agent:** Generates validated Remotion TSX and/or Manim Python scenes locked to Voiceover word timestamps; self-heals on compile/render error (bounded retries).
- [ ] **`backend/worker-manim/` (Python):** Executes Manim CE renders, exports transparent/compositable clips, and reports live health/checks to the board's Manim **Status** node.
- [ ] **Compiler & Formatter Worker:** Composites Remotion + Manim clips + Voiceover audio + burned word-synced captions via Headless Chromium + FFmpeg; supports both local VM worker and optional Cloud Run / Anole Lambda burst rendering.
- [ ] History tab video player for 16:9 and 9:16 outputs + Tauri Rust local preview/waveform acceleration.

## Milestone 4: Dynamic AI Board Builder — Architect Agent (Weeks 10–11)
**Goal:** Natural-language prompt bar creates real server agents and custom board widgets safely.
- [ ] **Architect Agent** in `backend/worker-agents/` equipped with `create_agent_worker` and `create_board_widget` tools.
- [ ] **Tier 1 (Default — Safe):** Declarative JSON UI Spec rendered by `<DynamicBoardNode/>` (`metric_card`, `progress_bar`, `table`, `trigger_button`, `status_strip`, `list_aggregator`) bound to a backend polling/stream endpoint.
- [ ] **Tier 2 (Opt-in — Custom TSX):** Sandboxed TSX compiled in-browser via `esbuild-wasm` inside an isolated `<iframe sandbox="allow-scripts">` with strict postMessage bridge; gated behind `org:admin` approval before saving to the org board.
- [ ] Wire Architect ghost-node preview on the canvas to real deployment + rollback.

## Milestone 5: Publisher, Hardening & Production Ops (Week 12+)
**Goal:** One-click multi-platform publishing, observability, and rock-solid VM/hybrid operations.
- [ ] **Publisher Agent:** Auto-generates titles, descriptions, tags, and thumbnails; queues on the Publish view for 1-click sign-off or scheduled release.
- [ ] Integrations: **YouTube Data API v3** (long-form + Shorts) and **Ayrshare / Upload-Post API** (TikTok + Instagram Reels).
- [ ] Live post-publish stats synced back to Publisher History & Tracker widgets.
- [ ] Production hardening: Postgres automated backups, Redis persistence, rate-limit/cost guardrails, Tauri auto-updater, and performance profiling (Web Workers / OffscreenCanvas if board exceeds 100+ nodes).

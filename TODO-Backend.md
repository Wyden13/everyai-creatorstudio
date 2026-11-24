# TODO — Backend (`backend/core`, `backend/db`, `backend/worker-agents`, `backend/worker-manim`)

All backend code must follow `caveman-code` guidelines (explicit state transitions, fail-loud validation at boundaries, zero hidden global state).

## Phase 1: Database Schema (`backend/db/`)
- [x] Write initial SQL migration (`migrations/0001_init.sql`) covering `organizations`, `users`, `org_memberships`, `invites`, `sessions`, `org_secrets`, `workspaces`, `board_snapshots`, `custom_widgets`, `agent_definitions`, `pipeline_runs`, `run_steps`, `media_assets`, and `published_items`.
- [ ] Install & configure non-containerized PostgreSQL on dev/prod VM and apply `0001_init.sql`.
- [ ] Add migration runner script & idempotent seed script for initial Organization + Admin account.

## Phase 2: Anole Core Control Plane (`backend/core/` — Zig 0.17.x)
- [x] Initialize Zig 0.17 project with `xuckless/Anole` v0.6.1 (`.profile = .web`, `.redis = true`, `.sqlite = false`).
- [x] Implement Self-Auth & RBAC middleware (`org:admin`, `org:manager`, Argon2id password verification, XChaCha20-Poly1305 sealed cookie sessions).
- [x] Implement AES-256-GCM Encrypted Org Key Vault (`vault.zig`, `/api/vault` admin CRUD + `/api/internal/vault/decrypt` worker-only endpoint).
- [x] Implement Model Capability Validator (`domain.zig`, `POST /api/nodes/:id/validate-model`).
- [x] Implement Yjs WebSocket room relay (`GET /ws/board/:workspace_id` via `websocket.Rooms`).
- [x] Implement SSE Server-to-Board event push (`GET /api/events/:workspace_id` + `POST /api/internal/events` via `anole.sse.Topics`).
- [x] Implement Pipeline Run & Approval endpoints (`POST /api/runs`, `GET /api/runs/:workspace_id`, `POST /api/runs/:run_id/approve` with `gate | auto` mode) and Admin-gated Widget endpoints (`POST /api/widgets`, `POST /api/widgets/:widget_id/approve`).
- [ ] Replace in-memory dev maps in `main.zig` with real PostgreSQL queries via `app.postgres(.{})` (users, sessions, `org_secrets`, `workspaces`, `board_snapshots`, `pipeline_runs`, `custom_widgets`).
- [ ] Wire Redis Pub/Sub + durable job dispatch from Anole to `worker-agents` and `worker-manim`.
- [ ] Add CORS middleware + CSRF token enforcement on cookie-authenticated browser mutations.
- [ ] Add HTTP/3 WebTransport listener alongside WebSockets once TLS certs are configured.
- [ ] Implement Google Drive HTTP Range streaming proxy + small LRU disk cache in `backend/core/` so `<video>`/`<audio>` tags scrub cleanly.
- [ ] Configure optional Anole `-Dlambda` build target for Google Cloud Run burst workloads if needed.

## Phase 3: Bun AI & Remotion Worker (`backend/worker-agents/` — TypeScript)
- [x] Initialize Bun workspace with Zod schemas synced to `shared/` (`contracts.ts`).
- [x] Implement Capability-Typed Provider Adapter Layer (`providers.ts` — Anthropic, OpenAI, Gemini with multimodal image/file support; ElevenLabs `/with-timestamps`, Google Cloud TTS, OpenAI TTS; SerpApi, Exa, Tavily; YouTube Data API v3, Ayrshare).
- [x] Implement **Trend Scout Agent** (`agents/trend-scout.ts`), **Screenplay Agent** (`agents/screenplay.ts` with `gate | auto`), and **Voiceover Agent** (`agents/voiceover.ts`).
- [x] Build curated **Remotion** primitive catalog (`remotion/primitives.ts`), **Burned-In Captions** ASS karaoke engine (`remotion/captions.ts`), **Code-Based Animation Agent** (`agents/animation.ts`), and **FFmpeg 16:9 / 9:16 Compiler** (`compiler.ts`).
- [x] Implement **Architect Agent** (`agents/architect.ts`) with multimodal attachments, interactive MCQ `clarify` turns, `create_agent_worker`, and `create_board_widget`.
- [x] Implement **Publisher Agent** (`agents/publisher.ts` with `gate | scheduled | auto`), **Google Drive OAuth2 / S3 Storage** (`storage.ts`), and **Spend Guardrails** (`guardrails.ts`).
- [ ] Build persistent Redis job consumer daemon + heartbeat/cancellation loop + stdout log streamer back to Anole `/api/internal/events`.
- [ ] Add live HTTP endpoint (`POST /api/architect/turn`) bridging `frontend/web` Architect chats to `runArchitectTurn()`.
- [ ] Implement concrete React/Remotion primitive components + Headless Chromium `remotion render` runner feeding `compiler.ts`.
- [ ] Implement post-publish YouTube/Ayrshare analytics poller writing live metrics back to `published_items` & Tracker widgets.

## Phase 4: Manim CE Worker (`backend/worker-manim/` — Python)
- [x] Scaffold Python project (`pyproject.toml`), AST static safety sandbox (`src/sandbox.py`), native `16:9`/`9:16` transparent renderer + standalone ASS caption burn (`src/worker.py`), and unit tests (`tests/test_worker.py`).
- [ ] Install Manim CE + Cairo/Pango/LaTeX system deps in local/VM `.venv`.
- [ ] Implement Redis job consumer daemon for `manim_render` tasks + upload rendered clips to Google Drive/S3 + emit completion events.
- [ ] Harden Manim subprocess with OS-level memory/CPU `ulimit` / `rlimit` and network-namespace isolation.
- [ ] Run periodic health/self-check loop publishing heartbeats to `backend/core` for the board's **Manim Status** node.

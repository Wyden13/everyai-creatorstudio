# Roadmap — EveryAI CreatorStudio (M6+)

Active roadmap from **Milestone 6 onwards**, organized by **area of build** from all remaining undone items. Completed milestones **M0 → M5** are archived in [done-items/ROADMAP-M0-M5.md](done-items/ROADMAP-M0-M5.md).

---

## Milestone 6: Backend Persistence & Durable Queues (`backend/db`, `backend/core`, `backend/worker-*`)
**Area of Build:** Database, Core Control Plane & Worker Daemons
**Goal:** Wire non-containerized PostgreSQL + Redis durable queues, CORS/CSRF, and persistent worker daemons with heartbeats.
- [x] Added `backend/db/migrations/0002_seed_dev.sql` + `backend/db/migrate.sh` migration runner.
- [x] Wired optional `server.postgres(.{})` (`DATABASE_URL`) and `server.redis(.{})` (`REDIS_URL`, `LPUSH creatorstudio:jobs:agents`) + `anole.middleware.Cors` + `GET /api/auth/csrf` into `backend/core/src/main.zig`.
- [x] Built persistent Redis consumer daemons with explicit lifecycle state machines and live `/api/internal/events` status/heartbeat push in `backend/worker-agents/src/daemon.ts` (`Bun.RedisClient`) and `backend/worker-manim/src/daemon.py`.
- [ ] Run `backend/db/migrate.sh` against a live local/VM PostgreSQL instance and swap remaining in-memory dev maps in `main.zig` to SQL queries when `state.db != null`.

---

## Milestone 7: Frontend Live Integration & Multiplayer Sync (`frontend/web`)
**Area of Build:** Web UI, Auth/RBAC, Yjs Realtime & Pipeline Wiring
**Goal:** Wire real `backend/core` Auth/RBAC, encrypted Org Vault, live Yjs multiplayer & SSE status/logs.
- [x] Created typed `api.ts` client (`SessionState` union + `ROLE_GRANTS` RBAC table) and table-driven tests (`milestone7.test.ts`).
- [x] Wired Login / Sign-out / Session hydration (`/api/auth/me`, `/api/auth/login`, `/api/auth/logout`) and `org:admin` Vault encryption UI (`/api/vault`) in `org.tsx`.
- [x] Mounted `createWorkspaceSync()` (`sync.ts`) in `index.tsx` & `board.tsx` for live Yjs node position sync + SSE `node.log_chunk` and `worker.health_check` (Manim Status beats) updates.
- [x] Wired `dropTopic` in `store.ts` to sync with `POST /api/runs` when authenticated.
- [ ] Wire Yjs Awareness partner cursor (`#7CC8FF`) and real `<audio>` / `<video>` stream URLs in Voiceover & Animation History once M9 storage streaming is active.

---

## Milestone 8: Live Architect Execution & `esbuild-wasm` TSX Sandbox (`frontend/web`, `backend/worker-agents`)
**Area of Build:** Dynamic AI Board Builder
**Goal:** Connect "Architect chats" and the board prompt bar to live LLM turns with real image/file uploads and browser-compiled Admin-gated TSX widgets.
- [ ] Expose `POST /api/architect/turn` (multimodal base64 images/files + MCQ answers → `clarify` or `plan`) and connect `architect-chats.tsx` + `architect.tsx` to it.
- [ ] Lazy-load `esbuild-wasm` inside a Web Worker to compile Admin-approved `sandboxed_tsx` specs into `<SandboxedTsxFrame/>`.
- [ ] Complete security audit on the iframe sandbox (`sandbox="allow-scripts"`, no `allow-same-origin`, strict CSP, typed `postMessage` allowlist).

---

## Milestone 9: Real Remotion Renders, Manim Runtime & Drive Range Streaming (`backend/worker-agents`, `backend/worker-manim`, `backend/core`)
**Area of Build:** Video Rendering & Media Storage
**Goal:** Execute real end-to-end Headless Chromium Remotion + Manim CE video renders stored on your 5TB Google Drive with instant scrubbing.
- [ ] Implement concrete React/Remotion primitive components (`animated_chart`, `map_callout`, `kinetic_typography`, `data_card`) and a Headless Chromium `remotion render` runner feeding `compiler.ts`.
- [ ] Install Manim CE + Cairo/Pango/LaTeX in the `backend/worker-manim` `.venv`, add OS-level `rlimit`/network-namespace isolation, and upload rendered transparent clips to storage.
- [ ] Implement Google Drive HTTP Range streaming proxy + small LRU disk cache in `backend/core` (and benchmark scrubbing latency).
- [ ] Implement post-publish YouTube Data API v3 / Ayrshare analytics poller updating `published_items` and Tracker widgets.

---

## Milestone 10: Tauri v2 Native Desktop & Canvas Performance (`frontend/desktop`, `frontend/web`)
**Area of Build:** Desktop Shell & Client Performance
**Goal:** Unlock native Rust desktop acceleration and verify smooth performance at 100+ nodes.
- [ ] Implement Tauri Rust commands in `frontend/desktop/src-tauri/`: native audio waveform peak extraction, local media cache for offline scrubbing, and optional local FFmpeg frame-grab preview.
- [ ] Configure frameless graphite window chrome (`#0B0C0F`) and deep-link OAuth callbacks (YouTube / Google Drive).
- [ ] Profile React/Canvas frame times with 100+ nodes + active log streams; offload log ring-buffer parsing to Web Workers (and evaluate `OffscreenCanvas` only if main-thread frame time exceeds 8ms).

---

## Milestone 11: Production VM Deployment, TLS/HTTP3 & External Credentials (`deploy/`, Infra)
**Area of Build:** Infrastructure, Security & Ops (When Ready to Deploy)
**Goal:** Harden and deploy the full stack onto a single Linux VM (with optional Cloud Run burst).
- [ ] Provision Linux VM with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17, Bun + Chromium + FFmpeg, and Python 3.12 + Manim CE.
- [ ] Create `systemd` units (`creatorstudio-core`, `creatorstudio-worker-agents`, `creatorstudio-worker-manim`) and configure TLS certs for HTTP/3 + WebTransport.
- [ ] Configure production secrets (`VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`), Google Drive OAuth2 app, YouTube Data API v3 OAuth consent screen, and Ayrshare/Upload-Post account.
- [ ] Optional: configure Anole `-Dlambda` / Google Cloud Run burst render profile and add root `LICENSE`.

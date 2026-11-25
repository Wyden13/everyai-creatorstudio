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
**Goal:** Connect "Architect chats" to live multimodal LLM turns and browser-compiled Admin-gated TSX widgets.
- [x] Exposed `POST /api/architect/turn` (`backend/worker-agents/src/architect-http.ts`, `make dev-architect`) and connected `architect-chats.tsx` with real base64 image & text file uploads (with graceful offline fallback).
- [x] Integrated lazy-loaded `esbuild-wasm` Web Worker compiler (`tsx-sandbox.ts`) into `<SandboxedTsxFrame/>` (`dynamic-node.tsx`) with typed `postMessage` data bridge.
- [x] Enforced static TSX security audit + strict CSP `srcDoc` + `sandbox="allow-scripts"` (no `allow-same-origin`), verified by table-driven tests (`milestone8.test.ts`).

---

## Milestone 9: Real Remotion Renders, Manim Runtime & Drive Range Streaming (`backend/worker-agents`, `backend/worker-manim`, `backend/core`)
**Area of Build:** Video Rendering & Media Storage
**Goal:** Execute real end-to-end Headless Chromium Remotion + Manim CE video renders stored on your 5TB Google Drive with instant scrubbing.
- [x] Implemented concrete Remotion TSX composition generator & CLI render runner (`remotion/runner.ts`) supporting native `16:9` and `9:16` layouts.
- [x] Added POSIX `resource.setrlimit` CPU & memory caps (`build_rlimit_preexec`) to `backend/worker-manim/src/worker.py`.
- [x] Implemented RFC 7233 HTTP Byte Range parser + bounded `MediaLruCache` (`media-cache.ts`) and `fetchGoogleDriveRange()` (`storage.ts`).
- [x] Implemented post-publish YouTube Data API v3 analytics poller & normalizer (`analytics.ts`).

---

## Milestone 10: Tauri v2 Native Desktop & Canvas Performance (`frontend/desktop`, `frontend/web`)
**Area of Build:** Desktop Shell & Client Performance
**Goal:** Unlock native Rust desktop acceleration and verify smooth performance at 100+ nodes.
- [x] Implemented native Rust Tauri commands (`frontend/desktop/src-tauri/src/media.rs`, `lib.rs`): `extract_audio_waveform` (mono PCM peak extraction), `cache_media_bytes` (path-traversal-safe local disk cache), and `grab_video_frame` (local FFmpeg preview frame grab), plus typed `platform.ts` wrappers and `make dev-desktop`.
- [x] Configured graphite overlay window chrome (`#0B0C0F`, `titleBarStyle: "Overlay"`) in `tauri.conf.json`.
- [ ] Configure deep-link OAuth callbacks (YouTube / Google Drive) and profile 100+ node canvas frame times (evaluate Web Worker log parsing / `OffscreenCanvas` only if main-thread frame time exceeds 8ms).

---

## Milestone 11: Production VM Deployment, TLS/HTTP3 & External Credentials (`deploy/`, Infra)
**Area of Build:** Infrastructure, Security & Ops (When Ready to Deploy)
**Goal:** Harden and deploy the full stack onto a single Linux VM (with optional Cloud Run burst).
- [ ] Provision Linux VM with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17, Bun + Chromium + FFmpeg, and Python 3.12 + Manim CE.
- [ ] Create `systemd` units (`creatorstudio-core`, `creatorstudio-worker-agents`, `creatorstudio-worker-manim`) and configure TLS certs for HTTP/3 + WebTransport.
- [ ] Configure production secrets (`VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`), Google Drive OAuth2 app, YouTube Data API v3 OAuth consent screen, and Ayrshare/Upload-Post account.
- [ ] Optional: configure Anole `-Dlambda` / Google Cloud Run burst render profile and add root `LICENSE`.

---

## Milestone 12: Org-Level Connectors, Minimal `.env` & Live Drag Arrows (`frontend/web`, `backend/core`, `backend/worker-agents`)
**Area of Build:** Organization Vault, Social & Storage Connectors, Canvas UX
**Goal:** Offload all third-party API keys, social connectors, storage connectors, and tool credentials into the Organization Vault; keep `.env` strictly minimal for core app infrastructure; live-update connected arrows during GPU node dragging.
- [x] Live-updated connected SVG edges & arrows inside `requestAnimationFrame` during GPU node dragging (`board.tsx` `updateConnectedEdges`, zero React re-renders).
- [x] Trimmed `.env.example` to app-boot essentials only (`DATABASE_URL`, `REDIS_URL`, `VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`, `ANOLE_PORT`, plus optional test-only keys).
- [x] Created `shared/connectors.json` and upgraded `org.tsx` into categorized **Org Connectors** (**AI Providers**, **Social**, **Storage**, **Research & Tools**) backed by the encrypted Org Vault.
- [x] Added `resolveStorageConfigFromOrgVault()` and `fetchOrgVaultSecret()` in `backend/worker-agents/src/storage.ts` so storage credentials come from the Org Vault per-job instead of global `.env`.

---

## Milestone 13: Auto-Scheduling & Actionable Top Trends (`backend/core`, `backend/worker-agents`, `frontend/web`)
**Area of Build:** Scheduler & Aggregator Lifecycle
**Goal:** Make Trend Scout (and any scheduled node) run automatically on configurable intervals, dynamically adding fresh topics and pruning stale ones, while removing `"Made"` items from Top Trends.
- [x] Built declarative `ScheduleInterval` (`off | 15m | 30m | 2h | 6h | daily`) & `reconcileTopTrends()` in `backend/worker-agents/src/scheduler.ts` with table-driven tests (`milestone13.test.ts`).
- [x] Wired `scoutSchedule` auto-scheduling and dynamic add/prune Top Trends reconciliation into `store.ts`, `nodes.tsx`, and `inspector.tsx`.
- [x] Removed `"Made"` items from **Today's Top Trends** (`visibleTopTrends`) and exposed `GET /api/topics/made` in `backend/core/src/main.zig` (plus Architect support for building a *"Topics we made videos about"* widget on demand).

---

## Milestone 14: Component IDs, Right-Click Context Menu & Architect Component Editing (`frontend/web`, `backend/worker-agents`)
**Area of Build:** Board UX & Architect Agent Editing
**Goal:** Give every board component a copyable stable ID, add a frosted right-click context menu, and let the Architect Agent edit existing components in place.
- [x] Added canonical `componentCode(n)` (`cmp_<kind>_<id>`), `duplicateNode()`, and `deleteNode()` in `store.ts`, plus copyable ID badge in the Inspector header.
- [x] Added frosted-glass right-click context menu on every board node (`Copy component ID`, `Inspect`, `Edit with Architect`, `Duplicate`, `Delete`) in `board.tsx`.
- [x] Added `edit_board_component` (`kind: 'edit'`) to `ArchitectTurnSchema` in `backend/worker-agents/src/agents/architect.ts` (with capability validation & tests in `milestone14.test.ts`) and wired in-place board node editing in `architect-chats.tsx`.

---

## Milestone 15: Architect Skills Library — Design System, Social, Storage & Publisher (`shared/skills/`, `backend/worker-agents`)
**Area of Build:** Modular Agent Skills (Progressive Disclosure)
**Goal:** Move beyond a single monolithic system prompt by building composable, task-specific lean `SKILL.md` files that teach the Architect Agent *what*, *when*, and *how* to wire native-looking, fully functional components.
- [x] Created lean `SKILL.md` files with YAML frontmatter under `shared/skills/` (`design-system`, `social-connectors`, `publisher-pipeline`, `aggregator-scheduler`) + `shared/skills/README.md`.
- [x] Built declarative skill router (`backend/worker-agents/src/skills.ts`) and wired `loadSkillsContext()` directly into `runArchitectTurn()` (verified in `milestone15-16.test.ts`).

---

## Milestone 16: Internal MCP Server Layer for Agents (`backend/mcp/`)
**Area of Build:** Model Context Protocol Tooling
**Goal:** Wrap external APIs and internal studio operations behind in-process, typed JSON-RPC 2.0 MCP servers scoped by `(orgId, workspaceId, agentId, componentId)`.
- [x] Built `InProcessMcpRouter` and `createStudioMcpRouter()` in `backend/mcp/src/registry.ts` (plus `backend/mcp/README.md`) exposing `mcp-studio-board`, `mcp-org-connectors`, `mcp-social-analytics`, and `mcp-media-storage`.
- [x] Enforced component write-ownership guards (`-32003` rejection if a non-Architect agent attempts to mutate another component's ID), verified in `milestone15-16.test.ts`.

---

## Milestone 17: Live Executable Widget Pipelines & Data Binding (`backend/core`, `backend/worker-agents`, `frontend/web`)
**Area of Build:** End-to-End Runtime Wiring (UI + Backend + Org Data)
**Goal:** Ensure Architect-created components are live, executable, and backed by real Org data — never static UI mockups.
- [x] Built `WidgetPipelineRegistry` & `inferMcpToolForEndpoint()` (`backend/worker-agents/src/widget-runtime.ts`) binding Architect widgets to scoped in-process MCP tools with scheduled `tickDueWidgets()` polling.
- [x] Exposed `POST /api/widgets/register`, `GET /api/widgets/:slug/data`, and `POST /api/widgets/:slug/refresh` on `architect-http.ts`.
- [x] Added `<LiveDynamicBoardNode/>` in `frontend/web/src/creator-studio/dynamic-node.tsx` with explicit `'Idle' | 'Live' | 'Fallback'` polling state and manual refresh triggers.

---

## Milestone 18: End-to-End Architect Verification Harness (`tests/e2e/`)
**Area of Build:** Automated Quality & Contract Verification
**Goal:** Verify end-to-end that an LLM-generated component matches the design system, connects to real Org Vault credentials, executes live API/MCP tools, and supports in-place editing.
- [ ] Automated E2E test: Prompt Architect → MCQ clarify → generate YouTube Analytics tracker → verify design tokens & schema → verify live Org Connector binding → verify `/api/widgets/:slug/data` returns real payload → verify `<DynamicBoardNode/>` renders cleanly.
- [ ] Automated E2E test: Prompt Architect to **edit** an existing component by `cmp_*` ID → verify patch preserves untouched fields, obeys capability rules, and updates the live board state.

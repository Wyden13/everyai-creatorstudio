# Roadmap Archive — Milestones M6–M10 & M12–M17 (Completed)

Shelved copy of completed engineering milestones. Active remaining work lives in [../ROADMAP.md](../ROADMAP.md).

---

## Milestone 6: Backend Persistence & Durable Queues
- [x] Added `backend/db/migrations/0002_seed_dev.sql` + `backend/db/migrate.sh`.
- [x] Wired optional `server.postgres(.{})` (`DATABASE_URL`), `server.redis(.{})` (`REDIS_URL`, `LPUSH creatorstudio:jobs:agents`), `anole.middleware.Cors`, and `GET /api/auth/csrf` in `backend/core/src/main.zig`.
- [x] Built persistent Redis consumer daemons with explicit lifecycle state machines and live `/api/internal/events` status/heartbeat push in `backend/worker-agents/src/daemon.ts` and `backend/worker-manim/src/daemon.py`.

## Milestone 7: Frontend Live Integration & Multiplayer Sync
- [x] Created typed `api.ts` client (`SessionState` union + `ROLE_GRANTS` RBAC table) + `milestone7.test.ts`.
- [x] Wired Login / Sign-out / Session hydration and `org:admin` Vault encryption UI in `org.tsx`.
- [x] Mounted `createWorkspaceSync()` in `index.tsx` & `board.tsx` for live Yjs node position sync + SSE logs & Manim health beats.
- [x] Wired `dropTopic` in `store.ts` to sync with `POST /api/runs` when authenticated.

## Milestone 8: Live Architect Execution & `esbuild-wasm` TSX Sandbox
- [x] Exposed `POST /api/architect/turn` (`backend/worker-agents/src/architect-http.ts`, `make dev-architect`) and connected `architect-chats.tsx` with real base64 image & text file uploads.
- [x] Integrated lazy-loaded `esbuild-wasm@0.28.2` Web Worker compiler (`tsx-sandbox.ts`) into `<SandboxedTsxFrame/>` (`dynamic-node.tsx`) with typed `postMessage` bridge.
- [x] Enforced static TSX security audit + strict CSP `srcDoc` + `sandbox="allow-scripts"` (no `allow-same-origin`).

## Milestone 9: Real Remotion Renders, Manim Runtime & Drive Range Streaming
- [x] Implemented concrete Remotion TSX composition generator & CLI render runner (`remotion/runner.ts`) for native `16:9` and `9:16`.
- [x] Added POSIX `resource.setrlimit` CPU & memory caps (`build_rlimit_preexec`) to `backend/worker-manim/src/worker.py`.
- [x] Implemented RFC 7233 HTTP Byte Range parser + bounded `MediaLruCache` (`media-cache.ts`) and `fetchGoogleDriveRange()` (`storage.ts`).
- [x] Implemented post-publish YouTube Data API v3 analytics poller & normalizer (`analytics.ts`).

## Milestone 10: Tauri v2 Native Desktop Commands
- [x] Implemented native Rust Tauri commands (`frontend/desktop/src-tauri/src/media.rs`, `lib.rs`): `extract_audio_waveform`, `cache_media_bytes`, and `grab_video_frame`, plus typed `platform.ts` wrappers and `make dev-desktop`.
- [x] Configured graphite overlay window chrome (`#0B0C0F`, `titleBarStyle: "Overlay"`) in `tauri.conf.json`.

## Milestone 12: Org-Level Connectors, Minimal `.env` & Live Drag Arrows
- [x] Live-updated connected SVG edges & arrows inside `requestAnimationFrame` during GPU node dragging (`board.tsx` `updateConnectedEdges`).
- [x] Trimmed `.env.example` to core app infrastructure only.
- [x] Created `shared/connectors.json` and upgraded `org.tsx` into categorized **Org Connectors** (**AI Providers**, **Social**, **Storage**, **Research & Tools**) backed by the encrypted Org Vault.
- [x] Added `resolveStorageConfigFromOrgVault()` and `fetchOrgVaultSecret()` in `backend/worker-agents/src/storage.ts`.

## Milestone 13: Auto-Scheduling & Actionable Top Trends
- [x] Built declarative `ScheduleInterval` (`off | 15m | 30m | 2h | 6h | daily`) & `reconcileTopTrends()` in `backend/worker-agents/src/scheduler.ts`.
- [x] Wired `scoutSchedule` auto-scheduling and dynamic add/prune reconciliation into `store.ts`, `nodes.tsx`, and `inspector.tsx`.
- [x] Removed `"Made"` items from **Today's Top Trends** (`visibleTopTrends`) and exposed `GET /api/topics/made` in `backend/core/src/main.zig`.

## Milestone 14: Component IDs, Right-Click Context Menu & Architect Component Editing
- [x] Added canonical `componentCode(n)` (`cmp_<kind>_<id>`), `duplicateNode()`, `deleteNode()`, and copyable ID badge in Inspector header.
- [x] Added frosted-glass right-click context menu on every board node (`Copy component ID`, `Inspect`, `Edit with Architect`, `Duplicate`, `Delete`).
- [x] Added `edit_board_component` (`kind: 'edit'`) to `ArchitectTurnSchema` and wired in-place board node editing in `architect-chats.tsx`.

## Milestone 15: Architect Skills Library
- [x] Created lean `SKILL.md` files under `shared/skills/` (`design-system`, `social-connectors`, `publisher-pipeline`, `aggregator-scheduler`) + declarative skill router (`skills.ts`) wired into `runArchitectTurn()`.

## Milestone 16: In-Process Scoped MCP Tool Servers
- [x] Built `InProcessMcpRouter` & `createStudioMcpRouter()` (`backend/mcp/src/registry.ts`) across `mcp-studio-board`, `mcp-org-connectors`, `mcp-social-analytics`, and `mcp-media-storage` with `(orgId, workspaceId, agentId, componentId)` write-ownership guards.

## Milestone 17: Live Executable Widget Pipelines & Data Binding
- [x] Built `WidgetPipelineRegistry` & `inferMcpToolForEndpoint()` (`widget-runtime.ts`) + exposed `POST /api/widgets/register`, `GET /api/widgets/:slug/data`, and `POST /api/widgets/:slug/refresh` on `architect-http.ts`.
- [x] Added `<LiveDynamicBoardNode/>` in `frontend/web/src/creator-studio/dynamic-node.tsx` with explicit `'Idle' | 'Live' | 'Fallback'` polling state and manual refresh triggers.

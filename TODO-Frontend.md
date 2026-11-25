# TODO — Frontend (`frontend/web` & `frontend/desktop`)

All frontend code must follow `caveman-code` guidelines (declarative state, explicit discriminated-union state machines, no hidden side effects).

## Phase 1: Project Setup, React 19 Port & Canvas UX
- [x] Initialize `frontend/web/package.json` with React 19, Vite, TypeScript, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`.
- [x] Port `frontend/web/src/creator-studio/` from Preact to React 19 while preserving `board.tsx`, `physics.ts`, `corners.ts`, `studio.css`, and all 4 node archetypes (`Agent`, `Status`, `Tracker`, `Aggregator`).
- [x] Optimize drag, pan, resize, and topic-drag to GPU `translate3d` + `requestAnimationFrame` with live DOM SVG edge/arrow updates (`updateConnectedEdges`) and tree-shaken `simple-icons`.
- [x] Assign stable copyable Component IDs (`cmp_<kind>_<id>`) + frosted right-click context menu (`Copy ID`, `Inspect`, `Edit with Architect`, `Duplicate`, `Delete`).
- [ ] Replace remaining simulated fallback runs in `store.ts` once live Postgres + Redis workers are running locally.

## Phase 2: Tauri v2 Hybrid Desktop Shell (`frontend/desktop/`)
- [x] Scaffold Tauri v2 project in `frontend/desktop/` consuming `frontend/web/` build output and Vite dev server (`make dev-desktop`).
- [x] Detect runtime cleanly behind `platform.ts` with typed native command wrappers.
- [x] Implement Tauri Rust commands (`media.rs`, `lib.rs`): `desktop_health`, `extract_audio_waveform` (mono PCM peak extraction), `cache_media_bytes` (path-safe local cache), `grab_video_frame` (local FFmpeg frame grab).
- [x] Configure graphite overlay window chrome (`#0B0C0F`, `titleBarStyle: "Overlay"`).
- [ ] Configure deep-link OAuth callback handling (YouTube / Google Drive).

## Phase 3: Auth, Org Connectors & Capability-Typed Model Selector
- [x] Implement capability-filtered Model Selector in `inspector.tsx` reading `shared/model-registry.json` (`capabilities.ts`).
- [x] Build Sign-in / Sign-out / Session hydration flow (`api.ts`, `org.tsx`) and declarative `ROLE_GRANTS` RBAC (`org:admin` vs `org:manager`).
- [x] Upgrade `org.tsx` into categorized **Org Connectors** (**AI Providers**, **Social**, **Storage**, **Research & Tools**) driven by `shared/connectors.json` and encrypted via `/api/vault`.

## Phase 4: Real-Time Multiplayer Sync (Yjs + WebSocket / SSE)
- [x] Build explicit `SyncState` Yjs + SSE client (`sync.ts`) and mount `createWorkspaceSync()` in `index.tsx` & `board.tsx`.
- [x] Stream SSE `node.log_chunk` and `worker.health_check` (Manim Status beats) into `store.ts`.
- [ ] Wire Yjs Awareness protocol to live partner cursor (`#7CC8FF` ice cursor + active node selection ring).

## Phase 5: Pipeline Views, History & Media Players
- [x] Wire Screenplay **Approval gate / Auto** mode, Trend Scout **Auto-schedule** (`15m | 30m | 2h | Daily | Off`) + add/prune reconciliation, and remove `"Made"` items from **Today's Top Trends** (`visibleTopTrends`).
- [x] Add `<BurnedCaptionsOverlay/>` with `Violet Pop`, `Vox Clean`, and `Minimal Mono` presets to Animation History (`captions.tsx`, `history.tsx`).
- [x] Wire Publish **Approval gate / Scheduled / Auto** mode (`publish.tsx`) and sync `dropTopic` to `POST /api/runs` when authenticated.
- [ ] Wire **Voiceover History** to real `<audio>` Range streams synced to word timestamps and **Animation History** to real 16:9 / 9:16 `<video>` Range streams.

## Phase 6: Dynamic AI Board Builder (`architect.tsx`, `architect-chats.tsx`, `dynamic-node.tsx`)
- [x] Build `<DynamicBoardNode/>` + `<LiveDynamicBoardNode/>` (live `/api/widgets/:slug/data` polling & manual refresh trigger).
- [x] Build `<SandboxedTsxFrame/>` with lazy-loaded `esbuild-wasm@0.28.2` Web Worker compiler, static security audit, strict CSP `srcDoc`, and Admin approval gate.
- [x] Build **"Architect chats"** navbar category & multi-turn view (`architect-chats.tsx`) with Picture/File uploads, inline MCQ cards, live `/api/architect/turn` wiring, in-place `cmp_*` component editing, and 1-click deploy.

## Phase 7: Power-User UX & Performance (M22)
- [ ] Add Component Versioning (`v1`, `v2`, `v3`) + 1-click Rollback in Inspector.
- [ ] Add Board Undo/Redo stack (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`) and Keyboard Shortcuts + Command Palette (`Cmd/Ctrl+K`, `Shift+1` Fit board).
- [ ] Add Visual Edge Wiring (drag output port → input port with live bezier preview + right-click delete edge).
- [ ] Run autonomous Wubble Browser MCP verification against `UI_UX_TEST_PLAN.md`.
- [ ] Profile React/Canvas frame times with 100+ nodes and active log streams; offload log ring-buffer parsing to Web Workers (and evaluate `OffscreenCanvas` only if main-thread frame time exceeds 8ms).

# TODO — Frontend (`frontend/web` & `frontend/desktop`)

All frontend code must follow `caveman-code` guidelines (declarative state, explicit discriminated-union state machines, no hidden side effects).

## Phase 1: Project Setup & Preact → React 19 Port
- [x] Initialize `frontend/web/package.json` with React 19, Vite, TypeScript, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`.
- [x] Port `frontend/web/src/creator-studio/` from Preact (`preact/hooks`, `JSX`) to React 19 (`react`, `react-dom/client`) while preserving 100% of `board.tsx`, `physics.ts`, `corners.ts`, `studio.css`, and all 4 node archetypes (`Agent`, `Status`, `Tracker`, `Aggregator`).
- [x] Optimize drag, pan, resize, and topic-drag to GPU `translate3d` + `requestAnimationFrame` (zero React re-renders during drag/pan) and tree-shake `simple-icons` (5.6 MB → 346 kB).
- [ ] Replace fake `store.ts` simulated pipeline with live backend-hydrated state (`Idle | Queued | Running | NeedsApproval | Failed | Done`).

## Phase 2: Tauri v2 Hybrid Desktop Shell (`frontend/desktop/`)
- [x] Scaffold Tauri v2 project in `frontend/desktop/` consuming `frontend/web/` build output and Vite dev server.
- [x] Detect runtime (`getRuntimePlatform()`) cleanly behind a single platform adapter (`platform.ts`).
- [ ] Implement Tauri Rust commands:
  - [ ] Native audio waveform peak extraction (replaces heavy JS decoding in Voiceover History).
  - [ ] Local file caching & media download for instant offline scrubbing.
  - [ ] Optional local FFmpeg preview / frame grab helper.
- [ ] Configure Tauri window chrome (frameless/titlebar-overlay matching `#0B0C0F` graphite) and deep-link OAuth callback handling (YouTube / Google Drive).

## Phase 3: Auth, Org Settings & Capability-Typed Model Selector
- [x] Implement capability-filtered Model Selector in `inspector.tsx` reading `shared/model-registry.json` (`capabilities.ts`), strictly separating TTS from LLM/Codegen.
- [ ] Build Login / Org Invite / Session hydration flow against `backend/core/` (`/api/auth/login`, `/api/auth/me`).
- [ ] Enforce RBAC in UI cleanly (`org:admin` vs `org:manager` visibility & guards).
- [ ] Wire `org.tsx` Key Vault UI to encrypted `/api/vault` endpoints (write-only key entry, masked last-4 display, connection test button per provider).

## Phase 4: Real-Time Multiplayer Sync (Yjs + WebSocket / WebTransport)
- [x] Build explicit `SyncState` Yjs + SSE client (`sync.ts`) with table-driven state machine tests.
- [ ] Mount `createWorkspaceSync()` inside `board.tsx` / `store.ts` to bind live Workspaces, Nodes, and Edges to `backend/core` WebSocket rooms.
- [ ] Wire Yjs Awareness protocol to live partner cursor (`#7CC8FF` ice cursor + active node selection ring).
- [ ] Connect SSE server-pushed node status badges, queue counts ("2 up next"), and streaming stdout/render logs into `store.ts` and `inspector.tsx`.

## Phase 5: Pipeline Views, History & Media Players
- [x] Wire Screenplay **Approval gate / Auto** mode in `store.ts` and `inspector.tsx`.
- [x] Add `<BurnedCaptionsOverlay/>` with `Violet Pop`, `Vox Clean`, and `Minimal Mono` presets to Animation History (`captions.tsx`, `history.tsx`).
- [x] Wire Publish **Approval gate / Scheduled / Auto** mode in `store.ts` and `publish.tsx`.
- [ ] Wire **Today's Top Trends** (`topicdrag.tsx`) drop-on-Screenplay to real `POST /api/runs` endpoint.
- [ ] Wire **Screenplay Inspector** approve button to real `POST /api/runs/:run_id/approve` endpoint.
- [ ] Wire **Voiceover History** to real `<audio>` playback + word-level timestamp highlighting synced to `audio.currentTime`.
- [ ] Wire **Animation History** to real 16:9 / 9:16 `<video>` playback + optional `@remotion/player` live preview.
- [ ] Wire **Manim Status** node to live worker health checks from SSE events.
- [ ] Wire **Publish View** (`publish.tsx`) to real preview streams, 1-click YouTube/Ayrshare sign-off API, and live post-publish metrics.

## Phase 6: Dynamic AI Board Builder (`architect.tsx` & `architect-chats.tsx`)
- [x] Build `<DynamicBoardNode/>` renderer for Declarative JSON UI Spec (`dynamic-node.tsx`).
- [x] Build `<SandboxedTsxFrame/>` isolated `<iframe sandbox="allow-scripts">` with Admin approval gate (`dynamic-node.tsx`).
- [x] Build **"Architect chats"** navbar category & multi-turn view (`architect-chats.tsx`) with Picture/File attachments, inline MCQ cards, live preview, and 1-click deploy.
- [ ] Connect `architect-chats.tsx` and floating `architect.tsx` prompt bar to live backend `POST /api/architect/turn` endpoint (passing base64 images/files + MCQ answers).
- [ ] Integrate `esbuild-wasm` (lazy-loaded in a Web Worker) to compile Admin-approved TSX widgets on the fly into `<SandboxedTsxFrame/>` with typed `postMessage` bridge.

## Phase 7: Performance (As-Needed Profiling)
- [ ] Profile React/Canvas frame times with 100+ nodes and active log streams.
- [ ] Offload log ring-buffer parsing and `esbuild-wasm` compilation to Web Workers.
- [ ] Evaluate `OffscreenCanvas` for background grid/edge pulses only if main-thread frame time exceeds 8ms.

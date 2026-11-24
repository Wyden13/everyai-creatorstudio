# TODO — Frontend (`frontend/web` & `frontend/desktop`)

All frontend code must follow `caveman-code` guidelines (declarative state, explicit discriminated-union state machines, no hidden side effects).

## Phase 1: Project Setup & Preact → React 19 Port
- [ ] Initialize `frontend/web/package.json` with React 19, Vite, TypeScript, Tailwind (if needed alongside `studio.css`), `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`.
- [ ] Port `frontend/web/src/creator-studio/` from Preact (`preact/hooks`, `JSX`) to React 19 (`react`, `react-dom/client`) while preserving 100% of `board.tsx`, `physics.ts`, `corners.ts`, `studio.css`, and all 4 node archetypes (`Agent`, `Status`, `Tracker`, `Aggregator`).
- [ ] Replace fake `store.ts` simulated pipeline with an explicit state layer (explicit node lifecycle enum: `Idle | Queued | Running | NeedsApproval | Failed | Done`).
- [ ] Verify smooth 60fps drag, resize, rubber-band, continuous-corner clip/ring/beam, and frosted glass in Chrome/Firefox/WebKit.

## Phase 2: Tauri v2 Hybrid Desktop Shell (`frontend/desktop/`)
- [ ] Scaffold Tauri v2 project in `frontend/desktop/` consuming `frontend/web/` build output and Vite dev server.
- [ ] Detect runtime (`isTauri()`) cleanly behind a single platform adapter (`platform.ts`) so web builds degrade gracefully without conditional clutter across UI components.
- [ ] Implement Tauri Rust commands:
  - [ ] Native audio waveform peak extraction (replaces heavy JS decoding in Voiceover History).
  - [ ] Local file caching & media download for instant offline scrubbing.
  - [ ] Optional local FFmpeg preview / frame grab helper.
- [ ] Configure Tauri window chrome (frameless/titlebar-overlay matching `#0B0C0F` graphite) and deep-link OAuth callback handling (YouTube / Google Drive).

## Phase 3: Auth, Org Settings & Capability-Typed Model Selector
- [ ] Build Login / Org Invite / Session hydration flow against `backend/core/`.
- [ ] Enforce RBAC in UI cleanly:
  - [ ] `org:admin`: API Key Vault CRUD, billing/usage trackers, user invites, approving Architect custom TSX widgets.
  - [ ] `org:manager`: Board editing, triggering/approving runs, screenplay editing, prompting Architect.
- [ ] Wire `org.tsx` Key Vault UI to encrypted backend endpoints (write-only key entry, masked last-4 display, connection test button per provider).
- [ ] Implement capability-filtered Model Selector in `inspector.tsx`:
  - [ ] Reads eligible providers/models from `shared/model-registry.json` + configured org keys.
  - [ ] Strictly prevents invalid assignments (e.g., Voiceover node only shows TTS models: ElevenLabs, Google Cloud TTS, OpenAI TTS; Screenplay/Animation/Architect nodes only show eligible LLM/Codegen models).

## Phase 4: Real-Time Multiplayer Sync (Yjs + WebSocket / WebTransport)
- [ ] Integrate `yjs` document binding for Workspaces, Nodes (position, size, config), and Edges.
- [ ] Build custom Yjs provider connecting to Anole WebSocket endpoint (with WebTransport transport adapter when supported).
- [ ] Wire Yjs Awareness protocol to live partner cursor (`#7CC8FF` ice cursor + active node selection ring).
- [ ] Subscribe to server-pushed node status badges, queue counts ("2 up next"), and streaming stdout/render logs in `inspector.tsx`.

## Phase 5: Pipeline Views, History & Media Players
- [ ] Wire **Today's Top Trends** aggregator (`topicdrag.tsx`) drag-and-drop onto **Screenplay** to real `POST /api/runs` queue endpoint.
- [ ] Wire **Screenplay Inspector** to structured storyboard JSON editor (hook, scenes[], narration, visual_directive, aspect_ratio) + **Approve / Request Revision** trigger.
- [ ] Wire **Voiceover History** to audio playback + word-level timestamp highlighting synced to `audio.currentTime`.
- [ ] Wire **Animation History** to 16:9 / 9:16 video playback + optional `@remotion/player` live preview.
- [ ] Wire **Manim Status** node to live worker health checks, recent check strip, and incident details.
- [ ] Wire **Publish View** (`publish.tsx`) to real preview streams, editable titles/tags/thumbnails, 1-click YouTube/Ayrshare sign-off, and live post-publish metrics.

## Phase 6: Dynamic AI Board Builder (`architect.tsx`)
- [ ] Connect Architect prompt bar to backend Architect Agent streaming tool-call endpoint.
- [ ] Build `<DynamicBoardNode/>` renderer for Declarative JSON UI Spec (`metric_card`, `progress_bar`, `table`, `trigger_button`, `status_strip`, `list_aggregator`) validated against `shared/widget-spec.schema.json`.
- [ ] Integrate `esbuild-wasm` (lazy-loaded in a Web Worker) to compile Architect-generated TSX into an isolated `<iframe sandbox="allow-scripts">` with strict typed `postMessage` data bridge.
- [ ] Build Admin Approval banner/queue for custom TSX widgets before publishing to the shared org board.

## Phase 7: Performance (As-Needed Profiling)
- [ ] Profile React/Canvas frame times with 100+ nodes and active log streams.
- [ ] Offload log ring-buffer parsing and `esbuild-wasm` compilation to Web Workers.
- [ ] Evaluate `OffscreenCanvas` for background grid/edge pulses only if main-thread frame time exceeds 8ms.

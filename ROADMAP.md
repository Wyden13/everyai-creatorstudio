# Roadmap — EveryAI CreatorStudio (Active)

Active remaining milestones only. Completed milestones are archived in [done-items/ROADMAP-M0-M5.md](done-items/ROADMAP-M0-M5.md) and [done-items/ROADMAP-M6-M17.md](done-items/ROADMAP-M6-M17.md). Future/unselected ideas live in [POTENTIAL_IDEAS.md](POTENTIAL_IDEAS.md).

---

## Milestone 18: End-to-End Verification & Wubble Browser MCP Suite (`tests/e2e/`, `UI_UX_TEST_PLAN.md`)
**Area of Build:** Automated Backend E2E & Autonomous Browser QA
**Goal:** Verify the entire Architect + Board + Pipeline loop end-to-end both programmatically and autonomously on screen via Wubble Browser MCP.
- [ ] Automated backend E2E test: Prompt Architect → Skills injection → MCQ clarify → generate YouTube Analytics tracker → register in `WidgetPipelineRegistry` → verify `/api/widgets/:slug/data` returns live MCP payload → edit component in place by `cmp_*` ID.
- [ ] Run [UI_UX_TEST_PLAN.md](UI_UX_TEST_PLAN.md) Suites 1–6 autonomously using **Wubble Browser MCP** (`navigate`, `click`, `drag`, `type`, `screenshot`, `evaluate`) and fix any visual or behavioral regressions discovered.

---

## Milestone 19: Remaining Live Runtime Polish (`backend/core`, `frontend/web`, `frontend/desktop`)
**Area of Build:** Full-Stack Wiring & Polish
**Goal:** Close the final gaps between dev-mode in-memory state and full production-grade runtime behavior.
- [ ] Swap remaining in-memory dev maps in `backend/core/src/main.zig` to live SQL queries when `state.db != null` (after running `./backend/db/migrate.sh` on local/VM PostgreSQL).
- [ ] Wire Yjs Awareness live partner cursor (`#7CC8FF`) and real `<audio>` / `<video>` Range stream URLs in Voiceover & Animation History.
- [ ] Configure Tauri deep-link OAuth callbacks (YouTube / Google Drive).

---

## Milestone 20: High-Signal Org Connectors Pack #1 (`shared/`, `backend/worker-agents/`, `backend/mcp/`)
**Area of Build:** Reusable Connector & MCP Pattern (Copy-Paste Formula for Future Connectors)
**Goal:** Build 5 rock-solid, easy-to-replicate Org Vault connectors + MCP tools + lean `SKILL.md` updates:
- [x] **Reddit Connector** (`connectors/reddit.ts`, `REDDIT_OAUTH_BUNDLE`, `mcp-social-analytics.reddit_fetch_trends`).
- [x] **X (Twitter) Connector** (`connectors/x.ts`, `X_OAUTH_BUNDLE`, `mcp-social-analytics.x_search`, `mcp-social-analytics.x_post_thread`).
- [x] **Yahoo Finance & Market News Connector** (`connectors/yahoo-finance.ts`, `YAHOO_FINANCE_CONFIG`, `mcp-social-analytics.yf_market_news`).
- [x] **Stock Asset Connector — Pexels** (`connectors/pexels.ts`, `PEXELS_API_KEY`, `mcp-media-storage.pexels_search`).
- [x] **Audio / Music Connector — Freesound** (`connectors/freesound.ts`, `FREESOUND_API_KEY`, `mcp-media-storage.freesound_search`) + `-24 LUFS` sidechain auto-ducking in `compiler.ts`.
- [x] Registered all 5 in `shared/connectors.json`, `widget-runtime.ts`, `skills.ts`, and `shared/skills/assets-audio/SKILL.md` (verified in `milestone20.test.ts`).

---

## Milestone 21: Long-Form Video Essay Pipeline — 10 to 120 Min (`backend/worker-agents/`, `backend/worker-manim/`, `shared/`)
**Area of Build:** Chunked Linked-List Video Production & VM Safety
**Goal:** Generate 10–120 minute video essays without hitting LLM output token limits or overloading the single VM.
- [ ] **Linked-List Chapter Graph (`ChapterChunk { id, index, prevId, nextId, outline, screenplay, audioAsset, clipAsset, state }`):**
  - Master outline generator breaks a 10–120 min topic into bounded 2–4 min chapters.
  - **Chunked Screenplay:** Generates 1 chapter at a time, passing a compact rolling summary from `prevId` so narrative continuity stays tight within token limits.
  - **Chunked Voiceover:** Synthesizes 1 chapter at a time with cumulative timestamp offsets (`chapterOffsetMs`).
  - **Chunked Animation & Rendering:** Renders 1 chapter at a time (Remotion/Manim), immediately freeing intermediate frames/temp files before starting `nextId`.
  - **Streaming Final Concat:** Joins chapter MP4s via FFmpeg concat demuxer (`-f concat -safe 0 -c copy`) + single loudness/caption pass.
- [ ] **VM Capacity Preflight Gate (`checkVmRenderCapacity`):** Estimates required RAM, disk scratch space, and render time *before* starting; fails loudly with a clear, actionable error if the request exceeds VM capacity (or offers Cloud Run burst).

---

## Milestone 22: Board Power-User UX — Versioning, Undo/Redo, Shortcuts & Visual Edge Wiring (`frontend/web/`, `backend/core/`)
**Area of Build:** Canvas Ergonomics & Architect History
**Goal:** Make rapid iteration and AI-assisted editing effortless and safe.
- [ ] **Component Versioning & Quick Undo (`v1`, `v2`, `v3`):** Snapshot every `cmp_*` component before an Architect edit or manual change; add a 1-click **Rollback** button in Inspector and pass recent versions as concrete few-shot examples to the Architect Agent.
- [ ] **Board Undo/Redo Stack & Keyboard Shortcuts:** `Cmd/Ctrl+Z` & `Cmd/Ctrl+Shift+Z` (undo/redo node moves, deletes, edits), `Cmd/Ctrl+K` Command Palette (jump to workspace, node by `cmp_*` ID, Architect chat, `Run scout`), `Shift+1` Fit board, `Delete`/`Backspace`, `Esc`.
- [ ] **Visual Edge Wiring (Stretch):** Drag from a node's output port to another node's input port with live bezier preview, plus right-click edge → `Delete edge`.

---

## Milestone 11: Single-VM Production Deployment, TLS/HTTP3 & External Credentials (`deploy/`, Infra)
**Area of Build:** Infrastructure, Security & Ops (When Ready to Deploy)
**Goal:** Harden and deploy the full stack onto a single Linux VM (with optional Cloud Run burst).
- [ ] Provision Linux VM with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17, Bun + Chromium + FFmpeg, and Python 3.12 + Manim CE/LaTeX.
- [ ] Create `systemd` units (`creatorstudio-core`, `creatorstudio-worker-agents`, `creatorstudio-worker-manim`) and configure TLS certs for HTTP/3 + WebTransport.
- [ ] Configure production secrets (`VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`), Google Drive OAuth2 app, YouTube Data API v3 OAuth consent screen, and Ayrshare/Upload-Post account.
- [ ] Optional: configure Anole `-Dlambda` / Google Cloud Run burst render profile and add root `LICENSE`.

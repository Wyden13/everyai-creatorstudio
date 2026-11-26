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

## Milestone 21: Long-Form Video Essay Pipeline — 10 to 120 Min (`backend/worker-agents/`, `shared/`)
**Area of Build:** Prompt-Cached Show Bible, Hybrid Visual Tiering, Resumable Checkpoints & VM Safety
**Goal:** Generate 10–120 minute video essays without hitting LLM output token limits, narrative drift, or overloading the single VM.
- [x] **Prompt Caching & Cost Telemetry (`providers.ts`, `agents/architect.ts`):** Ephemeral `cache_control` for Anthropic (90% cache-read discount), `prompt_cache_key` for OpenAI, stable prefix for Gemini, per-call `LlmUsage` (`savedUsd`), live-verified against Anthropic API.
- [x] **Immutable Show Bible + Global Beat Sheet (`longform.ts`, `shared/schemas/longform-essay.schema.json`):** Byte-identical cached Show Bible prefix across all chapters + 150-word verbal bridge from `prevId` + explicit `callbacks[]` to eliminate narrative drift while hitting 90% prompt cache savings.
- [x] **Decoupled Resumable Chapter Checkpoints:** Explicit chapter state machine (`Pending → Scripting → Scripted → Voicing → Voiced → Rendering → Rendered | Failed`), SHA-256 content-addressed reuse (editing Chapter 7 never re-pays Chapters 1–6 or 8–N), and ElevenLabs `previous_text`/`next_text` prosody continuity + `chapterOffsetMs`.
- [x] **Hybrid Visual Tiering & Zero-Reencode FFmpeg Concat:** Visual Budget (`65% ffmpeg_broll / 25% remotion_motion / 10% manim_diagram`), immediate scratch frame cleanup (`cleanupChapterScratch`), and streaming `ffmpeg -f concat -safe 0 -c copy` assembly (verified on real MP4s in `milestone21.test.ts`).
- [x] **VM Capacity Preflight Gate (`checkVmRenderCapacity`):** Probes live RAM & scratch disk, estimates peak RAM / disk / render time by visual tier mix, and fails loudly with actionable suggestions if the VM would be overloaded.

---

## Milestone 22: Board Power-User UX — Versioning, Undo/Redo, Shortcuts & Visual Edge Wiring (`frontend/web/`, `backend/core/`)
**Area of Build:** Canvas Ergonomics & Architect History
**Goal:** Make rapid iteration and AI-assisted editing effortless and safe.
- [x] **Component Versioning & Quick Undo (`v1`, `v2`, `v3`):** Snapshot every `cmp_*` component before an edit (`snapshotComponentVersion`), 1-click **Rollback** button in Inspector, and pass recent versions (`recentVersionsForArchitect`) as few-shot examples to the Architect Agent.
- [x] **Board Undo/Redo Stack & Keyboard Shortcuts:** `Cmd/Ctrl+Z` & `Cmd/Ctrl+Shift+Z` (undo/redo node moves, duplicates, deletes, edge edits + visual Undo/Redo toolbar), `Cmd/Ctrl+K` Command Palette (`palette.tsx` — jump to workspace, node by `cmp_*` ID, Architect chat, `Run Trend Scout`), `Shift+1` Fit board, `Delete`/`Backspace`, `Esc`.
- [x] **Visual Edge Wiring:** Drag from a node's output port (`.wire-port`) to another node with live dashed bezier preview (`wireDraft`), plus right-click edge → `Delete edge` (`e-hit`).

---

## Milestone 24: Harness Contract & Style Engines (`backend/worker-agents/`, `backend/worker-manim/`)
**Area of Build:** Testable harnesses; Vox and 3Blue1Brown styles where the LLM writes data and code owns visuals.
**Goal:** Every harness (system prompt + tools + LLM call) is a module with injected dependencies and a live test; videos stay in one style instead of being "all over the place".
- [x] **Vox style engine (`src/vox/`):** beat-sheet contract + editorial rules table, word-anchored timeline, hand-written widget library traced from Vox references, real Mediterranean geodata, DOM layout audit with scoped repair, parallel Chromium render.
- [x] **Formats:** `explainer` (16:9) and `short` (9:16) rows in `FORMATS`; character caps in one `CHARS` table that both the schema and the screenplay prompt read.
- [x] **0. Harness contract:** shared contract (prompt, tools, schemas, injected deps), streaming Anthropic calls with server tools, `bun run test:live <harness>` reading keys from env.
- [x] **1. Sandbox:** render at the timeline's real size (the 9:16 frame was scaled into a 16:9 composition).
- [x] **2. Short rules:** 60 s (~130–160 words), beats ≤12 words, no sources, big mid-screen word captions.
- [x] **3. Constant motion:** kinetic type, living numbers/charts, animated diagram shots, no hard cuts, and a frozen-frame audit check.
- [x] **Live tests, in order:** Scout (Claude `web_search` tool) → Screenplay → Voiceover (Gemini TTS + word alignment) → Animation, each piping its output into the next.
- [ ] **3Blue1Brown style:** Manim CE scene catalog driven by the same beat-sheet approach.
- [ ] **Architect:** builds status flags and tools; harnesses only as admin-approved compositions of existing tools.

---

## Milestone 11: Single-VM Production Deployment, TLS/HTTP3 & External Credentials (`deploy/`, Infra)
**Area of Build:** Infrastructure, Security & Ops (When Ready to Deploy)
**Goal:** Harden and deploy the full stack onto a single Linux VM (with optional Cloud Run burst).
- [ ] Provision Linux VM with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17, Bun + Chromium + FFmpeg, and Python 3.12 + Manim CE/LaTeX.
- [ ] Create `systemd` units (`creatorstudio-core`, `creatorstudio-worker-agents`, `creatorstudio-worker-manim`) and configure TLS certs for HTTP/3 + WebTransport.
- [ ] Configure production secrets (`VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`), Google Drive OAuth2 app, YouTube Data API v3 OAuth consent screen, and Ayrshare/Upload-Post account.
- [ ] Optional: configure Anole `-Dlambda` / Google Cloud Run burst render profile and add root `LICENSE`.

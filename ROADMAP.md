# Roadmap — EveryAI CreatorStudio (Active)

Active remaining milestones only. Completed milestones are archived in [done-items/ROADMAP-M0-M5.md](done-items/ROADMAP-M0-M5.md) and [done-items/ROADMAP-M6-M17.md](done-items/ROADMAP-M6-M17.md).

---

## Milestone 18: End-to-End Architect Verification Harness (`tests/e2e/`)
**Area of Build:** Automated Quality & Contract Verification
**Goal:** Verify end-to-end that an LLM-generated component matches the design system, connects to real Org Vault credentials, executes live MCP tools, and supports in-place editing.
- [ ] Automated E2E test: Prompt Architect → Skills injection → MCQ clarify → generate YouTube Analytics tracker → verify design tokens & schema → register in `WidgetPipelineRegistry` → verify `/api/widgets/:slug/data` returns live MCP payload.
- [ ] Automated E2E test: Prompt Architect to **edit** an existing component by `cmp_*` ID → verify patch preserves untouched fields, obeys capability rules, and updates the live board state.

---

## Milestone 19: Remaining Live Runtime Polish (`backend/core`, `frontend/web`, `frontend/desktop`)
**Area of Build:** Full-Stack Wiring & Polish
**Goal:** Close the final gaps between dev-mode in-memory state and full production-grade runtime behavior.
- [ ] Swap remaining in-memory dev maps in `backend/core/src/main.zig` to live SQL queries when `state.db != null` (after running `./backend/db/migrate.sh` on local/VM PostgreSQL).
- [ ] Wire Yjs Awareness live partner cursor (`#7CC8FF`) and real `<audio>` / `<video>` Range stream URLs in Voiceover & Animation History.
- [ ] Configure Tauri deep-link OAuth callbacks (YouTube / Google Drive) and profile 100+ node canvas frame times (evaluate Web Worker log parsing / `OffscreenCanvas` only if main-thread frame time exceeds 8ms).

---

## Milestone 11: Single-VM Production Deployment, TLS/HTTP3 & External Credentials (`deploy/`, Infra)
**Area of Build:** Infrastructure, Security & Ops (When Ready to Deploy)
**Goal:** Harden and deploy the full stack onto a single Linux VM (with optional Cloud Run burst).
- [ ] Provision Linux VM with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17, Bun + Chromium + FFmpeg, and Python 3.12 + Manim CE/LaTeX.
- [ ] Create `systemd` units (`creatorstudio-core`, `creatorstudio-worker-agents`, `creatorstudio-worker-manim`) and configure TLS certs for HTTP/3 + WebTransport.
- [ ] Configure production secrets (`VAULT_MASTER_KEY`, `SESSION_KEY`, `INTERNAL_WORKER_TOKEN`), Google Drive OAuth2 app, YouTube Data API v3 OAuth consent screen, and Ayrshare/Upload-Post account.
- [ ] Optional: configure Anole `-Dlambda` / Google Cloud Run burst render profile and add root `LICENSE`.

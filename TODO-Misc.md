# TODO — Shared Contracts, Infra & Misc (`shared/`, VM Ops, Security)

## 1. Shared Schemas & Contracts (`shared/`)
- [ ] `model-registry.json` — Canonical catalog of providers, models, and strict capability tags (`llm_text`, `llm_code`, `tts`, `search`, `publish`).
- [ ] `pipeline-state.schema.json` — Explicit discriminated union of node/run states (`Idle | Queued | Running | NeedsApproval | Failed | Done`) and allowed transitions.
- [ ] `storyboard.schema.json` — Strict scene storyboard contract (`hook`, `scenes[]` with `narration`, `visual_directive`, `animation_engine: 'remotion' | 'manim'`, `aspect_ratio`).
- [ ] `widget-spec.schema.json` — Declarative JSON UI Spec for `<DynamicBoardNode/>` (`metric_card`, `progress_bar`, `table`, `trigger_button`, `status_strip`, `list_aggregator`).
- [ ] `events.schema.json` — Wire format for Redis/WebSocket events (status updates, queue depth, stdout log chunks, Manim health checks).

## 2. Single-VM Infrastructure (Non-Containerized Postgres + Redis + Anole + Workers)
- [ ] Provision Linux VM (Ubuntu/Debian) with:
  - [ ] PostgreSQL 16+ (systemd service, local Unix socket + localhost TLS, automated daily `pg_dump` backups).
  - [ ] Redis / Valkey (lightweight, AOF persistence enabled, localhost-only).
  - [ ] Zig 0.17.x toolchain for building `backend/core` (Anole).
  - [ ] Bun runtime + Headless Chromium + FFmpeg for `backend/worker-agents`.
  - [ ] Python 3.12 + Cairo/Pango/LaTeX/FFmpeg for `backend/worker-manim`.
- [ ] Create `systemd` unit files for `creatorstudio-core`, `creatorstudio-worker-agents`, and `creatorstudio-worker-manim` with auto-restart and structured journald logging.
- [ ] Configure TLS certificates (Let's Encrypt / Caddy or Anole native TLS) to enable HTTP/3 + WebTransport.
- [ ] Optional: Document Google Cloud Run deployment profile for burst video rendering (Anole `-Dlambda` / stateless Remotion render job).

## 3. Storage & External App Setup
- [ ] Set up Google Cloud project + Google Drive API credentials (OAuth2 or Service Account with shared 5TB Drive folder) for `backend/core` media storage.
- [ ] Benchmark streaming range-requests from Google Drive proxy vs local disk cache (add small LRU disk cache on VM for hot renders if Drive latency affects video scrubbing).
- [ ] Configure YouTube Data API v3 OAuth consent screen & redirect URIs (Web + Tauri deep-link).
- [ ] Set up Ayrshare or Upload-Post account for TikTok/Instagram Reels publishing.

## 4. Security & Guardrails
- [ ] Generate and securely store `VAULT_MASTER_KEY` (32-byte random key) and `JWT_SECRET` outside git.
- [ ] Audit `esbuild-wasm` iframe sandbox: enforce `sandbox="allow-scripts"` (NO `allow-same-origin`), strict CSP, and explicit `postMessage` allowlist.
- [ ] Sandbox Manim Python scene execution (restricted builtins/AST check + OS-level timeout & memory ulimit + no outbound network).
- [ ] Add per-org daily spend/token/render limits so a runaway loop cannot burn ElevenLabs or LLM credits.

## 5. Repo Hygiene & DevEx
- [ ] Add root `.gitignore` (node_modules, zig-out, .zig-cache, target/, .venv/, .env, tmp renders).
- [ ] Add root `justfile` or `Makefile` for one-command dev startup (`just dev-core`, `just dev-workers`, `just dev-web`, `just dev-desktop`).
- [ ] Add `LICENSE` file.

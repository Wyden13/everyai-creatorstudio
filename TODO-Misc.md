# TODO — Shared Contracts, Infra & Misc (`shared/`, VM Ops, Security)

## 1. Shared Schemas & Contracts (`shared/`)
- [x] `model-registry.json` — Canonical catalog of providers, models, and strict capability tags (`llm_text`, `llm_code`, `tts`, `search`, `publish`).
- [x] `pipeline-state.schema.json` — Explicit discriminated union of node/run states (`Idle | Queued | Running | NeedsApproval | Failed | Done`) and allowed transitions.
- [x] `storyboard.schema.json` — Strict scene storyboard contract (`hook`, `scenes[]` with `narration`, `visual_directive`, `animation_engine: 'remotion' | 'manim' | 'hybrid'`, `aspect_ratios`).
- [x] `widget-spec.schema.json` — Declarative JSON UI Spec for `<DynamicBoardNode/>` & Admin-gated Sandboxed TSX.
- [x] `events.schema.json` — Wire format for Redis/WebSocket/SSE events.

## 2. Single-VM Infrastructure (Non-Containerized Postgres + Redis + Anole + Workers)
- [ ] Provision Linux VM (Ubuntu/Debian) with non-containerized PostgreSQL 16+, Redis/Valkey (AOF), Zig 0.17.x, Bun + Headless Chromium + FFmpeg, and Python 3.12 + Manim CE/LaTeX.
- [ ] Create `systemd` unit files for `creatorstudio-core`, `creatorstudio-worker-agents`, and `creatorstudio-worker-manim` with auto-restart and journald logging.
- [ ] Configure automated daily `pg_dump` backups for PostgreSQL.
- [ ] Configure TLS certificates (Let's Encrypt / Caddy or Anole native TLS) to enable HTTP/3 + WebTransport.
- [ ] Optional: Document Google Cloud Run deployment profile for burst video rendering (Anole `-Dlambda` / stateless Remotion render job).

## 3. Storage & External App Setup
- [ ] Set up Google Cloud project + Google Drive API OAuth2 credentials (refresh token for 5TB Drive folder).
- [ ] Benchmark streaming range-requests from Google Drive proxy vs local LRU disk cache on VM.
- [ ] Configure YouTube Data API v3 OAuth consent screen & redirect URIs (Web + Tauri deep-link).
- [ ] Set up Ayrshare or Upload-Post account for TikTok/Instagram Reels publishing.

## 4. Security & Guardrails
- [x] Implement AST static safety validator for Manim Python scenes (`backend/worker-manim/src/sandbox.py`).
- [x] Implement per-org daily spend, TTS character, and render cap guardrails (`backend/worker-agents/src/guardrails.ts`).
- [ ] Generate and securely store production `VAULT_MASTER_KEY` (32-byte random hex), `SESSION_KEY`, and `INTERNAL_WORKER_TOKEN` outside git.
- [ ] Audit `esbuild-wasm` iframe sandbox: verify `sandbox="allow-scripts"` (no `allow-same-origin`), strict CSP, and typed `postMessage` allowlist once `esbuild-wasm` is wired.
- [ ] Add OS-level `rlimit`/network isolation around Manim Python subprocess execution.

## 5. Repo Hygiene & DevEx
- [x] Add root `.gitignore` (node_modules, zig-out, .zig-cache, zig-pkg, target/, .venv/, .env, tmp renders).
- [x] Add root `Makefile` for one-command dev & test (`make dev-web`, `make dev-core`, `make test`).
- [ ] Add `LICENSE` file.

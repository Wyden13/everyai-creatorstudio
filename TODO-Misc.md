# TODO — Shared Contracts, Infra & Misc (`shared/`, VM Ops, Security)

## 1. Shared Schemas, Connectors & Skills (`shared/`)
- [x] `model-registry.json`, `connectors.json`, `pipeline-state.schema.json`, `storyboard.schema.json`, `widget-spec.schema.json`, `events.schema.json`.
- [x] `shared/skills/` lean `SKILL.md` library (`design-system`, `social-connectors`, `publisher-pipeline`, `aggregator-scheduler`).

## 2. Single-VM Infrastructure (Non-Containerized Postgres + Redis + Anole + Workers)
- [ ] Provision Linux VM (Ubuntu/Debian) with non-containerized PostgreSQL 16+ (daily `pg_dump` backups), Redis/Valkey (AOF), Zig 0.17.x, Bun + Headless Chromium + FFmpeg, and Python 3.12 + Manim CE/LaTeX.
- [ ] Create `systemd` unit files for `creatorstudio-core`, `creatorstudio-worker-agents`, and `creatorstudio-worker-manim`.
- [ ] Configure TLS certificates (Let's Encrypt / Caddy or Anole native TLS) to enable HTTP/3 + WebTransport.
- [ ] Optional: Document Google Cloud Run deployment profile for burst video rendering.

## 3. External App & OAuth Setup
- [ ] Create Google Cloud project + Google Drive OAuth2 credentials (refresh token for 5TB Drive folder) and store in Org Vault.
- [ ] Configure YouTube Data API v3 OAuth consent screen & redirect URIs (Web + Tauri deep-link).
- [ ] Set up Ayrshare or Upload-Post account for TikTok/Instagram Reels publishing.

## 4. Security & Guardrails
- [x] Implement AST static safety validator + POSIX `rlimit` CPU/memory caps for Manim Python scenes.
- [x] Implement static TSX security audit + strict CSP `srcDoc` + `sandbox="allow-scripts"` (no `allow-same-origin`) for `<SandboxedTsxFrame/>`.
- [x] Implement per-org daily spend, TTS character, and render cap guardrails (`guardrails.ts`).
- [x] Trim `.env.example` to core app infrastructure only; move all third-party credentials to Org Vault.
- [ ] Generate and securely store production `VAULT_MASTER_KEY`, `SESSION_KEY`, and `INTERNAL_WORKER_TOKEN` outside git.

## 5. Repo Hygiene & DevEx
- [x] Add root `.gitignore` and root `Makefile` (`dev-web`, `dev-core`, `dev-architect`, `dev-desktop`, `test`).
- [ ] Add `LICENSE` file.

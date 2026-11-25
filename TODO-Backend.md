# TODO — Backend (`backend/core`, `backend/db`, `backend/mcp`, `backend/worker-agents`, `backend/worker-manim`)

All backend code must follow `caveman-code` guidelines (explicit state transitions, fail-loud validation at boundaries, zero hidden global state).

## Phase 1: Database Schema (`backend/db/`)
- [x] Write initial SQL migration (`migrations/0001_init.sql`), idempotent dev seed (`migrations/0002_seed_dev.sql`), and migration runner (`migrate.sh`).
- [ ] Install & configure non-containerized PostgreSQL on dev/prod VM and run `./backend/db/migrate.sh`.

## Phase 2: Anole Core Control Plane (`backend/core/` — Zig 0.17.x)
- [x] Initialize Zig 0.17 project with `xuckless/Anole` v0.6.1 (`.profile = .web`, `.redis = true`, `.sqlite = false`).
- [x] Implement Self-Auth & RBAC (`org:admin`, `org:manager`, Argon2id, XChaCha20-Poly1305 sealed cookie sessions, `GET /api/auth/csrf`, `anole.middleware.Cors`).
- [x] Implement AES-256-GCM Encrypted Org Key Vault (`vault.zig`, `/api/vault` admin CRUD + `/api/internal/vault/decrypt` worker-only endpoint).
- [x] Implement Model Capability Validator (`domain.zig`, `POST /api/nodes/:id/validate-model`), Yjs WebSocket room relay (`GET /ws/board/:workspace_id`), SSE event hub (`GET /api/events/:workspace_id`), Pipeline Run & Approval endpoints, Admin-gated Widget endpoints, and `GET /api/topics/made`.
- [x] Wire optional `server.postgres(.{})` (`DATABASE_URL`) and `server.redis(.{})` (`REDIS_URL`, `LPUSH creatorstudio:jobs:agents`).
- [ ] Replace remaining in-memory dev maps in `main.zig` with live SQL queries when `state.db != null`.
- [ ] Add HTTP/3 WebTransport listener once production TLS certs are configured.
- [ ] Configure optional Anole `-Dlambda` build target for Google Cloud Run burst workloads if needed.

## Phase 3: Internal MCP Servers & Skills (`backend/mcp/`, `shared/skills/`)
- [x] Create lean `SKILL.md` library (`design-system`, `social-connectors`, `publisher-pipeline`, `aggregator-scheduler`) + progressive-disclosure skill router (`skills.ts`).
- [x] Build in-process scoped JSON-RPC 2.0 MCP router (`backend/mcp/src/registry.ts`) across `mcp-studio-board`, `mcp-org-connectors`, `mcp-social-analytics`, and `mcp-media-storage` with component write-ownership guards.

## Phase 4: Bun AI, Architect & Remotion Worker (`backend/worker-agents/` — TypeScript)
- [x] Implement capability-typed multimodal Provider Adapters (`providers.ts`), Trend Scout + Auto-Scheduler (`scheduler.ts`), Screenplay (`gate | auto`), Voiceover (`/with-timestamps`), Remotion primitives + composition runner (`remotion/runner.ts`), Burned-In Captions ASS engine (`remotion/captions.ts`), Animation Codegen Agent, and FFmpeg 16:9 / 9:16 Compiler (`compiler.ts`).
- [x] Implement multimodal Architect Agent (`clarify` | `plan` | `edit`), `POST /api/architect/turn`, executable MCP-backed `WidgetPipelineRegistry` + `/api/widgets/:slug/data` & `/refresh` endpoints (`widget-runtime.ts`, `architect-http.ts`).
- [x] Implement Publisher Agent (`gate | scheduled | auto`), YouTube Data API v3 + Ayrshare adapters, YouTube analytics poller (`analytics.ts`), Google Drive OAuth2 / Org Vault storage (`storage.ts`), HTTP Byte Range + LRU media cache (`media-cache.ts`), Spend Guardrails (`guardrails.ts`), and `Bun.RedisClient` consumer daemon (`daemon.ts`).

## Phase 5: Manim CE Worker (`backend/worker-manim/` — Python)
- [x] Build AST static safety sandbox (`sandbox.py`), native `16:9`/`9:16` transparent renderer + standalone ASS caption burn + POSIX `rlimit` CPU/memory isolation (`worker.py`), Redis job daemon + 15s health heartbeat publisher (`daemon.py`), and unit tests (`tests/test_worker.py`).
- [ ] Install Manim CE + Cairo/Pango/LaTeX system deps in local/VM `.venv`.

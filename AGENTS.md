# AGENTS.md — EveryAI CreatorStudio

Lean project context for AI coding agents and contributors. Read this first before editing any file.

## 1. What We Are Building

**EveryAI CreatorStudio** is a collaborative, real-time, node-based content & motion-graphics studio for a single Organization (`org:admin`, `org:manager`). Two partners operate an infinite freeform board of AI agents, status monitors, trackers, and aggregators that drive an end-to-end video pipeline (Trend Scout → Screenplay → Voiceover → Remotion/Manim Animation → 16:9 & 9:16 Compiler → Publisher) plus an **Architect Agent** that builds new board components and server workers from natural language.

## 2. Monorepo Map

Each directory has its own `README.md` explaining its exact responsibility and why it exists.

- `frontend/web/` — React 19 + Vite UI (ported from `src/creator-studio` Preact prototype; keeps custom `board.tsx`, `physics.ts`, `corners.ts` canvas; adds `esbuild-wasm` sandboxed TSX widgets & Yjs sync).
- `frontend/desktop/` — Tauri v2 Rust desktop shell wrapping `frontend/web/` with native Rust commands (audio waveforms, local file I/O, local FFmpeg preview).
- `backend/core/` — **Anole (Zig 0.17.x)** control plane: REST API, built-in self-auth & RBAC, non-containerized PostgreSQL + AES-256-GCM Org Key Vault, Yjs sync over WebSocket/WebTransport (HTTP/3), Redis/durable job orchestration, Google Drive (5TB) / S3 media storage adapter, and optional Cloud Run/Lambda mode.
- `backend/worker-agents/` — **Bun (TypeScript)** worker: executes LLM/research/voiceover/publisher agents, Architect Agent tool calls, Remotion codegen, and 16:9 + 9:16 Headless Chromium + FFmpeg compilation.
- `backend/worker-manim/` — **Python (Manim CE)** worker: renders 3Blue1Brown mathematical diagrams & vector morphs; reports health/jobs to the board's Manim Status component.
- `backend/db/` — Non-containerized PostgreSQL SQL migrations, schemas, and seed data.
- `shared/` — Language-agnostic JSON Schemas & contracts shared across Zig (`backend/core`), TypeScript (`frontend/web`, `backend/worker-agents`), and Python (`backend/worker-manim`).

## 3. Coding Guidelines (`caveman-code` Skill)

**All code in this repository MUST follow the `caveman-code` skill guidelines:**

1. **Declarative over imperative:** Express *what* data/UI/pipeline state should be, not tangled sequences of mutations. Prefer pure functions, explicit data transforms, and schema-driven configs.
2. **No implicit state machines:** Never encode workflow or UI states as combinations of loosely coupled booleans (`isLoading && !hasError && isPendingApproval`). Model every lifecycle with an explicit discriminated union / enum (`Idle | Queued | Running | NeedsApproval | Failed | Done`) and an explicit transition table.
3. **No hidden behaviors or magic side effects:** Avoid implicit lifecycle hooks, spooky global observers, silent fallbacks, or auto-mutating proxies. Side effects (network, DB, Redis, filesystem, subprocesses) must live at explicit boundaries and be visibly invoked.
4. **Fail loud at boundaries, trust typed internals:** Validate all external inputs (HTTP, WS, LLM JSON outputs, AI-generated widget specs, env vars) at the edge against `shared/` schemas. Never swallow errors silently.
5. **Keep modules small, flat, and boring:** Prefer shallow directory trees, explicit imports, and obvious names over clever abstractions or premature generics.

## 4. Non-Negotiable Architecture Invariants

- **Server-side execution only:** API keys never leave `backend/`. All LLM, TTS, Search, and Publish calls run in server workers reading decrypted keys from the Postgres Org Vault.
- **Capability-typed model routing:** Every agent/node has a declared capability class (`llm_text`, `llm_code`, `tts`, `search`, `publish`). UI selectors and backend validators MUST only allow models/keys matching that node's capability (e.g., ElevenLabs/Google TTS/OpenAI TTS only for Voiceover; never a TTS model on a Codegen/Screenplay/Architect node, and vice versa).
- **Human approval gates are durable:** Screenplay approval and Publisher sign-off persist in Postgres/Redis and survive server or worker restarts.
- **Admin gate on dynamic TSX:** Architect-generated Declarative JSON widgets (`<DynamicBoardNode/>`) can deploy immediately; Architect-generated custom TSX (`esbuild-wasm` iframe) MUST be gated by `org:admin` approval before persisting to the org board.
- **Visual design system stays intact:** Preserve the dark graphite (`#0B0C0F`) + violet (`#8B6CFF`) palette, iOS continuous corners (`corners.ts`), tactile springs (`physics.ts`), frosted glass, and "motion = status" philosophy from `frontend/web/src/creator-studio/README.md`.

## 5. Planning Docs

- [ROADMAP.md](ROADMAP.md) — Phased delivery milestones (M0 → M5).
- [TODO-Frontend.md](TODO-Frontend.md) — React 19 port, Tauri v2, Yjs board sync, Architect UI, History/Publish views.
- [TODO-Backend.md](TODO-Backend.md) — Anole Zig core, Postgres + Vault, Bun agent/Remotion worker, Python Manim worker, storage.
- [TODO-Misc.md](TODO-Misc.md) — Shared schemas, VM deployment, Google Drive/S3 setup, security, observability.

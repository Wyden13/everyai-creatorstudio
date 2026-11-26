# AGENTS.md — EveryAI CreatorStudio

Lean project context for AI coding agents and contributors. Read this first before editing any file.

## 1. What We Are Building

**EveryAI CreatorStudio** is a collaborative, real-time, node-based content & motion-graphics studio for a single Organization (`org:admin`, `org:manager`). Two partners operate an infinite freeform board of **harnesses, tools and status flags** (§3) that drive an end-to-end video pipeline (Scout → Screenplay → Voiceover → Animation → 16:9 & 9:16 Compiler → Publisher), plus an **Architect** harness that builds new board components from natural language.

## 2. Monorepo Map

Each directory has its own `README.md` explaining its exact responsibility and why it exists.

- `frontend/web/` — React 19 + Vite UI (ported from `src/creator-studio` Preact prototype; keeps custom `board.tsx`, `physics.ts`, `corners.ts` canvas; adds `esbuild-wasm` sandboxed TSX widgets & Yjs sync).
- `frontend/desktop/` — Tauri v2 Rust desktop shell wrapping `frontend/web/` with native Rust commands (audio waveforms, local file I/O, local FFmpeg preview).
- `backend/core/` — **Anole (Zig 0.17.x)** control plane: REST API, built-in self-auth & RBAC, non-containerized PostgreSQL + AES-256-GCM Org Key Vault, Yjs sync over WebSocket/WebTransport (HTTP/3), Redis/durable job orchestration, Google Drive (5TB) / S3 media storage adapter, and optional Cloud Run/Lambda mode.
- `backend/worker-agents/` — **Bun (TypeScript)** worker: runs every harness (Scout, Screenplay, Voiceover, Animation, Publisher, Architect), the Vox style engine, and 16:9 + 9:16 Headless Chromium + FFmpeg compilation.
- `backend/worker-manim/` — **Python (Manim CE)** worker: renders the 3Blue1Brown style (Manim CE) from a closed scene catalog; reports health/jobs to the board's Manim status flag.
- `backend/db/` — Non-containerized PostgreSQL SQL migrations, schemas, and seed data.
- `shared/` — Language-agnostic JSON Schemas & contracts shared across Zig (`backend/core`), TypeScript (`frontend/web`, `backend/worker-agents`), and Python (`backend/worker-manim`).

## 3. Vocabulary: Harness, Tool, Status Flag

The board has exactly three component kinds. (Older docs and code say "Agent"; that naming was a mistake: read it as Harness.)

- **Harness:** anything that has a system prompt and tools and calls an LLM to complete one defined task (Scout, Screenplay, Animation repair, Publisher metadata, Architect, a judge). Every harness implements the shared harness contract: declared system prompt, tools, input/output schemas, and injected dependencies (LLM, search, TTS, sandbox). No harness reads keys, the Vault or globals on its own. A harness may get its own specialized card on the board.
- **Tool:** a coded component with no system prompt. Its inputs are piped in from an API key/connector, an LLM, a user, a status flag or any other component. It has an output channel and does classic programming: computing, displaying, rendering, if/else decisions. Trackers (stats, costs, income) and aggregators (e.g. Today's Top Trends) are tools, as are web search, TTS, word alignment and the render sandbox. Every tool may have its own specialized look.
- **Status flag:** a health signal from our own system (compiler progress, renderer status, Manim worker health). It is the dumbest component: state, recent checks, one incident.

**Everything pipes.** Any component's output can feed another component's input, and that is how loops are built. For example: Manim renderer status `failing` → a tool with one if/else → restarts the Animation harness with its whole session context, the existing code and the failure flag. Or the same flag → a judge harness.

**What the Architect may build:** tools and status flags (including their specialized look) deploy freely; how much visual freedom it gets on harness cards is still open. Harnesses only as compositions (a system prompt plus existing tools plus input/output schemas, never new execution code), and only after the harness passes its live test and an `org:admin` approves it.

**Testability:** every harness and sandbox must run for real from its own test (`bun run test:live <harness>`), with keys read from environment variables. No scratch scripts, no account or Vault setup, no frontend. Unit tests inject scripted fakes at the I/O edge.

## 4. Video Styles

Exactly two styles, no general theme system: **Vox documentary** (`backend/worker-agents/src/vox/`) and **3Blue1Brown** (Manim CE). In both, the LLM writes data (a beat sheet) and hand-written code owns every visual. LLM-generated free-form animation code is not allowed. Motion is constant: if a shot looks like a PowerPoint slide, it fails the audit.

## 5. Coding Guidelines (`caveman-code` Skill)

**All code in this repository MUST follow the `caveman-code` skill guidelines:**

1. **Declarative over imperative:** Express *what* data/UI/pipeline state should be, not tangled sequences of mutations. Prefer pure functions, explicit data transforms, and schema-driven configs.
2. **No implicit state machines:** Never encode workflow or UI states as combinations of loosely coupled booleans (`isLoading && !hasError && isPendingApproval`). Model every lifecycle with an explicit discriminated union / enum (`Idle | Queued | Running | NeedsApproval | Failed | Done`) and an explicit transition table.
3. **No hidden behaviors or magic side effects:** Avoid implicit lifecycle hooks, spooky global observers, silent fallbacks, or auto-mutating proxies. Side effects (network, DB, Redis, filesystem, subprocesses) must live at explicit boundaries and be visibly invoked.
4. **Fail loud at boundaries, trust typed internals:** Validate all external inputs (HTTP, WS, LLM JSON outputs, AI-generated widget specs, env vars) at the edge against `shared/` schemas. Never swallow errors silently.
5. **Keep modules small, flat, and boring:** Prefer shallow directory trees, explicit imports, and obvious names over clever abstractions or premature generics.

## 6. Non-Negotiable Architecture Invariants

- **Server-side execution only:** API keys never leave `backend/`. All LLM, TTS, Search, and Publish calls run in server workers reading decrypted keys from the Postgres Org Vault.
- **Capability-typed model routing:** Every harness/tool has a declared capability class (`llm_text`, `llm_code`, `tts`, `search`, `publish`). UI selectors and backend validators MUST only allow models/keys matching that node's capability (e.g., ElevenLabs/Google TTS/OpenAI TTS only for Voiceover; never a TTS model on a Screenplay/Architect harness, and vice versa).
- **Human approval gates are durable:** Screenplay approval and Publisher sign-off persist in Postgres/Redis and survive server or worker restarts.
- **Admin gate on dynamic TSX:** Architect-generated Declarative JSON widgets (`<DynamicBoardNode/>`) can deploy immediately; Architect-generated custom TSX (`esbuild-wasm` iframe) MUST be gated by `org:admin` approval before persisting to the org board.
- **Responsibility stays with the org/user:** we sell the platform at a flat rate and assume no legal responsibility. Content, copyright, trademarks, likeness, disclosure (AI audio/video), and each connected platform's terms and guidelines are the org's/user's responsibility, together with the providers they connect (any API they register). The code never enforces legal or platform policy and we keep no per-platform legal or ToS text. Provenance and licence metadata (C2PA manifests, asset sources) are kept and exposed as data the user can act on. Spend limits are org/user settings, never hard-coded caps.
- **Visual design system stays intact:** Preserve the dark graphite (`#0B0C0F`) + violet (`#8B6CFF`) palette, iOS continuous corners (`corners.ts`), tactile springs (`physics.ts`), frosted glass, and "motion = status" philosophy from `frontend/web/src/creator-studio/README.md`.

## 7. Planning Docs

- [ROADMAP.md](ROADMAP.md) — Phased delivery milestones (M0 → M5).
- [TODO-Frontend.md](TODO-Frontend.md) — React 19 port, Tauri v2, Yjs board sync, Architect UI, History/Publish views.
- [TODO-Backend.md](TODO-Backend.md) — Anole Zig core, Postgres + Vault, Bun harness worker, Python Manim worker, storage.
- [TODO-Misc.md](TODO-Misc.md) — Shared schemas, VM deployment, Google Drive/S3 setup, security, observability.

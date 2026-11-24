# Roadmap Archive — Milestones M0 → M5 (Completed)

Shelved copy of the completed initial delivery plan. Active work continues in [../ROADMAP.md](../ROADMAP.md) starting at **Milestone 6**.

---

## Milestone 0: Foundation, Contracts & UI Port
- [x] Define `shared/` JSON Schemas: model capability registry, pipeline state, storyboard, declarative widget spec, and event bus protocol.
- [x] Port `frontend/web/src/creator-studio/` from Preact to React 19 + Vite preserving `board.tsx`, `physics.ts`, `corners.ts`, `studio.css`, 4 node archetypes, Workspaces, and History tabs.
- [x] Initialize `frontend/desktop/` Tauri v2 shell pointing to `frontend/web/`.
- [x] Bootstrap `backend/core/` (Anole Zig), `backend/db/` (PostgreSQL schema), `backend/worker-agents/` (Bun), and `backend/worker-manim/` (Python).

## Milestone 1: Auth, Org Vault & Real-Time Board Sync
- [x] Self-hosted Auth + RBAC (`org:admin`, `org:manager`) in Anole (`-Dauth`), Argon2id password verification, and XChaCha20-Poly1305 sealed cookie sessions.
- [x] Envelope-encrypted API Key Vault (`AES-256-GCM` with server master key + masked display hints); CRUD endpoints gated to `org:admin`.
- [x] Capability-typed Provider & Model Registry enforced in both `backend/core` and `frontend/web` Inspector (TTS strictly separated from LLM/Codegen).
- [x] Self-hosted Yjs sync over Anole WebSockets (`websocket.Rooms`) + explicit frontend `SyncState` client (`sync.ts`).
- [x] Server-to-board live status badges & streaming stdout/render log push via Anole SSE `Topics` (`/api/events/:workspace_id` + `/api/internal/events`).

## Milestone 2: Core Pipeline — Scout → Screenplay → Voiceover
- [x] Pipeline run state machine & Anole endpoints (`POST /api/runs`, `GET /api/runs/:workspace_id`, `POST /api/runs/:run_id/approve`, `POST /api/internal/vault/decrypt`) in `backend/core/` and `backend/worker-agents/`.
- [x] **Trend Scout Agent:** SerpApi (Google Trends + News) + Exa.ai/Tavily adapters + deterministic velocity/novelty scorer.
- [x] **Screenplay Agent (`gate` | `auto` mode):** Structured Output Zod storyboard using any eligible LLM (Claude / GPT / Gemini); pauses at `NeedsApproval` in `gate` mode or advances straight to Voiceover in `auto` mode.
- [x] **Voiceover Agent:** ElevenLabs `/with-timestamps` (character-to-word alignment) + Google Cloud TTS / OpenAI TTS support.
- [x] Frontend Screenplay **Approval gate / Auto** toggle wired cleanly in `store.ts` and `inspector.tsx`.

## Milestone 3: Programmatic Animation & Multi-Aspect Rendering
- [x] Curated **Remotion** visual primitive library (`primitives.ts`) with native responsive `16:9` (`1920x1080`) and `9:16` (`1080x1920`) layout specs (never cropped).
- [x] Dedicated **Burned-In Captions** engine (`captions.ts` ASS `\kf` karaoke generator + frontend `<BurnedCaptionsOverlay/>` with `Violet Pop`, `Vox Clean`, `Minimal Mono` presets) + standalone ASS caption burn in `backend/worker-manim/`.
- [x] **Code-Based Animation Agent** (`agents/animation.ts`): generates validated Remotion TSX and/or Manim Python scenes locked to word timestamps with bounded self-heal retries.
- [x] **`backend/worker-manim/` (Python):** AST-sandboxed Manim CE worker with native `16:9`/`9:16` transparent clip rendering & health check events.
- [x] **Compiler & Formatter Worker** (`compiler.ts`): declarative FFmpeg filter graph compositing base video + Manim overlay + `-14 LUFS` audio + burned-in ASS captions (verified end-to-end with local FFmpeg).

## Milestone 4: Dynamic AI Board Builder — Architect Agent & Architect Chats
- [x] **Architect Agent** (`backend/worker-agents/src/agents/architect.ts`) with multimodal image/file attachments, interactive MCQ `clarify` turns, `create_agent_worker` (capability-validated), and `create_board_widget` tools.
- [x] **Tier 1 (Default — Safe):** Declarative JSON UI Spec rendered by `<DynamicBoardNode/>`.
- [x] **Tier 2 (Opt-in — Custom TSX):** `<SandboxedTsxFrame/>` isolated `<iframe sandbox="allow-scripts">` (no `allow-same-origin`), enforced `pending_admin` until approved via `org:admin`-gated `POST /api/widgets/:widget_id/approve` in Anole.
- [x] New **"Architect chats"** navbar category & interactive multi-turn view (`architect-chats.tsx`) with picture/file uploads, inline MCQ cards, live preview, and 1-click deploy.
- [x] GPU `translate3d` + `requestAnimationFrame` drag/pan/resize/topic-drag performance pass (`board.tsx`, `topicdrag.tsx`, `studio.css`).

## Milestone 5: Publisher, Storage & Guardrails
- [x] **Publisher Agent** (`backend/worker-agents/src/agents/publisher.ts`): explicit `gate | scheduled | auto` state machine, LLM metadata generation, **YouTube Data API v3** resumable upload adapter, and **Ayrshare / Upload-Post** adapter.
- [x] **Pluggable Media Storage** (`backend/worker-agents/src/storage.ts`): Google Drive 5TB primary via OAuth2 refresh-token resumable uploads + S3-compatible fallback.
- [x] **Spend & Quota Guardrails** (`backend/worker-agents/src/guardrails.ts`) + frontend **Publish mode (`Approval gate` | `Scheduled` | `Auto`)** selector + root `Makefile`.

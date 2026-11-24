# TODO — Backend (`backend/core`, `backend/db`, `backend/worker-agents`, `backend/worker-manim`)

All backend code must follow `caveman-code` guidelines (explicit state transitions, fail-loud validation at boundaries, zero hidden global state).

## Phase 1: Database Schema (`backend/db/`)
- [ ] Install & configure non-containerized PostgreSQL on dev/prod VM.
- [ ] Write SQL migrations for:
  - [ ] `organizations`, `users`, `org_memberships` (`role: 'admin' | 'manager'`), `invites`, `sessions`.
  - [ ] `org_secrets` (provider, label, ciphertext, iv, auth_tag, key_version — AES-256-GCM envelope encryption).
  - [ ] `workspaces`, `board_snapshots` (Yjs binary state + vector clock), `custom_widgets` (spec_type: `declarative_json | sandboxed_tsx`, status: `pending_approval | approved | rejected`, approved_by).
  - [ ] `agent_definitions` (node_id, capability_type, provider, model, system_prompt, upstream_node_ids, output_schema).
  - [ ] `pipeline_runs`, `run_steps` (explicit enum: `Idle | Queued | Running | NeedsApproval | Failed | Done`, input_json, output_json, error_text, started_at, finished_at).
  - [ ] `media_assets` (run_id, asset_type: `audio | timestamps | remotion_clip | manim_clip | final_16x9 | final_9x16 | thumbnail`, storage_backend: `gdrive | s3`, storage_key, mime_type, duration_ms).
  - [ ] `published_items` (run_id, platform: `youtube | tiktok | instagram`, external_id, status, metrics_json).

## Phase 2: Anole Core Control Plane (`backend/core/` — Zig 0.17.x)
- [ ] Initialize Zig project with `xuckless/Anole` (`-Dauth=true -Dpostgres=true -Dredis=true -Dwebsocket=true -Ds3=true -Djobs=true -Dopenapi=true`).
- [ ] Implement Self-Auth & RBAC middleware (`org:admin`, `org:manager` route guards, Argon2/scrypt password hashing, JWT/session cookies, CSRF protection).
- [ ] Implement Encrypted Org Key Vault service (AES-256-GCM encrypt/decrypt using `VAULT_MASTER_KEY` env var; decrypt only for internal worker requests, never return plaintext to frontend).
- [ ] Implement Model Capability Validator (enforces `shared/model-registry.json` rules on every node config update).
- [ ] Implement Yjs Realtime Hub over Anole WebSocket (and HTTP/3 WebTransport listener) with room-per-workspace isolation, awareness broadcast, and periodic Postgres snapshot compaction.
- [ ] Implement Server-to-Board Event Push (Redis Pub/Sub → Anole WS hub) so worker status changes, queue counts, and stdout logs stream live to connected clients.
- [ ] Implement Pluggable Media Storage Adapter:
  - [ ] Primary: **Google Drive API** (5TB org drive, resumable uploads, streaming range proxy so `<video>`/`<audio>` tags scrub cleanly).
  - [ ] Secondary: **S3-compatible** via Anole native `-Ds3`.
- [ ] Implement Pipeline Orchestration endpoints (`POST /api/runs`, `POST /api/runs/:id/approve`, `POST /api/runs/:id/retry`, `GET /api/runs/:id/logs`) backed by Redis queues + Postgres state transitions.
- [ ] Configure optional Anole `-Dlambda` build target for Google Cloud Run burst workloads if needed.

## Phase 3: Bun AI & Remotion Worker (`backend/worker-agents/` — TypeScript)
- [ ] Initialize Bun workspace with Zod schemas generated/synced from `shared/`.
- [ ] Build Redis job consumer + heartbeat/cancellation loop + stdout log streamer back to Anole/Redis.
- [ ] Implement **Provider Adapter Layer** (reads decrypted org key per job from internal Anole endpoint, strictly keyed by capability):
  - [ ] LLM / Codegen (`llm_text`, `llm_code`): Anthropic Claude, OpenAI, Google Gemini.
  - [ ] TTS (`tts`): ElevenLabs (`/with-timestamps`), Google Cloud TTS, OpenAI TTS.
  - [ ] Search (`search`): SerpApi (Google Trends + News), Exa.ai, Tavily.
  - [ ] Publish (`publish`): YouTube Data API v3, Ayrshare / Upload-Post API.
- [ ] Implement **Trend Scout Agent** (scheduled/manual polling, velocity/novelty scoring, writes to Aggregator node).
- [ ] Implement **Screenplay Agent** (Structured Output Zod storyboard, transitions step to `NeedsApproval` and halts cleanly).
- [ ] Implement **Voiceover Agent** (synthesizes approved narration, extracts word timestamps, uploads audio + alignment JSON to storage).
- [ ] Build curated **Remotion** primitive library (animated charts, map callouts, kinetic typography, data cards) supporting native responsive `16:9` and `9:16` props.
- [ ] Implement **Code-Based Animation Agent** (generates Remotion TSX and/or Manim Python scripts synced to word timestamps; bounded self-heal loop on compile error).
- [ ] Implement **Compiler & Formatter Worker** (Headless Chromium + Remotion render + Manim clip compositing + FFmpeg audio mix + burned word-synced captions for both `16:9` and `9:16`).
- [ ] Implement **Architect Agent** with server tools:
  - [ ] `create_agent_worker` (registers validated agent definition in Postgres + wires edge).
  - [ ] `create_board_widget` (outputs Declarative JSON Spec or Admin-gated Sandboxed TSX + wires onto Yjs board).
- [ ] Implement **Publisher Agent** (generates metadata/thumbnails, waits at `NeedsApproval`, uploads on sign-off, polls analytics).

## Phase 4: Manim CE Worker (`backend/worker-manim/` — Python)
- [ ] Set up Python 3.12+ venv/uv project with `manim` (Manim Community Edition), `redis`, `pydantic`, and FFmpeg/Cairo/Pango system deps.
- [ ] Implement Redis job consumer for `manim_render` tasks (receives Python scene code + word-timestamp markers + target aspect ratio).
- [ ] Run Manim renders in an isolated subprocess with strict CPU/memory/timeout limits (no network access inside rendered scene script).
- [ ] Upload rendered transparent/compositable video clips to storage and emit completion event to Redis.
- [ ] Implement periodic health/self-check publisher for the board's **Manim Status** node (latency, queue depth, last error/incident).

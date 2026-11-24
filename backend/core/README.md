# Core Control Plane (`backend/core/`)

Built with **[xuckless/Anole](https://github.com/xuckless/Anole) (Zig 0.17.x)** — the single native server binary that owns state, security, real-time sync, and orchestration.

## What It Does

- **REST API & OpenAPI 3.1:** Workspaces, nodes, edges, pipeline runs, approval gates, history, and publish endpoints.
- **Self-Hosted Auth & RBAC (`-Dauth`):** Organization login, invites, sessions/JWT, CSRF protection, and strict `org:admin` vs `org:manager` guards.
- **Encrypted Org Key Vault:** AES-256-GCM envelope encryption for all third-party API keys stored in PostgreSQL (`org_secrets`). Never returns plaintext keys to browsers.
- **Capability Validator:** Enforces `shared/model-registry.json` so no node can be configured with an incompatible provider/model (e.g., TTS models restricted to Voiceover nodes).
- **Real-Time Board Sync (`-Dwebsocket` + HTTP/3 WebTransport):** Hosts Yjs CRDT rooms per workspace, relays partner presence/cursors, compacts snapshots to Postgres, and fans out Redis Pub/Sub events (status badges, queue counts, live stdout logs) to connected boards.
- **Job Orchestration (`-Dredis`, `-Djobs`):** Dispatches durable pipeline tasks to `worker-agents` and `worker-manim`, pausing cleanly at `NeedsApproval` gates.
- **Media Storage Adapter:** Primary integration with **Google Drive (5TB)** (resumable uploads + HTTP Range streaming proxy) with **S3-compatible** fallback via Anole's built-in `-Ds3`.
- **Burst Mode (`-Dlambda`):** Optional serverless/Cloud Run adapter for stateless burst endpoints.

## Why It's Here

Anole gives us HTTP/1.1, HTTP/2, HTTP/3 (WebTransport), WebSockets, Auth, Postgres, Redis, and S3 in one tiny compiled Zig binary — ideal for running lean on a single VM alongside heavy media workers.

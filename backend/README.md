# Backend (`backend/`)

All server-side services, workers, and database migrations for **EveryAI CreatorStudio**. Runs on a single Linux VM (non-containerized PostgreSQL + lightweight Redis + Anole binary + 2 thin workers), with optional Google Cloud Run burst support.

## Why This Architecture

Rather than forcing one runtime to do everything poorly, we split the backend by its natural strengths:

1. [`core/`](core/README.md) — **Anole (Zig 0.17.x):** Ultra-low-RAM single native binary for REST, Auth/RBAC, Postgres, AES-256-GCM Vault, Yjs WebSocket/WebTransport (HTTP/3) sync, Redis/Jobs, and Google Drive/S3 storage.
2. [`db/`](db/README.md) — **PostgreSQL:** Non-containerized SQL schema, migrations, and seed scripts.
3. [`worker-agents/`](worker-agents/README.md) — **Bun (TypeScript):** Runs every harness and its tools (Claude incl. server-side web search, OpenAI, Gemini incl. TTS, ElevenLabs, YouTube/Ayrshare), the Architect harness, Remotion 16:9 & 9:16 rendering, and FFmpeg compositing.
4. [`worker-manim/`](worker-manim/README.md) — **Python (Manim CE):** Dedicated worker for 3Blue1Brown mathematical diagrams & vector morphs.

## Security Boundary

API keys **never** leave `backend/`. Workers fetch decrypted org keys over an authenticated localhost/internal channel from `backend/core/` only for the duration of a job.

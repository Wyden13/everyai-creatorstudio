# EveryAI CreatorStudio

A real-time, collaborative, node-based AI content & motion-graphics studio. Built as a single-organization control room where partners visually orchestrate automated video pipelines (Trend Scout → Screenplay → Voiceover → Remotion/Manim Animation → 16:9 & 9:16 Compiler → Publisher) and use an **Architect Agent** to generate new board widgets and server workers on the fly.

## Repository Structure

Every directory contains its own `README.md` explaining what it does and why it exists:

```text
everyai-creatorstudio/
├── AGENTS.md                 # Lean project context & caveman-code guidelines
├── ROADMAP.md                # Phased milestones (M0 → M5)
├── TODO-Frontend.md          # Frontend & Tauri desktop tasks
├── TODO-Backend.md           # Anole core, Postgres, Bun & Python worker tasks
├── TODO-Misc.md              # Shared contracts, VM ops, Drive/S3, security
├── .env.example              # Environment variable template
├── shared/                   # Cross-language JSON Schemas & capability registry
├── frontend/
│   ├── web/                  # React 19 + Vite app (custom canvas, Yjs, esbuild-wasm)
│   └── desktop/              # Tauri v2 Rust shell + native commands
└── backend/
    ├── core/                 # Anole (Zig 0.17) API, Auth/RBAC, Vault, Yjs WS/WT, Jobs
    ├── db/                   # Non-containerized PostgreSQL migrations & schemas
    ├── worker-agents/        # Bun (TS) AI Agents, Architect, Remotion & FFmpeg
    └── worker-manim/         # Python Manim CE mathematical animation worker
```

## Core Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend UI** | React 19 + Vite + Custom Canvas (`board.tsx`, `physics.ts`, `corners.ts`) | Preserves tactile iOS-corner/spring UX while unlocking `@remotion/player` & `esbuild-wasm`. |
| **Desktop App** | Tauri v2 (Rust) | Hybrid Desktop + Web from one codebase; native Rust commands for waveforms/local preview. |
| **Core Backend** | [xuckless/Anole](https://github.com/xuckless/Anole) (Zig 0.17.x) | Single native binary with built-in Auth, Postgres, Redis, WebSocket, WebTransport (HTTP/3), S3 & Lambda mode. |
| **Database & Queue** | Non-containerized PostgreSQL + Lightweight Redis | Single-VM simplicity, AES-256-GCM org key vault in PG, durable job queues + pub/sub in Redis. |
| **Realtime Sync** | Self-hosted Yjs over Anole WebSocket / WebTransport | Zero vendor lock-in multiplayer board state, live partner cursors, and server-pushed node status updates. |
| **AI & Remotion Worker** | Bun (TypeScript) | Shared TS/Zod ecosystem for LLM SDKs, Architect tools, Remotion 16:9 + 9:16 rendering, and FFmpeg. |
| **Math Animation Worker** | Python + Manim CE | Dedicated 3Blue1Brown-style mathematical diagrams and vector morphs. |
| **Media Storage** | Google Drive (5TB) primary + S3-compatible fallback | High-capacity video/audio storage with pluggable storage adapter in `backend/core`. |

# Frontend (`frontend/`)

All client-side code for **EveryAI CreatorStudio**, cleanly separated from `backend/`.

## Why This Directory Exists

We run a **Hybrid Tauri + Web** architecture from a single UI codebase:
- `frontend/web/` holds the React 19 + Vite application (custom tactile board canvas, Inspector, Architect prompt bar, History, Publish, Org Settings).
- `frontend/desktop/` wraps `frontend/web/` in a Tauri v2 Rust shell for power-user desktop features (native audio waveforms, local caching, optional local FFmpeg preview) while keeping the exact same UI deployable as a standard web app for quick partner access.

## Directory Contents

- [web/README.md](web/README.md) — React 19 + Vite UI, custom canvas, Yjs client, `esbuild-wasm` sandbox.
- [desktop/README.md](desktop/README.md) — Tauri v2 Rust shell and native commands.

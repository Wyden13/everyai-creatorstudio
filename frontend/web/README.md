# Frontend Web App (`frontend/web/`)

The core browser & Tauri-embedded UI for **EveryAI CreatorStudio**, built with **React 19 + Vite + TypeScript**.

## What It Does

- Renders the infinite dark-graphite freeform **Workspaces** board (`board.tsx`, `physics.ts`, `corners.ts`, `studio.css`) with three component kinds: **Harness**, **Tool** and **Status flag** (root `AGENTS.md` §3).
- Syncs board topology, node configs, and live partner cursors in real time via **Yjs** over Anole WebSockets / WebTransport.
- Displays the right-hand **Inspector** drawer (system prompt, capability-filtered model selector, live stdout/render logs, storyboard editor, Run/Approve triggers).
- Hosts the **Architect** prompt bar and renders both:
  1. **Declarative JSON widgets** (`<DynamicBoardNode/>`) by default.
  2. **Sandboxed TSX widgets** compiled on-the-fly with `esbuild-wasm` inside an isolated `<iframe>` (gated by `org:admin` approval).
- Provides **History** (scripts, word-highlighted voiceovers, 16:9 & 9:16 video previews), **Publish**, and **Org Settings** (encrypted key vault & RBAC) views.

## Why It's Here

Keeping the entire UI in `frontend/web/` guarantees a single source of truth for both the web deployment and the Tauri desktop app (`frontend/desktop/`).

## Current State

- `src/creator-studio/` contains the copied Preact prototype from `xuckless/the-wallpaper-project` (`easi-install` branch), ready to be ported to React 19 while preserving its exact visual design system and custom spring/continuous-corner canvas. See `src/creator-studio/README.md` for design tokens and philosophy.

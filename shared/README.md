# Shared Contracts (`shared/`)

Language-agnostic JSON Schemas and static registries shared across **Zig** (`backend/core`), **TypeScript** (`frontend/web`, `backend/worker-agents`), and **Python** (`backend/worker-manim`).

## What It Does

- Defines the single source of truth for wire contracts and domain invariants:
  - `model-registry.json` — Supported providers, models, and strict capability classes (`llm_text`, `llm_code`, `tts`, `search`, `publish`).
  - `pipeline-state.schema.json` — Explicit node/run lifecycle enum and legal state transitions.
  - `storyboard.schema.json` — Structured Screenplay JSON contract.
  - `widget-spec.schema.json` — Declarative JSON UI Spec for `<DynamicBoardNode/>`.
  - `events.schema.json` — Real-time Redis/WebSocket event payloads.

## Why It's Here

Because our monorepo spans Zig, TypeScript, Rust, and Python, keeping schemas in plain JSON at `shared/` ensures every service validates the exact same data shapes at its boundaries with zero drift.

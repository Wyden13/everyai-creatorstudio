# Shared Contracts (`shared/`)

Language-agnostic JSON Schemas and static registries shared across **Zig** (`backend/core`), **TypeScript** (`frontend/web`, `backend/worker-agents`), and **Python** (`backend/worker-manim`).

## What It Does

- Defines the single source of truth for wire contracts and domain invariants:
  - `model-registry.json` — Supported providers, models, and strict capability classes (`llm_text`, `llm_code`, `tts`, `search`, `publish`, `image_gen`). `image_gen` models carry an `image` block (outputs, resolutions, max_refs, synthid, good_for, price per image or per 1M tokens) that `backend/worker-agents/src/assets/image-gen.ts` parses into `ProviderSpec`s.
  - `pipeline-state.schema.json` — Explicit node/run lifecycle enum and legal state transitions.
  - `schemas/vox-beat-sheet.schema.json` — Screenplay beat-sheet contract (generated from `backend/worker-agents/src/vox/beat-sheet.ts`). Map references (`view`, `layer`, `place`, `from`, `to`) are plain strings: the catalog is too large to enumerate, so `src/vox/places.ts` resolves names and ISO codes to canonical ids at the validator edge.
  - `widget-spec.schema.json` — Declarative JSON UI Spec for `<DynamicBoardNode/>`.
  - `events.schema.json` — Real-time Redis/WebSocket event payloads.

## Why It's Here

Because our monorepo spans Zig, TypeScript, Rust, and Python, keeping schemas in plain JSON at `shared/` ensures every service validates the exact same data shapes at its boundaries with zero drift.

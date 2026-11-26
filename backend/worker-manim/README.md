# Manim CE Worker (`backend/worker-manim/`)

A dedicated **Python** background worker running **Manim Community Edition (Manim CE)** for 3Blue1Brown-style mathematical animations, equations, and vector morphs.

## What It Does

- Consumes `manim_render` jobs from Redis containing a beat sheet, word timestamps, and target aspect ratio (`16:9` or `9:16`), and renders them with a closed catalog of hand-written 3Blue1Brown-style scenes (planned; see ROADMAP M24). The LLM never writes Manim code.
- Executes renders inside a tightly sandboxed subprocess (memory/CPU/timeout limits, no outbound network) and exports transparent/compositable video clips to storage for `backend/worker-agents` to composite into the final video.
- Publishes periodic health checks, queue depth, and incident reports back to `backend/core/` to drive the board's **Manim** status flag.

## Why It's Here

Manim CE requires Python, Cairo, Pango, and LaTeX. Isolating it in its own lightweight worker prevents Python/LaTeX dependencies from polluting `backend/core/` or `backend/worker-agents/`, and lets the Manim Status node monitor it independently.

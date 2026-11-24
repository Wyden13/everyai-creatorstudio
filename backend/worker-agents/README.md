# AI & Remotion Worker (`backend/worker-agents/`)

A **Bun (TypeScript)** background worker service that executes all LLM agents, external API integrations, Architect tool calls, and Remotion video rendering.

## What It Does

- Consumes durable jobs from Redis dispatched by `backend/core/` and streams live stdout/progress logs back via Redis Pub/Sub.
- **Capability-Typed Provider Layer:** Routes each agent to its configured org key + eligible model:
  - `llm_text` / `llm_code`: Anthropic Claude, OpenAI, Google Gemini.
  - `tts`: ElevenLabs (`/with-timestamps`), Google Cloud TTS, OpenAI TTS.
  - `search`: SerpApi (Google Trends + News), Exa.ai, Tavily.
  - `publish`: YouTube Data API v3, Ayrshare / Upload-Post API.
- **Pipeline Agents:**
  1. **Trend Scout:** Polls keywords, scores velocity/novelty, feeds **Today's Top Trends** aggregator.
  2. **Screenplay Agent:** Outputs strict Zod-validated JSON storyboards; pauses at `NeedsApproval`.
  3. **Voiceover Agent:** Generates narration + exact word-level timestamps.
  4. **Code-Based Animation Agent:** Writes Remotion TSX (using curated Vox-style primitives) and/or Manim Python scripts synced to speech timestamps.
  5. **Compiler & Formatter:** Renders native `16:9` and `9:16` Remotion compositions via Headless Chromium, composites any `worker-manim` clips, mixes audio, and burns word-synced captions with FFmpeg.
  6. **Publisher Agent:** Prepares metadata/thumbnails, waits for sign-off, publishes, and syncs stats.
- **Architect Agent:** Invokes `create_agent_worker` and `create_board_widget` tools to dynamically extend the board.

## Why It's Here

TypeScript/Bun is the native ecosystem for Remotion, Zod structured outputs, and modern AI SDKs. Running this as a thin worker decoupled from `backend/core/` keeps the Zig control plane fast and crash-isolated from Chromium/FFmpeg rendering.

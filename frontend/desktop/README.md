# Frontend Desktop Shell (`frontend/desktop/`)

The **Tauri v2 (Rust)** native desktop wrapper around `frontend/web/`.

## What It Does

- Packages `frontend/web/` into a lightweight native desktop app for Linux, macOS, and Windows.
- Exposes native **Rust Tauri commands** for client-side performance where Rust beats JS/WASM:
  - Fast audio waveform peak extraction for the Voiceover History player.
  - Local disk caching of rendered 16:9 / 9:16 videos for instant scrubbing.
  - Optional local FFmpeg frame-grab / preview acceleration.
- Handles native OAuth deep-link callbacks (YouTube Data API, Google Drive) and custom frameless window chrome matching the `#0B0C0F` graphite control room.

## Why It's Here

Isolating Tauri/Rust in `frontend/desktop/` ensures `frontend/web/` stays 100% browser-compatible. All desktop-only APIs are accessed behind a single `platform.ts` adapter so the web build works cleanly without Tauri.

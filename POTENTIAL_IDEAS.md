# Potential Ideas & Product Backlog — EveryAI CreatorStudio

Master list of product enhancement ideas. Items selected for active delivery are tracked in [ROADMAP.md](ROADMAP.md); deferred items stay here for future evaluation.

---

## 1. Org Connectors & MCP Tools
| Idea | Status | Target Milestone | Notes |
|---|---|---|---|
| **Reddit API Connector** | Selected | M20 | Subreddit trend polling & comment sentiment for explainer sourcing. |
| **X (Twitter) Connector** | Selected | M20 | High-priority: real-time trend search, auto-threading, and 9:16 teaser posts. |
| **Yahoo Finance & Market News** | Selected | M20 | Quotes, indices, and market headlines for finance/macro widgets. |
| **Stock B-Roll Asset Connector (Pexels)** | Selected | M20 | First stock visual connector; template for future Unsplash/Pixabay adapters. |
| **Audio / Music Bed Connector (Freesound)** | Selected | M20 | First royalty-free SFX/music connector + `-24 LUFS` auto-ducking under narration. |
| **Hacker News / ArXiv / RSS & Atom** | Backlog | Future | Copy-paste from M20 connector pattern when needed. |
| **LinkedIn / Threads Publishers** | Backlog | Future | Multi-platform text + short video cross-posting. |
| **Discord / Slack / Telegram Alerts** | Backlog | Future | Push notifications on `NeedsApproval` or `Failed` runs. |
| **Unsplash / Pixabay / Epidemic Sound** | Backlog | Future | Additional asset & music providers after Pexels + Freesound pattern is proven. |

## 2. Output Formats & Content Pipelines
| Idea | Status | Target Milestone | Notes |
|---|---|---|---|
| **Long-Form Video Essay Pipeline (10–120 min)** | Selected | M21 | Chunked linked-list chapters (Screenplay → Voiceover → Animation → FFmpeg concat) with VM capacity preflight guard so renders never OOM or blow token limits. |
| **1:1 Square & 4:5 Portrait Formats** | Backlog | Future | Add rows to `ASPECT_SPECS` for LinkedIn & Instagram Feed. |
| **Podcast / Long-Form Clipper Pipeline** | Backlog | Future | Ingest 60-min video/audio → word transcript → extract viral 45s clips. |
| **Carousel / Slide Deck & Newsletter Export** | Backlog | Future | Export approved `Storyboard` JSON to LinkedIn PDFs & Substack drafts. |
| **AI Thumbnail A/B Generator** | Backlog | Future | Generate 3 thumbnail variants and auto-pick winner via YouTube CTR. |

## 3. Architect & Board UX Superpowers
| Idea | Status | Target Milestone | Notes |
|---|---|---|---|
| **Component Versioning & Quick Undo/Rollback** | Selected | M22 | Snapshot `v1`, `v2`, `v3` per `cmp_*` node; 1-click rollback + gives Architect past-edit examples. |
| **Keyboard Shortcuts & Command Palette** | Selected | M22 | `Cmd/Ctrl+K`, `Cmd/Ctrl+Z` / `Shift+Z`, `Shift+1` Fit Board, `Esc`, `Delete`. |
| **Visual Edge Wiring on Canvas** | Selected (Stretch) | M22 | Drag output port → input port with live bezier preview + right-click edge delete. |
| **Live Cost Estimator Before Running** | Deferred | Backlog | Tricky to estimate accurately across variable LLM/TTS/render runs; revisit later. |
| **Right-Click Empty Canvas Menu** | Backlog | Future | Quick actions: Add with Architect, Fit board, Toggle snap, Run Scout. |
| **Web Canvas / Tauri Rust Audio Waveform Scrub** | Backlog | Future | Visual waveform peaks in Voiceover History backed by `extract_audio_waveform`. |

## 4. Autonomous Browser QA
| Idea | Status | Target Milestone | Notes |
|---|---|---|---|
| **Wubble Browser MCP Automated UI/UX Suite** | Selected | M18 | AI agents drive Wubble MCP (`navigate`, `click`, `drag`, `type`, `screenshot`) against [UI_UX_TEST_PLAN.md](UI_UX_TEST_PLAN.md). |

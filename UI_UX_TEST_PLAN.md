# UI/UX Automated Browser Test Plan (Wubble Browser MCP)

Executable end-to-end UI/UX test suite designed to be driven autonomously by AI agents using the **Wubble Browser MCP** (`start_session`, `navigate`, `click`, `drag`, `type`, `press_key`, `read_text`, `evaluate`, `screenshot`) against `http://localhost:5173` (and optionally `backend/core` `:8080` + `architect-http` `:8081`).

---

## Preconditions
1. Start web dev server: `make dev-web` (`http://localhost:5173`).
2. Optional live backend checks: `make dev-core` (`:8080`) and `make dev-architect` (`:8081`).
3. Verify zero uncaught console errors or React hydration warnings on initial load.

---

## Suite 1: Board Canvas, Tactile Drag & Live Arrows
- [ ] **T1.1 — Initial Render & Visual Baseline:** Navigate to `http://localhost:5173`, take screenshot, verify dark graphite background (`#0B0C0F`), left frosted `Nav`, floating `Architect` bar, and all starter nodes in `Explainers` workspace.
- [ ] **T1.2 — Smooth Node Drag & Live Connected Arrows:** Drag `Screenplay` node by `(+140px, -100px)`. Verify via DOM `evaluate` during/after drag that connected SVG `<path class="e-line">` and `<path class="arrow">` coordinates update to match the new node position with zero detached arrows.
- [ ] **T1.3 — Board Pan & Zoom Controls:** Drag empty canvas to pan; click `+`, `-`, and `Fit board` zoom buttons; verify `.world` `transform` updates and returns cleanly on Fit.
- [ ] **T1.4 — Node Resize & Minimum Rubber-Band:** Drag resize handle on `Screenplay` smaller than minimum (`240x150`) and release; verify node springs back to minimum dimensions without broken corner clip paths.

## Suite 2: Component IDs & Right-Click Context Menu
- [ ] **T2.1 — Right-Click Context Menu:** Right-click `Animation` node; verify frosted `.ctx-menu` opens displaying `cmp_animation_animation` (or `cmp_*` ID) and actions: `Copy component ID`, `Inspect`, `Edit with Architect`, `Duplicate`, `Delete`.
- [ ] **T2.2 — Duplicate & Delete:** Click `Duplicate` → verify new copy node appears offset by `(+36, +36)` and becomes selected. Right-click the duplicate → click `Delete` → verify it is removed cleanly without breaking existing edges.
- [ ] **T2.3 — Inspector ID Chip:** Click any node to open the right-hand Inspector; verify the mono Component ID badge appears in the header and is clickable.

## Suite 3: Workspaces & Actionable Top Trends
- [ ] **T3.1 — Workspace Creation & Switching:** Click `+` beside `Workspaces`, type `"Finance Daily"`, press `Enter` → verify empty workspace renders starter picker (`Explainer`, `Shorts`, `Blank`). Switch back to `Explainers` → verify board state preserved.
- [ ] **T3.2 — No "Made" Items in Top Trends:** Inspect **Today's Top Trends** node and confirm none of the already-produced topics (e.g., `"How GPS knows the time"`, `"Cities that banned cars"`) appear inside Today's Top Trends.
- [ ] **T3.3 — Auto-Schedule Control:** Click `Trend Scout` → verify `Auto-schedule` segmented control (`15m | 30m | 2h | Daily | Off`) switches cleanly and updates the node footer text (`auto every 15m` / `manual only`).
- [ ] **T3.4 — Topic Drag onto Screenplay:** Drag a topic row from **Today's Top Trends** onto `Screenplay` → verify floating `.topic-chip` follows pointer, highlights `Screenplay` on hover, and queues/starts a script draft on drop.

## Suite 4: Capability-Filtered Models, Screenplay Auto/Gate & Burned-In Captions
- [ ] **T4.1 — Capability-Typed Model Selector:** Open `Voiceover` → `Prompt` tab → open Model dropdown → verify ONLY TTS models (`ElevenLabs`, `Google Cloud TTS`, `OpenAI TTS`) appear and NO Claude/GPT-4o/Gemini models appear. Open `Screenplay` → `Prompt` tab → verify ONLY LLM models appear and NO TTS models appear.
- [ ] **T4.2 — Screenplay Gate vs Auto Mode:** Open `Screenplay` → `Script` tab → toggle `Approval mode` between `Approval gate` and `Auto`; verify toggle stays accessible in idle, running, and approval states.
- [ ] **T4.3 — Burned-In Captions Overlay:** Open `Animation` → `History` tab → expand a video card → toggle `16:9` vs `9:16` and caption presets (`Violet Pop`, `Vox Clean`, `Minimal Mono`) → take screenshot verifying `.burned-cap` renders cleanly in the safe zone with word-by-word active highlighting.

## Suite 5: Architect Chats (Attachments, MCQ Clarify, Deploy & In-Place Edit)
- [ ] **T5.1 — Layout & Margins Check:** Click `Architect chats` in left nav → take screenshot → verify clean outer padding inside the frosted sheet (no text, badges, or buttons touching rounded corners).
- [ ] **T5.2 — Inline MCQ Questionnaire Flow:** Open `"US Market News Aggregator"` chat → select multiple source options (`SerpApi Google News`, `Tavily Finance`) + cadence (`Every 5 min`) → click `Submit answers & build` → verify `<DynamicBoardNode/>` preview renders → click `Deploy to workspace` → verify new node appears on the board.
- [ ] **T5.3 — Picture & File Attachments:** Click `New` chat → attach a sample `.json` file and `.png` image → verify thumbnail & filename chip appear in composer and sent message.
- [ ] **T5.4 — Edit Existing Component by ID:** Right-click `Animation` on the board → click `Edit with Architect` → verify `Architect chats` opens with prefilled `Edit component cmp_... (Animation): ` → append `"make it Vox editorial style"` and press `Enter` → verify the `Animation` node subtitle/note updates in place!

## Suite 6: Organization Connectors, Auth & Publish Modes
- [ ] **T6.1 — Categorized Org Connectors:** Open `Organization` → `Key vault` → switch category tabs (`All connectors`, `AI Providers`, `Social`, `Storage`, `Tools`) → verify Google Drive, S3, YouTube, Ayrshare, SerpApi, Anthropic, ElevenLabs appear under their proper categories.
- [ ] **T6.2 — Live Sign-In & RBAC (with `make dev-core` running):** Sign in as `wendy@everyai.studio` (`org:manager`) → verify Vault shows read-only RBAC notice and disables key writes. Sign out and sign in as `admin@everyai.studio` (`org:admin`) → verify Vault encryption form unlocks.
- [ ] **T6.3 — Publish Mode Selector:** Open `Publish` → switch between `Approval gate`, `Scheduled`, and `Auto` → verify 16:9 & 9:16 side-by-side preview plays cleanly and `Sign off and publish` completes.

## Suite 7: Upcoming M22 UX Checks (Add as Implemented)
- [ ] **T7.1 — Keyboard Shortcuts:** `Cmd/Ctrl+K` opens command palette; `Shift+1` fits board; `Cmd/Ctrl+Z` undoes last node move/delete.
- [ ] **T7.2 — Component Version Rollback:** Edit a component with Architect → open Inspector History/Versions → click `Rollback to v1` → verify previous config restores cleanly.
- [ ] **T7.3 — Visual Edge Wiring:** Drag from a node output port to another node input port → verify new directional edge connects cleanly.

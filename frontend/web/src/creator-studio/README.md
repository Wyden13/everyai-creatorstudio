# EveryAI CreatorStudio

## The idea

The owner, 24 November 2026:

> We are going to create a new Design. This one is EveryAI CreatorStudio. Focus solely on the front end design and UX. Leave out any backend logic. Don't use any design assets from EveryAI, I need this as fresh as possible.

What it is (from the owner's brief, UI-relevant parts only):
- One organisation with an encrypted key vault (OpenAI, ElevenLabs, SerpApi, YouTube OAuth…). **Admins** manage keys, billing, invites and approve AI-generated board components. **Managers** edit the board, trigger and approve runs, edit scripts and prompt the Architect.
- A shared, real-time **freeform board** (Draw.io style): nodes are agents or live tracker widgets, joined by directional edges showing data flow. Both partners see node positions, edges, live cursors and status badges (`Idle`, `Running`, `Needs Approval`, `Failed`).
- Clicking a node opens an **inspector** from the right: system prompt, model selector, live logs, input/output JSON, and a Run / Approve trigger.
- An **Architect prompt bar** turns natural language into a new agent or widget that wires itself onto the board.
- The pipeline: Trend Scout → Screenplay (approval gate) → Voiceover → Animation (Remotion / Manim) → Compiler (16:9 + 9:16) → Publisher (sign-off gate).

Visual references:
- **Buttons and square multi-selectors**: like https://athas.dev (flat solid fills, small radius, quiet neutral secondary, icon + label).
- **Motion**: like Ultra Reactivate (this repo).
- **Big rounded rectangles**: iOS continuous corners (the owner's screenshot of an iOS card corner).
- **Frosted glass**: copied from Wubble (this repo).

Owner's answers, 24 November 2026:
- Dark graphite board.
- Violet accent ("see if we need any more").
- Calm at rest: motion means status.
- "Every agent / process / subprocess appears primarily in the freeform dashboard with fully drag-drop and resizable components. On click they open a deeper control panel from the right-hand side of the screen. On the left a navbar with Org Settings, Publish, other settings. The Architect prompt bar is overlaid on the board."

Feedback on the first prototype, 24 November 2026:
- "Change the name from Noor to Wendy." → the partner is Wendy Nguyen.
- "Isolate the Board into a Workspaces section and allow creating different workspaces for different pipelines." → the nav's first section is Workspaces (Explainers, Shorts daily, Podcast clips). **+** names a new one inline. An empty workspace offers a starter (Explainer, Shorts, Blank) or the Architect. Each workspace keeps its own board; runs keep going while you look at another one.

Second round, 24 November 2026:
- Trend Scout shows what it is "Searching for" (its keywords), and is set up once in the inspector (keywords, how often, sources).
- Its results land in a new **Today's top trends** aggregator. Drag a topic from it onto **Screenplay** and the pipeline runs from there. Screenplay's approval gate stays, because the script feeds both voice and video. Topics dropped while Screenplay is busy join a visible queue ("2 up next") and start when it clears.
- History everywhere it matters: Screenplay lists every script (newest first, expand to read). Voiceover lists every take by video ID (expand to play, with the transcript lighting up). Animation shows small cards that expand into a playing video (16:9 or 9:16). Publisher lists everything published with per-platform stats.
- "Make Manim a status component. We can have different styles of component": **Agent** (runs and has output; square icon tile), **Status** (is a task working? big state, a strip of recent checks, one incident; round tile), **Tracker** (stats, costs and income; violet tile) and **Aggregator** (collects results into a list you act on; violet list tile). The Architect builds and configures any of them, and says which type it chose.

## Philosophy

**A quiet control room where only work moves.** Two people run a content studio from one board. At rest the board is still, so anything that moves is news: a beam laps a node that is running, pulses travel down the edge feeding it, a node that needs you glows amber, and your partner's cursor drifts where they're looking. You should be able to glance at the board from across the room and know what's happening.

Principles:

1. **Motion is status.** Nothing loops for decoration. Running = a violet beam around the node and pulses along the edges feeding it. Needs approval = a slow amber breath. Failed = still, coral. Idle = still, grey.
2. **The board is the app.** Every agent, sub-agent and widget lives on the canvas; everything else (inspector, Architect, nav) is frosted glass floating over it, so the board keeps showing through.
3. **Tactile, from Ultra Reactivate.** Things follow the hand 1:1 while held and spring when let go. A dragged node lifts and leans into its travel, then settles with a single damped wobble. Resizing past a node's minimum rubber-bands and springs back. Overlap governs every swap: the old state leaves while the new one arrives, and contents settle a beat after their container.
4. **Flat, honest controls, from Athas.** Buttons are flat solid fills with a 7px radius, an icon and a short label. One primary per surface (solid violet); everything else is a quiet graphite fill. Multi-selectors are square tiles, not pills.
5. **Continuous corners on big shapes.** Nodes, panels and previews use iOS-style continuous corners: the curvature ramps in instead of starting abruptly the way a CSS circular arc does. Small controls keep plain radii, where the difference is invisible.
6. **Frost, from Wubble.** Glass is a coloured frost: heavy blur, saturate, a translucent milk and a faint inner light at the edge. It picks up the colour of the nodes beneath it.

### Corners

`corners.ts` builds the continuous-corner path in closed form (Figma's corner-smoothing construction, smoothing 0.6, which matches iOS): each corner is a short circular arc flanked by two cubic Béziers that ease curvature in from zero. That gives the exact iOS profile without a Fourier fit, and costs one string per resize. The same path is used three times per shape: the clip, the selection ring and the running beam, so the light follows the true edge.

### Palette

| Token | Value | Meaning |
|---|---|---|
| ground | #0B0C0F | the board |
| surface | #15161B | nodes |
| raised | #1E1F26 | secondary buttons, inputs |
| ink / ink-2 / ink-3 | #ECECF1 / #A0A1AC / #686974 | text |
| violet | #8B6CFF | the accent; primary actions; Running |
| amber | #F2B24C | Needs Approval |
| coral | #FF7B6B | Failed |
| mint | #5ED6A2 | done / success pulse |
| ice | #7CC8FF | your partner, Wendy (cursor, their selection) |

Violet was enough for actions; the extra hues are only for status and presence, because those need their own meaning.

### Motion tokens

Springs (semi-implicit Euler, from Wubble's `physics.ts`): follow k300 c15, settle k380 c30, wobble k520 c16. Rubber band k 26. Press 0.97. Overlap in 240ms / out 190ms, blur 4px. Dropdowns 200ms from 0.95, from their trigger. Rows 30ms apart. Drawer in 320ms ease-out, out 250ms.

## Exceptions

- **Avoid #16 (squircles):** big shapes use continuous corners because the owner asked for the iOS profile. Small controls keep simple radii.
- **Avoid #8 (bordered containers):** glass has a 1px inner light at its edge (the edge of the material, as in Wubble). Selection rings and the running beam are strokes along the shape; inputs get a ring only on focus.
- **Avoid #7 (opacity):** glass is translucency, and opacity drives crossfades and the beam's tail.
- **Avoid #1 (tags & pills):** video tags in Publish are real YouTube tags, so they're shown as removable tokens (small radius, not capsules). Status badges are a dot plus a word, not pills.
- **Avoid #17 (mono):** Geist Mono only for logs, JSON payloads, keys and numbers.
- **Encouraged #13 (no bounce):** dropped nodes settle with one damped wobble, because tactility is the reference (Ultra Reactivate). Menus, the drawer and buttons don't bounce.
- **Encouraged #20 (shared layoutId):** no motion library; the segmented and nav indicators are measured shared elements instead.
- Phone width: this is a desktop control room; the board isn't designed for 390px.

## Structure

- `index.tsx`: mount, app shell, view switching, `?preview=1`.
- `studio.css`: tokens and every style.
- `physics.ts`: springs, rubber band, loop (trimmed copy of Wubble's).
- `corners.ts` + `Shape`: continuous-corner paths, clip, ring and beam.
- `store.ts`: a tiny store, workspaces and their starter boards, and the simulated pipeline (front end only, all fake).
- `board.tsx`: the canvas (pan, zoom, drag, resize, edges, partner cursor).
- `nodes.tsx`: each component's body, by type.
- `topicdrag.tsx`: dragging a trend onto Screenplay.
- `history.tsx`: the History tabs.
- `inspector.tsx`: the right-hand control panel, including the screenplay editor.
- `architect.tsx`: the prompt bar and the ghost node it builds.
- `publish.tsx`, `org.tsx`: the Publish and Org settings views.
- `ui.tsx`, `icons.tsx`: buttons, segmented, select, toggle, icons.

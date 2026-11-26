# Open-source video and animation generation harnesses for LLM explainers (2023-2026)

Research date: 2026-11-24. Star counts, licenses and last-push dates come from the GitHub API (`gh api repos/...`) on that date. No repo files were modified.

## TL;DR

1. **Every system that gets reliable layout takes free placement away from the LLM.** Code2Video uses a 6x6 anchor grid plus an occupancy table. OmniManim predicts boxes before any code exists. SGA checks bounding boxes symbolically. HyperFrames runs a DOM layout audit that names `content_overlap`, `text_box_overflow`, `canvas_content_at_edge` and similar faults. Our harness asks for one free-form TSX file covering 2 minutes, which is the "direct code generation" baseline these papers beat by 40-50 points.
2. **Every system that stays in sync with narration ties visuals to speech events, not to seconds.** manim-voiceover has `<bookmark mark/>` and `wait_until_bookmark`. Motion Canvas has `waitUntil('event')`. Paper2Video aligns with WhisperX. HyperFrames uses `data-start` per clip and flags `line_unread` and `dead_stretch`. We pass only the first 40 word timestamps, so drift of 30-60 s is the expected result.
3. **Single-style consistency comes from a fixed component catalog, not from prompting.** HeyGen HyperFrames ships a Pro "Collage Explainer" style template that its own skill credits as learned from Vox (America, Explained). It is a template kit plus a `REMIX.md` process, not a free-form prompt. vercel-labs/json-render (`@json-render/remotion`) has the LLM emit a zod-validated timeline of clips that reference catalog components.
4. **Caveat from the one controlled study.** In "Shorter Is Not Cheaper" (arXiv 2610.32129, Oct 2026), a declarative spec that the model learned only in context was *not* more reliable than free-form code. Do not invent an exotic DSL. Have the LLM fill typed props of known React components (JSX and JSON it already knows), and keep the creative freedom inside each widget's implementation, which we write by hand.

**What to copy:** a word-anchored beat sheet (screenplay), one Vox widget catalog with zod props, a zone grid, per-beat compilation, a deterministic DOM and geometry audit before the VLM critic, and real cartography (d3-geo + Natural Earth TopoJSON).

---

## 1. Comparison matrix

| Project | What the LLM writes | Timing / VO sync | Layout-collision prevention | Quality verification | License | Maturity (GitHub, 2026-11-24) |
|---|---|---|---|---|---|---|
| **Remotion** + official AI skills/system prompt | Free TSX (React); `<Sequence>`, `Series`, `TransitionSeries`, `interpolate`, `spring` | Frame-based; skills say "measure each file with getAudioDuration and use calculateMetadata"; `@remotion/captions` for word-level `Caption[]` | Guidance only: safe area 80px sides / 100px top-bottom on 1080w, headline >= 84px, `@remotion/layout-utils` `measureText/fitText/fillTextBox` | None built in (human preview in Studio) | Remotion License (source-available, free for individuals/small cos, company license otherwise) | remotion 75.5k stars, pushed today; remotion-dev/skills 8.0k |
| **HeyGen HyperFrames** | HTML + `data-start/data-duration/data-track-index` + paused GSAP timelines registered in `window.__timelines` | Clip times in seconds per element; `<audio>` with `data-start`; review warns `line_unread`, `dead_stretch` | **Runtime DOM layout audit** (`hyperframes layout`, `check`): `content_overlap`, `text_box_overflow`, `container_overflow`, `canvas_overflow`, `canvas_content_at_edge`, `text_occluded`, `connector_detached`, `panel_out_of_canvas`; sampled at N midpoints + every transition | ~60 lint rules, contrast audit, `snapshot --review` contact sheets incl. 360px phone sheet, `SPEC.md` with numbers for every adjective, `REVIEW.md` P0/P1 notes, `diff` vs reference video | Apache-2.0 (style templates are Pro/closed) | 89.7k stars, pushed today |
| **vercel-labs/json-render** (`@json-render/remotion`) | JSON `TimelineSpec`: `clips[{component, props, from, durationInFrames, transitionIn/Out}]` validated by zod catalog | Frame ranges per clip | Implicit: each catalog component owns its layout | zod schema validation | Apache-2.0 | 19.8k stars |
| **Motion Canvas** | Free TS generator functions (`yield* all(...)`), signals, flexbox `Layout` nodes | `waitUntil('event')`/`useDuration('event')`: named time events dragged onto the voiceover in the editor | Flexbox layout engine (`Layout`) | Human editor | MIT | 20.2k stars, last push 2026-07 |
| **Revideo** (fork of Motion Canvas) | Same as Motion Canvas, plus headless render API | Same; adds audio/video elements | Same | None | MIT | midrender/revideo 4.2k, last push 2026-07 |
| **Manim CE** | Free Python `Scene.construct()` | `self.play(run_time=…)`, `self.wait()` | `next_to`, `arrange`, `to_edge`, `VGroup` buffs | None | MIT | 42.9k, pushed today |
| **manim-voiceover** | Python with `with self.voiceover(text="… <bookmark mark='A'/> …") as tracker:` | **Gold standard**: TTS runs first; `tracker.duration`, `wait_until_bookmark('A')`, `time_until_bookmark` | n/a | n/a | MIT | 328 stars, pushed 2026-06 |
| **Theatre.js** | Not LLM-oriented: keyframes in a JSON state file, edited in a GUI | Sequence timeline in seconds, audio attach | none | none | Apache-2.0 (core) / AGPL (studio) | 13.1k, **stale since 2024-08** |
| **Lottie / dotLottie** | JSON (Bodymovin schema), too verbose for LLMs to author well | Frame-based; `@remotion/lottie` seeks per frame | none | lottie validators | MIT (dotlottie-web) | dotlottie-web 959, active |
| **Rive** | Binary `.riv` made in the Rive editor; state machines with inputs | `@remotion/rive` seeks per frame | none | none | MIT runtime | rive-wasm 1.0k, active |
| **d3 + flubber** | Data → SVG path via d3; flubber `interpolate(pathA, pathB)` for shape morphs | Caller drives t | Data-driven geometry | none | BSD / MIT | flubber 7.0k, stale since 2022 but stable; Remotion `@remotion/paths` `interpolatePath()` covers most of it |
| **MoviePy** | Python clip composition (`TextClip`, `CompositeVideoClip`) | Seconds; manual | manual positions | none | MIT | 15.2k, pushed 2026-08 |
| **editly** | JSON5 declarative NLE spec (clips, layers, transitions) | Per-clip `duration`, audio ducking | Layer types own layout | Schema | MIT | 5.7k, last push 2025-05 |
| **Code2Video** (showlab, ICML 2026) | Manim per section, generated in parallel | Storyboard lecture-line ↔ animation pairs | **6x6 visual-anchor grid + occupancy table** | ScopeRefine (line → block → section repair), VLM critic (Gemini 2.5 Pro) on renders + code, TeachQuiz | MIT | 2.4k, pushed 2026-11 |
| **TheoremExplainAgent** (TIGER-Lab, ACL 2025) | Manim; planner: scene outline → vision storyboard → technical plan → narration plan | TTS narration per scene | Prompt text only ("safe area margins and minimum spacing"), plus `--use_visual_fix_code` VLM repair | 5 metrics (GPT-4o / Gemini), N=5 retry on errors | MIT | 1.5k, stale since 2025-07 |
| **OmniManim** (arXiv 2605.15585) | Manim, *after* a Vision Agent predicts keyframe bounding boxes | Scene Agent owns temporal issues | Learned 4x32x32 region prior + diffusion box refinement + interpolation-aware collision loss | CV overlap checks (HSV masks, IoU, pixel, text-line crossing), routed repair | paper | research |
| **SGA** (arXiv 2607.18116) | Plug-in on any Manim pipeline | does **not** check timing | Partial execution → symbolic scene graph → AABB overlap → minimum displacement → ±5-line patch | Deterministic MVQS score; beats VLM critic | paper | research |
| **Paper2Video / PaperTalker** (showlab, arXiv 2510.05096) | Beamer slides + subtitles | WhisperX word alignment; cursor grounding | Tree search over rule-based font/scale variants, VLM picks best | PresentQuiz, user study | MIT | showlab |
| **generative-manim / Animo** | Free Manim from GPT-4o/Claude | none | none | none | Apache-2.0 | 942 |
| **Math-To-Manim** | Multi-agent Manim + Blender | per-station | not stated | "verified" (Lean proofs for content) | MIT | 2.9k, pushed today |
| **manimator** (HyperCluster) | Manim from arXiv papers | none | none | none | — | 75 |
| **MoneyPrinterTurbo** | Script + stock-footage search keywords only (no code) | TTS + subtitles (edge-tts word boundaries / whisper) | Fixed template (stock clip + subtitle band) | none | MIT | 145.5k, pushed today |
| **ShortGPT** | "LLM-oriented video editing language" (JSON edit steps) + scripts | EdgeTTS + caption generation | Fixed templates | none | MIT | 8.2k, stale since 2025-02 |
| **json2video** (commercial SaaS) / Shotstack / Creatomate | JSON movie → scenes → elements | Per-element start/duration | Template positions | Schema | proprietary APIs (SDKs MIT) | small SDKs |

---

## 2. Per-project notes (what matters for us)

### 2.1 Remotion: our stack, and its official LLM guidance
- **System prompt**: https://www.remotion.dev/docs/ai/system-prompt. It covers `useCurrentFrame`, `interpolate` with clamp by default, `spring`, `Sequence from/durationInFrames`, `Series`, `TransitionSeries`, and says "it is forbidden to use the Math.random() API" (use `random('seed')`).
- **Agent skills** (https://github.com/remotion-dev/skills, 8.0k stars, v4.0.547). These files are useful for us:
  - `remotion-markup/timing.md`: use `Easing.bezier(0.16,1,0.3,1)`, `Easing.spring({damping:200})`, and `output:'perceptual-scale'` for scale.
  - `remotion-markup/measuring-text.md`: use `fitText`/`fillTextBox` to detect overflow, and load fonts before measuring (`validateFontIsLoaded: true`).
  - `remotion-create/video-layout.md`: "You are designing a video, not a webpage… Decide what the viewer should notice first in each scene". Safe area is 80px from the sides and 100px from top and bottom on 1080w. Headline is at least 84px and supporting text at least 44px.
  - `remotion-markup/multi-scene-video.md`: "Give each substantial scene its own component", using a `Track` of non-overlapping scenes or a `TransitionSeries`.
  - `remotion-markup/text-highlights.md`: `@remotion/rough-notation` (`<Highlight>`, `<Circle>`, `<Underline>`, `<Bracket>`) driven by `progress`. This **is the Vox highlighter-marker look**.
  - `remotion-maps/*`: static-map (a pre-rendered image plus overlays), MapLibre/Mapbox/MapTiler with `render-stability.md`, and Cesium flyovers.
  - `remotion-markup/audio.md`: "When scene timing follows the audio, measure each file with getAudioDuration and use calculateMetadata".
- **"Generate Remotion code using LLMs"** (https://www.remotion.dev/docs/ai/generate) recommends zod structured output (`code, durationInFrames, fps`). It also recommends **skill injection chosen by a cheap classifier instead of one giant prompt**, warns about "context rot", and points to the Prompt-to-Motion-Graphics template (`sanitize-response.ts`).
- Relevant packages:
  - `@remotion/paths`: `evolvePath` (line draw-on), `interpolatePath`/`interpolatePaths` (morph), `getPointAtLength` (arrow following a route), `getBoundingBox`.
  - `@remotion/shapes`: `makeCircle`, `makeRect`, `makeTriangle`, `makeStar`, `makePie`.
  - `@remotion/transitions`: fade, wipe, slide, `linearTiming`/`springTiming`.
  - `@remotion/captions`: `Caption{text,startMs,endMs,timestampMs,confidence}`, `createTikTokStyleCaptions`, `parseSrt`.
  - `@remotion/noise`: `noise2D/3D` for paper jitter and camera drift.
  - `@remotion/layout-utils`.
  - `@remotion/google-fonts`.
  - `@remotion/lottie` and `@remotion/rive`.
  - `@remotion/install-whisper-cpp` / `@remotion/openai-whisper` for word timestamps.
- **Remotion Elements** (`npx remotion elements use`) are installable React components (titles, charts, captions) from Element libraries. This is effectively a component-catalog ecosystem.
- **Gap**: Remotion has no automated layout or sync verification. We must build it, or port it from HyperFrames.

### 2.2 HeyGen HyperFrames: the most complete open harness, and it already targets Vox
- Repo: https://github.com/heygen-com/hyperframes (Apache-2.0, 89.7k stars, very active). It renders HTML with GSAP timelines by seeking headless Chrome frame by frame and encoding with FFmpeg, the same model as Remotion.
- **Style templates** (`skills/style-sampling/SKILL.md`) include "Collage Explainer… Vox (America, Explained)". Templates are Pro-only and closed. The structure is public: a template kit plus `series/<series>/REMIX.md` process, with two human stops (storyboard, draft). **They solved "one style" with a fixed kit, not a general prompt.**
- **`reverse-any-video` skill**: rebuilds a reference video frame-for-frame. It runs `measure cuts` to find every cut by frame and `measure frames --range --roi` to read consecutive frames at every entrance and exit. Each component (text, charts, maps) is rebuilt in HTML, and each sub-asset is cut from the original. `diff <video> <out>` reports missed cuts, timing offsets and the worst cells. **This is exactly the methodology for the user's step 2 (trace 3-4 Vox videos one to one).** We can reproduce it with ffmpeg scene detection (`select='gt(scene,0.3)'`) plus a frame-sheet diff.
- **Layout audit** (`packages/cli/src/commands/layout-audit.browser.js`, `layout.ts`) runs in the page:
  - It collects solid text blocks and flags pairs whose boxes overlap by more than one fifth of the smaller block (`content_overlap`). It ignores in-flow siblings managed by the same flex/grid parent ("they cannot visually collide").
  - It escalates a warning to an error only when the overlap persists across at least 2 adjacent samples or about 500 ms. This filters entrance and exit transients.
  - Other codes: `text_box_overflow`, `clipped_text`, `container_overflow`, `canvas_overflow`, `canvas_content_at_edge`, `text_occluded`, `escaped_container`, `connector_detached`, `connector_orphan`, `visibility_escapes_segment`.
  - Samples: `--samples 9` midpoints plus `--at-transitions`. `--json` output is agent-readable, and every issue carries a `fixHint`.
  - Opt-outs: `data-layout-allow-overlap` and `data-layout-ignore`.
  - **The "ACT III chip over the map title" bug is precisely `content_overlap`.**
- **Spec discipline** (`skills/hyperframes/references/spec.md`): "Adjectives are where the default look lives… Every adjective you turn into a number is a decision taken back from those defaults." The template has GOAL/OUTPUT/TIME/LOOK/OBJECTS/MOTION/SHOTS/BANNED/QA lines. Composition rules:
  - "The hero of a shot fills at least 40% of the frame"
  - "One hero move per shot. Secondary moves travel 50-70% as far, start 100-200 ms after"
  - "Something new every 2-4 s"
  - "an information card… its information is on screen within about 2.5 s, then it holds"
- **Review** (`references/review.md`):
  - Lint warns on `line_unread` (a line on screen too briefly to read), `dead_stretch` (more than 3 s with no change), `text_below_floor` (text under 2.6% of the short side) and `first_frame_empty`.
  - `snapshot --review` produces contact sheets: scene start and mid, a ±0.2 s strip at every cut, and a 360 px phone sheet.
  - "Describe each beat frame in one sentence as a stranger would… an object you would have to explain is a P0."
  - "Trust the numbers over your eye where they disagree."
- **Contract**:
  - Every element is a function of timeline time: no `Date.now`, no unseeded random, no `repeat:-1`.
  - Content stays inside a 90% action-safe box and key text inside an 80% title-safe box.
  - "Before hand-writing a named effect, transition, caption style, chart or card, search the registry". The registry holds about 450 blocks.

### 2.3 vercel-labs/json-render, `@json-render/remotion`
- https://github.com/vercel-labs/json-render (Apache-2.0, 19.8k). The model emits a `TimelineSpec {composition, tracks, clips[{component, props, from, durationInFrames, transitionIn, transitionOut}], audio}`, constrained to a `defineCatalog(schema,{components:{X:{props: z.object(...), description}}})`.
- Standard components (TitleCard, StatCard, LowerThird, SplitScreen…) are generic. The pattern matters more than the components: **"AI can only use components in your catalog"**, and every clip is validated and streamable. This is the shape of our `DynamicBoardNode` declarative widgets, applied to video.

### 2.4 Motion Canvas / Revideo
- https://motioncanvas.io/docs/time-events: `yield* waitUntil('event')` pauses until a named event that the editor drags onto the voiceover waveform. "By default, moving an event also moves all later events." `useDuration('event')` sizes an animation to an event window.
- **Idea to copy:** name the events in code and keep their times in data. Our equivalent is cue IDs in the screenplay, resolved to frames from TTS word timestamps.
- Revideo (https://github.com/midrender/revideo, MIT, 4.2k) adds a headless render API. Not worth switching to, since Remotion already covers this.

### 2.5 Manim CE + manim-voiceover
- https://voiceover.manim.community: `with self.voiceover(text="Here is a <bookmark mark='A'/>circle") as tracker: self.wait_until_bookmark("A"); self.play(Create(c), run_time=tracker.duration)`.
- **Narration is synthesized first, and animation durations are derived from it.** This is the single most important sync pattern in the ecosystem. TheoremExplainAgent, Code2Video and most Manim agents inherit it, and it is why their sync drift is near zero.

### 2.6 Theatre.js, Lottie/dotLottie, Rive
- **Theatre.js** (Apache-2.0 core, 13.1k) has been stale since Aug 2024. It is a GUI keyframe editor with JSON state. Not an LLM target.
- **Lottie** JSON is machine-readable but extremely verbose. LLMs author it poorly. Use it only for pre-made assets (icons, arrows, hand-drawn scribbles) via `@remotion/lottie`, seeked per frame.
- **Rive** `.riv` files are binary and authored in the Rive editor. State-machine inputs could be driven from props via `@remotion/rive`. This only helps if someone hand-builds Vox character or icon rigs. Low priority.

### 2.7 d3 + flubber
- d3-geo projections (`geoNaturalEarth1`, `geoAlbersUsa`, `geoMercator`) with `topojson-client` and `world-atlas`/`us-atlas` (Natural Earth, public domain) give **real coastlines in about 100 KB of JSON, deterministic and offline**. This directly fixes "maps are crude polygons inside a dark boxed card".
- d3-geo gives fitted `fitExtent` framing, `geoPath` output for `@remotion/paths` `evolvePath` (borders drawing on), and `geoInterpolate` for great-circle routes. Camera push-ins come from interpolating the projection `scale/translate` (or `rotate` for globes). MapLibre/Mapbox (Remotion maps skill) need tiles, tokens and network, and they render-stall.
- flubber (https://github.com/veltman/flubber, MIT) morphs arbitrary shapes, such as country → circle bubble. It has been stale since 2022 but is still the standard. `@remotion/paths interpolatePath` handles compatible paths.

### 2.8 MoviePy, editly, MoneyPrinterTurbo, ShortGPT, json2video
- These are "template + stock footage + TTS + subtitle band" systems. The LLM writes only script and search keywords. Output is consistent because **the LLM never touches layout**, but it is generic: no motion graphics.
- MoneyPrinterTurbo (145.5k stars, MIT) is the most popular. It proves that users accept rigid templates when content varies.
- editly (MIT) and json2video/Shotstack/Creatomate are JSON timelines of scenes → elements with start and duration. They are useful reference schemas for a timeline layer, not for motion design.

### 2.9 LLM-agent research systems (Manim lineage)
- **Code2Video** (https://arxiv.org/abs/2510.01174, https://github.com/showlab/Code2Video, MIT, 2.4k):
  - Agents: Planner (outline → storyboard of lecture lines + paired animations, external asset DB), Coder (per-section parallel Manim with ScopeRefine debugging), Critic (VLM over render + code).
  - **6x6 visual-anchor grid**: "turns continuous placement into a discrete anchoring problem". An occupancy table maps anchors to code lines. 6x6 beat 8x8 ("clutter"), and free placement scored 48.8 aesthetics.
  - Direct code generation (Claude Opus 4.1) scored aesthetics 37.8 and TeachQuiz 40.0. The full pipeline scored 87.9 and 86.0, against 99.7 and 97.1 for human 3B1B.
  - **Removing the Planner dropped aesthetics to 38.1.** Planning is the biggest lever.
- **TheoremExplainAgent** (https://arxiv.org/abs/2502.19400, ACL 2025, MIT, 1.5k):
  - Planner stages: scene outline → vision storyboard → technical implementation → narration plan.
  - Layout is only a prompt instruction ("Consider safe area margins and minimum spacing"). Result: "most generated videos had minor layout issues: overlapping text, inconsistent sizes".
  - Element Layout scored 0.59-0.61 against 0.73 for human. RAG over docs "did not consistently help".
  - **Lesson: prompting about margins does not work.**
- **OmniManim**, "See Before You Code" (https://arxiv.org/abs/2605.15585):
  - Plan boxes at sparse keyframes *before* code, including an interpolation-aware collision check at u=0.25/0.5/0.75. The Code Agent "preserves them rather than choosing positions itself".
  - Overlap score 0.763 against 0.598 for Code2Video. Without the Vision Agent it was 0.491.
  - Repair is routed to the responsible agent, never a full regeneration.
- **SGA**, symbolic geometric verification (https://www.alphaxiv.org/abs/2607.18116):
  - Partial execution produces a scene graph with labels, AABBs and source lines. Pairwise overlap at *resting* frames, ignoring mid-motion, gives a minimum displacement fix and a ±5-line patch.
  - MVQS rose from 62.97 to 73.11, against 64.54 for the VLM critic, and it is faster.
  - "Perceptual judges miss geometric errors". **A deterministic geometry check beats our current vision-only critic for overlap.**
- **Paper2Video / PaperTalker** (https://arxiv.org/abs/2510.05096): LLMs "handle fine-grained numerical layout changes poorly". Fix: generate rule-based parameter variants (font size, figure scale) and let a VLM *choose*. WhisperX provides word-level alignment of cursor and highlight to speech.
- **"Shorter Is Not Cheaper"** (Huang, arXiv 2610.32129, Oct 2026):
  - Setup: an in-context-learned declarative animation spec (ExplainSpec) against free-form HTML/JS, with Claude Opus/Sonnet/Haiku and Qwen3-14B.
  - Specs were 25-48% shorter but not faster, because Claude reasoned more before writing them. Free-form pages were valid after one repair round in 95-100% of jobs.
  - The study did **not** measure visual quality or style consistency, only state correctness.
  - **Lesson: a novel DSL is not a free reliability win. Use a format the model knows (JSX/JSON props for named components) and keep it small.**
- generative-manim (Apache-2.0, 942), Math-To-Manim (MIT, 2.9k) and manimator (75) are free-code generators without layout or sync machinery. They are useful only as prompt corpora.

---

## 3. Patterns, ranked by how consistent a single style they produce

| Pattern | Examples | Style consistency | Sync | Layout | Expressiveness |
|---|---|---|---|---|---|
| A. Free code for the whole video | our current harness, generative-manim, TEA | Low (each run reinvents style) | Poor unless TTS-first | Poor (prompt-only) | High |
| B. Free code per section + grid anchors + critic | Code2Video, OmniManim, SGA | Medium | Good (per-section narration) | Good | High |
| C. **Typed catalog of hand-built style components, LLM emits timeline of `{component, props, cue}`** | json-render/remotion, HyperFrames style templates + registry, MoneyPrinterTurbo (extreme) | **Highest** | Best (cue → word timestamp) | Best (components own zones) | Bounded by catalog |
| D. Template + stock footage | MoneyPrinterTurbo, ShortGPT, editly, json2video | High but generic | Good | Fixed | Low |

**Recommendation: pattern C, with a narrow escape hatch from pattern B.**

---

## 4. What we should copy, concretely, for the Vox-only harness

1. **The screenplay emits a word-anchored beat sheet, not prose acts** (manim-voiceover bookmarks, Motion Canvas time events, PaperTalker WhisperX):
   - Each beat has `{id, narration, cue_words:[{word_index|phrase, action}], widget, props}`.
   - TTS runs first. The aligner resolves each cue phrase to `startMs` from the **full** word-timestamp array, not the first 40 words.
   - Beat frame ranges are derived, so the LLM never writes seconds.
   - Mirror HyperFrames lints: `line_unread` (time on screen ≥ words/3.5 per second), `dead_stretch` (no visual change for more than 3 s), and something new every 2-4 s.
2. **One Vox widget catalog with zod props** (json-render's `defineCatalog`, HyperFrames registry):
   - Candidate widgets: `VoxMap` (d3-geo + world-atlas, beige land, highlighted country, `evolvePath` borders, projection push-in), `HighlightQuote` (`@remotion/rough-notation` Highlight on a paper texture), `ArchivalPhotoCollage` (cut-out photos, drop shadow, `@remotion/noise` jitter), `BigNumberCounter` (with a units and format enum, so no '0.0M km2' at t=0), `LineChartDraw`, `BarRace`, `TimelineRuler`, `DocumentZoom`, `LabelCallout` (leader line + label), `ChapterCard` (full-frame only, never a chip over content).
   - The LLM picks widgets and fills props. We hand-write the motion and look once, traced from the Vox references.
   - Escape hatch: allow free TSX for one custom beat, scoped to a single zone and audited like everything else.
3. **A zone grid instead of coordinates** (Code2Video 6x6, HyperFrames 90/80% safe boxes, Remotion safe-area numbers):
   - Each widget declares the zones it occupies, such as `full`, `left-2/3`, `right-1/3`, `lower-third` or `title-band`. A layout solver rejects two beats that claim the same zone at once.
   - Chapter or "ACT" markers get a dedicated band or a full-frame card, never a floating chip. This fixes the top-left ACT III bug structurally.
4. **One scene per beat, with clean exits** (Remotion `multi-scene-video.md`, `TransitionSeries`): the outgoing beat unmounts, so elements do not accumulate PowerPoint-style. An explicit `carry` prop handles a deliberate persistent element, such as a map that stays while labels change.
5. **A deterministic audit before the VLM critic** (HyperFrames `layout-audit.browser.js`, SGA):
   - In the Chromium visual sandbox, sample each beat at its resting frame (beat end − 0.2 s) plus 3 midpoints.
   - Collect `getBoundingClientRect` of text blocks and run: overlap greater than 1/5 of the smaller block, persisting across 2 or more samples; overflow outside the 90% action-safe box; text below 2.6% of the short side; intrusion into the subtitle band; empty first frame.
   - Feed `{beatId, widget, prop, fixHint}` back to the planner for that beat only (OmniManim/Code2Video routed repair; Code2Video ScopeRefine), not the whole file.
6. **Let the VLM choose, not nudge numbers** (PaperTalker tree search): for a failing beat, render 2-3 rule-based variants (font scale, zone, label placement) and let the critic pick. Score against a fixed Vox rubric and reference stills from the traced videos.
7. **A numeric style spec** (HyperFrames `spec.md`): write `VOX_SPEC` once as numbers.
   - Paper ground hex, grain %, ink, a single accent (Vox yellow highlighter), type family and weight in px at 1080p, eases by role (`Easing.bezier(0.16,1,0.3,1)` enter), stagger frames, hero ≥ 40% of the frame.
   - A BANNED list: dark void, glowing cards, boxed map cards, chips over content, everything fading in on one curve.
   - Both the widget implementations and the critic read the same spec.
8. **Trace references the HyperFrames `reverse-any-video` way** (user step 2):
   - ffmpeg scene detection for cuts, consecutive-frame reads around each entrance and exit, and rebuilding each component as a catalog widget.
   - A `diff` between our render and the reference at matched timestamps checks fidelity.

---

## Sources
- Remotion AI docs: https://remotion.dev/docs/ai/ · system prompt https://www.remotion.dev/docs/ai/system-prompt · skills https://www.remotion.dev/docs/ai/skills · generate guide https://www.remotion.dev/docs/ai/generate · skills repo https://github.com/remotion-dev/skills · layout-utils https://www.remotion.dev/docs/layout-utils/ · paths https://www.remotion.dev/docs/paths/ · captions https://www.remotion.dev/docs/captions/
- HyperFrames: https://github.com/heygen-com/hyperframes (skills/hyperframes, skills/style-sampling, skills/reverse-any-video, packages/cli/src/commands/layout-audit.browser.js, docs/reference/lint-rules.mdx) · https://help.heygen.com/en/articles/15001510-hyperframes-x-heygen
- json-render: https://github.com/vercel-labs/json-render (packages/remotion/README.md)
- Motion Canvas: https://github.com/motion-canvas/motion-canvas · https://motioncanvas.io/docs/time-events · Revideo https://github.com/midrender/revideo
- Manim CE https://github.com/ManimCommunity/manim · manim-voiceover https://voiceover.manim.community/en/stable/quickstart.html , https://voiceover.manim.community/en/stable/api.html
- Theatre.js https://github.com/theatre-js/theatre · dotLottie https://github.com/LottieFiles/dotlottie-web · Rive https://github.com/rive-app/rive-wasm · flubber https://github.com/veltman/flubber · MoviePy https://github.com/Zulko/moviepy · editly https://github.com/mifi/editly
- Code2Video https://arxiv.org/abs/2510.01174 , https://github.com/showlab/Code2Video
- TheoremExplainAgent https://arxiv.org/abs/2502.19400 , https://github.com/TIGER-AI-Lab/TheoremExplainAgent
- OmniManim https://arxiv.org/abs/2605.15585 · SGA https://www.alphaxiv.org/abs/2607.18116 · Paper2Video https://arxiv.org/abs/2510.05096 · Shorter Is Not Cheaper https://arxiv.org/abs/2610.32129
- generative-manim https://github.com/marcelo-earth/generative-manim · Math-To-Manim https://github.com/HarleyCoops/Math-To-Manim · manimator https://github.com/HyperCluster-Tech/manimator · MoneyPrinterTurbo https://github.com/harry0703/MoneyPrinterTurbo · ShortGPT https://github.com/RayVentura/ShortGPT · json2video SDK https://github.com/JSON2Video/json2video-nodejs-sdk

Not verified: the exact Remotion license thresholds (the docs page did not render them), json2video schema internals, and whether HyperFrames' Vox-derived template code matches its description (it is Pro-only and closed).

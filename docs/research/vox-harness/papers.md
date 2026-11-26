# Research: LLM/agentic generation of explainer and motion-graphics video (2023-2026), and what fixes "all over the place" output for one Vox style

Scope: academic papers and industry practice on planning, layout, narration alignment, and visual QA for code-generated explainer video. For each item: key idea, measured result, and a technique we can adopt in `backend/worker-agents` (Remotion + headless Chromium + Claude planners). Numbers are quoted from the papers. Where I could only verify the abstract, I say so.

The current harness, for reference: `agents/animation.ts` asks one LLM call to write one free-form TSX file for the whole video. The prompt gets the storyboard and `opts.words.slice(0, 40)` (line 284), so the coder sees only the first 40 word timings of a roughly 300-word narration. A Gemini/Claude vision critic then scores 4 PNG keyframes against a prose rubric (line 192). Nearly every paper below targets one of those three choices.

---

## 1. Code-centric explainer video agents (closest prior art)

### 1.1 Code2Video (Show Lab NUS, Oct 2025; NeurIPS'25 DL4C workshop, ICML 2026)
- Links: https://arxiv.org/abs/2510.01174 · https://github.com/showlab/Code2Video · https://showlab.github.io/Code2Video/
- **Key idea:** three agents. A **Planner** turns the topic into an outline and then a per-section storyboard of lecture lines paired with animations. It pulls reference images and icons from an **external asset database** and caches them for reuse across sections. A **Coder** writes Manim code **per section, in parallel**, and repairs it with **ScopeRefine**: first the error line ±1, then the lecture-line block, then a full section regeneration. A **Critic** (Gemini 2.5 Pro) reviews the rendered video through **Visual Anchor Prompting**:
  - The canvas is split into a **6×6 grid of named anchor points** that map to fixed coordinates.
  - The LLM places elements by anchor: one anchor for a small element, a region of anchors for a large one. It never writes raw coordinates.
  - The critic also gets an **occupancy table** that maps each element to its anchors and code lines. It checks three things: overlap, lecture text hidden by an animation, and large empty regions.
- **Measured (ablation, GPT-4.1, Aesthetics / TeachQuiz):** full system 79.0 / 82.0.
  - Without the Planner: **38.1 / 40.5 (−40.9 / −41.5)**.
  - Without the external asset DB: 68.1 / 52.0.
  - Without Visual Anchor: 69.2 / 55.2 (−9.8 / −26.8).
  - Without the Critic: 72.5 / 60.7.
  - With Claude Opus 4.1: Element Layout goes from **47.5 to 90.6** and average aesthetics from 37.8 to 87.9, against a direct-code baseline. Veo3, a pixel model, scores 0.0 on Element Layout. Human 3B1B videos score 98.3.
  - Parallel generation plus ScopeRefine cut wall time from 149.8 to 15.4 minutes.
- **Adopt:**
  - **Planning is the largest single lever**, and the critic is the smallest. Our harness has a storyboard but no per-scene plan the coder must follow.
  - Replace free-form pixel coordinates with a **named anchor/slot grid**.
  - Generate and repair **per scene**, not per video.
  - Give the critic an **occupancy table** (element id → slot → code location) alongside the images.
  - Back the planner with a **curated asset library** (real map geometry, icons) instead of letting the coder draw polygons.

### 1.2 TheoremExplainAgent (TIGER-Lab, ACL 2025)
- Links: https://arxiv.org/abs/2502.19400 · https://tiger-ai-lab.github.io/TheoremExplainAgent
- **Key idea:** Planner → scene outline → per-scene vision storyboard, technical implementation plan, and animation/narration plan → Coding agent writes Manim per scene and gets up to N = 5 error-fix retries. The planning prompts specify safe-area margins and minimum spacing. RAG over the Manim docs is optional.
- **Measured:**
  - o3-mini reached a 93.8% success rate. Overall scores were 0.77 to 0.79, about the same as human videos (0.77).
  - **Element Layout was the weakest dimension for every agent (0.57 to 0.65)**, against 0.73 for human videos. The failures were overlapping text, overlapping shapes, inconsistent sizes, and poor positioning.
  - The VLM's Element Layout score correlated only moderately with humans (Spearman 0.42). Visual Consistency correlated at only 0.17.
  - **RAG lowered success from 93.8% to 82.1%** because retrieved snippets were "often irrelevant or overly generic", and it doubled input tokens.
  - The paper does not describe how narration is synced to animation.
- **Adopt:**
  - A per-scene plan with explicit layout fields.
  - Do **not** add generic doc RAG. Use a closed widget API with typed props instead.
  - Treat a VLM layout score as weak evidence (ρ = 0.42), not a gate.

### 1.3 OmniManim / "See Before You Code" (May 2026)
- Link: https://arxiv.org/abs/2605.15585
- **Key idea:** "LLMs are effective at symbolic reasoning but unreliable at fine-grained spatial layout." A **Vision Agent** plans **sparse keyframe layouts as bounding boxes before code generation**:
  - Boxes are refined coarse-to-fine.
  - An interpolation-aware objective prevents collisions in the in-between frames that animation interpolation creates.
  - The pipeline also uses a shared scene state, structured post-render diagnostics, and localized repair.
- **Measured:** the abstract reports gains over single-model and multi-agent baselines on EduRequire-500, and ablations credit the spatial prior, the box refinement, and the interpolation-aware term. I could not verify exact numbers from the abstract page.
- **Adopt:**
  - Decide **layout (boxes/slots) before code**, as data.
  - Check **mid-transition frames** too, not only settled keyframes. Our 4-keyframe sampling misses collisions during motion.

### 1.4 SGA: Plug-and-play geometric verification (KAUST, Jul 2026)
- Link: https://arxiv.org/abs/2607.18116
- **Key idea:** intercept the LLM's Manim code, partially execute it to extract a **symbolic scene graph**, detect spatial conflicts and occlusions **without rendering**, and apply targeted code refinement. It also defines MVQS, a deterministic, rendering-free spatial-quality score.
- **Measured:**
  - Peak MVQS 73.11 (Code2Video + GPT-5.1), a +16.1% relative gain, with gains in 7 of 8 backbone × pipeline configurations.
  - **Humans preferred SGA over the raw baseline in 84.4% of comparisons and over a VLM-based critic in 65.0%.**
- **Adopt:** a **deterministic overlap/out-of-bounds checker beats VLM critique** for layout. In Remotion the scene graph is free: the DOM is live in Chromium.

### 1.5 PhysicsSolutionAgent (Jan 2026)
- Link: https://arxiv.org/abs/2601.13453
- **Key idea:** a VLM reviews rendered frames for overlap, readability, and clipping, and feeds critiques back to the coder. This is the same pattern as our current critic.
- **Lesson:** it is the baseline that SGA beats.

### 1.6 Paper2Video / PaperTalker (Show Lab, NeurIPS 2025)
- Link: https://arxiv.org/abs/2510.05096
- **Key ideas:**
  1. **Tree Search Visual Choice.** The authors found that LLMs and VLMs "barely respond to small numeric changes" when asked to tune font sizes, margins, or scales. So, only for slides that a deterministic signal flags (LaTeX overflow warnings), the system **enumerates rule-based variants**: a font-size sweep, or figure scales of 1.25, 0.75, 0.5, and 0.25. It renders them all, tiles them into one image, and lets a VLM **pick the best**.
  2. **WhisperX word-level timestamps** align each subtitle sentence and its cursor target to start and end times.
  3. Slide-wise parallel generation (48 vs 287 minutes).
- **Measured:** design score 2.85 with tree search vs 2.73 without. Cursor localization QA 0.633 with the cursor vs 0.084 without. Human ranking second only to human-made videos.
- **Adopt:**
  - **Never ask the LLM to nudge numbers.** Generate discrete variants by rule and ask the VLM for a **pairwise or multi-choice pick**.
  - Gate the search on a **deterministic** defect signal.
  - Use forced-alignment word timestamps as the timing ground truth.

### 1.7 PresentAgent (EMNLP 2025 demo) and AutoLectures (May 2025)
- Links: https://arxiv.org/abs/2507.04036 · https://arxiv.org/abs/2505.02966
- **PresentAgent:** document → segments → slides → narration → TTS. It syncs at block level only.
- **AutoLectures:** maps narration to slide regions at **line or word granularity** using simple, fuzzy, or LLM matching, then drives synchronized highlights from **TTS word-level timestamps**. Its AutoLectures-1K dataset has 1,000 annotated word-level highlight instances, and it costs under $1 per hour of video.
- **Adopt:** each visual event gets a **narration anchor**, a phrase that is resolved to a word index and then to a time by deterministic matching. The LLM does not compute times.

---

## 2. Narration-to-visual alignment (beat sheets, word timing)

### 2.1 Data Player (Microsoft Research, IEEE VIS 2023 / TVCG)
- Link: https://arxiv.org/abs/2308.04703 · https://content.ieeevis.org/year/2023/paper_v-full-1049.html
- **Key idea:**
  - An LLM builds **semantic links between narration segments and visual elements**.
  - Animation design knowledge is **encoded as low-level computational constraints**, which select **animation presets** aligned with the TTS audio timing.
  - The LLM chooses *what* links to *which phrase*. A constraint layer decides *when* and *how*.
- **Measured:** a user study and expert interviews found the videos "comparable to human-composed ones". I verified the abstract only, so the details of the constraint formulation are not confirmed here. Follow-ups: Narrative Player (https://arxiv.org/abs/2410.03268) and Data Playwright (2024).
- **Adopt:** this maps almost exactly onto our fix.
  - The LLM outputs `{phrase → widget event}` links.
  - A deterministic scheduler turns phrases into frame numbers using the word timestamps.
  - A fixed preset library supplies the motion, so the Vox motion vocabulary is closed.

### 2.2 manim-voiceover bookmarks (industry practice)
- Link: https://voiceover.manim.community/en/stable/quickstart.html · example: https://github.com/ManimCommunity/manim-voiceover/blob/main/examples/bookmark-example.py
- **Key idea:** "Bookmarks allow you to trigger an animation at a specific word in the voiceover". Authors mark the narration inline and call `wait_until_bookmark(mark)` / `tracker.time_until_bookmark(mark)` in scene code. This is the de-facto 3B1B-ecosystem method for word-synced explainers.
- **Adopt:** have the screenplay writer emit **inline cue marks inside the narration text**, for example `the river [[cue:map_zoom]]Nile runs...`. Resolve every cue to a word index after TTS, and pass the cue table, not the raw words, to the visual planner. This removes the 40-word truncation entirely.

### 2.3 Forced alignment (WhisperX), used in Paper2Video
- Link: https://github.com/m-bain/whisperX
- **Adopt:** if the TTS provider returns character or word timestamps (ElevenLabs does), use them directly. Otherwise run forced alignment. Either way, timing is data computed outside the LLM.

---

## 3. Storyboard-then-shot decomposition and multi-agent director/planner/coder/critic loops

### 3.1 VideoDirectorGPT (UNC, COLM 2024)
- Link: https://arxiv.org/abs/2309.15091 · https://videodirectorgpt.github.io
- **Key idea:** the LLM writes a **video plan** before any generation: per-scene descriptions, **per-entity bounding-box layouts per frame**, backgrounds, and **consistency groupings** (which entities must look the same across scenes). Layout2Vid then renders under that explicit layout control.
- **Measured:** improved layout and movement control over T2V baselines, and better cross-scene object consistency than ModelScopeT2V.
- **Adopt:** the plan is a **typed JSON document** with per-scene layouts and **entity identity across scenes**. For example, `map:egypt` is one entity that persists and transforms across scenes, rather than being redrawn by each scene. That is how Vox carries a map through a segment.

### 3.2 MovieAgent (Mar 2025), AniME (Aug 2025), Anim-Director (SIGGRAPH Asia 2024)
- Links: https://arxiv.org/abs/2503.07314 · https://arxiv.org/abs/2508.18781 · https://arxiv.org/abs/2408.09787
- **Key idea:** hierarchical decomposition, synopsis → acts → scenes → shots. Each level is produced by a role agent (director, screenwriter, storyboard artist), and each shot is a **structured descriptor** with camera and keyframe fields.
- **Adopt:** acts are **planning structure, not on-screen content**. Our 'ACT III' chip appearing inside a map scene is a symptom of planning metadata leaking into the render. In the schema, `act` should be a field the renderer never draws. A chapter card should be a separate, explicit `ChapterCard` scene type with a full-screen slot of its own.

### 3.3 PPTAgent (EMNLP 2025)
- Link: https://arxiv.org/abs/2501.03936 · https://github.com/icip-cas/PPTAgent
- **Key idea:** edit-based generation. The system analyzes reference slides, clusters them into layout types, and extracts their **content schemas**. New slides are produced as **executable edit actions on a reference layout**, not from scratch, so designed layouts survive. Includes self-correction. PPTEval scores Content, Design, and Coherence.
- **Measured:** average PPTEval 3.67, and it beats prior generators on all three dimensions.
- **Adopt:** for a single fixed style this is the core pattern.
  1. Hand-build (trace from real Vox videos) a **small set of scene templates with typed slot schemas**.
  2. Have the LLM **select a template and fill slots**.
  3. Never let the LLM invent layout.

### 3.4 Paper2Poster / PosterAgent (NeurIPS 2025) and follow-ups
- Links: https://arxiv.org/abs/2505.21497 · PosterMELD https://arxiv.org/abs/2608.02218 · EfficientPosterGen https://arxiv.org/abs/2603.00155 · PosterGen https://arxiv.org/abs/2508.17188
- **Key idea:** Parser → Planner (binary-tree layout) → Painter-Commenter visual loop that corrects overflow and alignment.
- **Measured:** open-source Qwen-2.5 variants beat GPT-4o multi-agent systems on most metrics while using 87% fewer tokens. Removing the commenter causes overflow and clutter.
- **Failures they report:**
  - Their own appendix admits text still spills past panels.
  - EfficientPosterGen cites "unreliable layout verification" by MLLMs and replaces it with **ALVD**, a deterministic, MLLM-free color-gradient check for overflow and sparsity.
  - PosterMELD adds **deterministic gates** for canvas bounds, overlap, and lane overflow.
- **Adopt:** the 2026 trend is clear. **Deterministic gates first, MLLM taste second.**

### 3.5 COLE (MSRA, 2023-24)
- Link: https://arxiv.org/abs/2311.16974
- **Key idea:** split design generation into intention → JSON spec → layers → typography attributes → render → feedback/QA, with each step handled by a specialist model.
- **Adopt:** typography (sizes, weights, colors) should come from the **style spec**, never per-scene LLM output.

---

## 4. LLM layout generation

### 4.1 LayoutGPT (NeurIPS 2023)
- Link: https://arxiv.org/abs/2305.15393
- **Key idea:** the LLM emits layouts in a **CSS-like structured format** (`object {left: ; top: ; width: ; height: }`) with in-context exemplars.
- **Measured:** 20-40% better on counting and spatial-relation correctness than prior text-to-image layout methods.
- **Adopt:** a structured layout format helps. Raw coordinates are still fragile (see Paper2Video, OmniManim), so emit **slot names that compile to CSS**.

### 4.2 LayoutPrompter (Microsoft, NeurIPS 2023)
- Link: https://arxiv.org/abs/2311.06495
- **Key idea:** three parts.
  - Task-specific input-output serialization.
  - **Dynamic exemplar selection**, which retrieves the most similar solved layouts as few-shot examples.
  - A **layout ranker** that samples several layouts and keeps the best. The paper's text evaluates alignment and overlap. I verified the abstract only.
- **Measured:** matches or beats trained SOTA on 4 datasets and is best on Alignment and Overlap; strong in low-data settings.
- **Adopt:**
  - **Retrieve 2-3 traced Vox scene specs that match the beat type** as few-shot examples. This beats generic instructions.
  - Sample N plans and **rank by deterministic metrics** (overlap, alignment, slot usage).

### 4.3 LayoutCoT (Apr 2025)
- Link: https://arxiv.org/abs/2504.10829
- **Key idea:** RAG of exemplar layouts plus chain-of-thought refinement, with no fine-tuning. It warns that optimizing metrics alone yields "structurally impractical" boxes.
- **Adopt:** pair metric ranking with a fixed template prior.

### 4.4 PosterLLaVa (2024) and PosterLlama (2024)
- Links: https://arxiv.org/abs/2406.02884 · https://arxiv.org/abs/2404.00995
- **Key idea:** an MLLM fine-tuned on a **single-style dataset** (QB-Poster: 5,188 posters in one prevalent social-media style) outputs JSON layouts.
- **Measured:** SOTA on content-aware layout benchmarks.
- **Adopt:** evidence that **narrow, single-style data** gives coherent layouts. It supports the "Vox only" decision, using traced Vox scenes as the dataset and few-shot pool.

### 4.5 AesthetiQ (Adobe, CVPR 2025)
- Link: https://arxiv.org/abs/2503.00591
- **Key idea:** Aesthetic-Aware Preference Alignment, a DPO variant in which an MLLM judge **ranks pairs** of layouts. Training data is filtered with layout-quality heuristics.
- **Measured:** users preferred AesthetiQ layouts 78.41% of the time vs 19.37% for LayoutNUWA, with better IoU and judge win rate.
- **Adopt:**
  - Aesthetic judging works best **pairwise**.
  - Heuristic filters (overlap, alignment) come before taste.
  - Later, log approved vs rejected scene specs from human review as preference data.

---

## 5. LLM-planned animation and motion verification

### 5.1 LogoMotion (Adobe/Columbia, CHI 2025)
- Link: https://arxiv.org/abs/2405.07065
- **Key idea:** **visually grounded code synthesis.**
  - The LLM first analyzes the layout and its element hierarchy.
  - It writes a design concept, then writes animation code.
  - **Visually grounded program repair** inspects the rendered animation for errors and auto-debugs.
  - Editing widgets bind to parameters in the code, which keeps edits small and local.
- **Measured:** across 276 animations it was judged more content-aware than an industry tool. A 16-person study found the widgets gave users more control.
- **Adopt:** the LLM animates **pre-existing laid-out elements**. It does not write layout and motion at the same time. It also maps directly onto our widget/props editing UI.

### 5.2 MoVer (Stanford, SIGGRAPH 2025)
- Link: https://arxiv.org/abs/2502.13372 · https://mover-dsl.github.io
- **Key idea:** a first-order-logic DSL for **spatio-temporal properties of 2D motion graphics**, such as "A moves right of B before t", "A fades in after B", or "no overlap". The LLM writes both the SVG animation and a **verification program**. Running the verifier on the actual motion yields failed predicates, which are fed back.
- **Measured:** 58.8% of prompts correct with no iteration, **93.6% with up to 50 verify-repair iterations**, on 5,600 prompts.
- **Adopt:** each scene spec carries **machine-checkable assertions**, checked by sampling DOM state across frames in Chromium:
  - `counter_main.textAt(endFrame) == "1.7M km²"`
  - `chip_act.bbox ∩ map_title.bbox = ∅`
  - `label_x.visible ⊂ [cue_t, next_cue_t]`
  This turns "0.0M km²" and the ACT III overlap into **failed predicates with exact feedback**, not vibes.

### 5.3 Keyframer (Apple, 2024) and Decomate (Nov 2025)
- Links: https://arxiv.org/abs/2402.06071 · https://arxiv.org/abs/2511.06297
- **Key idea:** the LLM writes CSS animations for an **existing SVG**. Decomate first decomposes the SVG into animation-relevant parts using both code and render.
- **Adopt:** assets (maps, icons) are prepared SVG/TopoJSON with **named parts**, for example `country:EGY`. The LLM references parts and does not draw geometry, which addresses the crude-polygon maps.

### 5.4 MotionAgent (Feb 2025)
- Link: https://arxiv.org/abs/2502.03207
- **Key idea:** for pixel I2V, an agent turns motion words in the prompt into **explicit motion fields and camera parameters** before generation.
- **Lesson:** convert motion language to explicit parameters before rendering. In our case, `camera: {type: "push_in", target: "country:EGY", from_cue, to_cue}`.

---

## 6. VLM-as-judge for visual QA, and its failure modes

### 6.1 "Vision language models are blind" (ACCV 2024)
- Link: https://arxiv.org/abs/2407.06581
- **Finding:** VLMs **cannot reliably tell whether two circles overlap or two lines intersect**, especially when the shapes are close together. Accuracy on intersection counting is about 41% to 76%. Linear probes show the encoder holds the information but the language model fails to decode it.
- **Implication:** a VLM is the wrong tool for overlap detection. This is likely part of why our critic misses the ACT III chip covering the map title.

### 6.2 MLLM-as-a-Judge (ICML 2024) and MM-JudgeBias (ACL 2026)
- Links: https://arxiv.org/abs/2402.04788 · https://arxiv.org/abs/2604.18164
- **Finding:**
  - MLLM judges are near-human on **pair comparison** but diverge from humans on **absolute scoring** and batch ranking.
  - They show position, length, and egocentric bias, plus hallucination.
  - MM-JudgeBias finds systematic **modality neglect**: judges lean on the text prompt over the image.
- **Implication:** our critic asks for an absolute 1-10 score and an `approved` boolean, which is the least reliable mode. Our rubric is also mostly text, which invites modality neglect.

### 6.3 LED benchmark (2025-26)
- Link: https://arxiv.org/abs/2507.23295 · https://arxiv.org/abs/2603.17265
- **Finding:** in layout-error detection, models that rely on text or structured inputs beat ones that rely on visual features.
- **Implication:** give the critic the **structured bbox/occupancy data** (as Code2Video does) or replace it with code.

### 6.4 TheoremExplainAgent's own judge validity
- **Finding:** VLM Element Layout correlates with humans at only ρ = 0.42.

**Synthesis:** use the VLM only for what code cannot judge: "Does this look like a Vox frame?", "Is the map legible?", "Which of these 3 variants is best?". Ask it **pairwise or multiple-choice**, give it a grid overlay plus the occupancy table, and **gate on deterministic checks** for overlap, bounds, safe zones, text overflow, and value correctness.

---

## 7. Industry trends (2025-2026)

- **Remotion Agent Skills (Jan 2026):** `npx skills add remotion-dev/skills`, and the docs at https://www.remotion.dev/docs/ai/coding-agents and https://www.remotion.dev/skills. Prompt-to-Remotion with Claude Code, Codex, or OpenCode is now mainstream. Community guides (for example https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code) recommend iterating in a live Studio preview. The general-purpose output is what we already have, though: free-form TSX that looks interesting but is inconsistent. The differentiator is the constrained layer on top.
- **`@remotion/layout-utils`** (`measureText`, `fitText`, `fillTextBox`): deterministic text measurement for overflow-free labels. Our widgets should call these instead of fixed font sizes.
- **Pixel video models fail here:** Veo3 scores 0.0 on Element Layout in Code2Video's comparison. That supports staying code-centric.
- **Deterministic gates in 2026 papers:** PosterMELD, EfficientPosterGen, and SGA all move from VLM critique toward deterministic layout gates, with an MLLM kept only for taste.

---

## 8. Ranked: the 8 techniques most likely to fix "all over the place" for a single Vox style

1. **Word-anchored beat sheet, with timing computed deterministically and never by the LLM.**
   - The screenplay writer emits narration with inline cue marks (manim-voiceover bookmarks, AutoLectures).
   - After TTS, each cue resolves to a word index and then to a frame using provider timestamps or forced alignment (Paper2Video/WhisperX).
   - The visual planner receives a **cue table covering the full script**, not `words.slice(0, 40)`.
   - Each scene's `from`/`durationInFrames` is computed from its cues.
   - *Fixes the 30-60 s drift directly.* (Data Player, AutoLectures, Paper2Video, manim-voiceover)

2. **Scene-per-beat decomposition with explicit lifetimes and nothing implicit carrying over.**
   - The planner outputs a typed list of scenes, one Remotion `<Sequence>` each.
   - Elements exist only within their scene unless declared as a persistent entity, as in VideoDirectorGPT's consistency groups.
   - Act/chapter is metadata. A chapter card is its own full-frame scene type.
   - *Fixes PowerPoint-style accumulation and the "ACT III inside a map" leak.*
   - Planning was worth −40.9 aesthetics points when removed in Code2Video. (Code2Video, TheoremExplainAgent, MovieAgent, VideoDirectorGPT)

3. **A closed Vox scene-template vocabulary: the LLM selects a template and fills typed props, with no free-form TSX.**
   - Hand-trace about 10-15 Vox scene templates (map-zoom-highlight, paper-texture title card, highlighted-document pan, big-number counter, archival photo with marker annotation, timeline scrub, and so on). Each gets a Zod/JSON schema for its slots.
   - The LLM picks templates and fills props. It does not write layout or styling.
   - Use edit-based generation as in PPTAgent, motion presets as in Data Player, and single-style data as in PosterLLaVa.
   - *Removes style drift by construction.*

4. **Named-slot or anchor-grid placement instead of coordinates.**
   - Each template defines named slots (`title`, `kicker`, `map`, `callout_1..3`, `source_credit`), and each slot has a reserved box on a fixed grid, like Code2Video's 6×6 anchors.
   - Chips and kickers get a reserved slot that cannot intersect the title slot.
   - Text fits its slot with `@remotion/layout-utils` `fitText`.
   - *Fixes the label overlaps.* (Code2Video: −9.8 aesthetics and −26.8 TeachQuiz without anchors; LayoutGPT; OmniManim)

5. **A deterministic geometric verifier in the Chromium sandbox, run before any VLM.**
   - At sampled frames, including mid-transition frames, read `getBoundingClientRect()` and computed visibility for every `data-el` element.
   - Hard-fail on pairwise overlap of text elements, out-of-frame or safe-zone intrusion (the bottom 140 px subtitle zone), and text overflow (`scrollWidth > clientWidth`).
   - Emit the failures as structured feedback for a scoped repair of only that scene (Code2Video ScopeRefine).
   - (SGA: 84.4% preferred over baseline, 65% over a VLM critic. PosterMELD, EfficientPosterGen ALVD. VLMs are blind.)

6. **Per-scene machine-checkable assertions (MoVer-style).**
   - The planner writes assertions with each scene, for example: the counter's final text equals the formatted target; element X is visible only between cue A and cue B; the camera ends centered on `country:EGY`.
   - The sandbox evaluates them on the DOM over time.
   - *Fixes "0.0M km²" and late or early reveals with exact, actionable failures.*
   - (MoVer: 58.8% correct to 93.6% with verify-repair.)

7. **Curated asset library with named parts instead of LLM-drawn geometry.**
   - Use real geo data (Natural Earth / world-atlas TopoJSON projected with d3-geo), with countries addressable by ISO code. Add an icon set and a paper/texture pack.
   - The LLM references `country:EGY` or `river:nile` and never draws polygons.
   - Maps render full-bleed in Vox style, not in a dark boxed card.
   - (Code2Video external DB: −10.9 aesthetics and −30.0 TeachQuiz without it; Keyframer/Decomate named-part SVGs.)

8. **Demote the VLM critic to taste, using pairwise or multi-choice picks with a grid overlay and occupancy table, and exemplars retrieved from traced Vox scenes.**
   - Stop asking for an absolute 1-10 score and `approved`.
   - When deterministic gates pass but a scene is borderline, enumerate 2-4 rule-based variants: alternate template, slot arrangement, or scale. Render them side by side and ask the VLM which looks most like the attached reference frame traced from a real Vox video.
   - Include the occupancy table so the judge does not rely on visual overlap perception.
   - For planning, retrieve the 2-3 most similar traced Vox scene specs as few-shot examples (LayoutPrompter dynamic exemplars).
   - (Paper2Video tree search, MLLM-as-a-Judge pairwise > scoring, AesthetiQ, LayoutPrompter, Code2Video occupancy table.)

**Order of implementation:** 1 → 2 → 3 → 4 → 5, which deliver most of the gain. Then 7 for map quality, 6 for value correctness, and 8 as the polish loop. Items 1-4 are mostly schema and prompt changes in `agents/screenplay.ts`, `agents/animation.ts`, and `remotion/theme-widgets.tsx`. Items 5-6 extend the existing Chromium visual sandbox.

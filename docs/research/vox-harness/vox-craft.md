# Vox Craft: how Vox explainers are written and drawn, plus a style bible we can encode

Scope: one style only, the Vox explainer as made by the vox.com video team (2014–2022 era: Joss Fong, Joe Posner, Johnny Harris, Estelle Caswell, Phil Edwards, Sam Ellis, Christophe Haubursin and others). Target: Remotion in headless Chromium, with Claude as planner.

Evidence comes in three grades, and the grade is marked throughout:
- **[P] Primary.** Vox staff in interviews, Vox job postings, or Vox's own "how we make videos" video.
- **[M] Measured.** Numbers I measured myself from the 4 Vox videos already downloaded to `scratchpad/vox/`:
  - `c8f6us-Sjlo`: "Why the QWERTY keyboard is overrated" (Phil Edwards)
  - `xiiHjrewXNI`: the yield curve video (all-animated, dark chart style)
  - `KpamjJtXqFI`: North Carolina gerrymandering (paper-map style)
  - `kIID5FDi2JQ`: map projections (Johnny Harris)
- **[S] Secondary.** Tutorials and third-party breakdowns. Treat these as hints only.

No repo files were modified.

---

## 0. TL;DR: the 12 rules that matter most

1. **Narration points at the picture.** Vox scripts are written *to* a visual. They say "these squares represent…", "this map shows…", "if you zoom in here…". In the measured videos this happens 1.4–2.8 times per minute [M]. Caswell: "write to something that we'll actually see on screen" [P]. Fong: "the perfect correspondence between what you're seeing … and what you're hearing" [P].
2. **One idea per shot, and the shot changes when the idea changes.** Measured median shot length is 1.5–4.2 s in the cut-heavy videos [M]. In the all-animated yield curve video, a significant visual change lands about every 4 s, with no hard cuts at all [M].
3. **Build one visual world per act and move the camera through it. Don't stack slides.** The yield curve video is effectively one continuous canvas: 2 hard cuts in 232 s [M]. The timeline, bond stacks and curve all live in the same space, and the camera pans and zooms between them. This alone fixes most of our "PowerPoint build" problem.
4. **Move, then hold.** Graphics animate in short bursts, then sit still while the sentence finishes. In the gerrymandering video only 26 of about 150 frames in a 5 s window were visually distinct [M]. Motion means "new information". Constant drift means nothing.
5. **Paper or charcoal ground, never a dark UI card.** There are two house grounds:
   - Aged cream paper, measured `#E6D5BA`–`#F1E5CF` [M].
   - Flat charcoal, measured `#383838` [M].
   Maps and charts sit full-bleed on that ground. They are never in a boxed panel.
6. **Highlighter yellow is the signature.** Measured `#FDF200`–`#FAF300`. It matches the Vox brand `#FFF200` [M][S]. It wipes left to right behind spoken keywords in bold black gothic type.
7. **Type is an American gothic sans, Balto.** Vox uses it in its videos [P: Vox's "How we got to 10 million subs"]. The free substitute is **Libre Franklin**. Chart titles are wide-tracked ALL CAPS. Section titles are a bold italic serif (Harriet on vox.com); the free substitute is **Source Serif 4 Italic**.
8. **Maps:**
   - Countries and states are textured flat fills, cut out on paper.
   - Borders are thin.
   - Labels sit directly on the map, in small sans or tracked caps.
   - The camera pushes in on the subject; there is no map frame.
   - Clutter is removed ("clean up my map", Johnny Harris [P]).
   - Highlight a region with a solid saturated fill (Harris uses orange [P]). Don't use outlines.
9. **Charts are pictograms and direct labels, not dashboards.** Squares stand for voters, stacks of $ bills for bond yields. Values are labelled directly on the marks. There are no axes boxes or legends when a direct label will do. Small `Source: …` sits bottom-left [M].
10. **The script is a story with a question engine.** Cold open on a concrete anomaly, then "so what is this?", then go back in time, then mechanism, then a turn, then a return to the present, then an honest open ending. A why/how/what question appears about once a minute [M].
11. **Numbers arrive one at a time, with a comparison.** "Democrats got 51% of the vote; they only won 46% of seats." Each number gets its own beat and its own visual. Don't write "0.0M km²". Counters count to a real value and land on a rounded, unit-ful label.
12. **Evidence beats animation.** Caswell: "The baked in priority is always the visual evidence. Animation is like number nine on that list" [P]. Archival documents, clippings, court text and real footage are all cut out, highlighted and annotated. Graphics exist to point at evidence.

---

## 1. Sources and what each one proves

| # | Source | Type | Key takeaway |
|---|---|---|---|
| 1 | School of Motion podcast, Estelle Caswell (Earworm) — https://www.schoolofmotion.com/blog/estelle-caswell-vox-podcast | P | Pitches include "a headline for everything" plus "all of the visual hooks and evidence". She rewrites scripts "so that we can write to something that we'll actually see on screen", and asks "How can I write that sentence so that it makes people really think about what they're looking at?" She prefers jump cuts to transitions ("transitions mean nothing"). Evidence over statistics: find "the source for it and the data, to illustrate that statistic". Visual metaphor: "the circle of fifths is like a color wheel for designers". Build "a visual language that I could teach myself". |
| 2 | Uses This, Estelle Caswell — https://usesthis.com/interviews/estelle.caswell/ | P | Tools: Google Docs for scripts, Milanote moodboards, After Effects for most animation, Photoshop for textures, Premiere for the final edit, a Wacom tablet. |
| 3 | Video Consortium, Joss Fong — https://videoconsortium.org/mag/episode-1-joss-fong | P | "we're going to lean into motion graphics and we're going to lean into narration". "The perfect correspondence between what you're seeing in these animations and what you're hearing." Aim for one memorable moment per episode rather than "jamming in every fact". |
| 4 | Storybench, Joey Sendaydiego (Vox art director) — https://www.storybench.org/?p=21229 | P | The art director joins during scripting to decide what is most essential to show. Each video gets one recurring motif, e.g. flying words, or a paper clock that becomes a pie chart. Maps are the most tedious graphics and are accuracy-checked. "Overly polished work can look like an ad." Turnaround is 2–3 weeks. Retention averages about 4 min. |
| 5 | Storybench, Ed Vega (Kamala Harris explainer) — https://www.storybench.org/?p=22821 | P | Structure of N "defining moments", reused from a Zelenskyy video. One recurring frame device: monitors, corner-pinned in AE at 2.5D. "Choosing which words to highlight on screen … took several iterations". Neutrality is a design constraint. |
| 6 | Storybench, Sam Ellis (Vox Atlas) — https://www.storybench.org/?p=14818 | P | Starts with visuals ("looking for maps that could support a story") and builds the writing around them. Traces maps from old books and plots geolocated data as points. Each roughly 10-minute episode mixes maps, news clips, photos and data viz. "We do the story first." |
| 7 | Vox, "How we got to 10 million subs" (transcript) — https://rosetta.to/u/vox/how-we-got-to-10-million-subs | P | **Balto (Tal Leming)** is the video typeface, chosen to feel like "a knowledgeable friend". Other credits: GeoLayers for maps, David Rumsey historical maps, the Motion 2 plugin, the aescripts "layer random shifter", Ben Marriott paper-cutout tutorials, Prelinger Archives, Newspapers.com, the Internet Archive, composer Lauren Duree (APM). Style rule: "US" and "DC" take no periods. |
| 8 | Johnny Harris, "How I Make My Maps" (transcript) — https://rosetta.to/u/johnnyharris/how-i-make-my-maps | P | Mapbox "Outdoors" base with roads, place labels and disputed borders switched off. Blue-ish water via Hue/Sat. Highlighted country as a **solid orange** shape. Labels parented to the map so they move with it, and faded out during zooms. Hold about 4 s per camera stop, with a slight pitch drift during the hold. |
| 9 | aescripts, "How Johnny Harris makes maps" / GEOlayers — https://aescripts.com/learn/how-johnny-harris-makes-maps | S | The GEOlayers 3 workflow. |
| 10 | The Long Story, "Why the best journalists on YouTube are all former Vox employees" — https://thelongstory.substack.com/p/why-the-best-journalists-on-youtube | S | Posner's rule: a story belongs in video only if it has distinctly visual elements; b-roll over narration doesn't count. Fong began writing her own scripts, arguing video needs "a different kind of thinking". Caswell's colour-coded music visuals. |
| 11 | Nieman Lab on Vox video — https://www.niemanlab.org/?p=124626 | P | Posner: "No desks." He chose to "tell the story of the door" rather than run an interview. Fong picks stories "specifically better in video". |
| 12 | The Explainers, Phil Edwards — https://theexplainers.substack.com/p/making-the-trivialnontrivial-how | P/S | Research week, a "Rosetta stone" source, scripts written with the visuals in mind, public-domain archival material, animated timelines. |
| 13 | PremiumBeat, "Replicating Vox motion graphics" — https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/ | S | Graphics animated at 12 fps in a 24 fps edit (stutter). 3D-camera push "tracking transitions" with a blur peak at the cut. Rough-edged lower thirds revealed in jagged steps. Cycling paper textures, 2–3 per second. Subtle edge chromatic aberration. |
| 14 | No Film School, Vox-style maps — https://nofilmschool.com/how-create-vox-style-map-animations-after-effects | S | Google Earth Studio base, desaturated, with vignette, posterize-time at 10 fps and 16 mm grain in Overlay at 35%. |
| 15 | Vox job postings (Motion Graphics Designer, Art & Motion Graphics Director), via Built In / startup.jobs | P | After Effects, Photoshop and Illustrator are core. C4D is only "a plus". The role is "create animations for our YouTube channel". |
| 16 | Fonts In Use / Typewolf: Vox site uses Balto, Harriet and Alright Sans — https://www.fontsinuse.com/uses/6828/vox-website , https://www.typewolf.com/site-of-the-day/fonts/balto | S | Balto is an American gothic (Franklin / Trade Gothic lineage), 8 weights plus italics. |
| 17 | shadcn design extraction of vox.com — https://www.shadcn.io/design/vox | S | Brand yellow `#FFF200`, ink `#131313`. |
| 18 | fontalternatives.com (Balto / Franklin Gothic) — https://fontalternatives.com/alternatives/franklin-gothic/ | S | Libre Franklin is the closest free Franklin match. Source Sans is a looser Balto match. |
| 19 | CK42BB vox-explainer-skill (an LLM skill) — https://github.com/CK42BB/vox-explainer-skill | S | A useful LLM-pipeline precedent: beat budget of about 150 wpm and 25–35 words per beat; arc of cold open → turn to context → escalating explanation (50–70% of beats) → complication → return to the opening image. Its collage look is not quite Vox, so use the structure only. |

---

## 2. Measurements from the 4 downloaded Vox videos [M]

Inputs: `scratchpad/vox/*/transcript.txt` (YouTube auto-captions) and `shot_times.txt` (hard-cut detection). Colours were sampled with ffmpeg and Python; the scripts are in `scratchpad/research/vcscripts/`.

| Video | Length | Words | **WPM** | Hard cuts | Median shot | Deictic "this/these/here/zoom" per min | Numbers per min | Why/how/what per min |
|---|---|---|---|---|---|---|---|---|
| QWERTY (Edwards, host plus collage) | 348 s | 817 | **141** | 42 | 2.3 s | 1.4 | 1.7 | 1.9 |
| Yield curve (fully animated) | 232 s | 604 | **156** | **2** | (one canvas) | 1.8 | 3.4 | 1.3 |
| Gerrymandering (paper maps) | 452 s | 1154 | **153** | 49 | 4.2 s | 2.3 | 4.4 | 1.1 |
| Map projections (Harris, studio plus maps) | 360 s | 1052 | **175** | 87 | 1.5 s | 2.8 | 0.8 | 0.5 |

What the numbers show:
- **Narration rate is 140–175 wpm, around 150.** A 2-minute video carries about 300 words, not 400.
- **The animated-only video has almost no cuts.** In the yield curve video, scene-change events above threshold 0.04 happen 56 times in 232 s, so a visual beat lands about every 4.1 s. All of them happen *inside one continuous world*. This is the model for our Remotion output.
- **Visual beat rate is one new visual idea every 3–5 s**, which is about one per clause or short sentence. Hard cuts can be faster (1.5 s median, Harris) when cutting archival.
- **Gerrymandering is "move then hold".** Short animation bursts are followed by static holds, during which the paper texture is the only thing alive.

### Colours sampled from frames [M]

| Role | Hex | Where |
|---|---|---|
| Paper ground (mid) | `#E6D5BA` / `#E0D0B8` | Gerrymandering, frame corners |
| Paper ground (light) | `#F1E5CF` / `#F0E8D0` | Gerrymandering |
| Paper shadow / stain | `#D8C8A8` | Gerrymandering |
| Highlighter | `#FDF200` / `#FAF300` (worn edge `#D9D600`) | Gerrymandering cold-open title |
| Charcoal ground | `#383838` | Yield curve, 77–90% of every frame |
| Alert / inversion red-magenta | `#E00050` / `#D01050` | Yield curve inverted line |
| Positive green ($ bills) | `#98D0A0` | Yield curve |
| Dotted annotation yellow | ≈ `#E8E070` | Yield curve arcs and ellipses (visual estimate) |
| Republican red (textured) | `#E00000`–`#D05040` | Gerrymandering |
| Democratic teal / blue | `#30A0C0`, `#50B0D0`, dark `#000090` | Gerrymandering choropleth |
| Muted cream map fill | `#DDD0B0` ± texture | Gerrymandering state fills |
| QWERTY section colours | teal `#90D0D0`, yellow `#F8D870`, purple `#785070`, plus orange and pink | One flat colour per act, used as the wipe background |

### Typography and layout observed in frames [M]

- **Cold-open kinetic title** (gerrymandering, 0:02):
  - Heavy American-gothic sans, black on paper, about 6% of frame height.
  - A yellow highlighter bar wipes left to right **behind the words as they are spoken** ("In 2018, Americans" highlighted while "voted for" is not yet highlighted).
  - The map fades in behind it like watercolour bleeding through.
- **Chart titles:** ALL CAPS, wide tracking (≈0.2 em), bold sans, small (≈2.5% of frame height), centred top. Examples: "NORTH CAROLINA VOTERS", "CONGRESSIONAL SEATS", "DEMOCRATIC VOTERS, BY PRECINCT".
- **Section and chapter titles:** bold *italic serif*, dark-ochre on paper. Examples: "*Basics of gerrymandering*", "*Republican-controlled state legislatures* / 2017".
- **Map labels:** small sans in muted accent colour ("District 12" in ochre at about 40% opacity; "Winston-Salem", "Greensboro") placed on the feature. No pins and no label boxes.
- **Annotations:** a hand-drawn red circle around a city, and a bracket arc ")" to group squares. Yield curve uses dashed yellow ellipses and dotted arcs linking events.
- **Source line:** "Source: US Census" or "Source: North Carolina State Board of Elections", in tiny grey sans at the bottom-left, only on data frames.
- **Watermark:** "Vox" italic serif wordmark, white at about 60% opacity, top-right, on every frame. **We must not copy it.** Use our own small mark in the same position if anything.
- **Documents:** a court ruling shown as a giant serif text crop with an underline drawn under "beyond the reach of the".
- **Archival TV clips** (MSNBC, PBS NewsHour) run full-frame or inset. Burned subtitles are bold sans with **keywords coloured** ("the **politicians** get to pick the **voters**").
- **QWERTY collage:**
  - Each act gets one flat colour background with horizontal "stripe glitch" bars.
  - Archival engravings are cut out with a white border and drop shadow.
  - Keyboard keys are white rounded tiles with a soft shadow.
  - A timeline ruler (1840 ——— 1890) sits along the bottom and *persists* across shots, gaining ticks (1865, 1868, 1873).
  - A name label sits beside the portrait ("Christopher Latham Sholes") in bold white sans, left-aligned, with no box.

---

## 3. The script: anatomy of a Vox explainer

### 3.1 Macro structure

This is the gerrymandering video traced beat by beat; QWERTY and yield curve follow the same skeleton.

| Phase | Share | What happens | Gerrymandering example | Yield curve example |
|---|---|---|---|---|
| **Cold open: the anomaly** | 0–10% | A concrete, visual, slightly weird fact. Dated and placed. | "In 2018, Americans voted… but in North Carolina the results were really weird. These squares represent all the voters…" | "In 1980 the US economy went into a recession… that recession could have been predicted if you were looking at a very specific type of line." |
| **Stakes and the name** | ~10% | Name the thing and say why it matters now. | "This imbalance was because… gerrymandered. It means…" | "This line is called the yield curve and it's predicted every recession… that's why experts freaked out when this happened." |
| **The question / "so what is it?"** | | An explicit pivot line. | "if you want to understand why … that's a good place to start" | "so what the hell is this line? It all starts with the US Treasury bond." |
| **Mechanism (the basics)** | 30–40% | Teach the minimum model with one recurring visual system. Introduce one term at a time and give each a numbered or label card. | "two things: first PACK… you can also CRACK" (the squares regroup) | "$100 bond… 2-year, 5-year, 10-year" (stacks of $ bills) |
| **The character / history** | 15–20% | A person, document or date that drove it. | Thomas Hofeller, his files, 2010 → 2011 maps, District 12 | 1980, 1988, 2000, 2006 inversions |
| **The turn / complication** | 10–15% | Courts, a reversal, irony. | Courts rule racial gerrymander → redrawn as partisan → crack Greensboro | Why investors flip short and long rates |
| **The test / payoff numbers** | ~10% | A run of comparisons, one per beat. | "51% of the vote… 46% of seats… half the vote… 42%… 3 of 13" | "when this chart looks like this…" |
| **Present + honest ending** | 5–10% | Return to now, restate the opening image, and end on an open or quotable line. Don't summarise. | "the representatives are choosing the voters" (callback to Hofeller's own quote) | "is a recession coming? Not necessarily… but it's not a good sign." |

QWERTY uses the same skeleton:
- **Cold open:** "Why does every keyboard look like this?"
- **Provocation:** "The QWERTY keyboard is overrated."
- **History:** 1840–1873 on a timeline.
- **Myths vs real explanations.**
- **Cartel turn.**
- **Present-day ending:** "QWERTY isn't going anywhere."

The ending style differs by video. Some close on a soft callback (gerrymandering), some on a hedged answer (yield curve), some on a call to a tool or link (Harris).

### 3.2 Sentence-level rules

| Rule | Evidence | Encodable form |
|---|---|---|
| ~150 wpm; ~300 words per 2 min | [M] 141–175 wpm | `wordsBudget = round(durationSec * 2.5)` |
| Short clauses, conversational, contractions, occasional profanity or slang for punch ("so what the hell is this line") | transcripts | Avg ≤ 16 words per sentence; ≥ 30% of sentences ≤ 8 words |
| **Deixis**: refer to the visual explicitly ("these squares", "this map", "here", "zoom in here", "this guy") | [M] 1.4–2.8 per min; [P] Caswell/Fong | Every beat whose visual is a diagram should contain a deictic anchor phrase. The planner must name the anchor word (§6). |
| One new idea per clause; a visual change roughly every 4 s | [M] | `beat.durationSec ∈ [2.5, 7]` |
| Numbers: one per beat, spoken plainly, paired with a comparison or denominator ("3 out of 13", "51% of the vote… only 46% of seats") | transcripts | A number beat must carry `{value, unit, comparisonValue?}` |
| Dates and places as anchors at the start of sentences ("In 2018…", "In September 2019…", "in North Carolina") | transcripts | Each date or place spoken → a date or place visual (timeline tick or map push) |
| Questions as engine: why/how/what about 1×/min, plus "it turns out", "but", "so", "now" pivots | [M] | Each act opens on a question or "but" pivot |
| Name terms, then label them on screen (PACK / CRACK; "The yield curve") | frames | Terms → numbered caps label cards, reused |
| Quote primary sources and show them (Hofeller's "politicians pick the voters"; the court opinion) | frames | Quote beat → document crop plus highlight |
| No desk, no "in this video we'll…", no throat-clearing | Posner [P] | Ban list: "in this video", "let's dive in", "fascinating", "journey" |

### 3.3 Script process the way Vox does it (for our Screenplay agent)

1. **Research to a "Rosetta stone" source** (Edwards [P]) and collect *visual evidence* first: maps, documents, archival material, data (Caswell, Ellis [P]).
2. **Pitch as headline plus a list of visual hooks** (Caswell [P]). This maps to a `visualHooks[]` field produced *before* the script.
3. **Pick one recurring visual system or motif** for the whole video (art director [P]): squares-as-voters, $-stacks, a timeline ruler, monitors.
4. **Write narration against those hooks.** Each sentence is written for something on screen (Caswell [P]).
5. **A story editor pass cuts tangents** (Mona Lalwani [P]). This maps to a critic pass that deletes beats with no visual anchor.

---

## 4. The visual grammar

### 4.1 Grounds and surfaces

- **Paper mode** (history, maps, politics):
  - Aged cream paper texture full-bleed, with stains, folds and grain.
  - The texture "boils" subtly, cycling 2–3 texture frames per second [S PremiumBeat], or at least has a slow drift.
  - Everything sits ON the paper and is multiplied into it, so fills look printed or watercolour.
- **Charcoal mode** (economics, explainers of abstract mechanisms):
  - Flat `#383838`, with no texture or very faint grain.
  - Thin cream/white lines, one alert colour (magenta-red), dotted yellow annotations, flat pixel or 8-bit-ish characters.
- **Colour-field collage mode** (Edwards, QWERTY):
  - One flat pastel field per act, with horizontal glitch bars.
  - Archival cutouts with white border and soft shadow.
- **Pick one mode per video.** For our "ONE style" we should default to **paper mode**, keep charcoal mode as the variant for economics and data, and skip collage mode initially.

### 4.2 Typography

| Role | Vox | Free Google Fonts substitute | Spec (1920×1080) |
|---|---|---|---|
| Kinetic headline / cold-open title | Balto Bold/Black | **Libre Franklin 800–900** (fallback: Public Sans 800, Archivo 800) | 64–76 px, tracking −0.01 em, ink `#131313`, max 2 lines, max ~32 chars per line |
| Chart / map title (eyebrow) | Balto Bold caps | **Libre Franklin 700**, UPPERCASE | 24–28 px, tracking 0.18–0.22 em, centred top, ink 85% |
| Section / chapter title | Harriet Display Bold Italic | **Source Serif 4 Bold Italic** (alt: Libre Caslon Text Bold Italic, Newsreader Bold Italic) | 48–56 px, ochre `#9A7A3A` on paper or white on charcoal |
| Data labels on marks | Balto Medium | Libre Franklin 600 | 20–24 px, coloured like the mark (direct label) |
| Map place labels | Balto Regular / caps small | Libre Franklin 500 (cities), 700 caps tracked 0.15 em (countries / regions) | 18–22 px, accent-tinted at 70–90% opacity, no box |
| Big number | Balto Black | Libre Franklin 900, tabular numbers | 120–180 px |
| Source line | Balto Regular | Libre Franklin 400 | 14–16 px, grey `#6B6253` at 80%, bottom-left, 48 px margin |
| Burned subtitles / quotes | Balto Bold | Libre Franklin 700 | 34–40 px, white on footage, keywords in accent |
| Document text | period serif (scan) | **Source Serif 4** or IM Fell / Libre Caslon for old documents | Huge crop (60–90 px), hand underline |
| Monospace tag (rare) | Roboto Mono on vox.com | Roboto Mono 500 | 16 px, caps, 0.1 em |

### 4.3 Colour tokens (paper mode plus charcoal mode)

```ts
export const VOX = {
  paper:      { base: '#EDE0C8', light: '#F1E5CF', mid: '#E6D5BA', stain: '#D8C8A8', edge: '#C9B48E' },
  charcoal:   { base: '#383838', raised: '#424242', line: '#5A5A5A' },
  ink:        { primary: '#131313', soft: '#4A4A4A', muted: '#6B6253', onDark: '#F4EFE6' },
  highlight:  '#FFF200',        // highlighter; measured #FDF200
  highlightWorn: '#E8DC1A',     // multiply-blended edge for marker texture
  accent: {
    red:     '#D7322B',  // "bad"/Republican/alarm on paper (textured #E00000–#D05040 measured)
    magenta: '#E00050',  // alert line on charcoal
    teal:    '#30A0C0',  // primary data on paper (measured)
    tealLt:  '#7CC6D6',
    navy:    '#1F2A8A',  // deep end of sequential
    orange:  '#E8833A',  // highlighted country (Harris "orange shape")
    green:   '#98D0A0',  // money/positive on charcoal
    ochre:   '#9A7A3A',  // section titles, secondary labels on paper
  },
  annotation: { pen: '#C8261E', dotted: '#E8E070' }, // red marker circle; dotted yellow arcs
  sequential: ['#E6F2EF','#A9D8D6','#5FB4C4','#2E8FB0','#1F5F9A','#1F2A8A'], // teal→navy choropleth
} as const;
```

Rules:
- At most **two data hues plus highlighter** per frame.
- Red and blue mean opposed sides. Teal sequential means density.
- Highlighter is only for words being spoken, or for the one region or line being discussed.

### 4.4 Maps

These rules come from Harris [P], Ellis [P] and the gerrymandering frames [M].

- **Projection and framing:**
  - Full-bleed, on paper (or a muted blue-ish water for world maps).
  - **Never inside a dark card or box.** Land runs off the frame edges when pushed in.
- **Land:**
  - Flat fill, `paper.mid` darkened 5–8%, multiplied with a paper or watercolour texture so the fill looks printed.
  - Outer coastline slightly darker. Internal borders are hairlines (1–1.5 px at 1080p), `ink.soft` at 50%, or white on coloured fills.
- **Highlight a region by filling it solid**, either the accent or a highlighter-yellow wash. Fill it in with a wipe or watercolour bleed over 12–18 frames. Don't use stroke-only outlines for emphasis.
- **Choropleth:** a teal sequential palette, with texture multiplied in so it looks hand-coloured. Include a source line.
- **Labels:**
  - Placed on the feature, with no pins, leader-line boxes or chips.
  - Cities get a small dot (6 px) plus sentence-case label. Countries and regions get tracked caps.
  - Labels are parented to the map so they scale with the camera, and fade out during zoom moves [P Harris].
- **Camera:**
  - Start wide, push in to the subject over 1–1.5 s with ease-in-out, then **hold about 4 s** with a tiny continued drift (scale +1–2% over the hold) [P Harris].
  - Use pans between places, never cuts, when the places are on the same map.
- **Annotations:** hand-drawn red circle (stroke 5–6 px, imperfect, drawn on over 10 frames), arrows, dashed paths. Draw-on, never pop.
- **Remove clutter:** no graticule unless the topic is projections, no roads, no unrelated labels [P].
- **Accuracy:** use real geometry (Natural Earth / TopoJSON), never LLM-drawn polygons. This is one of our observed failures.

### 4.5 Charts

- **Pictogram first:**
  - Squares as people, coin or bill stacks as money, seats as squares.
  - They rearrange to show mechanism: pack and crack regroup squares into district boxes.
  - The same marks persist and *move* rather than being replaced.
- **Line charts:**
  - One line, thick (6–8 px), in cream/white on charcoal or ink on paper.
  - Turns magenta or red when it crosses into "bad".
  - Draw-on synced to narration time. The x-axis is a timeline ruler with sparse year labels.
- **Small multiples:** a row of mini-charts that the camera pans along, as with the yield curve months.
- **Direct labels** at line ends and bar tops. Avoid legends. Use no gridlines or very faint ones.
- **Numbers:**
  - A big number counts up over 0.8–1.2 s with easeOut, then holds.
  - The final label is formatted with real units ("3 of 13", "51%", "$100").
  - Never show "0.0M": the count-up formatter must use the target magnitude's unit for the whole animation.
- **Source line** bottom-left on every data frame.

### 4.6 Text on screen

- **Kinetic text is the narration's keywords, not paragraphs.** Show at most about 8 words on screen at once.
- **The highlighter sweeps behind the specific word as it is spoken.** Use word timestamps. It runs left to right over about 8–12 frames, with a slightly rough marker edge.
- **Red pen** underline or circle for emphasis inside documents and maps.
- **Labels on screen never overlap.** Each frame has a fixed number of named zones (§5), and every element is assigned one.
- **Text styles:**
  - Name labels: bold sans beside the person, left-aligned, no box.
  - Chapter cards: italic serif on the paper.
  - Never use pill-shaped chips (our "ACT III" chip) or UI badges. Vox has none.

### 4.7 Motion, camera and transitions

- **Move, then hold.** Entrances run 8–15 frames at 30 fps with easeOutCubic or a gentle overshoot. Then everything holds until the next beat.
- **Camera does the transitions.** Inside a shared canvas, pan or zoom to the next region over 15–25 frames (easeInOut), with a short motion-blur peak at mid-move [S PremiumBeat "tracking transition"].
- **Hard cuts** go between worlds: chapter changes, archival footage, quotes. Caswell: "just jump cut" [P].
- **Never cross-fade slide to slide, and never accumulate.** Old elements must leave or the camera must move off them.
- **Stutter:**
  - Optionally step graphics at 12 fps (posterize time) for the handmade feel [S]. Apply it to texture boil and cutout wobble only, not camera moves.
  - Paper texture "boil" cycles 3 textures at about 3–4 swaps per second, at low amplitude.
- **Cutouts** (archival photos and engravings): white or cream border 6–10 px, soft drop shadow (0 6px 14px rgba(0,0,0,.25)), slight rotation (±2°), slight parallax during holds.
- **Lens finish:** a light vignette and very subtle edge chromatic aberration [S], plus grain at 4–8% in overlay blend.

### 4.8 Sourcing and evidence

- **Source line** on every data or map frame ("Source: US Census").
- **Document crops:**
  - Show the actual text (court opinion, clipping, email) at large size.
  - Push in slowly. Highlight or underline the quoted phrase as it is spoken.
- **Archival clip** framing: full-frame or a centred inset with burned subtitles. Credit the broadcaster small at the top-left ("PBS NewsHour").
- **End credits:** "Video by …", then a list of music titles. Ours should be our own.

---

## 5. Frame layout zones (to stop overlaps like the "ACT III" chip)

Use 1920×1080 with a 96 px safe margin. Every element must be assigned to exactly one zone, and **one zone holds one element**.

| Zone | Rect (x, y, w, h) | Allowed content |
|---|---|---|
| `title` | 96, 64, 1728, 120 | Chart or map caps eyebrow, or italic section title (one only) |
| `stage` | 96, 184, 1728, 712 | The single visual subject (map, chart, cutout, big number) |
| `caption` | 240, 896, 1440, 120 | Kinetic narration keywords or a quote line |
| `source` | 96, 1016, 900, 32 | Source line only |
| `mark` | 1704, 40, 180, 60 | Brand mark (ours), optional |

- Full-bleed maps override `stage` and use the whole canvas. Then `title` and `caption` must sit on solid paper areas, or get a 70% paper scrim behind them.
- **There are no "act" chips anywhere.** Act or chapter identity is expressed only as a full-screen chapter card at the act start (italic serif), held for 1.5–2.5 s.

---

## 6. Encoding this for our harness (concrete proposal)

The current pipeline asks one LLM call for one free-form TSX file for the whole video. Vox's own process is staged: research → visual hooks → script written to visuals → art direction motif → shots. We should mirror that with **typed intermediate data** and a **closed widget vocabulary**.

### 6.1 Screenplay output (per beat, validated against a `shared/` JSON Schema)

```ts
type VoxBeat = {
  id: string;
  act: 'cold_open' | 'name_and_stakes' | 'question' | 'mechanism' | 'history' | 'turn' | 'payoff' | 'ending';
  narration: string;            // 6–25 words, one idea
  anchorPhrase: string;         // exact words in narration the visual changes on ("these squares")
  shot: VoxShot;                // from closed vocabulary below
  world: string;                // canvas id; beats sharing a world are continuous (camera move, no cut)
  number?: { value: number; unit: string; display: string; compare?: { value: number; display: string } };
  place?: { name: string; iso?: string; lonlat?: [number, number] };
  date?: { year: number; label: string };
  source?: string;              // required when shot is chart/map data
};
```

Validators, written as data:
- `wordsTotal ≤ 2.6 × durationSec`
- every beat has `anchorPhrase ⊂ narration`
- data shots have `source`
- consecutive beats in the same `world` should be ≥ 60% of all beats; this enforces the continuous-canvas behaviour
- at most 1 `chapter_card` per act

### 6.2 Closed shot vocabulary (Remotion widgets, one Vox style)

| Shot | Vox source | Required props |
|---|---|---|
| `kinetic_title` | gerrymandering 0:02 | words[], highlightWords[], word timestamps |
| `chapter_card` | "*Basics of gerrymandering*" | title (italic serif) |
| `map_push` | NC maps, Harris | geo feature ids, camera from/to, highlight ids, labels[] |
| `choropleth` | "% Black people per neighbourhood" | geojson ref, values, palette = sequential, source |
| `map_annotate` | red circle on Winston-Salem | target lonlat, kind: circle/arrow/path |
| `pictogram_grid` | voter squares | groups[{count, colour, label}], regroup steps |
| `stack_compare` | $-bill bond stacks | items[{label, value}] |
| `line_draw` | yield curve | series, alertThreshold, timeline ticks |
| `timeline_ruler` (persistent) | QWERTY 1840–1890 | range, ticks added per beat |
| `big_number` | "51%" vs "46%" | number + compare |
| `document_crop` | court opinion | text or image, highlight phrase |
| `cutout_photo` | Sholes portrait plus name | image, name label |
| `archival_clip` | MSNBC/PBS | clip ref, credit, subtitle keywords |

Every widget has these properties:
- It renders **only** in its layout zones, with Vox tokens.
- Its timing comes from `anchorPhrase` word timestamps. This fixes the 30–60 s drift: visuals key off the *word*, not off an estimated storyboard time.
- It exits when the next beat in a different world starts. This fixes PowerPoint accumulation.

### 6.3 What the LLM does vs what code does

- **LLM:**
  - Research summary, then `visualHooks[]`, then beats (narration plus shot choice plus props).
  - Choose one motif per video (`pictogram_grid` or `timeline_ruler` as the recurring system).
- **Code:**
  - Layout zones, tokens, fonts, easing, camera math, counters and number formatting.
  - Real geodata (Natural Earth) and word-timestamp alignment.
- **Vision critic:**
  - Score against this rubric: overlap, accumulation, text ≤ 8 words, one highlight hue, source present on data frames, map full-bleed and not boxed, and the visual changing within ±300 ms of the anchor word.
  - Sample frames *at each anchor word* rather than at 4 fixed keyframes.

### 6.4 Deltas vs current `remotion/theme-widgets.tsx` (read only, not modified)

| Current | Vox target |
|---|---|
| Body font `Georgia`; UI `Helvetica 800/900` | Libre Franklin 700–900 for all sans; Source Serif 4 Bold Italic for chapter titles only |
| Highlighter `#F5D33A` (warm gold) | `#FFF200` (Vox hazard yellow) |
| Accent `#B8332A`, purple `#6C3FA0` | Red `#D7322B` / teal `#30A0C0` pair; orange `#E8833A` for map highlight |
| Map on `#1E2A36` dark card, land `#DDD3BC` with stroke `#9B8E74`, pins plus dark label chips `#1E1D1B` | Full-bleed on paper; land multiplied with texture; hairline borders; solid-fill highlight; no chips or pins; labels on the feature |
| Paper bg `#F4ECD8` with dot pattern | Paper `#EDE0C8` with a real scanned paper texture (stains, fold) and slow boil; no dot grid |
| Charts with rounded bars `rx=5`, axis labels | Pictograms, direct labels, faint or no axes, source line |

---

## 7. Free fonts (Google Fonts, OFL)

- **Libre Franklin**: https://fonts.google.com/specimen/Libre+Franklin. The closest free American gothic to Balto (≈92% match to Franklin Gothic per fontalternatives). Weights 100–900 plus italics.
- **Source Serif 4**: https://fonts.google.com/specimen/Source+Serif+4. Bold Italic stands in for the Harriet section titles. Alternatives are Newsreader and Libre Caslon Text.
- **Public Sans** / **Archivo**: fallback gothics.
- **Roboto Mono**: rare tags.
- **IM Fell English** / **Libre Caslon**: old-document recreations only.

Load the fonts locally in the Remotion bundle (`@remotion/google-fonts/LibreFranklin`, `.../SourceSerif4`) so Chromium renders deterministically.

---

## 8. Caveats

- Vox has published no official style guide. The tokens above are measured from 4 videos (2016–2019 era) plus staff interviews. The look varies by producer: Caswell is colour-coded and music-driven, Edwards uses colour-field collage, Harris uses paper and Mapbox.
- **Don't copy Vox trademarks.** That means no "Vox" wordmark, no brand name in output and no Vox end-card. We emulate a grammar, not a brand.
- The 12 fps stutter claim is from a tutorial [S]. My duplicate-frame test was inconclusive: holds dominate, so I couldn't isolate the step rate. Treat stutter as optional.
- WPM was computed from auto-captions, which slightly undercount words.

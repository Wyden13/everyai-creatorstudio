# `src/vox/`: the Vox explainer harness

One style only: Vox-style paper explainers. The LLM writes **data**. Code owns everything visual: layout, timing, motion, cartography and typography. That split is why the output stops being "all over the place".

```
topic ──► runVoxScreenplayAgent ──► BeatSheet (zod + editorial rules, violations fed back ≤3×)
             (screenplay.ts)              │
                                          ▼  voiceover (TTS with word timestamps)
                                   full word track
                                          │
          compileTimeline (timing.ts) ◄───┘   script↔audio LCS alignment, beat frames,
                │                             cue + spoken-word frames, transitions, camera
                ▼                             continuity, auto-framing, label placement
         auditTimeline (render.ts)    Chromium: sample each beat at its settled cue-landing and
                │                     resting frames, measure real text ink boxes →
                │                     auditFrame (audit.ts): overlap / safe-area / subtitle;
                ▼                     in parallel a low-res probe → auditMotion: frozen frames
     repairVoxBeat (failing beats only, narration locked) ─► re-audit (≤2 rounds)
                │
                ▼
     renderTimelineVideo: parallel Chromium frame capture → FFmpeg + burned captions
```

`produceVoxVideo` (harness.ts) runs everything after voiceover. It returns `Rendered`, `AuditFailed` or `SandboxFailed`. The pipeline harnesses in `src/harness/` wrap these entry points.

| File | Responsibility |
|---|---|
| `tokens.ts` | `VOX_SPEC` as numbers: palette, fonts, frame zones, cue lags, motion durations, camera `PUSH` per shot, `TRANSITIONS`, camera, label and pen-arrow geometry |
| `motion.ts` | Pure motion maths shared by compiler, widgets and tests: easing, word landing frames, push, map camera, unit regrouping, `TRANSITION_RULES`, `layersAt` |
| `beat-sheet.ts` | The Screenplay contract: closed shot vocabulary (`headline`, `chapter`, `map`, `number`, `pictogram`, `timeline`, `quote`, `line`, the diagrams `split`, `chain`, and the list shots `punch`, `ranking`, `versus`, `checklist`, `chat`), the `CHARS` and `COUNTS` caps, and the `BEAT_SHEET_RULES` table |
| `diagram.ts` | Pure diagram geometry: `splitLayout` and `chainLayout` per orientation (`SLAB`, `CHAINS` rows), label stacks, 1-D label spreading |
| `rows.ts` | The list shots' logic and geometry (pure): who wins, computed from typed values (`rankOrder`, `rankSlots`, `rowWinner`, `versusVerdict`), and `rankingLayout`, `versusLayout`, `checklistLayout`, `chatLayout` per orientation (`RANKINGS`, `VERSUS` rows); `wrapLines` |
| `format.ts` | The `UNITS` table (`UnitSpec` rows: dimension, base factor, prefix/suffix, spoken words, magnitude words, count, signed), figure/year formatting and `spokenFigure`. A count-up formats with the target's magnitude, so "0.0M km²" can't happen. `WRITTEN_ONLY` (symbols and abbreviations the narration may not write) is derived from it |
| `speech.ts` | Spoken numbers both ways: `speechUnits` reads "two point five trillion", "2,500,000", "minus forty", year pairs as one value (alignment and `number_matches_speech` share it); `numberWords` writes a value as words; `tokenize` |
| `inflation.ts` | Same-currency inflation adjustment (`inflate`, `shownValue`) from the baked tables in `assets/inflation/cpi.json` |
| `icon-manifest.ts` | The closed pictogram icon catalog (`ICONS`, `ICON_FAMILIES`); path data lives in `assets/icons/icons.json` |
| `geo-manifest.ts` | The map vocabulary as data: `MAP_VIEWS`, `ANCIENT_LAYERS`, `SITES`, `ERA_NAMES`, `ALIASES`, `DISPLAY_NAMES`, `WORLDVIEWS`, `HIST_SNAPSHOTS`, `GEO_SOURCES`, and the id naming rules |
| `places.ts` | Place resolver: names / ISO codes / QIDs → canonical ids against `assets/geo/catalog.json` (`resolveRef`, `resolveSheetRefs`), era names (`placeName`), snapshot choice, the prompt's famous places and the `knownPlaces` retrieval pre-pass |
| `geo.ts` | Bun-side map compiler (`compileMaps`): worlds, `PROJECTION_RULES`, camera framing and clamping, and a per-sheet pruned `GeoScene` |
| `geo-shapes.ts` | Shape helpers shared with the pack build (`mainBox`) |
| `timeline.ts` | Compiled Timeline types shared by Bun and browser |
| `timing.ts` | Alignment, timeline compilation, auto-framing, label placement, caption words |
| `VoxVideo.tsx` | The hand-written widget library traced from reference Vox videos (browser) |
| `audit.ts` | Deterministic checks, as tables: per-element and per-pair layout checks, temporal checks (`frozen_frame`), and register-gated motion checks on the compiled timeline (`hard_cut`, `register_motion`) |
| `register.ts` | The Tone (`Register`): one `REGISTERS` row per tone, `resolveStyle(format, register)`, the prompt block, and code-inserted vocal tags (`voiceScript`, `stripVocalTags`) |
| `audio.ts` | Procedural FFmpeg sound effects (`SFX`), their placement from word-timed cues (`sfxCues`) and the ducked mix graph |
| `render.ts` | Audit pass and full render on top of `remotion/visual-sandbox.ts`; generates the register's SFX and mixes them under the voice |
| `screenplay.ts` | Prompt bible generated from the same tables the validator enforces, plus the scoped repair agent |
| `harness.ts` | Post-voiceover orchestration |
| `fixtures.ts` | A valid sheet and synthetic voice track shared by the Vox and harness unit tests |
| `schemas.ts` | Emits `shared/schemas/vox-beat-sheet.schema.json` (drift is caught by a test) |

## Motion: animation at all times

Owner's rule: if it looks like a PowerPoint slide, it fails. Nothing on screen is still except maps (and, later, real pictures). Diagrams are not in `STILL_SHOTS`: they build on cue and keep moving once built. This supersedes the research's "move, then hold" (`docs/research/vox-harness/vox-craft.md`).

| Shot | Lands | Keeps moving |
|---|---|---|
| `headline` | Kinetic type: each word rises into place on the frame it is spoken (`landingFrames`), the highlighter sweeps on its cue | Camera push |
| `chapter` | Title builds word by word, pen rule draws | Rule keeps extending; camera push |
| `number` | A counting figure is up from the beat start and counts (odometer ticks) toward its spoken word; a comparison slides the main figure aside | Proportion bars grow between the two figures, then both figures scale to their share; camera push |
| `pictogram` | Cells (catalog icons, or squares when the shot has no `icon`) fly in to a scattered grid; the legend shows count (× `per`) and a "1 icon = …" key | On each group's cue every cell slides to its regrouped slot (`unitSlots`) and the group takes its colour; camera push |
| `timeline` | Ruler draws, marks and leaders land on cue, the red head runs between marks | Camera push |
| `quote` | Words reveal as they are read (unspoken words cascade), highlighter on cue | Camera push |
| `number` (a year) | Years never count: the label and a pen rule under the figure's slot arrive at the beat start, the year drops in on its word | The rule keeps extending; camera push |
| `line` | The axis draws from the beat start (x labels land as it passes); the line starts drawing once the axis is built, or on its cue if that is earlier | Line keeps drawing until just before the beat ends, rippling head dot; the camera push tracks the head |
| `split` | The whole slab grows in (the whole is named in the title); on `at` a pen tear draws across it, the parts pull apart (`splitApart`) and each takes its tone and label on its own cue | Parts keep drifting apart (`SPLIT.drift` over the push span); camera push. A same-world continuation starts already torn |
| `chain` | A faint guide draws through every slot; each link's arrow draws into its node, which pops on its phrase (uncued nodes follow by `linkDraw`) | The newest node ripples; camera push. A same-world continuation that repeats the previous nodes (`chain_grows`) slides them to the new layout, then the new links build |
| `punch` | A full-bleed field; a pen rule draws under the words from the beat start; each word lands on its phrase in the register's punch feel (below) | Rule keeps extending; camera push (hype: shake on each word) |
| `ranking` | Dashed rails draw from the beat start; each item lands on its phrase in its slot among the items already up (rank numeral, label, bar growing to its share of the largest, counting value) and the rows slide to re-sort; #1 is red with a highlighter under its label | #1's bar head ripples; camera push |
| `versus` | Both names land, the VS badge slams in, then each row's two values count up on its phrase; once counted, the winner gets a pen circle and the loser fades back | After the last row, the side winning more rows gets the highlighter; camera push |
| `checklist` | Pen boxes draw from the beat start; each item slides in on its phrase, then the pen ticks (teal), crosses and strikes through (red) or squiggles (ochre) it | The newest mark ripples; camera push |
| `chat` | Typing dots on the sender's side, then the bubble pops in on its phrase; the stack scrolls up once it outgrows the stage (bubbles fade out at the stage top) | Dots pulse, the newest bubble floats; camera push |
| `map` | Layers bleed, labels, pins (drop and bounce, name lands with them), pen circle, pen arrow and army arrows on cue | Army arrows advance along their route behind a solid head, then a march pattern flows along them. Real camera: eases between same-world views and drifts in from the first frame (allowed to be still-ish) |

Rules that keep this safe:

- **Words never wait long.** A word lands on its spoken word, but never more than `MOTION.wordWaitMax` after the previous one, so a late-spoken headline never leaves an empty frame.
- **Every `PUSH` row ends at scale 1.** Scaling down about a point inside the stage keeps the layout inside its zones, so the layout audit holds for every frame of the push by construction.
- **A same-world run shares one push span and the next map camera starts where the last ended (drift included)**, so glides never jump.

**Transitions (no hard cuts, except a register's punchline `cut`).** Every beat after the first has `enter: { kind, from, to }`: a window centred on its start, at most `TRANSITION_MAX_SHARE` of either beat. `TRANSITION_RULES` (motion.ts) picks the kind, first matching row wins:

| From → to | Kind | Look (`TRANSITION_LOOKS` in VoxVideo.tsx) |
|---|---|---|
| any → any, same world | `glide` | No window: camera and carried elements are already continuous |
| `headline` / `quote` / `chapter` → any, any → `chapter` | `wipe` (14 frames) | A highlighter stroke sweeps left→right, revealing the incoming beat |
| a register's swap (hype) | `zoom` (8 frames) | The outgoing beat scales up and fades as the incoming settles in |
| a register's swap (dramatic) | `dip` (20 frames) | Fade through the field colour (ink) |
| a deadpan/comedic punchline beat | `cut` (0 frames) | Hard cut; nowhere else (`hard_cut` audit) |
| everything else, 9:16 | `rise` (16 frames) | The push, vertical: the outgoing beat slides off the top as the incoming rises in |
| everything else | `push` (16 frames) | Paper push: the outgoing beat slides off left as the incoming slides on |

**The audit skips transition windows.** Mid-transition text is meant to be sliding off-frame or under a wipe, so overlap and safe-area checks there would only report the transition itself. The settled frames on both sides of every window are audited instead (`auditFrames`).

**Frozen-frame check (`frozen_frame`, `MOTION_PROBE` in audit.ts).** A second Chromium session renders the whole video every 0.25 s at 1/8 size with the paper textures off (their boil would count as motion), decodes each PNG to luma in the page, and measures the mean absolute luma change from the previous sample. A run of changes below `stillLuma` (0.01 of 255) lasting at least `frozenSec` (1 s) inside a beat whose kind is not in `STILL_SHOTS` (`map`) is a violation naming the beat, so the scoped repair loop sees it like any layout problem. It costs about 5 s for a 22 s Short, run in parallel with the layout audit. Measured: a truly still frame is exactly 0.000, the slowest push about 0.02-0.1, map drift about 0.23.

## List shots

Topic-agnostic shots for any trend topic, from `docs/research/research-tone-shots.md` (batch 1; the world map is separate). The LLM writes data; code decides every winner and draws every mark. Logic and geometry live in `rows.ts`, the widgets in `VoxVideo.tsx`.

| Shot | Shape | Code decides | 16:9 | 9:16 |
|---|---|---|---|---|
| `punch` | 1-3 `words` `{text ≤12, one word, at}`, `field` (`ink`, `red`, `yellow`, `paper`; colours from the grade, `PUNCH_PAINT`) | How each word lands, from the register (`motion.punch`) | Stacked words, up to 340 px | up to 300 px |
| `ranking` | `title`, `unit`, `better` (`higher`/`lower`), 3-6 `items` `{label ≤18, value, at}` | The order (`rankOrder`), each arrival's slot (`rankSlots`: arrived items pack from the top by rank), #1, one shared scale (the unit line "million km²" sits above the values) | numeral \| label \| bar → value | label above a full-width bar |
| `versus` | two `sides` `{label ≤16, tone}`, 1-4 `rows` `{label ≤14, unit, left, right, better: higher/lower/none, at}` | Each row's winner (`rowWinner`) and the side winning more rows (`versusVerdict`; a draw has none) | names over two value columns, row labels between, VS between the names | stacked halves (name, then label \| value rows), VS in the seam |
| `checklist` | optional `title`, 2-5 `items` `{text ≤36, mark: yes/no/maybe, at}` | Text size (shrinks to fit, never under `readable`), wraps (`wrapLines`) | pen box \| text, spread down the stage | same, bigger |
| `chat` | `people` `{a, b}` (≤14), 2-6 `messages` `{from: a/b, text ≤48, at}` | Bubble sizes, the scroll, the header ("A & B") | `a` left, `b` right, beside their initial | same, bigger |

Rules: `cues_in_order` (punch words, versus rows, checklist items and chat messages build in reading order; a ranking re-sorts in any order), `ranking_unit` (bars grow from zero: no year, one_in or temperature), `ranking_values` (every item a distinct, non-zero figure on the shared scale), `versus_fit` (on a phone, a row's label plus its widest value must fit at the readable size), and `number_matches_speech` / `unit_sign` / `spoken_form` cover ranking items and versus rows (`FIGURES` in beat-sheet.ts lists every typed figure a shot shows). Chat bubbles are generic (no app's look); the prompt says a chat is "the gist", never a verbatim quote of a real person.

**Punch feel per register** (`motion.punch` in `REGISTERS`, tested per register): documentary 1.3× → 1 over 8 frames; deadpan a flat cut (1×, 0 frames); comedic 1.6× with its spring and a soft flash; hype 1.8× with its spring, shake and a strong flash; wholesome 1.15× eased in; dramatic a slow 36-frame fade from 1.06×. Durations scale with the register's `duration`.

## Diagrams

Animated diagrams for what maps, numbers and timelines cannot show. Each builds on its spoken cues (`cues_in_order`: the tear before its parts, parts and links in reading order) and morphs instead of cutting when the next beat continues it (same `world` and kind).

| Shot | Shape | For | 16:9 | 9:16 |
|---|---|---|---|---|
| `split` | `whole`, `at`, 2-3 `parts` `{label, tone, at?}` | One thing dividing: an empire in two, a schism, a partition | Slab tears along x, parts side by side | Slab tears along y, stacked bands the full stage width |
| `chain` | optional `title`, 2-5 `nodes` `{label, sub?, tone?, at?}` | A succession, a family line, cause → effect | Left→right, labels alternate below/above | Top→bottom down the stage's left edge, labels filling the width right of the spine |
| map `armies` | ≤2 `{from, to, tone, at}` on a `map` | Campaigns, invasions, migrations: they need geography, so they live on the map | Thick tone arrow advancing along a curved route | same |

**Phone sizing (9:16).** A phone shows the stage small, so every 9:16 shot fills it and no stage text is under 48 px: the sizes are data in `LAYOUTS['9:16']` (tokens.ts: `type`, `readable`, `figureStack`, `legend`, `markStack`, `labelLines`, `chart`, `rank`, `versus`, `check`, `chat`), never a branch on aspect in a widget. Caps labels may wrap onto a second line (`labelLines: 2`; `capsLines` in diagram.ts counts the lines the same way the browser wraps them). Figures, timeline marks and chain nodes start at their type ceiling and shrink only to fit their box; the unit grid picks the column count with the biggest cells (ties go to the wider grid) above a one-row-per-group legend whose per key spans the whole row; line x labels, the line's end value, quote attributions and title sub lines are layout rows too (48 px or more on a phone). The render sandbox test "fills the phone stage" measures each shot's ink box over the stage and its smallest font; a six-mark timeline is the one row allowed under 48 px (its sub lines shrink to ~34 px to fit six stacks).

`chain_grows`: a chain continuing its world repeats the previous nodes first (same labels, in order); the carried nodes (`node:<i>:<label>` keys) slide from the old layout to the new one over `cameraMove`, and new nodes land only after that. Label placement treats army arrows as obstacles like the pen arrow.

## Formats

One style, two delivery formats, each a row in `FORMATS` (`beat-sheet.ts`); the validator and the prompt both read it.

| Format | Frame | Default target | Narration | Beat | Captions (`remotion/captions.ts`) |
|---|---|---|---|---|---|
| `explainer` | 16:9 | 120 s | 2.1-2.8 words/s | 4-32 words | karaoke band at the bottom (`\kf` sweep, 6 words) |
| `short` | 9:16 | 60 s (130-160 words; Gemini "Puck" reads ~2.9 words/s) | 130-160 words/min | 3-12 words, hook ≤12 words | big Shorts captions in the lower third: ≤3 words / ≤18 chars, one ASS event per word with the spoken word in highlighter yellow, clear of the Shorts UI (rail, top bar, bottom 400 px) |

No source lines on screen and no citations in the beat sheet; accuracy rules (real quotes, no invented numbers or events, hedged estimates) stay. `LAYOUTS[aspect].zone.subtitles` is derived from the caption geometry in `remotion/primitives.ts` `ASPECT_SPECS`, so the `subtitle_band` audit measures against the burned captions.

## Assets (`backend/worker-agents/assets/`)

Nothing is credited on screen. The source and licence of every asset are data (this table, `ICON_FAMILIES`, the per-icon `author`, the `sources` in `cpi.json`); whether a video's description credits them is the user's call.

| Asset | Source | Licence |
|---|---|---|
| `geo/mediterranean.topo.json` (92 KB) | Natural Earth via world-atlas 2.0.2, and AWMC Roman extents (commit `7ecf8bc`) | Public domain / ISC; AWMC is ODbL (attribution: "Ancient World Mapping Center") |
| `geo/world-iso.topo.json` (353 KB) | Natural Earth 5.1.2 (`natural-earth-vector` tag v5.1.2): 10m ISO-worldview countries simplified to ~50m density, 50m breakaway/disputed areas, lakes, rivers | Public domain (credit optional: "Made with Natural Earth") |
| `geo/admin1/<CC>.topo.json` (200 files, 1.4 MB) | Natural Earth 5.1.2 10m admin-1, split per country; `US` from us-atlas 3.0.1 `states-10m` (U.S. Census cartographic boundaries) | Public domain; us-atlas ISC, Census data public domain |
| `geo/hist/<year>.topo.json` (53 snapshots, 2.4 MB) | Cliopatria v0.2.1 (Seshat Global History Databank), POLITY rows alive in the year, dissolved per polity, clipped to the ISO land, simplified. Approximate by construction | CC BY 4.0: credit "Cliopatria, Seshat Global History Databank", link the licence, say it was simplified and clipped |
| `geo/catalog.json` (1.3 MB) | Rows for the resolver: NE countries, admin-1 and 7,342 populated places (tier 1 = scalerank ≤ 2), Cliopatria polities and per-snapshot membership | As its sources above |

All geo packs come from `bun scripts/geo-build.ts` (pinned URLs, sha256-checked, deterministic, size budgets per family, ~5.6 MB committed). Downloads stay in the gitignored `.geo-cache/`; another worldview's pack is built there with `--worldview=<id>` once its sha256 is pinned in `WORLDVIEWS`. The same table is data in `GEO_SOURCES` (geo-manifest.ts): every timeline lists the ids its maps drew (`Timeline.sources`), and the animation harness output carries them with licence and suggested credit for the Publisher. Crediting is the user's call; nothing is on screen.
| `fonts/` | Libre Franklin (stands in for Vox's Balto) and Source Serif 4 Italic | OFL |
| `textures/` | Generated with `python3 scripts/paper-texture.py assets/textures` | Ours |
| `icons/icons.json` (Phosphor ids) | Phosphor Icons 2.1.1, `fill` weight (npm `@phosphor-icons/core`). Rebuild with `bun scripts/icons-build.ts` (pinned, sha256-checked) | MIT (`icons/LICENSE-phosphor.txt`) |
| `icons/icons.json` (game-icons ids) | game-icons.net at commit `82d9488`, per-icon `author` in the JSON | CC BY 3.0 (`icons/LICENSE-game-icons.txt`); credit each author (Delapouite, Lorc, Skoll, Cathelineau, Sbed, Quoting, HeavenlyDog, Lord Berandas) |
| `inflation/cpi.json` `usd` 1913-2024 | U.S. BLS CPI-U all items, U.S. city average (FRED `CPIAUCNS`), annual mean of 12 months. 2025 is left out: BLS published no October 2025 index. Rebuild with `bun scripts/inflation-build.ts` | Public domain (U.S. federal work); FRED asks for a citation |
| `inflation/cpi.json` `usd` 1800-1912 | Minneapolis Fed "Consumer Price Index, 1800-" (BLS historical series: Vermont farmers, Hoover, Rees), spliced onto BLS at 1913 | Series compiled by the BLS; the Minneapolis Fed site's disclaimer says "research and informational purposes" (open question, see TODO) |
| `inflation/cpi.json` `gbp` 1800-2025 | ONS `CDKO` long-run price index (Jan 1974=100) | Open Government Licence v3.0 ("Source: Office for National Statistics licensed under the Open Government Licence v3.0") |

## Numbers and units

The LLM writes `value` + `unit`; code owns how it looks and how it must be said. Every unit is a row in `UNITS` (format.ts), so the schema enum, the prompt catalog (`usd: $2.5 million → "two point five million dollars"`), the narration lint and the formatter cannot drift.

| Dimension | Units |
|---|---|
| money (no exchange rates: each currency compares only with itself) | `usd` $, `eur` €, `gbp` £, `jpy` ¥, `cny` (spelled "yuan"), `inr` ₹ |
| length, area | `m`, `km`, `mi`; `km2`, `mi2`, `hectares` |
| mass, speed | `kg`, `tonnes`, `lb`; `kmh`, `mph` |
| duration | `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`, `decades`, `centuries` |
| temperature (signed: zero and negatives allowed, never drawn as bars) | `celsius` °C, `fahrenheit` °F |
| energy, power, data (decimal SI) | `kwh`, `twh`; `w`, `mw`, `gw`; `mb`, `gb`, `tb`, `pb` |
| density, volume | `per_km2`; `liters`, `barrels` |
| share, ratio, count, year | `percent`, `one_in` ("1 in 4"); `people`, `soldiers`, `count`; `year` |

Glyphs: Libre Franklin covers € £ ¥ ₹ ° ² and the minus sign (checked against the font's cmap), so no currency is spelled for lack of a glyph; the yuan is spelled only to tell it from the yen. Magnitude words are million, billion and trillion (a row's `scales` says which it may use); below them, full digits.

Rules (rows in `BEAT_SHEET_RULES`; those with a `doc` are stated in the prompt's NUMBERS AND UNITS block):

- `number_matches_speech`: a number shot's `at` (and its compare `at`) sits on a spoken number equal to the figure at screen precision ("five point two million" for 5,200,000; "fifty-one percent" for 50.6). A pictogram group, ranking item or versus row whose `at` is a spoken number must say what the screen shows there (count × `per`; the item's value; one of the row's values). The violation tells the model what to say, which is how an inflation-adjusted figure (unknown to the model) reaches the narration.
- `compare_same_dimension`: a comparison shares its main figure's dimension; bars convert with `toBase` (square miles against square kilometers), currencies only against themselves.
- `spoken_form`: narration never writes the unit table's symbols or abbreviations (`$ € £ ¥ ₹ / ° %`, `km`, `mph`, …); plain digits (years) are fine.
- `unit_sign` (number figures, ranking items, versus values), `inflation_known`, `pictogram_fit`, `icon_families` (one family per pictogram, at most two per video), `ranking_unit`, `ranking_values`.

**Inflation.** A money figure may carry `inflation: {year, to}`: `value` is in `year` prices, the screen shows `inflate(...)` rounded to two significant digits with "in <to> dollars" under it. Same currency only, from `assets/inflation/cpi.json`: USD 1800-2024, GBP 1800-2025. Alignment reads "trillion" and "minus"/"negative"; still unsupported: "oh" years, ordinals, "half"/"quarter".

## Adding things

- **A unit:** a row in `UNITS` (format.ts) and a row in `UNIT_ROWS` (units.test.ts). Check the font has any new glyph.
- **An icon:** a row in `icon-manifest.ts`, then `bun scripts/icons-build.ts`.
- **A currency's inflation table:** a source row in `scripts/inflation-build.ts` (pinned by the sha256 of the extracted series; check the licence first).

- **A view, site, era name, alias or display name:** a row in `geo-manifest.ts` (`MAP_VIEWS`, `SITES`, `ERA_NAMES`, `ALIASES`, `DISPLAY_NAMES`). Cities, countries, admin-1 areas and polities come from the catalog build; a snapshot year is a row in `HIST_SNAPSHOTS` (then `bun scripts/geo-build.ts`).
- **A projection:** a `PROJECTIONS` entry and a `PROJECTION_RULES` row (geo.ts).
- **An editorial rule:** add a row in `BEAT_SHEET_RULES`. The prompt lists rule names automatically.
- **A shot kind:** add it to `ShotSchema` (caps in `CHARS`, counts in `COUNTS`; typed figures in `FIGURES`), `SHOTS` in `VoxVideo.tsx` (its sizes as `LAYOUTS` rows in tokens.ts, its geometry per orientation in a pure module like `rows.ts`), a `CUE_LAG_MS` role, `SHOT_DOCS` in `screenplay.ts`, `shotPhrases`, `ELEMENT_KEYS` in `timing.ts` (what a same-world continuation carries), `ORDERED_CUE_SHOTS` if it builds in reading order, `PUSH` (or `STILL_SHOTS` if it may hold still), a `SHOT_TOURS` row so both aspects are rendered and audited, and a row in the 9:16 fill table (vox.test.ts). Run `bun scripts/emit-schemas.ts`.
- **A diagram orientation:** a row in `SLAB` / `CHAINS` (`diagram.ts`); the geometry tests check every `COUNTS` size in every aspect.
- **A transition:** a row in `TRANSITIONS` (tokens.ts), `TRANSITION_LOOKS` (VoxVideo.tsx) and the pairing in `TRANSITION_RULES` (motion.ts).
- **An audit check:** add a row in `ELEMENT_CHECKS`, `PAIR_CHECKS`, `TEMPORAL_CHECKS` or `TIMELINE_CHECKS`.
- **A tone:** a row in `REGISTERS` (register.ts). Measure its voice's words/s with the TTS spike first; a new caption look is a row in `CAPTION_STYLES`, a new sound a row in `SFX`.

## Tone (`Register`)

UI label "Tone"; the code says `Register` because `Tone` already names the data hues (`COLOR.tone`). One register per video, on the beat sheet (`register`, default `documentary`) and the screenplay harness input. Every per-register value is one row in `REGISTERS`; `resolveStyle(FORMATS[format], register)` is the one place a register meets a format (it scales the narration budget by the voice's measured words/s over Puck's 2.9), so there is no row per combination. The look stays Vox: same fonts and layouts; a register only re-grades, changes motion feel, captions, audio and prose.

**`documentary` is today's output, byte for byte**: no prompt block, voice Puck with no style, no tags, the paper grade, no SFX (the voice is muxed alone). Rendered frames of the Roman short were hashed before and after the Tone work and match.

| | documentary | deadpan | comedic | hype | wholesome | dramatic |
|---|---|---|---|---|---|---|
| Voice (style) | Puck (none) | Schedar (flat) | Puck (wry) | Fenrir (rapid) | Sulafat (warm) | Algenib (hushed, slow) |
| Words/s (measured) | 2.9 | 2.26 | 2.57 | 3.10 | 2.26 | 1.79 |
| Vocal tags (code-inserted) | none | `<short pause>` before a punchline's last sentence | same + `<chuckle>` into the ending | none | `<breath>` into the ending | `<short pause>` before the turn's reveal, `<long pause>` into the payoff |
| Motion: duration / spring / push / shake | 1 / 0 / 1 / 0 | 1 / 0 / 0.7 / 0 | 0.85 / 1.7 / 1.2 / 0 | 0.7 / 2 / 1.6 / 14 px | 1.15 / 0.8 / 0.9 / 0 | 1.3 / 0 / 1.5 / 0 |
| Punch: scale / frames / flash | 1.3 / 8 / 0 | 1 / 0 / 0 (flat cut) | 1.6 / 9 / 0.35 | 1.8 / 8 / 0.85 | 1.15 / 14 / 0 | 1.06 / 36 / 0 (slow fade) |
| Transitions | house | house + hard `cut` into punchlines | house + hard `cut` into punchlines | push/rise → `zoom` | house | push/rise/wipe → `dip` (to ink) |
| Grade | paper | paler highlighter, lighter grain | warm tint, yellow highlighter | warm tint, more grain | warm tint, soft highlighter, softer red | ink mode: ink page, paper-coloured text, red accent, screen blend |
| Captions | `vox_clean` | `vox_flat` (no active colour) | `vox_clean` | `vox_hype` (CAPS, ≤2 words, 115% pop) | `vox_clean` | `vox_serif` (Source Serif 4 italic, lowercase) |
| SFX | none | none | paper rustle on beat changes, stinger on punchlines, chime on number/pictogram cues | whoosh on beat changes, impact on data cues, riser into the payoff | paper rustle, chime | riser + sub-boom into the turn, sub-boom into the payoff |

- **Prompt.** `registerRules` (hook, humor, sentence rules, devices, bans, accuracy) rides in the request as `register_rules`, AFTER the cached `VOX_SCREENPLAY_BIBLE`, so switching tone never changes the cache prefix. The model never chooses the register: code stamps it on the sheet before validating. Satire is allowed in comedic (an obvious joke may exaggerate; facts stated straight and quotes stay true); every other register keeps the bible's accuracy rules. There is no tone-fits-topic judge: that responsibility is the user's.
- **Voice.** `src/harness/voiceover.ts` sends the row's voice and `style` (Gemini `speech_metadata.style`) and `voiceScript(...)`, the narration with the row's vocal tags. The LLM cannot write tags (`narration` rejects `<`, `>`, `[`, `]`); the harness fails loud if stripping the tags would not give back the narration exactly, and alignment only ever sees the plain narration.
- **Punchline beats** are the first beat of each act in the row's `punchActs` (`punchlineBeats`); tags, cuts and stingers all key on them.
- **Motion.** The compiler copies the row's `motion` onto every `TimedBeat.feel`. Entrances use `landing` (duration scale + back-ease spring; spring 0 is exactly the house ease-out), the camera push scales its amplitude (`pushScale`, still ending at 1), and `shakeAt` shakes the camera for `SHAKE_FRAMES` after each cue. The layout audit samples each beat after its scaled entrance settles. `TIMELINE_CHECKS` (audit.ts) allow a `cut` only into a punchline beat of a register that cuts, and overshoot/shake only up to the register's row and `MOTION_LIMITS`; the frozen-frame probe runs on every register.
- **Grade.** `timeline.grade` (a `Grade`, tokens.ts) is set as CSS variables on the root (`PAINT` in VoxVideo.tsx: ink family, accent, highlight, blend); hex data tones come from `timeline.grade.tone` because pictograms and splits interpolate them. Maps are pictures and keep `COLOR` (in dramatic a map shot stays a light map).
- **Audio.** `sfxCues` places each row's sounds on non-glide beat changes, on the cue frames of chosen shots (from word timestamps), on punchline beats or on an act's first spoken word, with each sound's `hitMs` landing on the moment (a riser ends on it). `renderTimelineVideo` generates the sounds with FFmpeg lavfi (no licensed files), delays and sums them, sidechain-ducks the sum under the voice and limits. Music is later.


## World maps

The LLM writes names, never ids it has to remember or coordinates. Everything below is data plus one small engine each.

**Places (`places.ts`).** A map shot's `view`, `layers[].layer`, `labels`, `pins`, `circle`, `arrow` and `armies` take what the model writes: `"Paris"`, `"Paris, FR"`, `"Springfield, US-IL"`, `"Georgia (US state)"`, `"FR"`, `"FRA"`, `"US-CA"`, `"Q90"`, an era name (`"Constantinople"`) or a canonical id (`city:paris-fr`, `country:FR`, `admin1:US-CA`, `polity:ottoman-empire`, `site:carthage`, `rome_ce117`). `checkBeatSheet` resolves every reference before the editorial rules run, so a checked sheet holds canonical ids only (`compileTimeline` resolves again, idempotently, and fails loud on a name that does not resolve). Order: exact id or code, then name/alias with an optional qualifier (a kind word, a country, an admin-1 code; never the qualifier itself), then the view's box breaks ties ("Syracuse" on the Mediterranean is Sicily), then size ranks (population; `KIND_WEIGHT` for rows without one; a region yields to a same-named city in its country). Two candidates within `AMBIGUOUS_RATIO` (3×) are ambiguous. Violations go back through the screenplay retry loop with the closest candidates:

| Rule | When |
|---|---|
| `place_unknown` | No row has the name; lists the nearest by edit distance |
| `place_ambiguous` | Two rivals ("Georgia", "Birmingham", "Springfield"); lists them with ids |
| `place_era` | The row exists but not for this map (`REF_KINDS`): a modern country on a historical or ancient map, a polity not alive in the snapshot. On a historical map it names the polity that held the country's land that year |
| `map_year` | A `year` before the first snapshot (3000 BCE) |
| `map_places` | A place both labelled and pinned |
| `map_world` | One world mixing ancient and modern views |

The prompt stays small: the views, the layer kinds, and the ~200 tier-1 places (`tier1Places`: Natural Earth scalerank ≤ 2 cities plus tier-1 sites). A retrieval pre-pass (`knownPlaces`) adds `known_places` to the request: capitalised n-grams of the topic and research matched against the alias index, with canonical ids. No runtime geocoder.

**Eras.** Ancient views (`mediterranean`, `italy`, …) draw the AWMC pack exactly as before and fill only `ANCIENT_LAYERS`; their places show era names of `ANCIENT_DEFAULT_YEAR` (117 CE) unless the shot has a `year`. A modern map draws Natural Earth borders and fills countries and admin-1 areas. A map with `year` draws the Cliopatria snapshot at or before that year (`snapshotFor`; 53 `HIST_SNAPSHOTS`), its polity borders only (never modern borders), fills polities alive then, and shows era names (`ERA_NAMES`: Londinium, Constantinople, Petrograd, Edo, …). Snapshots are approximate: `GeoMap.era`/`year` mark them, `GEO_SOURCES.cliopatria` says so.

**Disputed borders.** The worldview is an org setting (`WORLDVIEWS`, default `iso`; the animation harness input `worldview`). Natural Earth's breakaway/disputed areas are drawn over every fill with land colour and a hatch at constant screen spacing, so they are never tone-filled; historical and ancient maps have no modern disputes.

**Projections (`PROJECTION_RULES`, first match wins).** One projection per world (beats sharing a world glide on one canvas): ancient views keep the AWMC conic; a view may pin one (`world`/hemispheres: Equal Earth; `usa`: AlbersUsa; `russia`: conic); otherwise a world spanning ≥100° of longitude is Equal Earth, one within ±30° latitude is Mercator, the rest conformal conic with parallels at 1/6 and 5/6 of its latitude span. A view may also be a country / admin-1 / polity id, framed on its main landmass (`mainBox`: parts at least ¼ of the biggest). AlbersUsa maps draw only US states (its insets would otherwise draw neighbours).

**Framing.** The sea colour fills the frame. A world-scale view is first cropped to the projected sphere along its long axis (`clampToBox`: a 16:9 world shows the whole width, a 9:16 world is a crop of the globe's height about its centre); then `frameView` widens and recentres only if a subject is off the stage (subjects win; past the sphere there is only sea). The ancient pack keeps `clampToData`: its ragged clip edge (`PACK_CLIP`) must never show, so it clamps after framing (on 9:16 the `mediterranean` view narrows to 0.72×). Globe (orthographic) mode is later. Label placement treats pen arrows, army arrows and pin heads as obstacles.

**Pruning and LOD.** `GeoScene` is one `GeoMap` per world (per snapshot or era-name year) holding only what its beats use: the referenced fills (plus any fading out from the previous beat), the referenced places with their era names, and base layers clipped to the union of the world's camera frames (+10%) and thinned to 0.5 screen px at its closest zoom. Measured: a Roman sheet ships 46 KB of props (was the whole pack), a modern region ~70-100 KB, a 16:9 world + US states sheet ~520 KB. A test holds every map of every tour under 60k drawn vertices.

**Benchmark (real Chromium, `bun scripts/map-preview.ts`, 30 consecutive frames per beat, full-size PNG capture included, shared dev machine).** Map beats cost what text beats do (headline beats: 160-370 ms/frame mean in the same sessions): ancient 160-283 ms, modern region with pins 184-261 ms, 1914 Europe 212-318 ms, US states 170-295 ms, the 16:9 world 401 ms mean (p95 570 ms; 522 KB of props for the world + US sheet). Resting frames of every map tour are written to `~/Downloads/map-preview/`.

Research behind every number here is in `docs/research/vox-harness/`.

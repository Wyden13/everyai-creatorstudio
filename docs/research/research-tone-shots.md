# Vox engine: Tone setting and new shot kinds (research)

Scope: `backend/worker-agents/src/vox/`. Research only; no repo files edited.

Evidence legend. **[doc]** = read in current Google docs this session. **[repo]** = read in the code. **[craft]** = my synthesis of how the named channels work; web search returned almost no script-level analysis of these channels, so every number in the craft columns is a starting hypothesis to calibrate, not a measurement. TTS API behaviour could NOT be tested: no Gemini key in the environment.

---------------------------------------------------------------------

## 0. Constraints found in the repo that shape the design

1. **Name collision.** `Tone` already exists: `COLOR.tone` / `ToneSchema` in `tokens.ts` / `beat-sheet.ts` = the data hues (red, teal, ochre, muted, ink). A delivery "tone" must not reuse the identifier. Recommend code name `Register` (`register: 'deadpan'`), UI label "Tone".
2. **AGENTS.md section 4: exactly two styles, no general theme system.** So a tone cannot be a theme. It may only change *grade* tokens inside the Vox paper look (tint, highlight, grain, ink-mode), motion feel, caption style, audio and prose rules. No new fonts, no new layout system.
3. **Voice is one TTS call per video with plain text** [repo providers.ts ~L640-660]: `contents:[{parts:[{text}]}]` on `:generateContent`, no style channel. The comment there says the model reads inline "Say ...:" aloud and rejects `systemInstruction`.
4. **No audio mix stage exists.** `render.ts` muxes one `audioPath` (voiceover) with burned subtitles. Music/SFX = new FFmpeg mix step.
5. **Pacing is validated by `FORMATS.short.wordsPerSec` (130-160 words / 60 s).** Puck measured ~2.9 words/s, so 160 words is ~55 s. Per-tone budgets need a measured speech rate per (voice, style), not a guess.
6. **Motion invariants:** no bounces, no hard cuts (`TRANSITIONS` has glide/push/rise/wipe), constant motion enforced by the `frozen_frame` audit (mean luma change must stay above 0.01 of 255 for under 1 s). Tones that want overshoot, hard cuts or slow camera must extend these tables, and slow pushes must still clear the frozen-frame floor.
7. **Map is Mediterranean only** (`geo-manifest.ts`; prompt says "If the topic is not about the Mediterranean world, do not use map shots"). If Scout feeds trending topics, most topics have no geography shot at all.
8. **Adding a shot kind touches ~9 sites** [repo README L117]: `ShotSchema` (+`CHARS`/`COUNTS`), `SHOTS` in VoxVideo.tsx, `SHOT_DOCS` in screenplay.ts, `shotPhrases`, `ELEMENT_KEYS` in timing.ts, `ORDERED_CUE_SHOTS`, `PUSH`/`STILL_SHOTS`, a `SHOT_TOURS` row (both aspects audited), then `bun scripts/emit-schemas.ts`. Plus geometry tests proving max counts fit the stage. Effort estimates below include this.
9. Bible prompt is byte-stable for caching. Put the tone block AFTER the cached bible (one small block per tone), so tone switching does not invalidate the cache.

---------------------------------------------------------------------

## 1. TONE

### 1.1 What concretely differs between tones (channel notes, [craft])

| Channel | Script structure | Humor | Rhythm / pace | Sound | Motion / look |
|---|---|---|---|---|---|
| Vox | Anomaly, stakes, pivot question, mechanism, history, turn, payoff | Rare, dry, 1 per 1-2 min | Medium sentences, ~150-160 wpm, clear breaths | Low electronic/piano bed, subtle whooshes | Paper, maps, calm eased moves |
| Johnny Harris | First person ("I went to..."), thesis, evidence, so-what | Light, self-deprecating asides | Conversational ~170-190 wpm, rhetorical questions | Dense small sound design (ticks, whooshes), moody ambient bed | Maps + graphics, cuts every 2-4 s |
| Kurzgesagt | Awe at scale, then dark turn, then earned hope | Gentle, dry, scale comparisons | Calm, even, deliberate | Lush cinematic synth, soft SFX | Flat shapes, smooth ease with slight overshoot, saturated gradients |
| Oversimplified | Chronological retelling with running gags | Very dense (a gag every few seconds): anachronism, puns, callbacks, fourth wall, escalation | Fast, ~170-190 wpm, British delivery, parenthetical asides | Heavy stingers/SFX | Cartoon characters, bright flat colour |
| Casually Explained | Setup, deadpan escalation, brief sincere pivot | Deadpan: understatement; the pause IS the joke | Slow monotone delivery, long beats of silence | Almost no music | Low-fi MS Paint look (writing and voice carry it) |
| Wendover | Thesis-led system explainer, counterintuitive middle, resolution | Dry, straight-faced, ~1 per 30-40 s | Brisk, number-heavy, ~165-175 wpm | Light upbeat bed | Clean motion graphics, lots of ranked/compared figures |
| MrBeast-style hype | 3 s promise, stakes ladder, "but here is the catch", countdown/clock | None; energy replaces jokes | Short punchy sentences, 180-200+ wpm | Bass music, whoosh/impact/riser on every change | Zoom punches, shake, saturated flashes, huge captions |
| TikTok explainers | Hook line, loop opened, "wait for it", payoff | Casual, self-aware | Very fast, jump cut every 1-2 s | Trending sound / bed | Word-by-word big captions, keyword colour |

Independent web evidence found (vendor blogs, weak): faceless Shorts voiceover ~160-180 wpm; visual change every 2-4 s; large high-contrast word-timed captions; many viewers start muted. Casually Explained success is attributed to deadpan delivery and timing more than the art (OutlierKit page). Kurzgesagt writing is the slowest stage, narration is recorded whole then re-taken per sentence (kurzgesagt.org/youtube).

Take-aways that actually discriminate tones:
- **Joke density and *type*** (none / understatement / absurd-escalation / none-but-energy / warmth).
- **Sentence length and the final-word rule** (deadpan puts the flattest word last; hype puts a verb last).
- **Pauses**: deadpan and dramatic are defined by silence before the line; hype by the absence of it.
- **Where energy comes from**: comedic from writing, hype from cut rate + sound, dramatic from restraint + sound design.
- **Motion feel**: overshoot/spring = playful or hype; critically damped ease = serious; hard cut = deadpan punchline.

### 1.2 Tone as DATA (proposed table; every value is a starting hypothesis)

Six tones. `documentary` = today's behaviour (default; zero change).

| Field | documentary | deadpan | comedic | hype | wholesome | dramatic |
|---|---|---|---|---|---|---|
| **Prompt: hook pattern** | dated, placed anomaly (current) | flat statement of an absurd true fact, no reaction | absurd true premise + promised escalation | stakes + payoff promise in 12 words | wonder or "you are part of this" | in medias res, fragments: date. fact. consequence. |
| **Joke density / 60 s** | 0-1 | 3-4 (understatement, rule of three with deflating third) | 5-7 (anachronism, callback, escalation, aside) | 0 (no jokes; one stakes line per beat) | 1-2 (mild, warm) | 0 |
| **Avg sentence words (max)** | 16 | 12 (mostly 5-9, punchline 3-5) | 12 | 8 | 14 | 10, mix long then 2-word |
| **Devices to require** | pivot question, "this map" pointing | last word is the flattest; one 3-beat build then deflation | one running gag + callback in last beat | pattern interrupt each beat, open loop beat 2, "but" turns, countdown | "we/our", scale comparison, reassurance close | one reveal withheld to beat N-2, short sentence after long |
| **Banned additions** | house list (existing) | exclamation marks, "literally", "crazy" | "lol", meme dated slang, mocking victims | clickbait lies ("you won't believe", unproven superlatives) | cynicism, doom close | jokes, hedging filler |
| **Script words per 60 s** | 130-150 | 120-140 | 145-165 | 160-180 | 115-135 | 105-125 |
| **TTS voice (hypothesis)** | Charon (Informative) | Schedar (Even) or Alnilam (Firm) | Puck (Upbeat) or Zubenelgenubi (Casual) | Fenrir (Excitable) or Sadachbia (Lively) | Sulafat (Warm) or Achird (Friendly) | Algenib (Gravelly) or Gacrux (Mature) |
| **TTS `style` string (short, constant)** | "calm, clear and measured, quietly curious" | "monotone and flat, dry, understated" | "playful and wry, quick, a hint of a smirk" | "energetic, speaking rapidly, excited" | "warm, gentle, smiling" | "low and hushed, speaking slowly, building tension" |
| **TTS inline tags (code-inserted)** | `<short pause>` at beat boundaries only | `<short pause>` before punchline sentence | `<short pause>` before punchline, optional `<chuckle>` on callback | none (no pauses) | `<breath>` rare | `<short pause>` before reveals, `<long pause>` once before payoff |
| **Motion: duration scale** | 1.0 | 1.0 | 0.85 | 0.7 | 1.15 | 1.3 |
| **Motion: overshoot (spring)** | 0 | 0 | 0.10 | 0.12 + 6-frame shake on impacts | 0.05 | 0 |
| **Motion: camera push amplitude** | x1.0 | x0.7 (still floor above frozen-frame limit) | x1.2 | x1.6 | x0.9 | x1.5 (slow dolly) |
| **Transitions** | existing table | adds hard `cut` (0 frames) for the punchline beat | push/rise + quick wipe | whip/zoom, 8-10 frames | soft push | dip-to-ink, 20 frames |
| **Grade (inside Vox look)** | paper #EDE0C8, highlight #FFF200 (current) | same, highlighter replaced by pen circle | paper #F1E4C6, highlight #FFE600, red used for the gag | adds full-field flashes (ink/red/yellow) on `punch`, grain 0.6 | paper #F3E6CB, teal primary, ochre secondary, red only for alarm | ink mode: field #131313, paper text, red accent, heavier grain (needs contrast audit) |
| **Captions** | vox_clean, 3-4 words/cue | vox_clean, no active-word colour, 4-5 words | vox_clean, active word yellow | ALL CAPS, 1-2 words/cue, active word scale pop 1.15 | sentence case, 3-4 words | Source Serif 4 Italic lowercase, 4-6 words, fade not pop |
| **Music** | none or very low ambient | none | none or light bouncy bed | bass bed, ducked | warm pad | drone + riser into turn |
| **SFX set** | quiet paper rustle on transitions, tick on number land | none (silence is the joke) | stingers on gag, soft boing on pop | whoosh each cut, impact on number/punch, riser before payoff | soft chime on reveal | sub-boom on reveals, riser |
| **Prefer shots** | map, timeline, number, quote | checklist, versus, chat, number | chat, versus, punch, ranking | punch, ranking, versus, number | units, chain, checklist, ranking | timeline, quote, map, number, punch |
| **Avoid shots** | punch (rare) | punch, chat overuse | quote of real tragedy | quote, chapter-like slow shots | punch | chat, ranking |
| **Sensitive-topic rule** | allowed | allowed with judge | refused on tragedy topics | refused on tragedy topics | allowed | allowed |

Sketch of the data (not code to commit):

```ts
export const REGISTERS = {
  deadpan: {
    prompt: { hook: '...', jokesPer60s: [3, 4], sentenceWordsMax: 12, require: [...], ban: [...] },
    voice:  { name: 'Schedar', style: 'monotone and flat, dry, understated', wordsPer60s: [120, 140], tags: { beforePunch: '<short pause>' } },
    motion: { duration: 1.0, overshoot: 0, push: 0.7, transitions: { punchline: 'cut' } },
    grade:  { paper: '#EDE0C8', highlight: null, grain: 0.4, mode: 'paper' },
    captions: { style: 'vox_clean', activeColor: false, wordsPerCue: 5, case: 'sentence' },
    audio:  { music: null, sfx: {} },
    shots:  { prefer: ['checklist', 'versus', 'chat'], avoid: ['punch'] },
  },
  // ...
} as const satisfies Record<string, RegisterSpec>;
```

Everything that today reads `FORMATS` / `MOTION` / `PUSH` / `CAPTION_STYLES` gets multiplied by the register row at ONE edge (a `resolveStyle(format, register)` pure function), so widgets never branch on tone. Validator rules read the same row (`jokes_per_60s` via judge, `shots_fit_register`, `words_budget`).

### 1.3 Should humor bend accuracy? No.

Recommended rule set:
- Jokes may bend **framing and attitude** ("Rome was having a bad day"), never **facts**: every number, date, name, place and quote passes the same editorial checks in every tone; the `quote` shot stays verbatim-and-attributed only.
- Attributed motives and invented dialogue are facts. A `chat` shot (below) must read as "the gist"; never present invented words from a real person as a quote.
- Hype superlatives ("biggest", "most", "only") must be backed by a number comparison in the same beat; otherwise the judge harness fails the sheet.
- A `tone_fits_topic` judge pass (LLM judge harness, per harness taxonomy) blocks comedic/hype on tragedy topics (deaths, war crimes, disasters, living private people) and falls back to documentary/dramatic, loud (error to the caller, not silent downgrade).
- Pure-data shots (`number`, `timeline`, `line`, `ranking`, `versus`) compute winners/ranks in code from typed values; the LLM cannot assert a wrong winner.

### 1.4 TTS: getting expressive delivery from Gemini without reading it aloud

Findings (links in section 1.5):

1. **The docs now give a separate style channel.** For `gemini-3.8-flash-tts` the Gemini API docs use the **Interactions API** (`POST https://generativelanguage.googleapis.com/v1beta/interactions`) and put delivery in an **annotation on the text part**: `annotations:[{type:'speech_metadata', style:'cheerful and friendly'}]`. `text` is treated as a verbatim transcript. Because style is a different JSON field, it cannot be spoken. This is the structural fix for the read-aloud problem; our current code sends only text through `:generateContent`.
2. **Request shape [doc]:**
   ```json
   {"model":"gemini-3.8-flash-tts",
    "input":[{"type":"user_input","content":[{"type":"text","text":"Have a wonderful day!",
       "annotations":[{"type":"speech_metadata","style":"cheerful and friendly"}]}]}],
    "response_format":{"type":"audio"},
    "generation_config":{"speech_config":[{"voice":"Kore"}]}}
   ```
   Audio comes back in the last `model_output` step as base64 (`interaction.output_audio.data` in SDKs). Unary default is WAV 24 kHz mono 16-bit with a RIFF header; `audio/l16` gives headerless PCM. SDKs need `@google/genai` 2.24.0+ and `api_version: "v1beta"`. Our C2PA splitter in providers.ts was written for the raw-PCM generateContent response; re-verify it against the WAV response.
3. **Model page says 3.8 Flash TTS supports both GenerateContent and Interactions** [doc], but the documented style mechanism (`speech_metadata`) is shown only on Interactions. Whether `generateContent` has an equivalent annotation is undocumented. Do not assume it.
4. **Inline tags on 3.8 are ANGLE-bracket**, vocal only: `<laugh> <chuckle> <sigh> <gasp> <breath> <cough> <whispers> <short pause> <long pause>` etc. Square-bracket tags (`[whispers]`, `[sarcasm]`, `[extremely fast]`) belong to the 3.1 Flash TTS preview and Cloud Text-to-Speech docs; on 3.8 they may be spoken. Docs say avoid non-vocal SFX tags (applause, thud), and the Cloud page warns vocalized-adjective tags like `[scared]` are spoken.
5. **Other documented controls:** capitalised words add emphasis ("a VERY important point"); `style` is for sustained delivery (emotion, pace, volume: "speaking rapidly", "speaking slowly", "monotone and flat", "whispered urgently"); keep `style` short and constant per tone, no meta-instructions ("keep the voice steady"), since the docs say they increase drift; test with empty style first. Accent/age/gender do NOT go in style; choose a voice.
6. **Text should match style emotionally** (Cloud page): neutral text gives weak style effect. This is an argument for the prompt rules in 1.2 actually changing wording, not just the voice.
7. **Multi-speaker:** up to 2 speakers, prebuilt voices only, `speaker` + optional `style` per turn via `speech_metadata`. Useful for (a) a future `chat`/dialogue shot read by two voices, and (b) a possible trick: map two speaker aliases to the same voice to get a different `style` per turn in ONE request (undocumented; spike it).
8. **3.1 Flash TTS preview is labelled legacy; docs say migrate to 3.8** [search snippet of the 3.1 page]. The 3.1 "director's notes" structure (Audio Profile / Scene / Director's Notes / `#### TRANSCRIPT`) is a prompt-prefix style and is exactly what reads aloud on 3.8 in our earlier test; do not use it.
9. **Cost is trivial:** 25 audio tokens/s; 60 s = 1,500 tokens; $9/M through 2026 ($18/M after) = ~$0.014-$0.027 per Short. Per-beat TTS calls are affordable if per-beat delivery is wanted (consistency drift risk instead).
10. **No word timestamps** documented; our `align.ts` aligns script to audio already, so keep that.

Recommended implementation shape (for the design, not built here):
- `TtsOptions` gains `style?: string`; the Gemini branch switches to Interactions and puts `style` in the annotation. One API path (no silent fallback to generateContent).
- Tags are inserted by CODE from the register row (e.g. `<short pause>` before the last sentence of a beat when the register has a punchline pause), never written by the LLM. The caption/alignment script strips tags before LCS alignment. Optionally uppercase the `highlight` phrase in the TTS text only, for emphasis.
- **Leak detector for free:** the existing script-to-audio LCS alignment can enforce "no instructions were read aloud": if aligned coverage drops or extra spoken words appear, fail loud.
- Per-tone words-per-second must be measured (voice x style) with one live test and stored in the register row; the word-budget rule then reads the measured value (`wordsPer60s` above are placeholders: hype at 160-180 words only fits 60 s if "speaking rapidly" actually yields about 3.0-3.3 wps).

**Spike to run before any build (about 1 hour, needs a Gemini key, can be a `test:live` file):** 6 tones x 1 identical 60-word paragraph, Interactions API with `speech_metadata.style`; record (a) any instruction leakage via alignment coverage, (b) measured wps, (c) whether `<short pause>` / `<chuckle>` are honoured and not spoken, (d) whether the C2PA splitter and WAV header handling still hold, (e) whether the same-voice two-speaker trick works, (f) voice audition: Schedar/Alnilam for deadpan, Sulafat for wholesome, Algenib/Gacrux for dramatic, Fenrir for hype. Voice descriptors come from the docs' voice table (Puck=Upbeat, Charon=Informative, Schedar=Even, Algenib=Gravelly, Sulafat=Warm, Fenrir=Excitable ...), but how they sound with each style is untested.

### 1.5 Sources
- Gemini API speech generation (redirects): https://ai.google.dev/gemini-api/docs/speech-generation and https://aistudio.google.com/docs/speech-generation (text: https://aistudio.google.com/docs/speech-generation.md.txt)
- Gemini 3.8 Flash TTS model page: https://aistudio.google.com/docs/models/gemini-3.8-flash-tts.md.txt
- Cloud Gemini-TTS prompting guidance (3.1/2.5, square-bracket tags, pauses, style prompt vs text): https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
- 3.1 prompting article (director's notes structure): https://dev.to/googleai/how-to-prompt-gemini-31s-new-text-to-speech-model-24bb
- 3.1 launch: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts
- Kurzgesagt process: https://kurzgesagt.org/youtube/ ; Casually Explained analysis: https://outlierkit.com/channel/casuallyexplained ; Shorts pacing (vendor, weak): https://fluxnote.io/guides/increase-audience-retention-youtube-shorts

---------------------------------------------------------------------

## 2. NEW SHOT KINDS

Effort scale (includes the 9 touchpoints, geometry tests for both aspects and audit tour): **S** about 0.5-1 day, **M** about 2-3 days, **L** over 1 week or external asset pipeline. These are my estimates.

Common to all: LLM writes only data (text with char caps in `CHARS`, typed values, `at` phrases copied from narration); code owns layout, motion, colour; every shot must keep moving (no `STILL_SHOTS`), reads inside the 9:16 `stage` zone (900x960 px, above captions), and takes tone via the register's motion/grade multipliers.

### 2.1 Candidates, all scored

| Shot | LLM writes | Code animates | Tones | Phone read | Effort |
|---|---|---|---|---|---|
| **punch** (zoom-punch kinetic word) | 1-3 words (<=12 chars each) with `at`, field hue | Word slams in at 1.5x to 1x (spring per register), optional shake, full-bleed field flash (ink/red/yellow), camera punch-in; fade variant for dramatic | hype, comedic, dramatic, deadpan (as a flat one-word beat) | Ideal: 230+ px type, one idea | S |
| **ranking** (countdown / leaderboard) | title, unit, 3-6 items `{label, value, at}` | Rows bars grow (`barGrow`), rank numeral slams, rows FLIP-re-sort as items arrive, #1 highlighted | documentary (Wendover style), hype, comedic, deadpan | Vertical rows, label above full-width bar; reads well | S-M |
| **versus** (comparison) | two sides `{label, hue}`, 1-4 rows `{label, left:{value,unit}, right:{value,unit}, better:'higher'/'lower'/'none'}`, `at` per row | Top/bottom halves, VS badge slam, rows count up and winner computed in code, tick on winner, verdict wipe | all, esp. hype, comedic, documentary | Stacked halves on phone (compare:'column'), reads well | M |
| **checklist** (myth/fact, verdict, tick list) | title, 2-5 items `{text, mark:'yes'/'no'/'maybe', at}` | Rows slide in, pen-drawn tick (teal) or cross (red) with strike-through, final row highlighted | all; deadpan (cross everything), wholesome, documentary | Large rows, high legibility | S |
| **chat** (fake phone chat / "the gist") | names, 2-6 messages `{from:'a'/'b', text<=48, at}` | Typing dots then bubble spring-in, auto-scroll upward as messages accumulate (keeps motion), generic bubbles (no real app branding) | comedic, deadpan, wholesome, hype | Native to the phone; great | M |
| **world map pin-drop** | `view` (world/continent id), `pins:[{place, at}]`, country `layers` with hue | Extends the existing map widget: pin falls + ripple, country fill from origin, camera auto-framing already exists | documentary, dramatic, hype | Existing map quality; vertical crop of world needs presets | M-L (asset work) |
| tier list (S/A/B/C) | tiers, items `{label, tier, at}` | Chips drop into rows, row colour pop | comedic, hype | Rows readable if <=6 items | M |
| icon pictogram grid | like `units` but each group names an icon from a closed set | Icons fly in and regroup (reuse `unitSlots`) | wholesome, documentary | Good; closed ~40-icon set, e.g. MIT/ISC sets | M |
| multi-series line / bar race | 2-3 series of points, end labels; bar race = frames of values | Lines draw, labels follow heads; race re-sorts bars (reuse ranking FLIP) | documentary, hype | Good with <=3 series | M each |
| process / flow with branches | nodes + if/then edges | Extension of `chain` (already exists) | documentary | Branching hard on 9:16 | M, low priority |
| photo with Ken Burns / cut-out | image id, focus box, caption | Pan/zoom, mask, contrast scrim for text | all | Strong but needs imagery | L (sourcing, licence, relevance, text-over-image audit) |
| quote with portrait | as `quote` + portrait id | Portrait slides in, words read | documentary, dramatic | Strong | L (depends on photo pipeline) |
| reaction / stamp (emoji or icon + 2 words) | icon id from closed set, word, `at` | Wobble/stamp per register | comedic, hype | Good, cheap meme feel | S-M (icon licence: Noto Emoji Apache-2.0) |
| countdown / clock | number, unit, `at` | Digits tick, ring drains | hype, dramatic | Good | S, fold into `ranking` or `number` |
| character dialogue (Oversimplified) | speakers, lines, poses | Characters + speech | comedic | Great but L | L (character art + 2-voice TTS, alignment per speaker) |
| tweet/post card | handle, text | Card | ... | ... | **Skip**: imitating a real platform UI risks impersonation; `chat` stays generic |

### 2.2 First batch, ranked

Ranked by (range gained x tones served x phone fit) / effort, with topic-agnostic shots first because Scout feeds arbitrary trend topics and today a non-Mediterranean topic has no geography shot.

1. **`punch` (S).** Cheapest, and the clearest per-tone signature: hype slam with shake and flash, comedic slam with overshoot, deadpan flat one-word beat on a hard cut, dramatic slow fade with red rule. Distinct from `headline` (which is paper kinetic type of up to 2 lines with a highlighter): `punch` is one to three giant words on a full-bleed field. Data: `{words:[{text<=12, at}] (<=3), field:'ink'|'red'|'yellow'|'paper'}`. Audit: reuse headline fit check; field contrast check.
2. **`ranking` (S-M).** Biggest "Shorts format" payoff (top 5, biggest, countdown). Data typed numbers, code sorts and formats (reuse `format.ts`), reveal order is the spoken order. Validator: values distinct; reveal order must be ascending or descending in value (countdown) or code re-sorts live.
3. **`versus` (M).** Direct "X vs Y" Short format. Winner derived from `better` and numeric values, so the LLM cannot assert a wrong winner. Phone: two stacked halves.
4. **`checklist` (S).** Myth-vs-fact and verdict beats; trivially phone-readable; strong in deadpan ("no, no, no, yes").
5. **`chat` (M).** The comedic/wholesome workhorse; reads as native phone UI. Guardrail: framed as "the gist" in narration, judge-checked, never used for verbatim quotes; no real app branding.
6. **World map with pins (M-L).** Highest topic-range unlock but mostly asset work: Natural Earth (public domain) TopoJSON, closed ids for ~60-200 countries and ~150 cities, continent view presets for a tall crop, label collision tests. If Scout topics skew geographic, promote it to #2.

Batch 2: tier list, icon grid, reaction stamp, multi-series line / bar race. Batch 3 (only with an image/character pipeline): photo + Ken Burns, quote-with-portrait, dialogue.

### 2.3 Per-shot motion notes (to keep "constant motion")
- `punch`: field slowly pushes after the slam; dramatic variant slow dolly; must exceed the 0.01 luma frozen-frame floor.
- `ranking`/`versus`: bars grow, then idle motion (head shimmer, slow scale to share) like `number`'s proportion bars.
- `chat`: scroll continues; typing dots pulse; last bubble gently floats.
- `checklist`: pen strokes draw, then the strike line keeps extending (like chapter rule).
- Transition table rows: add `punch` rows (wipe-in from field colour) and, for deadpan/comedic, a `cut` kind restricted by register.

---------------------------------------------------------------------

## 3. Open design questions (with recommended answers)

1. **Name?** Existing `Tone` = data hues. Rec: code type `Register`, UI label "Tone".
2. **May a tone change the look?** AGENTS.md allows only two styles. Rec: yes only as grade tokens inside Vox (tint, highlight, grain, ink mode for dramatic), plus motion, captions, audio. No new fonts or themes. Confirm dark ink mode for dramatic is acceptable as "Vox".
3. **May humor bend accuracy?** Rec: no. Framing only; facts, numbers, quotes unchanged; hype superlatives need a number in the same beat; `tone_fits_topic` judge refuses comedic/hype on tragedy topics (fail loud, no silent downgrade).
4. **One tone per video or per beat?** Rec: one per video; code adds intra-video energy variance (hook beat gets the style's high end, ending the low end). Per-beat tone later.
5. **Who picks the tone?** Rec: user/Scout input field with default `documentary`; the judge may reject, not rewrite.
6. **Switch TTS to the Interactions API with `speech_metadata.style`?** Rec: yes, after the 1-hour spike; single path, no silent generateContent fallback; leak detector via alignment coverage.
7. **Tags: LLM-written or code-inserted?** Rec: code-inserted from the register row, stripped before alignment. LLM never writes tags.
8. **One voice per tone, or one brand voice?** Rec: per-tone default voice from the table, owner-overridable; audition during the spike. Keep Puck for comedic.
9. **Word budgets per tone?** Rec: measure speech rate per (voice, style) once and store it; budgets in the table are placeholders.
10. **Add music/SFX?** Rec: yes, in two steps. (a) SFX first: procedurally generated with FFmpeg (`anoisesrc`, `sine` sweeps), no licensing, deterministic; cue off the existing cue roles (`CUE_LAG_MS`). (b) Music later: bundled CC0 loops, sidechain-ducked under voice, bed around -24 to -28 dB relative to voice, final mix near YouTube's -14 LUFS. Default off for documentary/deadpan/wholesome until tested.
11. **Hard cuts?** Rec: allow a `cut` only for deadpan/comedic punchline beats (register-gated), since it breaks the no-hard-cuts rule.
12. **Real photos/portraits?** Rec: defer. If added, public-domain/CC0 via Wikimedia Commons or Library of Congress, file ids validated at the edge (fail loud on unknown ids); no LLM-invented URLs.
13. **Characters/dialogue (Oversimplified style)?** Rec: out of first batch (character art + 2-voice TTS + per-speaker alignment is an L).
14. **Chat shot and real people?** Rec: allowed only as paraphrase ("the gist"), generic bubbles, no real platform branding, judge-checked; never in documentary/dramatic.
15. **Geography first or generic shots first?** Rec: generic first (punch, ranking, versus, checklist); promote world map if Scout topics are geographic.
16. **Registers and the existing `FORMATS`?** Rec: format (short/explainer) stays the frame/pacing table; register multiplies it. Do not create register x format rows by hand; `resolveStyle(format, register)` computes them.

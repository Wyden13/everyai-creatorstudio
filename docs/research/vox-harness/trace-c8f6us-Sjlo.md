# One-to-one trace: Vox, "How QWERTY conquered keyboards" (c8f6us-Sjlo)

Source: https://www.youtube.com/watch?v=c8f6us-Sjlo. Vox "Overrated" series, 2016, presented by Phil Edwards. The source is 1280x720, 23.976 fps, 347.9 s long; the narrated body is 0–327 s and credits/outro run 327–348 s.
Method: I viewed 1 fps contact sheets for the whole video (15 sheets of 24 s each), 2 fps sheets around every transition, and full-resolution frames at 5, 16, 70.5, 86, 101, 117, 182 and 236 s. I sampled pixel colours with `ffmpeg crop=2:2 → rgb24`. Coordinates below are converted to a **1920x1080** grid (source px x 1.5). Element timing is accurate to ±0.5 s, the 2 fps sampling grid. Word times come from the auto-caption line starts, interpolated within each line, so they are accurate to about ±0.7 s.

Context caveat: this is a 2016 *presenter-led, archival-collage* Vox explainer. It is not a map/data piece. The grammar it shows is **flat section colour + texture, inset archival cards, keycap typography, and a persistent timeline rail**. These map directly onto Remotion widgets.

---

## 1. Shot table

Shot-type codes: **TH** talking head · **KT** kinetic text/keycaps · **AC** archival card (inset still on a coloured field) · **AF** archival footage (inset or full-bleed) · **DOC** full-bleed document/engraving with camera move · **DIA** diagram (keyboard layout used as a diagram) · **BUMP** series bumper · **TR** transition.
The lag column is *element onset minus spoken trigger word*; a negative value means the element leads the word.

| # | Time (s) | Narration over it | Type | Layout (1920x1080) | Elements and motion | Trigger word → lag | Transition out |
|---|---|---|---|---|---|---|---|
| 1 | 0.0–1.0 | "why does every keyboard…" | KT | Keyboard centred, rows at y≈80–200 (top third) | White keycaps fly in from the left and assemble into QWERTY in ~0.8 s; keys arrive staggered ~40 ms each, ease-out | "keyboard" → about −0.3 s (on open) | none (same scene) |
| 2 | 1.0–3.5 | "…look like this" | DIA | 10/9/7 keycap rows plus a spacebar, centred x, upper third | Static hold; background is static teal with bars | — | Title box overlays in place |
| 3 | 3.5–6.5 | "the QWERTY keyboard is overrated" | KT | Translucent white box x 276–1646, y 365–743 (centre band) | Box fades in at α≈0.85 and the keyboard ghosts through it. "The QWERTY keyboard / is ____" appears at once, then "overrated" types on in red italic over the purple underline | "overrated" → 0 to +0.2 s | Box and keyboard push off right while a yellow panel wipes in from the right (~0.4 s) |
| 4 | 7.0–11.5 | "okay so this top strip here … 99% chance … on your keyboard" | TH | Presenter in the left 2/3; prop keyboard at right third | Yellow gradient background. Lower third "Phil Edwards \| Vox" at x≈450, y≈888, ~21 px, white; it fades in at 8.5 s | — | continuous |
| 5 | 11.5–14.8 | "it's Q-W-E R-T-Y, QWERTY" | TH+KT | Letters float at the right third, x≈1150–1350, y≈640 | Purple (#733964) spaced bold caps appear one by one: Q, QWE R, QWERTY | each letter → 0 to +0.3 s, tight lip-sync | hard cut |
| 6 | 14.8–17.7 | "we all have these QWERTY keyboards … in your pocket" | DIA | Teal; top row scaled ~1.4x (QWERTYUIOP ≈ 1.5 key-widths), keyboard top third | Top-row letters re-coloured green in an L→R sweep (~1 s) | "QWERTY" → about +0.5 s | hard cut |
| 7 | 17.7–21.1 | "one in your pocket on a screen but why" | TH | Centred | Presenter holds up a phone (physical prop) | "pocket" | hard cut |
| 8 | 21.1–26.9 | "why is this pattern of letters so familiar" | AF | Inset B&W 4:3 footage, ~600x450, centred-low on teal (x 1530–1830 in the right half for the second clip) | Inset frame sits on a slightly darker offset plate; footage plays at normal speed | — | hard cut between clips (22.9) |
| 9 | 26.9–29.1 | "…the keyboard but why" | AF | Inset top-down shot of hands on keys | Inset, static | — | hard cut |
| 10 | 29.1–30.8 | "of course" | TH | centred | — | — | hard cut |
| 11 | 30.8–37.5 | "QWERTY was just one person's invention from the 1870s… 140 years old" | DOC | 1878 patent drawing, full-bleed on white | **Camera tilt down**: starts on the mechanism (top) and ends on the keyboard (Fig. 3). The move covers ~1.5 frame-heights over ~5 s, ease-in-out, then holds | "invention" → move starts on the cut | continuous |
| 12 | 37.5–40.1 | "yet it's still the standard" | DOC | same | The "QWERTY" key row is highlighted with a yellow-green fill (~#c8e35a, α 0.7) over the six keys; fade 0.3 s | "standard" → about −0.5 s | hard cut |
| 13 | 40.1–40.9 | "many respect" | AF | Full-bleed B&W presenter footage (1940s training film) | — | — | hard cut |
| 14 | 40.9–43.5 | "we all use it but" | AF | Full-bleed B&W footage of typewriter brands (Burroughs, Underwood) | quick cuts ~0.8–1.3 s | — | hard cut |
| 15 | 43.5–49.7 | "don't know why… the definition of overrated… subject of intense debate" | TH | centred | Presenter holds a book prop at 47 s | — | hard cut |
| 16 | 49.7–51.5 | "some lies you've probably been told" | KT | Teal; keyboard in the upper third | Loose letters scatter in from off-canvas and settle into keycaps (~1.5 s); key caps "pop" (scale 0→1, ~150 ms) | — | same scene |
| 17 | 51.5–59.5 | "a few real explanations… including an old-fashioned cartel" | DIA | Keyboard upper third | **Highlight sweeps**: groups of 3–6 keys flash yellow #ffe94c, magenta #d94f9c, green #b8dd6b or red #ec6a78, about one group per 0.5 s, rhythm-driven (decorative, not semantic) | rhythm of clauses, ~1 group per stressed word | **Glitch** (59.5–60.5): horizontal colour-bar slices in yellow, purple and cyan |
| 18 | 60.5–63.5 | [music] | BUMP | Yellow field; "OVERRATED" wordmark centred at y≈410, column icon below at y≈480–560 | Wordmark is a distressed slab serif in purple. It glitches in, holds ~2.5 s, then the panel slides **up** (~0.4 s, ease-in) and exits | music hit | push-up reveals teal |
| 19 | 63.5–66.5 | "lots of people have tried to arrange these jumbled letters" | KT | Teal keyboard, centred x, y≈560–960 | Scattered letters reassemble; spacebar flashes yellow | "arrange" | same scene |
| 20 | 66.5–71.5 | "half century period of indecision, debate" | DIA + timeline | Keyboard upper half; **timeline rail** at y≈908, x 210–1710 | Rail draws on L→R (~0.6 s, linear), labels "1840" and "1890" white bold. Keys **shuffle** into 4 random layouts, ~1 per s: letters slide/swap between positions (~300 ms each, ease-in-out) and some keys drop out and re-enter | "half century" → +0 to +0.5 s for the rail | **Vertical push**: orange panel rises from the bottom over ~0.5 s and takes the teal off the top |
| 21 | 72.0–77.5 | "in the 1840s Hughes' printing telegraph arranged the keys like a piano keyboard" | AC + rail | Engraving card ~690x480 centred in the top 2/3 (x 615–1305, y 45–525); rail persists at the bottom | Card scales up from ~0.6x to 1.0x (~0.4 s, ease-out) with an offset darker plate (−24 px x, +24 px y) | "telegraph" → −0.5 s (card arrives as the sentence starts) | in-scene |
| 22 | 77.5–82.0 | "like a piano keyboard" | AC → KT | Engraving fades to α≈0.25 (orange tint shows through); its **piano-keys cutout** is isolated, rotated ~−10° and moved right. Maroon box (#9b2c58 at α 0.85) at left, x 50–480, y 600–700 | Monospace-feeling bold caps **type on**, "ABCDEFGHIJKLMN" then ".ZYXWVUTSRQPO", at ~16 chars/s | "piano" → about 0 | **slice-out**: card leaves as horizontal blue/orange strips (~0.5 s) |
| 23 | 82.5–87.5 | "or look at Hansen's writing ball from 1865" | AC + rail | Colour photo card ~ x 465–1450, y 130–830 | Photo enters by horizontal slat slice-in (~0.5 s). Rail fills yellow up to 1865 and a small "1865" label (~33 px) appears at the 50 % tick | "1865" → +0.5 s | in-scene |
| 24 | 87.5–88.5 | "people's fingers pecked at this thing" | AC | Circular loupe ~480 px diameter, centred | **Circle magnifier**: a circular crop of the ball's keys pops in at about 2x zoom (~0.3 s, overshoot) | "pecked" → about +1.5 s | pops out |
| 25 | 88.5–94.0 | "the letters varied per version but they showed up in this pattern" | AC + DIA | Photo slides left to x 0–450; a keycap grid (4 rows: HC / XWULRGFZ / OAIEDTVS / QYJNMKBP) appears at the right, x 1230–1880, y 560–1000 | Keys pop in row by row (~60 ms stagger) | "pattern" → about −0.5 s | card slides off left |
| 26 | 94.0–98.0 | "this 1868 typewriter looks weird too, but it was the start of something" | AC + rail | Patent sheet card enters from the right, then **rotates into a 3D isometric tilt** (~45° rotateX/rotateZ, ~0.6 s) | Rail label "1868" is added beside 1865 | "1868" → about +0.5 s | **Glitch** (98.0–98.8) |
| 27 | 98.8–104.5 | "the inventor was Christopher Latham Sholes… typewriter Santa Claus" | AC (name card) | Portrait square x 563–1313, y 165–968. Name at x 1350, y 365–585, 3 lines, white bold ~72 px; cyan rule (#92cfd1, 2 px) at y 606, x 1313–1748. Purple bars (#90447c) stacked under the photo, y 985–1045 | Portrait glitches in with cyan/yellow/purple rectangles. Name wipes in L→R (~0.4 s) | "Christopher" → about 0 | Portrait slides down-left while the keyboard enters from the right (~0.5 s) |
| 28 | 104.5–109.5 | "in 1870 he developed a pattern like this" | DIA + rail | Light-grey keycaps (#d7d7d7) with slate letters, rows AEI.?YUO, / BCDFGHJKLM / ZXWVTSRQPN, centred | Keys slide in as a block from the right edge, ~0.5 s ease-out | "pattern" → about −1 s | **morph**: keys swap letters in place |
| 29 | 109.5–116.5 | "as of 1873 he'd come up with a keyboard that looked a lot like QWERTY but there were quirks" | DIA + rail | Rows QWE.TYUIOP / ZSDFGHJKLM / AX&CVBN?;R. Keys ~128 px square, 16 px gap, x 230–1680, y 270–735 | Letters flip to the new layout. Rail adds "1873" and its fill extends. At ~113 s, a slow **push-in** to about 1.15x over 3 s | "1873" → about +0.5 s | continuous |
| 30 | 116.5–121.5 | "notice that period where the R should be, and the A and Z are flipped" | DIA | same | Yellow highlight #ffe94c fills the "." key (key grows ~10 %) at 117. Then A and Z highlight at 118.5 with **letters slightly enlarged and offset**, as if lifting to swap | "period" → about +0.5 s; "A and Z" → about 0 | continuous |
| 31 | 121.5–124.0 | "the M also sits next to the L" | DIA | same | M highlighted | "M" → about 0 | Keyboard slides **up and off**, revealing an archival collage beneath |
| 32 | 124.0–128.0 | "Remington, a company that made machines for shooting" | DOC/AC collage | Full-bleed sepia Victorian engraving as the background; revolver ad card centred (x 120–1390, y 75–490) | Ad scales up slightly (1.0→1.1, 2 s) | "shooting" → about −1 s | ad shrinks left; orange returns |
| 33 | 128.0–129.5 | "and sewing" | AC collage | Revolver ad left (x 60–600), sewing-machine booklet right (x 1260–1380) | Second card slides in from the right | "sewing" → about 0 | — |
| 34 | 129.5–132.5 | "bought the design, suddenly they were in the typewriter business" | AC | Remington No.1 engraving card centred-large (x 80–1370), side cards cropped at the edges | Card pops in at the centre; the earlier cards push to the edges | "typewriter business" → about −1 s | card shrinks to ~0.4x |
| 35 | 132.5–134.3 | "the design Sholes patented in 1878" | AC + rail | Patent sheet card, portrait, centred x 900–1110 | Rail label "1878" | "1878" → about +0.3 s | punch-in cut |
| 36 | 134.3–138.1 | "was basically QWERTY along with the numbers" | DOC | Full-bleed crops of the same patent: mechanism, signature, keyboard numbers | 4–6 hard punch-in cuts, ~0.4–1 s each (rhythmic) | "numbers" lands on the keyboard crop | cut |
| 37 | 138.1–140.5 | "the only weirdness is" | AC | Teal returns; patent card small at the left, exiting | Card slides off left; keyboard fades in | — | — |
| 38 | 140.5–146.0 | "that M next to the L, and the C and X are flipped compared to a contemporary keyboard" | DIA | Teal keyboard QWERTYUIOP / ASDFGHJKLM / ZCXVBN, grey keycaps | M highlighted at 141; C and X highlighted at 143, then **swap positions** (144–145, ~0.5 s arc) and become QWERTY | "M" → 0; "C and X" → about 0; swap on "flipped" | keys turn white (modern) |
| 39 | 146.0–148.0 | "the company that made Remington typewriters" | DIA | Modern white keycaps | — | — | **vertical push** to yellow |
| 40 | 148.0–149.8 | "was soon sending out sales packets" | AC | Yellow field; portrait-format ad engraving (woman at a typewriter) at x 1480–1650 (right third); then a "Remington Standard Typewriter" booklet card at x 1700–1830 | Cards pop in, ~0.3 s | "sales packets" → −0.5 s | cut |
| 41 | 149.8–150.9 | "…" | AC | Factory engraving card at the left third | — | — | cut |
| 42 | 150.9–153.9 | "with the QWERTY we know and love" | DOC | Keyboard-sample print, centred | **Push-in** from ~0.55x to 1.0x over 2.5 s, ease-in-out (the print fills the frame) | "QWERTY" | hard cut |
| 43 | 153.9–168.5 | "but that doesn't quite explain how QWERTY got big… urban legends… jamming… not a lot of good evidence… other options…" | TH | Presenter centred, yellow gradient | 14.6 s with no graphics: the longest single shot | — | **grey wipe** |
| 44 | 168.5–174.0 | "around in 1890, like the Merritt typewriter" | AC | Purple field (#6c184d) with an engraving card centred (x 555–1350) | Card enters (~0.4 s) | "Merritt" → about −0.5 s | cut |
| 45 | 174.0–177.0 | "you moved this handle to the right spot for your letter and pressed" | DOC (duotone) | Full-bleed **teal duotone** crop of the handle | Static close crop | "handle" → about 0 | cut |
| 46 | 177.0–184.0 | "the letters weren't in QWERTY, they were in a big long strip that looked like this" | AC + label band | Grey field; engraving card x 440–1485, y 135–935. Purple band (#6c184d α 0.65) full-width, x 190–1725, y 438–613 | "KWBHGPCQTMJDLUEANIVORSZXYF" **scrolls** R→L inside the band at large size (~110 px), then shrinks to fit (~66 px) | "strip" → about 0 | in-scene |
| 47 | 184.0–186.0 | "so it was a KWBHGP keyboard" | AC + label | Band shrinks to a left-anchored box; giant "KWBHGP" (~110 px) | Text scales up | "KWBHGP" → about 0 | **glitch build** |
| 48 | 186.0–198.0 | "many typists believed it worked as well as QWERTY… the best evidence… this invention from 1889" | DOC (glitch frame) | 1889 patent card (Sholes's last keyboard) centred, framed by glitch rectangles (yellow #fde69e, purple, cyan) | Rectangles assemble around it (~1 s). Slow **push-in** 1.0→1.6x over ~11 s, linear | "invention" → about −3 s (an early establishing image) | in-scene |
| 49 | 198.0–200.5 | "the keyboard: not QWERTY but XPMCHR" | DOC + label | Background card **blurs** (Gaussian, ~10 px). Purple label at the left third: "QWERTY" (with strike-through) then "XPMCHR" stacked below | Focus pull 0.3 s; label 1 appears, gets struck through, label 2 types in | "not QWERTY" → 0; "XPMCHR" → 0 | **yellow flash wipe** (1 frame-group, ~0.4 s) |
| 50 | 200.5–205.5 | "the inventor, Christopher Latham Sholes, the guy who invented QWERTY. He created it just before he died" | AC name card | Teal; the same portrait/name card as #27 (reuse), plus a column icon under the photo | Reused widget, same entrance | "Christopher" → about 0 | cross-fade to keyboards |
| 51 | 205.5–212.0 | "even the creator of QWERTY wasn't settled on QWERTY" | DIA (comparison) | Two keyboards stacked: XPMCHR layout above (y 590–690), QWERTY below (y 700–1000), both small (~60 px keys) | Second layout fades in below | "settled" → about 0 | top one drops out, QWERTY scales up |
| 52 | 212.0–215.0 | "and that's where the cartel comes in" | DIA | single QWERTY, centred | — | — | **grey slice wipe** |
| 53 | 215.0–222.0 | "look at this King, he has something to do with QWERTY" | DOC | Light-grey field; Puck cartoon "Trusts" king card, near full-bleed (x 0–870 of 960 per tile → ~1800 px wide) | Enters as a thin horizontal strip that **unrolls vertically** (~0.5 s) | "King" → about −0.5 s | — |
| 54 | 222.0–226.0 | "see the label on his crown" | DOC (duotone zoom) | Full-bleed **magenta duotone**, ~2.2x zoom on the crown | Hard punch-in plus a colour change to duotone | "crown" → about −0.5 s | cut |
| 55 | 226.0–233.0 | "trusts: in the 1890s many companies merged into trusts that allowed them to fix prices and control markets" | AC (glitch frame) | "Commercial Trust" cartoon card centred (x 150–1650) with glitch accents | Rectangles slide in; slow push 1.0→1.08 | "trusts" → about 0 | in-scene |
| 56 | 233.0–235.0 | "in 1893 that happened with typewriters" | DIA | QWERTY keycaps on grey, centred | — | — | keys rearrange |
| 57 | 235.0–240.0 | "some of the biggest manufacturers came together" | KT keycap words | Single keycap row centred (y≈480): SMITH, then REMINGTON, CALIGRAPH, DENSMORE… | Each brand name is **spelled by the keycaps**, which scatter and re-form (~0.5 s each, cubic in-out) | each brand name → about 0 | keys fly together |
| 58 | 240.0–243.0 | "to form Union Typewriter Company" | KT | 3 centred keycap rows: UNION / TYPEWRITER / COMPANY, y 80–170 (top third) | Letters fly in from scatter (~0.7 s) | "Union" → about 0 | **yellow wipe** |
| 59 | 243.0–246.0 | "manufacturers cared most about price" | AC → duotone | Yellow field; colour Remington photo card at the right third (x 1360–1700), then **purple duotone** wipe L→R across the card | ~10 gold "$" glyphs (#f6c84a, 40–90 px) pop in with ~50 ms stagger, then drift up and fade | "price" → about 0 | in-scene |
| 60 | 246.0–250.5 | "and technical improvements, like how the typewriter worked" | AC + annotation | same card | **Thin cream line-art circles** (2–3 px, #e8d6a0) draw around mechanism parts, plus a couple of straight leader lines; each draws in ~0.4 s, ~4 in total | "improvements" → about 0 | card slides down |
| 61 | 250.5–258.0 | "the biggest company made Remington typewriters… the trust did the same" | AC | "Remington Standard" ad card centred, portrait, ~330x520 | Static, slight push | "Remington" → about 0 | card slides left |
| 62 | 258.0–265.0 | "most experts think the trust didn't work to fix prices; trouble beating innovative competitors" | AC | Underwood ad card centred | A red highlight bar (#e6474f) draws vertically over the ad's keyboard line at 265 | "competitors" → about −2 s | **colour push** to red-pink |
| 63 | 265.5–272.8 | "but their market power did fix a pattern on the keyboard" | DIA | Pink-red field (#e66164); white QWERTY keycaps centred | Keyboard scales 1.0→0.85 | "pattern" | **black frame** (~0.5 s) |
| 64 | 273.3–275.6 | "and one more reason why that pattern stuck: look at these old typewriter ads" | AC collage | Purple field; Densmore ad (left) and Remington ad (right) overlapping, full height | Cards slide in from opposite sides | "ads" → about −0.5 s | cut |
| 65 | 275.6–277.4 | "…" | AC | Bar-Lock posters, two cards side by side | — | — | cut |
| 66 | 277.4–280.0 | "or these early typists" | AC | Two B&W photos side by side, full height | — | "typists" → about 0 | cut |
| 67 | 280.0–290.5 | "most of these students are women… they're in a class together" | DOC (selective tint) | Full-bleed B&W classroom photo | **Selective magenta tint** on the women (multiply, #d58ed0), fades in over ~0.6 s at 281. Slow push 1.0→1.12 over ~9 s | "women" → about −1 s | grey wipe |
| 68 | 290.5–297.0 | "typing wasn't like it is today, where you get one of these at the office or one of these when you're born" | TH | centred | Phone prop at 295 | — | **green push** |
| 69 | 297.0–299.0 | "typists trained" | AC | Green field (#b2d56f); B&W typist photo card centred-left with **pink corner tab** and an offset pink plate | Card shrinks 1.0→0.8 | "trained" → about 0 | cut |
| 70 | 299.0–301.8 | "they took classes" | AF | Full-bleed B&W footage of hands on a typewriter | — | — | cut |
| 71 | 301.8–306.0 | "if you took a class you took it for the most common keyboard, that was QWERTY" | DIA | Green; white keycap QWERTY assembles key by key L→R (~1 s) | — | "QWERTY" → about 0 | keyboard shrinks to the bottom |
| 72 | 306.0–311.6 | "people still debate whether QWERTY is the best; some say the 1930s Dvorak keyboard is better" | DIA (comparison) | Dvorak layout (PYFGCRL / AOEUIDHTNS / QJKXBMWVZ) large on top (y 870–1010 → upper-middle), QWERTY small below | Dvorak drops in from above | "Dvorak" → about −0.5 s | hard cut |
| 73 | 311.6–313.4 | "whether it's the best system or not" | TH | centred | — | — | **yellow push** |
| 74 | 313.4–316.4 | "QWERTY isn't going anywhere anytime soon" | KT | Yellow; "QWERTY" keycap row large (~90 px keys) at the top third, then the full keyboard | Keys pop in | "QWERTY" → about 0 | cut |
| 75 | 316.4–317.8 | "how you type…" | AF | Full-bleed silhouette footage | — | — | cut |
| 76 | 317.8–327.0 | "…is more important than what you type. This is the mark of a good typist" | AF | Pink-red field; inset B&W training-film clips (~600x450, offset plate) | Clips cut every ~1.5–2 s | — | **cut to black** (327) |
| 77 | 330–344 | (aside about "TYPEWRITER on the top row") | Credits | Dark slate #1c1c1c; credits at left, presenter square inset at right (x 1350–1830, y 75–1040 per tile) | — | — | Vox network bumper (344–346), logo (346–348) |

---

## 2. Statistics (narrated body, 0–327 s)

| Metric | Value |
|---|---|
| Shots/beats (rows 1–76) | **76**, average **4.3 s** per beat. Hard visual cuts or full-frame transitions: ~62, average **5.3 s**. Median beat ~3.5 s. |
| Longest hold | 14.6 s, talking head (#43). Longest graphics hold: 11 s, the 1889 patent push (#48) |
| Shortest | 0.4–0.8 s punch-in crops (#36) |
| Mix by **screen time** | Talking head 13 % (~42 s) · Keyboard diagram/kinetic keycaps 31 % (~100 s) · Archival cards on colour fields 29 % (~95 s) · Full-bleed doc/engraving with camera move 15 % (~48 s) · Archival footage 8 % (~25 s) · Bumper/transitions 4 % |
| Mix by **beat count** | DIA/KT 36 % · AC 30 % · DOC 13 % · AF 9 % · TH 9 % · BUMP/TR 3 % |
| Map / chart content | **0 %**. The "data" layer is the timeline rail (rows 20–36, ~66 s on screen) |
| On-screen words at once | Median **0** words of prose. Typical "text" is 1 token (one name, one year, one brand). Maximum: 6 words of prose (title card #3) or one 26-letter strip (#46). Excluding keycap letters, text appears in ~28 % of beats |
| Simultaneous elements | Typical 2–3 (background + one subject + rail). **Maximum about 7** (name card #27: portrait, inner frame, name, cyan rule, purple bars, rail, glitch accents) |
| Subjects per frame | **One focal subject 92 % of the time.** Two-up comparisons happen only when the narration compares (#33, #51, #64–66, #72) |
| Camera movement | Element animation is always present, but a **virtual-camera move** (push/tilt/zoom) runs in about 18 % of screen time: #11 tilt, #29 push, #32, #42, #48, #55, #67. Every one is a single slow linear or ease-in-out move, 2–11 s long and 1.08x–1.8x in scale. There are no pans across multiple subjects and no handheld shake. Static frames with animated elements make up ~82 % |
| Background colour changes (chapters) | 14 field-colour changes: teal → yellow bumper → teal → orange → teal → yellow → grey/purple → grey → yellow → red → purple → green → yellow → red |
| Transition types | Hard cut ~60 % · vertical colour push ~15 % · glitch/slice ~12 % · element slide-off to reveal the next scene ~10 % · black ~3 %. **No cross-dissolves between scenes** (only within-scene fades) |

---

## 3. Design tokens (sampled)

### Field colours (full-bleed backgrounds; each has a lighter "bar" tone)

| Token | Base | Bar tint | Used for |
|---|---|---|---|
| `teal` | `#95D4D8` | `#A8DADC` | the modern keyboard / "now" |
| `orange` | `#F1894B` | `#F19660` | 1840–1878 invention timeline |
| `grey` | `#D0D0D0` (warm) / `#D8DFDD` (cool) | `#DDE3E2` | alternatives, the cartel |
| `yellow` | `#FCE59C` | `#FDE69E` | market/price, bumper, finale |
| `redPink` | `#E66164` | `#EB7078` | market power, "mark of a good typist" |
| `plum` | `#6C184D` | — | ads, Merritt |
| `green` | `#B2D56F` | `#BBDA7F` | training/education, Dvorak |
| `presenterBg` | gradient `#FFF69C` (top-left) → `#FFE996` (centre) → `#FACC45` (bottom-right) | — | talking head only |
| `slate` | `#1C1C1C` | — | credits |

**Texture:** every field has a **static** layer of 25–40 flat horizontal rectangles. Each is 30–110 px tall and 150–900 px wide, filled with white at **α 0.08–0.25**, with no blur. Some overlap, which gives a "stacked paper strips/scanlines" feel. I measured no drift over 8 s (`bgdrift.jpg`), so it is a fixed pattern regenerated per chapter. There is **no paper grain, watercolour, halftone or torn edge** in this video.

### Ink and accent colours
- Headline text, purple: `#733964` (≈ `#74385F`). Underline rule: `#67385C`, 4–5 px.
- Emphasis word, red italic: `#E64B51`.
- Key letters, slate blue-grey: `#51667C`. Keycap face is `#FFFFFF` on teal/green/red/yellow and `#D7D7D7` on orange.
- Key highlight yellow: `#FFE94C`. Other highlight hues: magenta ~`#D94F9C`, green ~`#B8DD6B`, red ~`#EC6A78`.
- Timeline: done segment `#FFDD7A`, remaining `#587799`, ticks `#587799` at 3 px. Labels white.
- Label band: `#6C184D` at α ≈ 0.65 (renders as `#957189` over grey). Name-card bars: `#90447C`. Name rule, cyan: `#92CFD1`.
- Money glyph gold: ~`#F6C84A`. Annotation line-art cream: ~`#E8D6A0`.
- Vox logo: white at ~α 0.7, top-right, x 1720–1890, y 30–115.

### Shadows and plates
- **Archival card plate**: a solid rectangle the same size as the card, offset **(−24 px, +24 px)** (down-left), in the field colour darkened ~18 % (orange field → `#CA796E`). No blur. The card itself has no border; a document card has its own white paper.
- **Keycap shadow**: a hard drop toward bottom-left, offset (−12, +15) px, in a darker field tint (`#CBC6CB` on grey, `#C9706A`-ish on orange). Corner radius ~12 px on 128 px keys (≈ 9 %).
- Title box: white α ≈ 0.85, square corners, no shadow.

### Typography
- **UI sans** (titles, names, years, labels, key letters): Vox's in-house **Balto** (Font Bureau), a heavy grotesk. Closest Google Fonts: **Libre Franklin 800/900**, or **Archivo 700/800**, which matches the key letters well.
  - Title: ~110 px, weight 800, tracking 0, line-height 1.15.
  - Name card: 72 px, 700, 3 stacked lines.
  - Years: endpoints 48 px 800, intermediate 33 px 700.
  - Keycap letters: ~60 % of key height, 600–700, centred.
  - Spelled words (SMITH/REMINGTON): keycaps ~90 px with the letter **in purple `#5E1F4F`**.
  - Typed-on letters next to the presenter: bold caps with +20 % letter-spacing, purple.
- **Bumper wordmark** "OVERRATED": a distressed heavy slab/old-style serif. Closest Google Fonts: **Alfa Slab One** or **Abril Fatface** with a roughen filter. It appears only in the bumper.
- **Typewriter strip**: same bold sans in white caps (not monospace).
- Lower third: 21 px sans, white, "Name | Vox".

### Annotation style
- **No red-pen scribbles in this video.** Emphasis comes from: (a) **fill-highlighting keycaps** in flat yellow, (b) a semi-transparent **colour block** over a patent region (yellow-green, α 0.7), (c) thin **cream line circles** (2–3 px, imperfect, drawn on) on a duotone image, (d) **selective colour tint** on people in a B&W photo, (e) **strike-through** in a label.
- Duotone treatments: magenta (`#C24E96` highlights → `#5A1A44` shadows) on the crown, purple on the Remington, teal on the Merritt handle.

### Grid / safe areas (1920x1080)
- Logo bug at top-right (x ≥ 1720, y ≤ 115) is never overlapped.
- Timeline rail band: y 890–980, x 210–1710. While it is visible, all main content stays in y 45–860.
- Main subject is centred, about 50–70 % of frame width. Name/label text uses the right third (x ≥ 1350) or a full-width band at the vertical centre.

---

## 4. Widget candidates (Remotion)

All timings are frames @30 fps unless noted. `at` is a **word anchor** (`{word: index}` into the alignment). Every widget resolves its entrance frame as `wordStart(at) + lead` with a default lead of **−3 frames (−100 ms)**.

1. **`ChapterField`**: full-bleed flat colour with a seeded static bar texture, plus the chapter transition.
   ```ts
   { color: 'teal'|'orange'|'grey'|'yellow'|'redPink'|'plum'|'green'; seed: number;
     barCount?: number /*30*/; barAlpha?: [number,number] /*[.08,.25]*/;
     enter?: 'push-up'|'push-left'|'cut'|'glitch'; at: WordAnchor }
   ```
   Motion: push-up/left over 14 f with `Easing.inOut(Easing.cubic)`; the new field slides over the old one and carries its content. Reproduces rows 3, 18, 20→21, 39, 52, 58, 62, 68, 73. **This replaces "ACT III" chips: a chapter is a colour change, never a label.**

2. **`KeycapBoard`**: a keyboard-layout diagram that can morph, highlight, swap and scatter.
   ```ts
   { rows: string[] /* e.g. ['QWE.TYUIOP','ZSDFGHJKLM','AX&CVBN?;R'] */; keySize?: number /*128*/;
     face?: 'white'|'grey'; spacebar?: boolean; position?: 'upper'|'center';
     events: Array<
       | { at: WordAnchor; kind: 'highlight'; keys: string[]; color?: string /*#FFE94C*/ }
       | { at: WordAnchor; kind: 'swap'; a: string; b: string }
       | { at: WordAnchor; kind: 'morph'; rows: string[] }
       | { at: WordAnchor; kind: 'assemble'|'scatter' } > }
   ```
   Motion: `assemble` is a spring (damping 14, mass 0.6), 40 ms stagger per key. A highlight fill takes 6 f with a scale bump of 1.0→1.1→1.0. A swap moves along an arc (y −40 px) over 15 f. A morph flips letters in place with a 1-frame blank and 20 ms per-key stagger. Reproduces rows 1–2, 6, 16–17, 19–20, 28–31, 38–39, 51–52, 56, 63, 71–72.

3. **`KeycapWord`**: spells a word in keycaps; successive words scatter and re-form.
   ```ts
   { words: Array<{ text: string; at: WordAnchor }>; layout?: 'row'|'stack'; keySize?: number /*90*/; ink?: string /*#5E1F4F*/ }
   ```
   Motion: letters persist across words where possible (a FLIP-style re-layout), take 15 f with cubic in-out, and extra letters fly off-canvas. Reproduces rows 57, 58, 74 and 5 (floating letters).

4. **`ArchivalCard`**: an inset still with an offset plate and optional treatments.
   ```ts
   { src: string; box: Rect /*default centred 70% w*/; plate?: { dx: -24; dy: 24; darken: .18 };
     enter: 'scale'|'slice'|'slide-left'|'slide-right'|'unroll'|'glitch'; at: WordAnchor;
     treatment?: { kind:'duotone'; hi: string; lo: string; at: WordAnchor }
               | { kind:'ghost'; alpha: .25; at: WordAnchor }
               | { kind:'blur'; px: 10; at: WordAnchor }
               | { kind:'tilt3d'; at: WordAnchor };
     push?: { from: 1; to: number; durationS: number } }
   ```
   Motion: scale 0.6→1 over 12 f `Easing.out(Easing.back(1.2))`. `slice` uses 8 horizontal strips that slide in alternately from ±60 px over 12 f. `unroll` animates scaleY 0.05→1 over 15 f. A push is always linear or `inOut(sine)`. Reproduces rows 21–23, 26, 32–35, 40–41, 44, 46, 48, 53, 55, 59–62, 64–66, 69.

5. **`TimelineRail`**: a persistent year axis across a chapter.
   ```ts
   { from: 1840; to: 1890; ticks?: number /*6*/; marks: Array<{ year: number; at: WordAnchor }>; y?: 908 }
   ```
   Motion: the line draws on L→R over 18 f, linear. On each mark the yellow progress fill animates to that year (12 f, ease-out) and a small label fades and rises 8 px. The rail **persists across cards** and unmounts only with its `ChapterField`. Reproduces rows 20–36.

6. **`NameCard`**: a portrait with a person's name.
   ```ts
   { photo: string; name: string /* split onto ≤3 lines */; at: WordAnchor; accent?: '#92CFD1'; glitch?: boolean }
   ```
   Motion: the photo glitches in (3–4 frames of RGB-offset slices); the name wipes L→R over 12 f, 4 f after the photo. The cyan rule draws 10 f later. Reproduces rows 27 and 50.

7. **`LabelBand`**: a translucent plum band with white caps, used for a single token or code.
   ```ts
   { text: string; at: WordAnchor; mode: 'type'|'scroll'|'pop'; strike?: { at: WordAnchor; then?: string };
     placement?: 'center-band'|'left-third' }
   ```
   Motion: `type` runs at 16 chars/s. `scroll` moves R→L at ~900 px/s, then scales to fit (10 f). A strike line draws over 6 f and the replacement text types in below. Reproduces rows 22, 46–47, 49.

8. **`StatementCard`**: the cold-open thesis line.
   ```ts
   { lead: string /*"The QWERTY keyboard is"*/; keyword: string /*"overrated"*/; at: WordAnchor /*keyword*/ }
   ```
   Motion: the box fades in at α 0.85 over 8 f. The lead text appears immediately. The keyword types in red italic exactly on its spoken word, and the underline draws over 8 f. Reproduces row 3. **Use at most once per video.**

9. **`DocumentPan`**: a full-bleed document or engraving with a single camera move plus an optional region highlight.
   ```ts
   { src: string; move: { from: {x,y,scale}; to: {x,y,scale}; startAt: WordAnchor; durationS: number };
     highlight?: { rect: Rect; color?: '#C8E35A'; alpha?: .7; at: WordAnchor };
     punchIns?: Array<{ rect: Rect; at: WordAnchor }> }
   ```
   Motion: one ease-in-out move with no direction change, followed by a hold of at least 1 s. Punch-ins are hard cuts. Reproduces rows 11–12, 36, 42, 45, 54, 67.

10. **`Loupe`**: a circular magnifier over a card detail.
    ```ts
    { target: Rect; zoom?: 2; diameter?: 480; at: WordAnchor; holdS?: 1.2 }
    ```
    Motion: pops in over 8 f with an overshoot spring, holds, and pops out over 6 f. Reproduces row 24.

11. **`IconBurst` / `LineCallouts`**: decorative semantic glyphs ($) or thin drawn circles over a duotone card.
    ```ts
    { kind: 'burst'; glyph: '$'; count: 10; color: '#F6C84A'; at: WordAnchor } |
    { kind: 'callouts'; circles: Array<{ cx; cy; r; at: WordAnchor }>; stroke: '#E8D6A0'; width: 3 }
    ```
    Motion: burst glyphs pop in with a 50 ms stagger, then drift up 40 px and fade over 30 f. Each circle draws on via stroke-dashoffset over 12 f. Reproduces rows 59 and 60.

12. **`GlitchTransition`**: an RGB bar-slice wipe between scenes.
    ```ts
    { durationF: 24; palette: ['#FDE69E','#6C184D','#92CFD1']; at: WordAnchor }
    ```
    Motion: 6–10 horizontal bars at random heights flash and offset ±80 px, with alternate frames between the outgoing and incoming scene. Reproduces rows 17→18, 26→27, 47→48, 49→50. Use it **≤ 1 per 60 s**.

(Not a widget in our pipeline, but in the style: the **presenter plate** on a yellow gradient. We have no presenter. The equivalent beat for us is a 3–6 s "breather" scene of one big `KeycapWord` or one archival card with no other motion.)

---

## 5. Rules observed

**Always**
1. **One focal subject per beat.** Show two subjects only when the narration literally compares two things, and then side by side or stacked, never overlapping.
2. **Entrance on the spoken word.** In 80 % of measured events the element onset falls within −0.5 s to +0.5 s of its trigger word (the noun, name or year). Letters and keys spelled aloud sync to ±0.3 s. Establishing images may lead by 0.5–1 s at a sentence start. Nothing lags by more than ~2 s.
3. **A chapter is a background colour.** A new act or idea means a new flat field colour, entered with a push. The chapter is never named on screen.
4. **Persistent context lives in a reserved band.** The timeline rail stays at y≈908 for an entire chapter, and content never enters that band while it is visible.
5. **Replace, don't accumulate.** Each new card enters as the previous one leaves (slide-off, shrink-away, morph), and at most one previous element stays, as a comparison. Over 76 beats I saw no PowerPoint-style build-up of more than 3 items.
6. **Morph the same object instead of cutting**, when the subject is the same (keyboard layouts 1870→1873→1878→modern), so the viewer tracks the change.
7. **Highlight before explaining.** A flat-fill highlight lands on the exact key, letter or region named, then the next sentence uses it.
8. **Archival images are inset cards** with a hard offset plate in a darker field tint. Full-bleed is reserved for documents during a camera move and for footage.
9. **Camera moves are single, slow and monotonic**: 1.08x–1.8x over 2–11 s, no direction reversals, no more than one move per beat.
10. **Typography is one heavy grotesk.** The only serif is the series bumper.

**Never**
1. No chips, act labels, section titles or "Part 2" text overlays. Navigation is colour plus narration.
2. No boxed UI cards with borders or rounded panels around content. The only box is the translucent thesis box (once) and the plum label band.
3. No more than ~6 words of prose on screen. Labels are single tokens: a name, a year, a brand, a code.
4. Labels never overlap a subject's key detail. They sit beside it (right third) or in a band with the subject blurred behind (row 49).
5. No cross-dissolves between scenes. Use a cut, a colour push or a glitch.
6. No counters, charts or icons without a spoken referent. Even the $ burst is triggered by "price".
7. No drop shadows with blur, gradients on fields, or glows (except the presenter's backdrop).
8. Nothing ever overlaps the top-right logo bug.

**Implications for the CreatorStudio harness**
- The "ACT III chip over the map title" bug breaks Never-rule 1 and Always-rule 3. Remove chapter chips entirely and let `ChapterField` colour carry the act.
- The drift of 30–60 s means anchoring was missing. Every widget in §4 takes a `WordAnchor`, not seconds, and the renderer resolves anchors from the full word alignment (all words, not the first 40).
- The "slides accumulate" problem: enforce Always-rule 5 in the scene schema. A scene holds ≤ 1 focal widget plus ≤ 1 persistent rail, and every widget has an explicit exit tied to the next anchor.

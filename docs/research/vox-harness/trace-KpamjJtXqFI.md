# One-to-one trace: Vox, "The man who rigged America's election maps" (KpamjJtXqFI)

Source: https://www.youtube.com/watch?v=KpamjJtXqFI. Local copy: 720p, 29.97 fps, 451.9 s. The credits start at 442.3 s.
Method: I walked the whole video in 1 fps contact sheets (16 sheets). I then made 5 fps and 10–12 fps strips at about 10 key beats to time triggers, pulled 1280x720 stills for typography, and sampled pixel colours with ffmpeg plus a small saturation picker.
Working files are in `scratchpad/trace/KpamjJtXqFI/` (`m_*.jpg` = 30 s sheets, `st_*.jpg` = 5 fps timing strips, `grid_*.jpg` = stills, `tr_*.jpg` = transition strips).
All coordinates below are given on a **1920x1080** canvas (720p measurements x1.5).

Timing precision: the transcript comes from YouTube auto captions, which give line starts only, accurate to about ±0.5 s. I estimated each word's onset by interpolating inside its caption line. Element onsets come from frames at 0.2 s (5 fps) resolution. So the "lead/lag" values are accurate to about ±300 ms.

---

## 0. The single most important observation

The whole explainer is a **one-sheet-of-paper world**. Every animated beat is staged on the same warm cream paper texture, full-bleed, with a camera that moves over it. The camera pushes in, pulls back and pans. When the paper itself needs to change, a new sheet physically slides in. Nothing ever appears in a boxed card or panel.

There are only two "frame" devices:
- **(a) Camera pull-back.** The camera pulls back so far that the paper becomes a sheet sitting on a graphite desk (#3B3B3D). This is used twice: once to add a second chart below, and once to put a caption *above* the sheet.
- **(b) Paper-sheet swap.** The old sheet slides off and a rotated new sheet slides on.

Everything else is choropleth maps, unit/waffle squares, documents and archival footage, all drawn *on* the paper.

Two of our current faults trace directly to breaking this rule:
- The "ACT III chip over the map title" fault is impossible in this grammar. There are no persistent UI chips; section titles exist only as the paper's own headline, one at a time.
- The "dark boxed card" fault is also impossible here: there are no cards.

---

## 1. SHOT / BEAT TABLE

Legend for shot types:
- **MAP**: choropleth or outline map on paper
- **UNIT**: waffle/unit squares chart
- **DOC**: document, headline or file collage
- **FTG**: archival footage or photo
- **TXT**: kinetic word
- **TRN**: transition

Other notation: "Cam" means virtual camera, `push` means scale up, `pull` means scale down. Durations are in seconds.

| # | t (s) | Narration over it | Type | Layout (1920x1080) | Elements & motion | Trigger word → onset (lag) | On-screen text & style | Out-transition |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.0–6.0 | "In 2018 Americans voted for who would represent them in Congress" | MAP + TXT | US district map centred, 1500 px wide, y 90–950. Caption block centred at x≈960, two lines at y≈450/545 (on the map's middle third) | Paper appears at 0.17 s. The map *bleeds in* as watercolour blotches (18 frames, 1.8→2.8 s). There is no slide. Cam static | "In 2018" → caption 0.8 s (+~0.3 s after the word, because the box wipes before the text). "Americans" → map 1.8 s (≈0) | Kinetic caption: **Libre Franklin/Franklin Gothic 800, ~54 px, black on highlighter yellow #F9F400 bar**. The bar wipes L→R in ~0.2 s, then the words type in phrase-chunks *exactly as spoken* ("In 2018," / "Americans voted for" / "who would represent" / "them in Congress."). The chunk being spoken has no yellow yet; the bar catches up 0.2–0.4 s later | Everything except NC fades to ~15 % opacity, 5.6–6.4 s, while the cam pushes toward NC |
| 2 | 6.0–9.6 | "but in North Carolina the election results were really weird" | MAP | NC alone, centred (x 650–1200, y 300–560). Ghost US map at 15 % behind | Cam push ~3.5x into NC over ~1.0 s (ease-in-out). A **hand-drawn graphite ellipse** (#776A5E, ~4 px, wobbly, overshoots its own start like a real pen loop) draws around NC in ~0.6 s | "North Carolina" (≈6.3) → ellipse + label 6.6–7.2 (+~300 ms) | Label "North Carolina" in bold grotesque, rotated −10° to follow the state's axis, set *on top* of the state | **Paper-sheet swap**: a new sheet slides in from the right, rotated −8°→0°, 9.6→10.2 s (0.6 s, ease-out) |
| 3 | 10.2–12.8 | "these squares represent all the voters in North Carolina" | UNIT | Header at y≈95. 5x18 grid of squares (each ~30x42 px, gap ~12 px) centred at y 250–500 | Squares are already present when the sheet lands. A **gold shimmer sweep** crosses the grid at 11.2–11.6 s | "squares" (≈10.8) → shimmer 11.2 (+400 ms) | "NORTH CAROLINA VOTERS": bold grotesque caps, ~44 px, tracking ≈ +0.25 em, black #0D0700 | Cam **pull-back** |
| 4 | 12.8–17.0 | "they were voting for these 13 seats in Congress" | UNIT | Cam pulls back to 0.79x (12.8–13.8, ease-in-out). The sheet now shows its edges on graphite #3B3B3D (portrait-ish 1510x1080 sheet). New row of 13 seat squares at y≈890 | The second label + seat row fade/slide up 0.3 s | "13 seats" (≈14.0) → seat row 13.8–14.1 (≈0) | "CONGRESSIONAL SEATS", same caps style. Seat squares are copper/gold gradient (#C08211 centre → dark brown edges) = "unassigned" | — |
| 5 | 15.0–20.0 | "about half voted for Republicans and about 48% voted for Democrats" | UNIT | Grid splits into two blocks (blue left x 410–900, red right x 1015–1500) with 2 neutral tan squares (top row) between | Recolour sweeps column-by-column (~0.6 s per block) with a slight gap opening (0.3 s) | "Republicans" (≈16.8) → red 16.6–17.4 (≈0). "Democrats" (≈19.0) → blue 18.6–19.2 (−200 ms) | No numbers shown: the squares *are* the number | — |
| 6 | 21–28 | "…maybe Democrats would have won six seats and Republicans would have won seven" | UNIT | Same | Seat squares recolour: 6 blue at 24.6, then 7 red at 26.8 | "six" (≈24.3) → +300 ms. "seven" (≈27.0) → ≈0 | — | — |
| 7 | 28–33 | "but Democrats won only 3 of 13 seats, way less than half" | UNIT | Same | 3 of the 6 blue seats turn purple (transitional, 29.5), then orange/red (30.5). A gap opens between 3 blue and 10 red | "3" (≈29.5) → purple 29.5, red 30.5 | — | Cam **push back** to 1.0 (34.0–35.0) |
| 8 | 35–37.3 | "this imbalance was because North Carolina's congressional districts…" | UNIT | Full-bleed voters grid again (header y≈170, grid y 300–900) | Hold (static) | — | — | — |
| 9 | 37.3–40.9 | "had been gerrymandered" | TXT over UNIT | Word on a diagonal (−4°) across the grid's middle row, x 180–1740, y≈570 | **Stroke write-on**: letters reveal L→R like a pen nib, 37.4→39.5 (2.1 s), holds 1 s, fades 40.6–40.9 (0.3 s) | "gerrymandered" (≈38.0) → starts 37.4 (**−600 ms lead**), completes 1.5 s after | **"Gerrymandered" in bold high-contrast italic serif (Playfair Display 900 Italic class), ~190 px. Ink is black with a rust/brown watercolour grain inside the strokes** | — |
| 10 | 41.0–46.0 | "it means these voters had been grouped into districts very strategically" | UNIT | Same sheet | Squares **detach and fly** with individual random delays (41.2→45.5, about 4 s total, each square's flight ~0.6–1.0 s, ease-in-out, a few rotate) into 13 clusters | "grouped" (≈40.8) → first square moves 41.2 (+400 ms) | — | — |
| 11 | 46.0–59.0 | "…benefiting one party. Gerrymandering has pretty much always happened… every ten years the political districts are redrawn" | UNIT | 13 cluster "districts" fill the sheet (x 90–1880, y 230–960) | Each cluster gets a **translucent watercolour tile** behind it (blue-grey wash #DAD5DA or salmon wash with soft, torn edges). Squares saturate to navy #003BB1 / red #E61B03. At 52–56 ("redrawn") several squares hop between tiles (0.4 s hops) and the tiles reshape | "districts" (≈41) → tiles 45.6. "redrawn" (≈52.5) → hops 52.0 (−500 ms) | — | Cam pull-back |
| 12 | 59.0–62.6 | "…whoever holds power in state government at the time" | UNIT | Cam pulls back (~0.85x) so a third row appears: "STATE GOVERNMENT" + 13 small seats (3 blue, 10 orange) at y≈850–940 | Label + row fade in 0.3 s | "state government" (≈58.0) → 59.3 (+~1 s) | "STATE GOVERNMENT" in **gold** caps (#C08211), same tracking | **Paper swap (long form)**: the old sheet slides out L with −8° rotation (62.6–63.0), 0.3 s of empty graphite, then the new sheet slides in from the R at ~−12°, settling 63.4–64.2 (total ≈1.5 s) |
| 13 | 64–80 | "That's what happened in 2010. Republicans won control of lots of state governments… over the next few years redistricting helped them hold on to almost all those states" | MAP | Title block centred top (y 50–130). US states map x 150–1750, y 190–1000 | States fill **red watercolour** (#F1484A-ish, granular) vs tan (#BEAF8E). The year counter **swaps** (it does not count): 2010 → 2011 at 66.0 → 2014 (74.0) → 2016 (75.0) → 2017 (76.0), with map fills updating per year. Cam: slow push ~3 % over 16 s | "2010" (≈60.5) → year visible at 64 (as sheet lands). "next few years" (≈68.5) → years tick 74–76 | Line 1: "Republican-controlled state legislatures" in italic serif, ~34 px, black. Line 2: the year in **bold italic serif ~48 px**, under it. Both centred | Hard cut |
| 14 | 80.0–91.3 | (Hofeller audio) "Usually the voters get to pick the politicians. In redistricting, the politicians get to pick the voters." | FTG | 4:3 SD archive scaled to fill width, letterboxed bottom (black 25 %) | Slow push in. Subtitle line under the image | Subtitle appears with the audio phrase (81.0, 87.0) and fades out at line end (85.5–86.5) | Subtitles: bold grotesque ~34 px white. **Key nouns recoloured yellow #F9F400** ("voters", "politicians") | Cut |
| 15 | 91.3–96.0 | "this is Thomas Hofeller, the mapmaker who helped Republicans gerrymander districts" | FTG | Full-bleed footage | Name lower-third at bottom-left (x 80, y 870), no box, white with a soft drop shadow | "Thomas Hofeller" (≈89.5) → name at 91.7 (with the cut) | "Thomas Hofeller", bold grotesque 46 px white | Push-in with a zoom blur (96) = cut |
| 16 | 96.0–99.0 | "when Hofeller died in 2018…" | DOC | Paper. Headline block left-aligned at x 190, y 210–500 (left two-thirds) | Static re-typeset headline (not a screenshot) | "died" (≈95.8) → 96.0 | NYT blackletter masthead, then **headline in Libre Franklin 800, ~64 px**, then "AUGUST 21, 2018 \| BY MICHAEL WINES" in small caps 22 px | Cut |
| 17 | 99.0–110.0 | "his daughter found thousands of his emails and files which she shared with activists" | DOC collage | 8–9 tilted (±3–8°) screenshots/printouts of GIS maps & spreadsheets overlapping, full-bleed | Slow drift pan (~4 % across). Individual files **punch in** full-screen (104.1, 105.6, 106.8) for ~1.2 s each, then back | "files" (≈100.5) → collage already on screen. Punch-ins land on the rhythm of the clauses | Only the files' own text | Cut |
| 18 | 110.0–121.5 | "the files show that Tom Hofeller's fingerprints are all over the way America's political maps look today, but North Carolina was his masterpiece" | MAP + FTG | East-coast watercolour map (states as torn paper with white borders) full-bleed. Hofeller's face is **multiply-blended** into the map | NC district outlines **draw on** in dark brown/black (113–117.5) with a gold coastline. Slow push. At 118.0 the **Vox wordmark** fades in at right-centre (x≈1120–1560, y≈400–520), maroon serif, as a title card | "masterpiece" (≈110.5) → lines 113 (+2.5 s; drawn under the next sentence) | "Vox" logo (maroon) | Dip to the paper (121–122.5, 1 s cross-dissolve) |
| 19 | 122.5–127.5 | "the basics of gerrymandering are actually pretty simple. If you're a Republican trying to keep power you want to do two things" | UNIT | Title arched at the top (y 60–130, x 560–1360). Squares cluster centre (y 390–470) | Title fades in 0.4 s. **13 blue + 8 red squares fly in from off-frame** (all edges) with staggered starts, 123.2→125.0, ease-out, settling into 2 blocks. An **orange pen arc** (#D66C15, ~5 px) swipes around the red block 125.4→126.4 (~1 s) and is erased (the stroke retracts) | "basics" (≈121.5) → title 123.0 (+1.5 s, waits for the dissolve). "Republican" (≈124) → arc at 125.4 | "Basics of gerrymandering" in **gold foil italic serif** (#B4891D, metallic grain), ~64 px, on a slight arc/−3° | — |
| 20 | 127.5–129.5 | "…two things" | UNIT | Numerals "1" and "2" above each future zone (x≈720, x≈1450; y≈235) | Numerals fade in at 127.8 | "two things" (≈127.5) → +300 ms | "1", "2" bold grotesque 44 px | Cam pans |
| 21 | 129.5–142.0 | "first, PACK as many Democratic voters as possible into a single district… almost half these votes are basically wasted" | UNIT | Cam **pans** so "1" sits at the left third (x≈640) and the right zone is partly off-frame. Packed block = 7 navy squares in a lavender wash tile (x 540–700) | "PACK" label types under "1" at 130.4. Blue squares slide/merge into a tight 2-row block (130.0–131.0). **Black hand-drawn ellipse** around the top row + label "Wasted" (regular grotesque 28 px) right of it, 139.6–140.5 | "pack" (≈129.3) → label 130.4 (+1.1 s). "wasted" (≈140.0) → ellipse 139.6 (−400 ms) | "PACK" bold caps 44 px, tracked | Cam pans right (142–143, 0.8 s) |
| 22 | 142.0–161.3 | "you can also CRACK big Democratic areas into separate districts where there are slightly more Republicans… in this district and in this district… packing and cracking" | UNIT | "2 CRACK" heading at x≈1450. Two orange watercolour tiles (#F3C488) each with 3 navy over 4 red squares (x 1100–1830) | Squares split and slide into 2 tiles (143–146.5). **Teal pen stroke** draws a connector across both tiles (151.0–152.0, ~1 s) then erases. Cam recentres to show 1 + 2 together at 153–156 (slow 3 s ease) | "crack" (≈142.3) → "CRACK" label 142.9 (+600 ms). "this district… this district" (≈152) → pen 151–152 | "CRACK" caps as PACK | Hard cut |
| 23 | 161.3–165.9 | "and Hofeller employed these techniques masterfully…" | FTG | Hofeller podium, full-bleed | Static | — | — | Cut |
| 24 | 165.9–173.0 | "in 2011 he was hired to redraw the state's political lines… he came up with this map" | MAP | Title centred top (y 50–150). NC silhouette, tan watercolour with torn paper bottom edge, x 30–1880, y 200–700 | District boundaries **draw on as one continuous thin pen line** (~3 px, #2A1E14) 166.6→170.0 (3.4 s, linear), starting at the west and snaking east | "redraw" (≈165) → 166.6. "this map" (≈170.5) → line completes 170.0 (draw finishes *as* the word lands) | "North Carolina" gold foil italic serif 64 px, plus "2011 congressional districts" maroon (#872102) grotesque 26 px, centred directly under it | Cam push |
| 25 | 173.0–179.0 | "Now I just want to focus in on District 12, this weird skinny shape" | MAP | Cam push ~2.5x (172.5–174, ease-in-out). Lines thicken to ~5 px in screen space | District 12 **fills salmon** #E79D80 (0.4 s) with the label "District 12" in orange-red #D64207 grotesque 40 px, placed in the empty paper *beside* the shape (x 500–690, y 330), never on top of lines. At 177–179 the lines turn gold and fade out | "District 12" (≈172.5) → fill 173.6 (+1.1 s, after the push lands) | — | Cross-dissolve to the next map layer |
| 26 | 179.0–188.0 | "this map shows the percentage of black people in each neighborhood. The bluer areas are where more black people live" | MAP | NC full width. Header top-left (x 60, y 50–110). Source tiny bottom-left (x 15, y 1050) | Choropleth **watercolour blobs** (teal #2BB39A-ish → navy → purple #59007D) bloom in ~0.8 s. The header *types on* line 1 then line 2 (182.0, 183.0). Cam slow pull | "percentage" (≈181.5) → header 182.0 (+500 ms) | "PERCENTAGE OF BLACK PEOPLE / IN EACH NEIGHBORHOOD", bold caps 30 px, tracking +0.2 em, dark grey #3A3A3A. "Source: US Census" 12 px | Cam push |
| 27 | 188.0–199.5 | "Hofeller basically gathered up black people in Winston-Salem, Greensboro and Charlotte and packed them into one district. So that's how District 12 happened" | MAP | Cam push 1.6x (188–189.5). Cities at the upper-left third (WS x≈700, y≈225), upper-right (G x≈1090), lower-left (C x≈450, y≈620) | For each city: a **thin red circle** (#E03C32 at ~60 % opacity, ~4 px, slightly imperfect) draws clockwise in ~0.35 s, and a label fades in 0.2 s, placed *outside* the circle. Then the D12 outline (black ~3 px) draws through all three, 192.8→194.2 (1.4 s). Circles fade 196.8. Cam pulls back 198–199.5 | "Winston-Salem" (≈189.6) → 189.8 (+200 ms). "Greensboro" (≈190.8) → 191.0 (+200 ms). "Charlotte" (≈191.6) → 191.8 (+200 ms). "packed them into one district" (≈192.5) → line 192.8 (+300 ms) | City labels: medium grotesque 40 px. Winston-Salem/Charlotte in dark maroon #872102 placed left of the circle; Greensboro in brown-orange #963700 placed right | — |
| 28 | 199.5–205.5 | "Hofeller also did this with North Carolina state representatives and state senators, for example here the state Senate districts" | MAP | Title centred top again | The new title types on. Senate district lines draw over the choropleth (201–204, 3 s) | "state senators" (≈200.5) → title 199.8 | "North Carolina" gold serif + "2011 state Senate districts" maroon | **Fast zoom** with motion blur (205.5–206.9, ~1.4 s, strong ease-in-out, ~3x). The cut detector fires 20 times here |
| 29 | 206.9–215.5 | "here he packed Winston-Salem into one district, and then packed Greensboro into its own district" | MAP | Zoomed Piedmont. Thick black district lines (~8 px) and dark-red senate line | Red circle + "Winston-Salem" (207.6–208.4). Second red circle on Greensboro 210.6–211.4. Both hold | "Winston-Salem" (≈205.5–206) → 207.6 (+~1.5 s, waits for the zoom to land). "Greensboro" (≈210) → 210.6 (+600 ms) | Labels as before | Fast zoom-out 215.5–217.4 (detector fires again) |
| 30 | 217.4–221.0 | "these new districts helped Republicans get a stranglehold on power…" | MAP | Full-state senate map with title | Hold | — | — | Cut |
| 31 | 221.0–224.3 | "…a strict new voter ID law" | FTG | PBS NewsHour anchor | — | — | — | Cut |
| 32 | 224.3–228.7 | "which bathrooms transgender individuals can use" | FTG | CNN studio "Bathroom battle" | — | — | — | Cut to paper |
| 33 | 228.7–233.5 | "in 2016 and 2017 federal courts ruled that both of these maps…" | MAP | Two stacked NC outline maps (gold outlines #B18121, 2 px), each ~900 px wide. Top map y 120–420, bottom y 560–870. Labels above each | Top map + label fade in 229.6. The bottom map slides up from below (230.5–232.0) while the top compresses upward | "both of these maps" (≈232.5) → both present by 232 (−500 ms) | "CONGRESSIONAL MAP" / "STATE SENATE MAP" in caps 20 px, tracking +0.3 em, maroon #872102 | — |
| 34 | 233.5–238.5 | "…were unconstitutional" | MAP + TXT | Same | **3-D rubber-stamp prop** (dark brown #271918, with a soft drop shadow on the paper) drops in from the top (234.3), hits the top map at 235.5 leaving the red word, lifts, then hits the bottom map at 236.3. Each hit ≈0.25 s down / 0.4 s up | "unconstitutional" (≈234.7) → first impact 235.5 (+800 ms). The stamp is in motion *during* the word | "Unconstitutional" in red #F30001 heavy italic serif, ~60 px, −4°, slightly distressed ink | Cam **pull-back** |
| 35 | 238.5–245.5 | "they said what NC Republicans did wasn't just gerrymandering, it was a *racial* gerrymander…" | MAP (framed) | Cam pulls back to 0.56x (238.4–239.2, 0.8 s ease-out). The sheet becomes a card on graphite #3B3B3D (x 240–1325... centred, ~1075x610). Caption on the graphite *above* the sheet at y≈100 | Caption fades in 0.3 s | "racial gerrymander" (≈239.0) → caption 239.6 (+600 ms) | "RACIAL GERRYMANDERING" white bold caps 48 px, tracking +0.25 em | Cut |
| 36 | 245.5–252.5 | "…the court said Republicans in the NC Statehouse now had to redraw the lines without looking at racial demographics" | FTG | NC House chamber (2 stills/clips) + committee hearing | Ken-Burns push ~5 %/4 s | — | — | Cut |
| 37 | 252.5–256.6 | "so they went back to Tom Hofeller" | FTG | Hofeller podium | — | "Hofeller" (≈253.5) → cut at 252.5 (−1 s, the cut anticipates the name) | — | Cut |
| 38 | 256.6–263.0 | "this time Hofeller couldn't look at race. Instead he looked at which areas voted for Democrats and which voted for Republicans… instead of a racial gerrymander" | MAP | NC silhouette full width (x 30–1890, y 300–850) | **Purple wash** bleeds east-to-west (258.4–259.6, 1.2 s); **orange wash** bleeds west (260.6–261.4). "RACIAL GERRYMANDER" types on at 261.6–262.0 centred *on* the state | "Democrats" (≈258.5) → purple 258.4 (≈0). "Republicans" (≈260.5) → orange 260.6 (+100 ms). "racial gerrymander" (≈262.0) → 261.6 (−400 ms) | Bold caps 40 px, tracking +0.25 em, black | — |
| 39 | 263.0–266.5 | "it would be a partisan gerrymander" | MAP + TXT | Same | **Word-swap**: a black block with white "PARTISAN" slides in from the left (263.0–263.6, 0.6 s ease-out). It pushes "RACIAL" out of existence and "GERRYMANDER" stays put. The washes desaturate to tan at the same time (263.4–264.6) | "partisan" (≈263.0) → 263.0 (≈0) | "PARTISAN": white caps in a black #110F0D box (padding ~8 px), same size as the following word | Cross-dissolve |
| 40 | 266.5–273.0 | "here's that map using data from 2014. The bluer an area, the more Democratic voters there are" | MAP | Header centred top (y≈60). Source bottom-left | Teal precinct choropleth reveals L→R wipe (267.0–268.6) | "here's that map" (≈266) → 267.0 (+~800 ms). The header is ghosted in before the data | "DEMOCRATIC VOTERS, BY PRECINCT" caps 30 px, tracking +0.25 em | Cam push ~4x (272.5–274, ease-in-out) |
| 41 | 273–284 | "now if you zoom in here to Greensboro you can see one of the highest concentrations of Democratic voters… Hofeller drew a congressional district line to crack this community in half" | MAP | Greensboro cluster centred. Label at top-centre (x 960, y 70) | "GREENSBORO" fades in 274.4 (0.4 s), turning maroon → gold at 279. **Thick black line** (~10 px, ink texture) draws from the bottom-left, snakes through the cluster and exits right, 279.0→281.5 (2.5 s) | "Greensboro" (≈274.5) → 274.4 (≈0). "crack this community in half" (≈280.5) → line mid-draw at 280.5 (synced so the line *crosses the cluster on "crack"*) | "GREENSBORO" caps 36 px, tracking +0.3 em, maroon #872102 | Cam pull 284 (0.5 s) |
| 42 | 284–294 | "this meant Democrats here were now in the minority in their district, and Democrats here were also in the minority" | MAP | Pulled back 0.6x | Small red circle (#E03C32, 60 %) on the north half (285.6), then on the south half (288.8), each 0.35 s | "Democrats here" (≈284.8) → 285.6 (+800 ms). Second "here" (≈288.3) → 288.8 (+500 ms) | — | Cam pull to the full state (293–295) |
| 43 | 294–303.4 | "Hofeller employed these techniques all over the state… the first big test would be the 2018 election" | MAP | Title centred top | The choropleth fades to plain tan (295–296). The title types on 295.0–296.0 | "all over the state" (≈293.5) → pull-back done 295 | "North Carolina" gold serif + "2017 congressional districts" maroon | Cut |
| 44 | 303.4–309.3 | "Democrats were expected to turn out in droves" + news audio "blue wave" | FTG | CBS News (303.4–306), MSNBC (306–309.3) with original lower-thirds kept | — | — | — | Cut to paper |
| 45 | 309.3–312.5 | "so how did the maps do?" | MAP | 2017 map title hold | 312.0: the map **dissolves into the unit grid** (the title and silhouette fade while gold squares fade up, 0.5 s) | "how did the maps do" (≈310.5) | — | Morph |
| 46 | 312.5–321.0 | "for state representatives Democrats got 51 percent of the vote. They only won 46 percent of seats" | UNIT | VOTERS grid (5x20, y 120–330) top-centre. STATE REPRESENTATIVES grid (5x24, y 400–700) below. Percent labels to the right of each grid (x≈1520) | Gold "unassigned" squares recolour (orange L / grey→cyan R) 315.6→316.4. "51%" fades in at 316.4. Seat grid recolours at 318.2 and "46%" at 318.4 | "51 percent" (≈315.6) → colour 315.6 (≈0), number 316.4 (+800 ms). "46 percent" (≈317.8) → 318.4 (+600 ms) | "VOTERS" / "STATE REPRESENTATIVES": bold caps 24 px, tracking +0.3 em. **Percentages in cyan #009ED5 bold grotesque ~52 px, tracking +0.1 em**. Only the Democratic share is shown; no Republican number | Cross-fade + slide (whole layout slides left, 320.6–321.4) |
| 47 | 321–327 | "for state Senate they received half the vote and won just 42 percent of seats" | UNIT | Same layout, "STATE SENATE" with 50 seats (5x10, larger squares) | Same recolour; 50% at 324.0, 42% at 326.0 | "half" (≈322.7) → 323.6. "42 percent" (≈325.0) → 326.0 (+1 s) | Same | Same slide |
| 48 | 327–338 | "and for Congress you already know how that one turned out. Democrats won nearly half the votes but won only 3 out of 13 seats" | UNIT | "US REPRESENTATIVES" with 13 seats in one row | 48% at 331.8. Seats split 10 orange / 3 cyan with a gap at 333.0, "23%" at 333.4 | "nearly half" (≈330.0) → 331.8 (+1.8 s). "3 out of 13" (≈333.0) → 333.4 (+400 ms) | Same | Cut |
| 49 | 338–344 | "a year later in 2019 the Supreme Court weighed in. They said it was beyond their reach" | DOC | Rucho v. Common Cause syllabus page on paper. Cam pushes 3x into a paragraph (339.8–341.0) | An **orange highlighter underline** (#E88730, ~6 px, ragged ends) draws under "beyond the reach" L→R in 0.5 s | "beyond their reach" (≈339.5–340) → 341.2 (+~1.2 s, waits for the push) | Document typeface: Century Schoolbook (court print), ~70 px at zoom | Cross-dissolve to the triptych |
| 50 | 344–350 | "all of this raised an existential question: if Republicans could continue drawing the lines…" | UNIT | Cam pulled way back: **3 charts side by side** (state reps / state senate / US reps), slow pan L→R | Pan ~250 px over 5 s, linear | — | Mini headers only | Cam push |
| 51 | 350–357 | "how could they ever be elected out of office?" | UNIT | Extreme push into red seat squares (squares ~80 px). The camera **tracks right** along a row of red squares, which thin out to a single row | Continuous pan ~6 s | — | No text | Cross-dissolve |
| 52 | 357–365 | "but the Supreme Court's ruling left open the possibility for state courts to rule on partisan gerrymandering" | DOC | Rucho opinion page. Cam pushes in to fill-frame text (360) | **Yellow highlighter box** #F9F400 behind "state courts" sweeps L→R in ~0.3 s | "state courts" (≈358.5) → 360.6 (+~2 s, after the push) | Court print serif | A new document sheet slides in from the top-right, tilted (364.2–365.0) |
| 53 | 365–372.5 | "and in September 2019 that's exactly what the North Carolina Supreme Court did… partisan gerrymandering violated the state constitution" | DOC | Common Cause v. Lewis judgment caption page | **Orange-red pen loop** (#E04C00, ~5 px) circles "STATE OF NORTH CAROLINA / WAKE COUNTY" (366.0–366.6). Cam pans down the page; a yellow highlight on "VIOLATE THE NORTH CAROLINA CONSTITUTION" (368.6) | "North Carolina" (≈364.5) → circle 366.0 (+1.5 s). "violated the state constitution" (≈370.0) → highlight 368.6 (lead ~−1.4 s, because the page scroll lands there first) | — | Cut |
| 54 | 372.5–382.3 | "in the court's decision it was Hofeller's files that helped prove…" | DOC collage | Spreadsheet "Dr. Hofeller's Draft Plan File", GIS screenshots (green/red maps), tilted on paper | **Rapid file sequence**: cuts every 1.2–1.9 s (372.5, 373.3, 374.8, 377.1, 378.6, 380.6, 381.9), each with a slight slide/rotate | "Hofeller's files" (≈372.5) → 372.5 (≈0) | — | Cut |
| 55 | 382.3–386.5 | "…North Carolina Republicans had to redraw the Statehouse and state Senate maps one more time" | DOC | Judgment page, section VIII | Yellow highlight on "REDRAWING" (383.0) | "redraw" (≈381.5) → 383.0 (+1.5 s) | — | Cross-dissolve |
| 56 | 386.5–401.0 | "this new map approved by NC legislators is much less biased… in the last few years the courts in several states like Florida and Pennsylvania…" | MAP | Title centred top. 2019 senate map full width | New district outlines draw (387–390). Long hold with slow drift (14 s, the longest static MAP beat) | "this new map" (≈385.5) → 387.0 | "North Carolina" gold serif + "STATE SENATE 2019" gold caps (tracking +0.3 em) | Cut to graphite |
| 57 | 401.0–408.0 | "like Florida and Pennsylvania have made partisan gerrymandering much harder" | DOC | Headline cards on **graphite #252525** (no paper). Text block left-aligned at x≈250 (13 % of width), y 470–720 (vertical centre band) | Two headlines in sequence: Sun Sentinel (401–404.5), NYT (405–408) | "Florida" (≈400.5) → 401.0. "Pennsylvania" (≈402.5) → 405.0 (+2.5 s; the headline is held) | Masthead + headline in **white Libre Franklin 800 ~54 px with the key phrase in yellow #F9F400** ("ordered to redraw", "South Florida congressional districts") + date/byline 18 px caps | Cut |
| 58 | 408–432 | "and now that's also the case in North Carolina. Hofeller is gone now but in other states across the country many maps he helped draw are still in use…" | FTG | 7 archive photos/clips of mapmakers with maps (408.0, 410.8, 414.5, 417.4, 421.6, 424.7, 427.6) | Ken-Burns 3–5 % push/pan per shot. Shots 2.9–4.4 s | — | — | Cut |
| 59 | 432–442.3 | (Hofeller audio) "redistricting is like an election in reverse. It's a great event" | FTG | C-SPAN 4:3 pillar-boxed with the original lower third "TOM HOFELLER / Republican National Committee…". Punch-in zoom 434.0–437.0 (soft upscale) | — | — | Original broadcast lower third | Cut to black |
| 60 | 442.3–451.9 | [music] | Credits | Black. Right-aligned credit column at x≈260–300 (of 1920), with a thin yellow vertical rule with dot terminals | Static, then a page change at 446.8 | — | Role in small italic serif grey, name in bold caps white | End |

---

## 2. STATISTICS

Counting choices:
- **Hard cuts** come from the cuts.txt detector with slow-zoom false positives removed (the 205–207, 215–217, 372–382 bursts collapsed). That leaves ≈ **44 true cuts/paper swaps in 442 s**, so the **average shot is ≈ 10.0 s**.
- **Beats** (a new element, recolour or camera move inside a shot) are much denser: **≈ 150 beats, one every ≈ 2.9 s**. In the animated passages (UNIT/MAP) it is **one change every 2.0–2.5 s**. No visual state holds still longer than ~4 s except shot 56, a 14 s map hold with drift.

Screen time by type (0–442 s):

| Type | Seconds | % | Notes |
|---|---|---|---|
| MAP (choropleth/outline on paper) | ≈ 174 | **39 %** | 13 beats. Most use a 2-level camera: full-state, then a push to a city |
| UNIT (waffle squares) | ≈ 130 | **29 %** | 3 long sequences: intro, pack/crack, results |
| FTG (archival footage, news, photos) | ≈ 80 | **18 %** | Always hard-cut, mostly 3–11 s, used as "breath" between animated arguments |
| DOC (headlines, court docs, file collages) | ≈ 55 | **12 %** | Every doc beat has exactly one annotation (circle, highlight or underline) |
| Kinetic text alone | ≈ 3 (overlay) | <1 % | Text is *never* a standalone slide; it always sits over a map or grid |
| Credits | 9.6 | — | |

Text density:
- **Words on screen at once:** median **3–4 words** (one caps header, or a gold title plus subtitle). The p90 is ~12 words (stacked labels in shot 46). The max is the document zoom-ins, where the text is texture rather than "read" text.
- **Simultaneous labels:** never more than **4 typographic elements** (title, subtitle, plus 2 data labels). The highest is shot 46 (VOTERS, STATE REPRESENTATIVES, 51 %, 46 %).
- **Numbers shown:** only **7 numbers in the whole video** (51 %, 46 %, 50 %, 42 %, 48 %, 23 %, plus the years 2010–2017). They are integers with a % sign and no decimals. Counts ("13 seats", "3 of 13") are never shown as digits; they are shown as **squares**.

Element counts:
- **Max simultaneous visual groups:** 5 (13 district tiles count as one group "districts"; then the seat row, labels, title). Individual squares reach ~240 (shot 46), but they read as 2–4 blocks.

Camera:
- **Camera moving vs static** in the animated (non-FTG) time: ~**75 % of seconds have some camera motion**.
  - ~45 % is slow drift (1–5 % scale per 10 s, linear).
  - ~30 % is deliberate moves: ≈ **28 discrete push/pull/pans**, each **0.8–1.5 s, ease-in-out**. Two "fast zooms" (205.5, 215.5) are ~1.4 s with motion blur.
- Truly locked frames are mostly the unit-chart holds while squares are recolouring.

Annotations:
- Hand annotations appear in **13 beats**: 5 red circles, 2 graphite/black ellipses, 3 orange/teal pen strokes, 1 orange underline, 3 yellow highlighter boxes, 1 stamp.

Transitions:
- ≈ 30 hard cuts (all into or out of FTG/DOC)
- 4 paper-sheet swaps (rotated slide)
- 6 cross-dissolves/dips (0.5–1 s, used between map layers)
- 2 camera pull-backs that reveal the graphite desk
- 1 morph (map → squares)
- No wipes, no 3-D flips and no "slide deck" fades between bullets.

---

## 3. DESIGN TOKENS

### Colour

All values are sampled from frames (ffmpeg crop + area-average). The "≈" values are composites over paper.

| Token | Hex | Where |
|---|---|---|
| `paper.base` | **#E5D7BF** | Mid-tone of the paper texture |
| `paper.light` | **#F4EAD6** | Highlights/centre (the paper is lit centre-bright with a vignette) |
| `paper.edge` | **#D7C8AE** | Corners/vignette (~10 % darker) |
| `desk.graphite` | **#3B3B3D** | Surround when the camera pulls back past the sheet |
| `card.ink` | **#252525** | Headline cards that are not on paper (shot 57) |
| `ink.text` | **#0D0700** | Caps headers (warm black, never pure #000) |
| `ink.maroon` | **#872102** | Subtitles, city labels, small map labels |
| `ink.brown` | **#963700** | Secondary city label |
| `gold.foil` | **#B4891D** (range #B18121–#C89A48) | Serif titles: "North Carolina", "Basics of gerrymandering". Has metallic grain |
| `unit.neutral` | **#C08211** centre → #5A2A0A edge | "Unassigned" squares (copper/gold gradient per square) |
| `dem.deep` | **#003BB1** | Navy squares / map blue (#0643B4) |
| `dem.light` | **#00ABD6** | Cyan squares. Dem squares form a **gradient navy→cyan across columns** |
| `dem.label` | **#009ED5** | Percentage numbers |
| `rep.deep` | **#E61B03** | Red squares / map red (#F72454 on the US map, #F1484A on state fills) |
| `rep.light` | **#F07D41** | Orange squares. Rep squares form a **gradient red→orange across columns** |
| `district.tile.dem` | **#DAD5DA** | Lavender-grey wash behind packed districts |
| `district.tile.rep` | **#F3C488** / salmon | Washes behind cracked districts |
| `highlight.focus` | **#E79D80** fill / **#D64207** label | District 12 |
| `map.neutral` | **#BEAF8E** | Non-highlighted states |
| `choro.teal` → `choro.navy` → `choro.purple` | ≈#2BB39A → #1B2F8F → **#59007D** | Black-population map (watercolour) |
| `choro.precinct` | ≈ #1E8C93 teal | Democratic-precinct map |
| `annot.red` | ≈ **#E03C32 @ 60 %** (≈#AA4E3A over paper) | Circles around places |
| `annot.pen.graphite` | **#776A5E** | Loose ellipse around NC |
| `annot.pen.black` | **#110705** | "Wasted" ellipse, district lines |
| `annot.pen.orange` | **#D66C15** / **#E04C00** | Arc swipes, doc circling |
| `annot.underline` | **#E88730** | Highlighter underline |
| `highlight.yellow` | **#F9F400** | Caption bars, doc highlights, keyword colour in subtitles/headlines |
| `stamp.red` | **#F30001** | "Unconstitutional" |
| `stamp.body` | **#271918** | Stamp prop |

Two colour rules:
- Blue/red are **never flat**: each square carries its own paper-grain texture and a hue drift along the row.
- Saturation goes **up** at the moment of meaning. Squares go muted to deep when districts form, and maps go tan to colour on the spoken party name.

### Typography

Vox's in-house faces are not public. The closest Google Fonts are:

| Role | Observed | Closest Google Font | Size @1080 | Tracking |
|---|---|---|---|---|
| Caps label/header ("NORTH CAROLINA VOTERS", "PACK", "GREENSBORO") | Heavy grotesque, all caps, wide tracking | **Libre Franklin 800** (alt: Archivo 800) | 24–48 px | **+0.25 to +0.30 em** |
| Kinetic caption / headline text | Heavy Franklin Gothic-style | **Libre Franklin 800** | 54–64 px | 0 |
| Map title ("North Carolina", "Basics of gerrymandering", "Republican-controlled…") | Bold high-contrast italic serif, Didone/Clarendon-ish, gold foil | **Playfair Display 900 Italic** (alt: Abril Fatface + faux italic) | 48–64 px | +0.02 em |
| Big emphatic word ("Gerrymandered", "Unconstitutional") | Same serif italic, very heavy | **Playfair Display 900 Italic** | 60–190 px | 0, set at −4° |
| Map sub-label ("2011 congressional districts", city names) | Medium grotesque, sentence case | **Libre Franklin 500** | 26–40 px | 0 |
| Percent figure | Bold grotesque, tracked | **Libre Franklin 700** | ~52 px | +0.10 em |
| Document body | Century Schoolbook (court print) | **Old Standard TT** / **Libre Caslon Text** | — | — |

### Strokes

Values are at 1080p.

| Stroke | Width | Character |
|---|---|---|
| District outlines (full state) | 2–3 px | Warm black #2A1E14 |
| District outlines (zoomed) | 5–8 px | Grows with camera zoom, i.e. drawn in world space |
| "Crack" line | ~10 px | Ink-textured |
| Gold outlines | 2 px | |
| Red place circles | ~4 px | 60 % opacity, imperfect circles, rotated start point |
| Pen ellipses | 3–5 px | Pressure-varying, overshoot past the start point by 10–20° |
| Highlighter underline | ~6 px | Ragged ends |
| Highlighter box | Full x-height + 15 % | Flat #F9F400 |

### Textures

1. **Paper grain + stains.** Every frame has paper grain, faint water stains, creases and a centre-bright vignette. The texture is slightly *boiling*: it shifts subtly over time, most visible in 0.0–0.6 s.
2. **Watercolour fills.** Every fill is watercolour: granulation, darker edge pooling, soft bleed. That covers map states, choropleth blobs, district tiles and squares.
3. **Torn edges.** NC silhouettes have torn-paper bottom edges (shots 24, 38), and the east-coast map is torn paper with white borders.
4. **Shadows.**
   - Shadows exist only on physical props (the stamp's soft contact shadow) and on paper sheets during swaps.
   - Labels and data never have drop shadows. The one exception is footage lower-thirds.
5. **Gold foil.** Gold titles carry a metallic noise texture.
6. **No halftone, no glow, no gradients-as-decoration, no rounded-corner cards, no glassmorphism.**

---

## 4. WIDGET CANDIDATES

All widgets share a **`WordClock`**: a sorted list of `{word, startMs, endMs}` from TTS/forced alignment. Every entrance prop is a **word anchor** `{word: string, occurrence?: number, offsetMs?: number}`, resolved to a frame at build time. Unresolved anchors **throw** (fail loud). The defaults below are the observed median lags.

Every widget also renders **inside** a shared `<PaperStage>` and never draws its own background.

### W1. `PaperStage` (world + camera)
- **Does:** owns the paper texture (base #E5D7BF + grain + vignette + slow boil), the graphite desk, and a **camera** with keyframed `{x, y, scale, rotate}` in *world* coordinates. Children are positioned in world space (a 1920x1080 sheet = world units). Sheet swaps are camera-independent.
- **Props:**
  ```ts
  { camera: Array<{ at: Anchor; x: number; y: number; scale: number; durMs?: number; ease?: 'inOut'|'out' }>;
    drift?: { scalePer10s: number };  // default 0.02
    sheet?: 'full'|'portrait' }
  ```
- **Motion:** discrete moves are 800–1500 ms, `easeInOutCubic`. Drift is linear. The pull-back reveals the desk at scale < ~0.85.
- **Reproduces:** shots 2, 4, 7, 12, 21–22, 25, 27–29, 35, 40–43, 49–51.

### W2. `SheetSwap` (transition)
- **Does:** the outgoing sheet slides off left with a −8° rotation, a short graphite gap shows, then the incoming sheet slides in from the right at −8…−12° and settles to 0°.
- **Props:** `{ at: Anchor; variant: 'quick'|'long' }`. `quick` = 600 ms incoming only; `long` = 1400 ms out + gap + in.
- **Motion:** `easeOutQuart` for the settle. A soft 20 px shadow under the moving sheet only.
- **Reproduces:** shot 2→3, 12→13, 52→53.

### W3. `UnitGrid` (waffle / voters-and-seats)
- **Does:** an N×M grid of textured squares that can **recolour by party share**, **split into blocks**, **fly into clusters**, and **morph** from a map. It shows counts as squares, not digits.
- **Props:**
  ```ts
  { id: string; label: string; rows: number; cols: number; at: Anchor;
    states: Array<{ at: Anchor;
      split?: { dem: number; rep: number; other?: number };          // counts
      layout?: 'grid'|'blocks'|{ clusters: Array<{ dem: number; rep: number; tile: 'dem'|'rep' }> };
      showPct?: { party: 'dem'; value: number; at?: Anchor } }>;
    palette?: 'neutralGold' }
  ```
- **Motion:**
  - Recolour sweeps column-by-column over 600 ms.
  - Splits open a gap in 300 ms.
  - Cluster flights are 600–1000 ms per square with a random 0–2500 ms stagger, `easeInOutSine`, ±15° rotation.
  - The pct label fades in 300 ms, at +600…800 ms after the recolour.
- **Reproduces:** shots 3–8, 10–12, 19–22, 45–48, 50–51.

### W4. `ChoroplethMap` (watercolour geo layer)
- **Does:** renders GeoJSON features as watercolour fills on paper:
  - `reveal: 'bleed'` grows blotches
  - `'wipe'` reveals L→R
  - `'draw'` draws outlines as one continuous stroke
  - `'ghost'` takes everything except `focus` to 15 %
  It recolours features per state keyframe.
- **Props:**
  ```ts
  { geo: GeoJSON; projection: 'albersUsa'|'stateFit';
    layers: Array<{ at: Anchor; kind: 'fill'|'outline'; valueOf?: (f) => number;
                    scale?: 'party'|'teal'|'blackPop';
                    reveal: 'bleed'|'wipe'|'draw'|'fade'; durMs?: number }>;
    focus?: { featureId: string; at: Anchor; fill?: string; label?: string } }
  ```
- **Motion:** bleed 800–1200 ms. Draw takes 3000–3500 ms for a full state of districts (linear) and 1400 ms for one district. Wipe 1600 ms. The **outline draw should finish on the anchor word** ("this map"), so the start is computed as `anchor − durMs`.
- **Reproduces:** shots 1, 2, 13, 18, 24–30, 33, 38–43, 56.

### W5. `MapTitle` (gold serif title + maroon subtitle)
- **Does:** the one and only heading device on map beats. It is centred at the top. A new title replaces the old one; titles never stack.
- **Props:** `{ title: string; subtitle?: string; at: Anchor; variant: 'gold'|'black'; year?: { values: Array<{ at: Anchor; text: string }> } }`. `year` swaps the second line in place (shot 13).
- **Motion:** fade + 8 px rise, 400 ms. Year swaps are a hard swap or a 150 ms cross-fade (no counting).
- **Reproduces:** shots 13, 19, 24, 28, 43, 56.

### W6. `CapsLabel` (tracked caps header / data label)
- **Does:** the bold tracked caps label used for chart headers, city names and "PACK/CRACK". Placement is **collision-aware**: it auto-places outside its target's bbox and outside every other label's bbox. Supports a `typeOn` reveal and a **`swapWord`** with a black block slide-in (shot 39).
- **Props:** `{ text: string; at: Anchor; anchorTo?: ElementRef; side?: 'above'|'left'|'right'|'auto'; size: 24|30|36|44; color: 'ink'|'maroon'|'gold'|'white'; typeOn?: boolean; swap?: { at: Anchor; replaceWord: string; withText: string; style: 'blackBlock' } }`
- **Motion:** fade 300 ms, or type-on at ~25 ms/char. The swap block slides 600 ms `easeOutCubic` from x−300 px.
- **Reproduces:** shots 3–4, 12, 20–22, 26–27, 33, 35, 38–41, 46–48.

### W7. `PenAnnotation` (circle / ellipse / arc / underline / connector)
- **Does:** hand-drawn strokes as SVG paths with a jittered radius, an overshoot and pressure variation. They are drawn with `strokeDashoffset`.
- **Props:** `{ kind: 'circle'|'ellipse'|'arc'|'underline'|'connector'; target: ElementRef|BBox; at: Anchor; color: 'red60'|'graphite'|'black'|'orange'|'teal'; widthPx?: number; label?: { text: string; side: 'left'|'right' }; erase?: Anchor|{ afterMs: number } }`
- **Motion:**
  - Circle 350 ms; ellipse 600 ms; arc/connector 1000 ms; underline 500 ms.
  - All `easeOutQuad`, starting at about the 10 o'clock position and overshooting 15°.
  - The label fades 200 ms, simultaneous with the stroke.
  - Erase is a reverse dash, 400 ms.
- **Reproduces:** shots 2, 19, 21–22, 27, 29, 42, 49, 53.

### W8. `InkWord` (big kinetic serif word)
- **Does:** one emphatic word in a heavy italic serif, written on with a mask sweep (pen-nib feel), with ink/watercolour grain inside the glyphs. A `stamp` variant uses a 3-D stamp prop (drop, impact, lift) and leaves the red word, optionally on several targets in sequence.
- **Props:** `{ text: string; at: Anchor; mode: 'write'|'stamp'; rotateDeg?: number; color: 'ink'|'stampRed'; targets?: ElementRef[]; holdMs?: number }`
- **Motion:** `write`: starts **600 ms before** the word, 2100 ms L→R mask, hold 1000 ms, fade 300 ms. `stamp`: drop 400 ms `easeInQuad`, impact frame + 2 px shake, lift 400 ms. Each subsequent target is +800 ms.
- **Reproduces:** shots 9, 34.

### W9. `CaptionHighlight` (yellow-bar kinetic caption)
- **Does:** the cold-open caption. Text is chunked by phrase. Each chunk types in on its spoken word and a yellow #F9F400 bar wipes behind it 200–400 ms later. It allows max 2 lines, centred, set over the visual's middle third.
- **Props:** `{ chunks: Array<{ text: string; at: Anchor }>; maxLines: 2 }`
- **Motion:** bar wipe 200 ms linear. Exit as a group with the scene (fade 400 ms).
- **Reproduces:** shot 1 (and the subtitle style of 14 with `variant: 'subtitle'`, which is white text with keyword-yellow words).

### W10. `DocumentFocus` (paper document + zoom + highlight)
- **Does:** shows a re-typeset document or headline on paper, then **pushes the camera into one phrase** and marks it once (highlighter box, underline, or pen loop). It has a `collage` mode: tilted file thumbnails with punch-ins.
- **Props:** `{ kind: 'headline'|'courtPage'|'collage'; source: { masthead?: string; headline: string; byline?: string } | { imageUrl: string }[]; focus?: { phrase: string; at: Anchor; mark: 'highlight'|'underline'|'circle' }; bg?: 'paper'|'card' }`
- **Motion:** push 1000–1200 ms `easeInOut`, *then* the mark (the mark waits for the camera; observed lag +1.2…+2.0 s from the word). Collage punch-ins hold 1200 ms.
- **Reproduces:** shots 16–17, 49, 52–55, 57.

### W11. `FootageCut` (archival clip/photo with Ken Burns + quote subtitle)
- **Does:** hard-cuts to footage. Applies a 3–5 % push/pan per shot, an optional name lower-third (white bold, no box) and optional quote subtitles with keyword colouring.
- **Props:** `{ src: string; in: Anchor; out: Anchor; kenBurns?: { from: Rect; to: Rect }; name?: string; quote?: Array<{ text: string; at: Anchor; keywords?: string[] }> }`
- **Reproduces:** shots 14–15, 23, 31–32, 36–37, 44, 58–59.

### W12. `FrameOnDesk` (pull-back caption device)
- **Does:** pulls the camera back so the current sheet becomes a card on graphite and places one big white caps caption *above* it. This is the only sanctioned "section title". It is never a chip in a corner.
- **Props:** `{ at: Anchor; scale: number /*0.56*/; caption: string }`
- **Motion:** 800 ms `easeOutCubic`, caption +300 ms fade.
- **Reproduces:** shot 35 (and shot 4's variant without a caption).

---

## 5. RULES (observed hard constraints)

### Composition
1. **One world, one paper.** Every animated beat lives on the same cream paper, full-bleed. There are **never** boxed cards, panels, chips, rounded rectangles, glass or dark UI frames around content. A "frame" only appears by pulling the camera back to reveal the sheet on the desk.
2. **One idea per beat, one change per ~2–3 s.** A beat introduces exactly one new thing: a recolour, one label, one circle or one line. The previous beat's elements either persist because they are the same subject, or are cleared by a camera move or sheet swap. Elements **never accumulate** across subjects. There is no PowerPoint build-up of bullets.
3. **Max 4 typographic elements on screen** (title, subtitle, 2 data labels). The median is 3–4 words.
4. **Titles are part of the paper, not overlays.** A map gets a centred gold serif title + maroon subtitle *at the top of the sheet*. There is never a corner chip, act number, chapter tag or progress indicator (the Vox bug at top-right is the only persistent mark, at ~40 % opacity). **This directly forbids our "ACT III" chip.**
5. **Labels never overlap content.** City labels sit *beside* their circle. "District 12" sits in empty paper next to the shape. Headers sit above grids with ≥ 40 px clearance. Kinetic words sit on the grid only when the grid is a passive background, and only briefly (≤ 3.5 s).
6. **Layout stays on a centred axis with thirds for focal points.** Titles are centred at the top (y 50–150). Charts are centred. Focal cities are pushed to land on thirds (shot 27: WS ≈ x 700, C ≈ x 450).

### Timing
7. **Elements appear on their spoken word.** The median lag is **+200…+600 ms**.
   - Recolours/washes land at ±100 ms of the party name.
   - Labels land at +200 ms.
   - Numbers land at +600…800 ms after their colour change.
   - Emphatic words *lead* by 400–600 ms.
   - Outline draws are scheduled to *finish* on the word ("this map").
   - When a camera move is needed first, the annotation waits for the camera (+1.2…2 s), but the camera move itself starts on the word.
8. **Footage is breath, ~1 clip per 30–40 s, 3–11 s long, always a hard cut.** Animated arguments resume on paper after it.

### Data
9. **Quantities are shown as things, not digits.** Voters and seats are squares. Only final percentages appear as numbers: integers, a "%" sign, one party (Dem), coloured cyan. Never decimals, never "0.0M", never counters that roll from zero. Years swap; they don't count.
10. **Maps are geographically real and full-bleed.** They use real boundaries (states, districts, precincts), a proper projection, watercolour fills, torn-paper edges, and fill 80–98 % of the frame width. They are never small polygons in a box. Camera pushes go from state → city (2.5–4x) instead of insetting.
11. **Colour carries meaning, and saturation rises on meaning.** The neutral state is gold/tan. Blue = Dem, red = Rep, as two-tone gradients per group. Yellow is reserved for highlighting. Red pen is reserved for "look here".

### Style
12. **Annotations are hand-made.** Imperfect circles that overshoot, pressure-varying pen strokes, highlighter boxes with flat yellow. They are drawn on (350–1000 ms), never popped. At most one annotation type is active per beat.
13. **Motion vocabulary is small.** It consists of camera push/pull/pan (0.8–1.5 s ease-in-out), slow drift (always on), stroke draw, watercolour bleed, square fly, sheet swap and stamp. **No bounces, no spring overshoot on UI, no scale-pop entrances, no 3-D flips.** The only physical bounce is the stamp impact.
14. **Type system is exactly three voices:**
    - Tracked heavy-grotesque caps for structure
    - Heavy italic serif (gold or ink) for titles and emphatic words
    - Medium grotesque for small labels

    Document text keeps its original typeface.
15. **Transitions are physical.** Hard cuts go to and from footage. Sheet swaps change subject on paper. Camera moves change scale. Cross-dissolves are only between layers of the *same* map.

---

### Notes for the harness (derived from this trace)

- These are the direct failure → rule mappings:

  | Our current failure | Fixed by rules |
  |---|---|
  | Drift out of sync | 7 |
  | PowerPoint accumulation | 2 |
  | Label overlap / "ACT III" chip | 4, 5 |
  | Crude polygons in dark box | 1, 10 |
  | "0.0M km²" | 9 |

- The harness should therefore plan a **beat list** (one row per ~2–3 s, each row = `{anchorWord, widget, props}`) instead of free-form TSX, and compile it with the W1–W12 widgets above.
- Treat `PaperStage` + camera keyframes as the scene graph root so that "zoom to city" is a camera move rather than a new slide.

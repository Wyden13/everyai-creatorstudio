# Trace: Vox "The chart that predicts recessions" (xiiHjrewXNI), one-to-one

Source: https://www.youtube.com/watch?v=xiiHjrewXNI (232.4 s file; content ends at 223.0 s, then black credits). Traced from the 2 fps dense frames, 10 fps strips around every big transition, full-res 1280x720 stills, and a per-0.5 s frame-difference signal (ffmpeg `tblend=difference` + `signalstats` YAVG).
Working files: `/tmp/claude-1000/-home-xuckl-Dev-everyai-creatorstudio/f200848f-f148-46dd-8a1b-42a949994497/scratchpad/trace/xiiHjrewXNI/` (m_*.jpg are 1 fps sheets, d_*.jpg are 2 fps sheets labelled in deciseconds, tr_*/trans_*.jpg are 10 fps transition strips, full_*.jpg are stills, and diff.txt holds the motion data).

Coordinates are on a **1920x1080** grid (720p values x1.5). Word timings come from auto-caption *line* starts, so each one has an error of about ±0.4 s. "Lag" means visual onset minus the estimated spoken-word onset.

**The key finding:** the shot detector found only one cut because this video has almost **no cuts**. It is a **"one-take infinite canvas"**: a single world (a horizontal timeline of monthly chart panels, and later a single ground-line stage) that a virtual camera pans and zooms across. Scene changes are camera moves (pan, zoom, whip-pan) or morphs of one object into the next. There are only 7 true image replacements in 223 s.

---

## 1. SHOT / BEAT TABLE

Abbreviations: CAM = camera, ease-io = ease-in-out, ↑ = slide-up entrance.

| # | Time (s) | Narration | Type | Layout (1920x1080) | Elements and motion | Word trigger (lag) | On-screen text | Out-transition |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.0–3.4 | "In 1980, the US economy went into a recession" | kinetic text over data strip | Text block left-aligned at x≈430–1480, y≈300–480 (upper-middle). **Month-tile ribbon** at y≈775–860 across the full width, with year label "1980" (grey bold ~70px) under it at y≈880–945 | CAM pans R→L along the ribbon at ~60 px/s. Text builds in 4 groups, each a 250–300 ms ↑12px + fade: "In 1980," 0.5 / "the US economy" 1.5 / "went into a" 2.5 / "recession." 3.0, which gets a maroon box #854552 behind the word (wipe-in ~150 ms). Six Jan–Jun 1980 tiles are maroon #834650, all others #39393B | Each group lands on its first word, +0–200 ms | White bold sans, ~78px, 2 lines, ≤5 words per line | Text fades 200 ms while a TV drops in from the top (300 ms ease-out) |
| 2 | 3.5–5.0 | "[Carter] … production dropped 37½ %" | archival in TV frame | Retro TV bezel centred at x≈545–1495, y≈90–705 (upper two-thirds). Ribbon still visible under it | Static CAM. Footage plays inside the screen. Knobs and speaker grille are flat vector | TV lands 0.5 s before the clip audio | none (burnt-in CBS clock only) | Hard swap of footage *inside* the same TV |
| 3 | 5.0–8.0 | "Wall Street reacted very badly" | archival in TV | same | same (CBS/Cronkite clip) | — | — | swap inside TV |
| 4 | 8.0–10.2 | "…but that" | archival in TV | same | Third clip (local anchor) | — | — | TV slides down off the bottom (300 ms ease-in) |
| 5 | 10.2–12.4 | "recession actually could've been predicted" | kinetic text plus zoom-out | Text top-centre at y≈230–350. The ribbon is now at vertical centre (y≈530) | CAM zooms out about 1.0→0.55 over 1.5 s (ease-out). Line 1 fades in at 10.5. **"predicted" appears as a separate bigger, bolder 2nd line** (~1.4x size) at 11.5 | "predicted" −300 ms (slight lead) | "But that recession actually could've been / **predicted**" | — |
| 6 | 12.4–16.0 | "if you were looking at a very specific type of line" | hold | same | Fully static (diff 0.03) for 3.5 s | — | same | Text fades 500 ms |
| 7 | 15.5–17.5 | "…type of line. You see, normally" | data morph | ribbon | Each month tile reveals a tiny line chart inside it (lines fade in, ~0.5 s) | "line" ≈0 | — | CAM move |
| 8 | 17.5–19.5 | "this line points slightly upward" | CAM pan/zoom | Ghost giant year "1978" (grey #8B8A8D, ~150px) passes along the bottom-left | CAM zooms in about 3x and pans **left (back in time)** over 2 s (ease-io). Panels grow to roughly 600 px wide | — | ghost year | — |
| 9 | 19.5–21.5 | "like here in September 1977" | focused small-multiple + annotation | Focus panel centred at x≈625–1220, y≈250–815, with "September '77" grey label above (y≈190). Neighbours are dimmed to about 30 % opacity | Yellow all-caps **"CURVE UPWARD"** (#FFFF2B, ~42px, tracking +0.08em, rotated −4° to follow the slope) plus a hand-ish arrow drawn L→R in ~400 ms | "upward" +~500 ms, "September 1977" ≈0 | "CURVE UPWARD →", axis "2-year … 10-year" grey | Annotation fades. CAM pulls back |
| 10 | 21.5–27.5 | "but about a year later it started pointing the other way, just slightly" | CAM truck through time | About 6 panels visible, centred row at y≈350–430 | CAM pans R at ~1 panel per 0.5 s (constant speed). Lines flatten. At ≈25.5 the inverted panels' lines **flip colour cream #EFEFE3 → crimson #ED1154** (instant, per panel) | "other way" ≈0 | month labels (tiny) | Zoom-out |
| 11 | 27.5–33.0 | "and then not long after that … boom, the 1980 recession" | strip overview plus annotation | Ribbon at y≈540, years under it. Inverted months are crimson lines, recession months maroon tiles | CAM zooms out to ~0.35x in 0.5 s. A **yellow dotted arc** (#F5FF00, ~5px dots) draws from the first inverted month to the recession start, 28.5→29.5 (1.0 s ease-out). A **yellow ring** (r≈45 px, stroke 5 px) pops (scale 0.6→1, ~150 ms) on Jan 1980 | ring lands on "boom" ≈+0–300 ms | — | Pan |
| 12 | 33.0–35.0 | "it happened again; a few months later the line curved downward" | pan | same | CAM pans right about one screen in 1.5 s (ease-io) to 1981–82 | — | "1981", "1982" | — |
| 13 | 35.0–39.5 | "then boom, another recession" | arc plus ring | same | Arc 37.0–38.0, ring 38.0 | ring on "boom" ≈0 | — | pan |
| 14 | 39.5–44.0 | "it happened again in 1988" | pan plus arc | 1989/1990 | Pan 1 s, arc 42.0–43.0, ring 43.0 | pan lands on "1988" | — | pan |
| 15 | 44.0–46.5 | "again in 2000" | pan plus arc | 2000/2001 | Pan, arc, ring 46.0 | ≈0 | — | pan |
| 16 | 46.5–49.0 | "and again in the mid 2000s" | pan plus arc | 2006/07/08 | Arc 47–48.5, ring 48.5 | ≈0 | — | Fast zoom-in |
| 17 | 49.0–51.4 | "this line is called the yield curve" | small multiples plus title | Title top-centre y≈200–300 (~125px bold). Panels row y≈490–910, each ~400 px wide with an 80 px gutter | CAM zooms in about 4x in 0.6 s (ease-out, diff 5.3). Title ↑ fades in at 49.0. A **dashed yellow ellipse** (#E5FD67, dash ~30/20 px, stroke 5 px) draws around June '06 at 50.0 (~400 ms) | "yield curve" ≈0 | "Yield curve" | Text swap |
| 18 | 51.5–54.4 | "and it's predicted every recession in the past half century" | caption | Same layout, smaller 2-line headline (~60px) top-centre | Line 1 at 51.5, line 2 at 53.0 (↑ fade 250 ms). The ellipse stays | per line ≈0 | "It's predicted every recession / in the past half-century." | Text fades (54.4). Whip-pan |
| 19 | 54.5–58.5 | "and that's why some experts freaked out when this happened" | fast-forward pan | Panels row y≈330–480. Ghost year "2019" bottom-left (~150px grey) | **Whip-pan** to the right (diff 14 → 2 over 4 s, strong ease-out deceleration). The 2008 recession panels flash by with a maroon fill. About 11 years pass in 4 s. Ends on the **August '19 panel: crimson line plus a red outer glow frame** | lands on "this happened" | ghost "2019" | — |
| 20 | 57–60 | news soundbites: "a recession warning… inverted yield curve…" ×3 | **audio only** | — | No archival shown. The camera keeps decelerating onto Aug '19 | — | — | — |
| 21 | 60.0–66.5 | "so what the hell is this line" | slow push-in | Aug '19 panel moves to the centre | CAM pushes in 1x→~3.5x over 6 s (ease-in). Neighbours and labels fade. In the end only the glowing red frame is left, then it fades | — | — | Fade to ident |
| 22 | 66.5–69.5 | (music) | **brand ident** | Vox wordmark centred, ~250 px wide. The corner bug is hidden | Fade in 200 ms, hold 2.5 s, fade to grey 300 ms | — | "Vox" | Bond slides in |
| 23 | 69.5–72.4 | "it all starts with the US Treasury bond" | object hero | "$100 BOND" ticket centred, ~430 px wide, y≈580–700 | Slides in from the left in ~300 ms (ease-out) with about 2° rotation settle | "bond" ≈0 | "$100 BOND" (tan, embossed) | Zoom-out reveal |
| 24 | 72.4–74.0 | "a bond is basically an agreement saying if you lend the federal government" | character stage | **Ground line** (white, 12 px) at y≈950 full-bleed. Investor at x≈600–800, Uncle Sam at x≈1180–1420 | CAM zooms out ~2.5x→1x in 0.8 s (ease-out). Characters fade from ~40 % to 100 %. The bond shrinks into the investor's hand | "government" ≈0 | — | — |
| 25 | 74.0–76.5 | "say $100, they'll pay you interest" | prop exchange | same | A green "$100" bill pops in the hand (150 ms) at 74.5. Bill and bond swap hands at 76 | "$100" +~200 ms | "$100" bill | CAM pull-back |
| 26 | 76.5–79.0 | "while they hold onto your money until the date they agreed" | stage plus time axis | Axis labels under the ground: "Now / 2 years later / 5 years later / 10 years later" at x≈180, 555, 975, 1395 (grey #7D7C7F, ~45px, 2 lines) | CAM pulls back to ~0.5x while trucking right for 2.5 s (ease-io). Uncle Sam slides to "10 years later" | "until the date" ≈0 | axis labels | — |
| 27 | 79.0–83.0 | "to pay you back" | prop exchange | same | The bill comes back plus a gold coin (pop at 80.5) | "pay you back" ≈0 | — | Morph |
| 28 | 83.0–86.0 | "and the longer you let the government keep your money, the higher the interest rate" | **stacked-bill bar chart** | Columns at x≈625 / 1105 / 1610, bottom on the ground line y≈860. Labels "2-year / 5-year / 10-year bond" below | Characters vanish. Bills stack one at a time (~120 ms per bill, slight overshoot): 4/6/7 bills. Percent labels "3% / 4% / 5%" (grey #878789, ~70px) ↑ at 85.0/85.5/86.0 | "higher" ≈0 | "3% 4% 5%" | — |
| 29 | 86.0–89.3 | "so you get more money" | hold | same | static (diff 0.02) | — | — | Whip-pan |
| 30 | 89.3–90.5 | "next, you need to understand that most people" | whip-pan | — | The world slides R→L about one screen in 0.8 s (diff 27). Back on the character stage | "next" ≈0 | — | — |
| 31 | 90.5–94.0 | "don't buy bonds from the government, they buy and sell them from each other" | stage | same | Uncle Sam exits (fade/slide, 93) | "each other" ≈0 | — | — |
| 32 | 94.0–101.0 | "in the secondary market, and the prices change based on how much demand there is" | stage plus speech | New buyer enters from the left (0.5 s). Speech text sits above the head | **Italic speech label** "I'll pay $90." (white bold italic ~48px) pops at 98.0 (scale 0.9→1, 150 ms) | "prices" ≈0 | "I'll pay $90." | CAM trucks left |
| 33 | 101.0–106.0 | (cont.) "demand…" | stage, crowd | 4 characters across x≈290–1590 | CAM trucks left 0.5 s. "$100!" at 102.0, "$110!" at 103.5, each next to a new bidder | ≈0 | "$110!" "$100!" "I'll pay $90." | Pan |
| 34 | 106.0–107.5 | "this basically means that the amount of profit" | crossing pan | — | Bars world slides in from the left while the crowd exits right (1 s, diff 30) | — | — | — |
| 35 | 107.5–112.0 | "you can make on each bond changes every day" | bars jitter | bars layout (#28) without % | Each stack changes ±1 bill every ~0.5 s (a "live market" wobble) | "changes" ≈0 | — | — |
| 36 | 112.0–117.5 | "still the basic rule holds: if you let the government keep your money for longer, you'll yield more money" | **single-line caption sequence** | One line, top-centre y≈120 (~40–45px) | Each phrase **replaces** the previous one (crossfade 150 ms, ↑8px): 112.0 / 113.0 / 114.0 / 115.5. There is never more than 1 caption line. A yellow highlight bar flashes next to the 10-year stack at 114.5 | each ≈0 | "The basic rule holds." → "If you let the government" → "keep your money for longer…" → "you'll yield more money." | Caption fades |
| 37 | 117.5–119.5 | "trace these bars on any given day" | trace line | Through the stack tops | **White dashed line** (dash ~28/16 px, stroke 8 px) draws L→R over 2.0 s (linear) | "trace" ≈0 | — | — |
| 38 | 119.5–123.5 | "and you get a curved line showing the yields of different bonds" | hold | — | static (diff 0.02) | — | — | — |
| 39 | 123.5–128.0 | "or what people call the yield curve, and normally it points upward" | label on path | The label rides the line, rotated −12°, above the 5-year stack | Italic bold white "The yield curve" fades in at 123.5 (300 ms). A thin white arrow "⟶" appears at 126.0 | "yield curve" ≈0, arrow on "upward" ≈0 | "The yield curve ⟶" | **Hard cut** |
| 40 | 128.0–131.5 | "now here's where things get more complicated. Let's say you're an investor" | character close-up | Empty stage: ground at y≈950, "Now" label. CAM is about 2.2x | The character **flips in** (scaleX 0→1, 300 ms) at 129.5 | "investor" ≈0 | "Now" | Zoom-out |
| 41 | 131.5–133.5 | "and you have a hunch" | thought beam | Translucent grey cone (#6b6b60 at ~40 %) from the head to the upper right | CAM zooms out to 1x (1 s, ease-io). The beam wipes out from the head (300 ms). The "2 years later" label appears | "hunch" ≈0 | "Now", "2 years later" | — |
| 42 | 133.5–136.5 | "that an economic downturn is coming in the near future" | omen | Pixel cloud (~380×120 px) at the beam's end, upper middle | Cloud drops in from the top (300 ms) | "downturn" ≈0 | — | — |
| 43 | 136.5–139.0 | "if your hunch is correct, if you buy a two-year bond" | exchange | — | The beam goes. A seller appears and the bond/bill swap happens (137) | "buy" ≈0 | — | — |
| 44 | 139.0–143.5 | "you might get your money back in a bad economy" | rain | Rain under the cloud: teal #33717C dashed vertical lines, about 8 columns | The investor moves to "2 years later" (pan 0.5 s). Rain starts at 140 (dashes scroll down) | "bad economy" ≈0 | — | — |
| 45 | 143.5–146.0 | "and there might not be anything good to reinvest in" | — | — | The investor offers $100 and nobody takes it | — | — | — |
| 46 | 146.0–150.0 | "that makes a two-year bond a lot less attractive to you" | — | — | The investor flips (scaleX) and walks off. The seller stays with the bond | — | — | — |
| 47 | 150.0–156.3 | "and if lots of other people think this way, the demand for 2-year bonds will drop, so they start selling for cheaper" | speech | Speech above the seller | "Anyone?" 150.5 → "Now $90!" 153.0 → "$80?" 155.0 (each replaces the last) | "cheaper" ≈0 | italic speech | Morph |
| 48 | 156.3–157.5 | "but because the 2-year bond now costs less" | **morph** | — | The cloud desaturates and fades. The seller cross-dissolves **into a bill stack** (0.5 s) at the same x | — | — | — |
| 49 | 157.5–162.5 | "it yields a better return relative to that low cost" | bar grows | Stack at "2 years later" | The stack grows 4→6 bills at 159.5 (per-bill pops) | "better return" ≈0 | — | Pan right |
| 50 | 162.5–164.0 | "and at the same time investors who think a downturn is coming might think" | pan reveal | "10 years later" label at x≈1395 | CAM pans right (1 s, diff 13). Reveals a seller with a 10-year bond | — | — | — |
| 51 | 164.0–178.0 | "I'd rather invest in a 10-year bond … so that bond gets more popular, but it also gets more expensive" | crowd plus speech | 1→4 buyers crowd the seller | Buyers enter one by one (164, 172, 173). A thought-cloud flickers at 170–172. "I'll pay $110!" 175.5, "$120!" 176.5 | "popular" / "expensive" ≈0 | speech | Morph |
| 52 | 178.0–179.5 | "so investors start yielding less money" | morph plus shrink | — | The crowd morphs into a tall stack (8 bills) that **shrinks** to 5 (179) | "less" ≈0 | — | — |
| 53 | 179.5–184.5 | "and if enough investors are acting on this expectation, the yield on a long-term bond, which is almost always higher…, can actually dip lower" | **hold** | Two stacks, equal height | **5 s fully static** (diff 0.02) while narration continues | — | — | — |
| 54 | 184.5–187.5 | "and if you draw that yield curve" | trace line | Top of stack A to top of stack B | A solid white line (10 px) draws L→R over 1.5 s | "draw" ≈0 | — | — |
| 55 | 188.0–189.5 | "you can see that it goes in the other direction, it inverts" | inversion | — | The 10-year stack drops a bill. The line tilts down and recolours white→pink→crimson #DE0043 over 500 ms | "inverts" ≈0 | — | — |
| 56 | 190.0–196.0 | "in other words" | label on path | Label above the line, rotated −3° | All-caps **"YIELD CURVE"** (heavy, ~55px, white) at 190.0. Arrow at 191.5 | ≈0 | "YIELD CURVE ⟶" | Abstraction |
| 57 | 196.5–198.5 | "when this chart looks like this" | **abstraction morph** | A panel square fades in behind the line (#39393B) | Stacks and label fade (0.5 s). The scene becomes the small-multiple panel grammar from Act 1 | "this chart" ≈0 | — | — |
| 58 | 198.5–203.4 | "it means investors think an economic downturn is probably coming in the near future" | omen over chart | Cloud and rain over the left half of the panel | Cloud drops (300 ms) and rain starts | "downturn" ≈0 | — | **Hard cut** |
| 59 | 203.5–205.5 | "and that's what's happening now" | small multiples | July '19 (cream) partial at the left. Aug '19 at x≈330–1050, y≈180–865 | static | "now" ≈0 | "August '19", "2-year / 10-year" | — |
| 60 | 205.5–208.5 | "so is a recession coming?" | callout | Right of the panel at x≈1125–1790, y≈505 | Muted crimson #87535B all-caps tracked "RECESSION?" plus a long arrow, **wipe reveal L→R** ~600 ms | "recession" ≈0 | "RECESSION? ⟶" | Fade on "not necessarily" |
| 61 | 208.5–211.5 | "not necessarily, but when we" | reframe | — | Slight CAM truck (0.5 s) | — | — | Zoom-out |
| 62 | 212.0–216.5 | "redesigned the chart so we can see all the years on a single screen" | **year grid overview** | Column at x≈640–935: 43 rows (1977–2019) × 12 mini-curves, year labels at the left in grey 22px | CAM zooms out ~4x→1x over 4.5 s (strong ease-out). Recession cells are maroon-tinted | "single screen" ≈0 | year numbers | — |
| 63 | 215.5–219.0 | "it's pretty safe to say when the yield curve inverts" | leader labels | Labels at x≈1050–1220. Leader lines run from the row ends | 13 labels draw in a staggered sequence (~150–250 ms apart). Leader line first, then the word fades in. "Inversion" is pink-crimson, "Recession" is pale pink | "inverts" ≈0 | "Inversion"/"Recession" ×13 | — |
| 64 | 219.0–223.0 | "it's not a good sign" + music | hold | — | static | — | — | Hard cut to black credits |

---

## 2. STATISTICS

- **True image replacements (hard cuts / swaps): 7** (at 5.0 and 8.0 inside the TV, 66.5 ident, 69.5, 128.0, 203.5, 223.0). The mean interval between hard cuts is **≈32 s**. Everything else is camera motion or morphs.
- **Beats** (a new idea, visual state or camera target): **64 in 223 s, so the mean beat is 3.5 s** (median ≈3.0 s; shortest ≈0.8 s for whip-pans; longest 6.5 s, the push-in at #21).
- **Continuous camera sequences:** 5. Timeline/data (0–66.5), bond stage (69.5–128), investor parable (128–196.5), chart abstraction (196.5–203.5), Aug '19 / grid finale (203.5–223).
- **Screen time by type:**

| Type | Seconds | % |
|---|---|---|
| Chart / data viz (ribbon, small multiples, bill-stacks, trace lines, year grid) | ≈139 | **62 %** |
| Character diagram / parable (flat pixel people on the ground line) | ≈74 | **33 %** |
| Archival footage (always inside a TV frame, never full-bleed) | 6.7 | 3 % |
| Brand ident | 3.0 | 1.3 % |
| Maps / talking head / full-screen text cards | 0 | 0 % |

Kinetic text appears only **overlaid** on a chart or stage (≈20 s total). A full-screen text card is never used.
- **Text at once:** at most **one headline block** of ≤2 lines and ≤6 words per line (≤11 words in total). Captions in #36 never accumulate: there is always **1 line**. Small labels (axis, month, %) run 2–4 per frame. The densest frame is the finale (13 leader labels plus 43 year numbers), and it is the only "dense" frame in the whole video.
- **Max simultaneous foreground elements:** about 12, at #33 (4 characters, 4 props, 3 speech labels, ground). The typical beat has **3–6**.
- **Motion vs static** (frame-difference per 0.5 s, n=447): **31 % fully static** (YAVG<0.15, so even the grain is frozen), **25 % small motion** (a single element animating), **44 % large motion** (camera pan/zoom or a scene morph). The camera moves in about 45–50 % of the runtime. Static holds of **3–5 s** are used deliberately after a concept lands (#6, #29, #38, #53, #64).
- **Sync:** every element I could check onsets within **−300…+500 ms** of its keyword, with a median ≈0. A few visuals lead slightly (#5 "predicted"). Ring pops land on "boom".

---

## 3. DESIGN TOKENS (sampled from 720p frames)

| Token | Hex | Use |
|---|---|---|
| `bg` | **#3F3E41** | Whole-frame background: warm charcoal, never pure black, never a gradient |
| `panel` | #39393B | Small-multiple chart squares (only about 2 % darker than bg, no border) |
| `ink` | #FFFFFF / #FCFBFE | Headlines, ground line, trace lines |
| `line-normal` | **#EFEFE3** | Cream data line (the normal state) |
| `line-alert` | **#ED1154** (#DE0043 on the stage) | Inverted or alarming data. The only saturated warm colour |
| `recession-fill` | **#834650** / #854552 | Maroon tiles, word-highlight box, recession tint |
| `alert-muted` | #87535B | Secondary alert callout ("RECESSION?") |
| `annot-yellow` | **#F3FF0A** to #FFFF2B (dots #F5FF00, dashed ellipse #E5FD67) | Every annotation the narrator "points at": arcs, rings, ellipses, "CURVE UPWARD" |
| `label-grey` | #7D7C7F (axis), #878789 (%), #676865 (month labels), #8B8A8D (ghost years) | All secondary text |
| `money` | fill #A1D4A7, line/glyph #638F6A | Dollar bills, stacks |
| `bond` | paper #CDC89E, text/border #928C6A | "$100 BOND" ticket |
| `cloud` | #F3F1EB, stepped hard shadow #2E2B2E | Omen cloud |
| `rain` | #33717C | Dashed rain |
| characters | jacket #8EB1BA, pants #7A8384, hair #222222, skin #99867A | Flat, blocky, pixel-stepped people |
| Vox bug | wordmark at ~75 % white (#BEBEC0 on bg), top-right at x≈1725–1893, y≈27–112 | Always on, except during the ident and credits |

- **Fonts:** the on-screen sans is Vox's house grotesque (**Balto**, Font Bureau): a heavy, low-contrast geometric grotesque. The closest Google Fonts are **Libre Franklin 800/700** or **Barlow 700** (Barlow Semi Condensed for the tracked caps). Uses:
  - Headlines: 700–800, ~78px (2-line), 125px (single title), ~45px (caption line).
  - Speech: **bold italic**.
  - Callouts: ALL CAPS with tracking +0.06…0.1em.
  - Numbers: tabular bold grey.
  - Brand: a high-contrast serif (the Vox logotype).
- **Strokes (at 1080p):** ground line 12px; data lines 15px (focus panel) and ~6px (strip); dashed trace 8px (dash 28 / gap 16); yellow ring 5px; dotted arc 5px dots at a ~12px pitch; leader lines 2px.
- **Texture:** a very subtle **static** low-frequency grain/blotch on bg (±2–3 levels, frozen between frames). No paper, halftone, watercolour or torn edges in this video. No drop shadows, except the cloud's offset stepped shadow and a soft **red outer glow** (~10px blur, ~30 % #ED1154) around the alarming panel (#19–21).
- **Annotation style:** yellow, hand-placed but geometrically clean: dotted arcs, perfect rings, dashed ellipses, and short arrows ("⟶" thin line plus open chevron). Annotations draw on (they do not fade) over 0.4–1.0 s. There is never more than one annotation per beat (arc and ring count as one gesture).
- **Grid:** ~6 % side margin. Headlines sit in the upper third (y 120–480). The data ribbon or stage sits in the lower-middle (ground line at y≈860–950). Content is centred on the horizontal centre. The top-right corner is reserved for the bug, so nothing else ever goes there.

---

## 4. WIDGET CANDIDATES

All widgets take **word-anchored cues**: `at: WordRef` (`{word: "boom", occurrence?: n}`, resolved against the alignment) plus `offsetMs` (default 0, allowed −300..+500). They read colours only from `VoxTokens` above.

1. **`<WorldCamera>`** (the core: an infinite canvas plus a virtual camera). Reproduces #8, 10, 12–16, 19, 21, 26, 30, 34, 41, 50, 61, 62.
   ```ts
   { world: ReactNode; keys: { at: WordRef; x: number; y: number; zoom: number;
     ease?: 'io'|'out'|'whip'; durMs?: number }[] }
   ```
   - Pans default to 1000–1500 ms with ease-in-out (cubic).
   - `whip` is 600–900 ms with a strong ease-out (quint), used for fast-forward through time.
   - Push-ins run 4–6 s with ease-in. Zoom-outs run 0.5–4.5 s with ease-out.
   - The camera interpolates between consecutive keys and holds otherwise.
   - Elements live at **world coordinates**, so nothing "stacks" on screen and leaving = scrolling off.
2. **`<MonthRibbon>` / `<SmallMultiples>`** (a timeline of mini line charts). Reproduces #1–21, 59, 62.
   ```ts
   { series: {label: string; values: number[]; state: 'normal'|'alert'|'recession'}[];
     panelW: number; gap: number; focusIndex?: number; dimOthers?: number /*0.3*/;
     revealLinesAt?: WordRef; ghostYear?: boolean }
   ```
   Focus dims neighbours to 30 % over 300 ms. A state change flips the line colour instantly, or over 500 ms through pink. Recession cells get the maroon fill.
3. **`<KineticHeadline>`.** Reproduces #1, 5, 17, 18.
   ```ts
   { groups: {text: string; at: WordRef; emphasis?: 'box'|'big'}[]; size: 'title'|'two-line'|'caption';
     anchor: 'upper-third' }
   ```
   - Each group enters with ↑12px and fades in over 250–300 ms (ease-out).
   - `box` wipes a maroon highlight behind the word in 150 ms.
   - `big` puts the word on its own line at 1.4x.
   - Limits: 2 lines, ≤6 words per line. Exit is a 200–500 ms fade.
4. **`<CaptionLine>`** (a single line that replaces itself). Reproduces #36.
   ```ts
   { lines: {text: string; at: WordRef}[] }
   ```
   Only one line is visible at a time. Lines crossfade over 150 ms with ↑8px.
5. **`<Annotate>`** (the yellow gestures). Reproduces #9, 11, 13–17.
   ```ts
   { kind: 'arc'|'ring'|'ellipse'|'label-arrow'; from?: WorldPt; to: WorldPt;
     text?: string; at: WordRef; drawMs?: number /*400–1000*/ }
   ```
   - `arc` is dotted and draws on with an SVG dash offset.
   - `ring` pops (scale 0.6→1, 150 ms, slight overshoot).
   - `ellipse` is dashed.
   - `label-arrow` uses ALL CAPS, rotated to follow the local slope.
6. **`<TraceLine>`** (draws a curve through bar tops, then labels it). Reproduces #37, 39, 54–56.
   ```ts
   { points: WorldPt[]; style: 'dashed'|'solid'; color: 'ink'|'alert'; drawAt: WordRef;
     drawMs: 1500–2000; label?: {text: string; italic?: boolean; caps?: boolean; at: WordRef};
     arrowAt?: WordRef }
   ```
   The draw is linear. The label rides the path's angle. The arrow appears on the direction word ("upward").
7. **`<BillStack>` bar chart.** Reproduces #28, 35, 49, 52, 53.
   ```ts
   { columns: {x: number; bills: number; label: string; pct?: string}[]; at: WordRef;
     perBillMs: 120; jitter?: boolean }
   ```
   - Bills stack bottom-up and pop one at a time.
   - Count changes animate per bill (grow or shrink).
   - `jitter` changes each stack by ±1 bill every 500 ms.
   - Percent labels ↑ in a staggered sequence 500 ms apart.
8. **`<GroundStage>` with `<FlatPerson>` / `<Prop>` / `<SpeechText>`.** Reproduces #23–27, 30–33, 40–51.
   ```ts
   { groundY: 950; axis?: {label: string; x: number}[];
     actors: {id: string; look: 'investor'|'unclesam'|'buyer'; x: number; enterAt?: WordRef;
       enter?: 'flip'|'slide-left'|'fade'; exitAt?: WordRef}[];
     props: {kind: 'bond'|'bill'|'coin'; holder: string; text: string; at: WordRef}[];
     speech: {actor: string; text: string; at: WordRef}[] }
   ```
   - Speech is bold italic and pops in 150 ms. A new line from the same actor replaces the old one.
   - Prop pops take 150 ms.
   - `flip` enters with scaleX 0→1 over 300 ms.
9. **`<Omen>`** (thought beam, cloud and rain). Reproduces #41–44, 51, 58.
   ```ts
   { beamFrom?: string /*actor*/; cloudAt: WorldPt; rain?: boolean; at: WordRef; exitAt?: WordRef }
   ```
   The beam wipes out over 300 ms. The cloud drops in from the top over 300 ms. Rain is a looping dash scroll.
10. **`<Morph>`** (one object becomes the next, so the scene is never "cut"). Reproduces #48, 52, 57.
    ```ts
    { from: ElementId; to: ReactNode; at: WordRef; durMs: 500 }
    ```
    It crossfades and position-matches at the same world x.
11. **`<ArchivalTV>`.** Reproduces #2–4.
    ```ts
    { clips: {src: string; at: WordRef}[]; enter: 'drop-top'; exit: 'drop-bottom' }
    ```
    Clips swap hard inside the bezel. Footage is never full-bleed.
12. **`<LeaderLabels>`** (finale overview callouts). Reproduces #63.
    ```ts
    { items: {anchor: WorldPt; text: string; tone: 'alert'|'soft'}[]; at: WordRef; staggerMs: 200 }
    ```
    The line draws first (150 ms), then the text fades in.
- *(plus)* **`<BrandBug>` / `<Ident>`.** The bug is always on and is hidden during the ident (3 s, centred). The ident happens once, after the cold open (#22).

---

## 5. RULES OBSERVED

1. **Never cut when you can move.** One persistent world per act. Transitions are pan, zoom, whip-pan or morph. Hard cuts are used about 7 times in 223 s.
2. **One idea per beat (≈3.5 s), one annotation per beat.** A new beat removes or replaces the previous overlay. Text and annotations **never accumulate** like slide builds.
3. **Every element enters on its spoken keyword**, within −300…+500 ms. Labels, rings, colour flips, speech and caption phrases all follow this.
4. **At most one headline block** (≤2 lines, ≤6 words per line), always in the upper third. Captions are a single line that replaces itself.
5. **No boxed cards, no panels with borders, no chips or section badges.** The only containers are the near-invisible chart squares (#39393B on #3F3E41) and the diegetic TV. There are **no "ACT I/II/III" labels**: the act break is the brand ident, used once.
6. **The top-right corner belongs to the brand bug.** Nothing else is ever placed there.
7. **A colour means a state, globally:** cream = normal, crimson = alarming/inverted, maroon = recession period, yellow = "look here" annotation, green/tan = money/bond. These meanings never change.
8. **Abstraction ladder:** concrete parable (people, bills) → bars → line → the same small-multiple panel as the data. The explainer resolves into the real chart (#57), so the viewer recognises the data afterwards.
9. **Hold after the payoff:** 3–5 s static after each concept lands. The camera is static about 31 % of the time.
10. **Archival is framed and short:** inside a TV, 3 clips in under 7 s. News soundbites can run as **audio only** over the data (#20).
11. **Data is drawn exactly and minimally:** no gridlines, no y-axis, only two end-labels ("2-year / 10-year") and a month title. Counters show the real values ("3% 4% 5%", "$90").
12. **Time is spatial:** left = past, right = future, for both the ribbon of months and "Now → 10 years later". The camera moving right *is* time passing.
13. **The palette stays dark and flat:** charcoal background, flat fills, no gradients or 3D. The only glow marks the single most alarming object.

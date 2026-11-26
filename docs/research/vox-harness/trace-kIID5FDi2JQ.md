# One-to-one trace: Vox, "Why all world maps are wrong" (kIID5FDi2JQ)

Source: https://www.youtube.com/watch?v=kIID5FDi2JQ. The local copy is 1280x720 at 23.976 fps and runs 360.0 s. The narrated body ends at 336.3 s, and an end card follows.

## How this was measured

- **Frame sampling.** I read the whole video as 15 contact sheets at 1 fps, plus 30 strips at 6 fps around every important entrance. I also pulled full-resolution stills for typography and colour. All of these are in `/tmp/claude-1000/-home-xuckl-Dev-everyai-creatorstudio/f200848f-f148-46dd-8a1b-42a949994497/scratchpad/trace/kIID5FDi2JQ/` (`m_*.jpg`, `f_*.jpg`, `z_*.jpg`).
- **Word timing.** Word-level timestamps come from the YouTube auto-caption VTT, parsed into `trace/kIID5FDi2JQ/words.txt` (1051 words). Every "Δ" in this report is the visual onset minus the word onset, measured to the nearest 6 fps frame (±85 ms). Caption word times carry about ±100 ms of their own error.
- **Coordinates.** Positions are converted to a 1920x1080 frame (720p values x1.5).
- **Colours.** Hex values are pixel samples from the 720p H.264 file, so they are about ±4 per channel from the true values.

---

## 1. Shot / beat table

Shot types used in the table:

| Code | Meaning |
|---|---|
| **LA** | Live-action presenter footage |
| **MAP** | Map or globe graphic on paper |
| **ARC-S** | Archival still collage |
| **ARC-F** | Archival film |
| **KT** | Kinetic text card |
| **SCR** | Screen capture |
| **TR** | Transition-only beat |

### Act 0: Cold open, physical demonstration (0–42.7 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 1 | 0.0–1.0 | (music) | LA | Inflatable globe tossed toward the lens. White serif "Vox" logo, centre-right, about 30% width, semi-transparent. | Handheld whip; the logo fades over about 2 s. | n/a | Hard cut |
| 2 | 1.0–15.8 | "all right here we go… cut it… open" | LA ×10 | Studio with white sweep. Presenter and globe centred; overhead shots of a knife cutting the globe. | Handheld. Cuts at 1.9, 4.3, 9.1, 11.4, 12.1, 12.8, 13.6, 14.3, 15.6 s; ASL inside the cutting montage (11–16 s) is about 0.7 s. | Cuts follow action, not words | Hard cuts |
| 3 | 15.8–42.7 | "in order to get this globe… map makers… without some form of distortion" | LA ×16 | Overhead and close shots of the presenter stretching the PVC globe flat on carpet. | Handheld; ASL about 1.7 s. | Cuts follow the physical action | **Paper wipe**: a light paper sheet slides up from the bottom and covers the frame, 42.67→43.33 s (660 ms, ease-out) |

### Act 1: "Projection" concept (42.7–94.0 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 4 | 42.7–47.2 | "mathematically proved by this guy a long time ago" | ARC-S | Paper background. Oval portrait of Gauss at centre (x 600–1240, y 80–1000). Name plate "**Carl Friedrich Gauss**" sits across the bottom of the oval (black #242424 plate, x 450–1466, y 848–993; white #EFEFEF bold italic serif, about 90 px). Line-art diagrams on the left and right: "Gauss' Theorema Egregium" sphere diagram, Δφ=Δs/r, and determinant equations, in black ink with one cyan patch and an orange dashed arc. | Portrait scales 0→100% in 500 ms (43.33→43.83, ease-out with slight overshoot). Plate begins as a black square at 43.5, then wipes left→right to full width by 44.0 (≈400 ms). Diagrams fade in 43.83→44.17. Slow push of about 3% across the shot. | Portrait on "mathematically" (43.44): **−110 ms**. Name plate complete before "this guy" (44.64): **−640 ms** | Hard cut |
| 5 | 47.2–51.4 | "since around the 1500s mathematicians…" | ARC-S | Painted double portrait (Mercator and Hondius), first shown as an inset rectangle at about 70% width over an antique world map, which acts as a textured backdrop. | Continuous push 1.0→≈1.8x over 4 s (ease-in-out) until the painting fills the frame and the faces are cropped. | Lands on "1500s" (46.72): about +500 ms | Hard cut |
| 6 | 51.4–54.1 | "translate the globe into something flat" | LA ×2 | Overhead of globe pieces on the floor. | Handheld. | n/a | Hard cut |
| 7 | 54.1–58.7 | "a process called **projection** popular rectangular maps use a cylindrical projection" | LA + KT overlay | Globe at bottom centre; paper roll on the right. **Label plate "Projection"**: #282A32 plate spanning x 460–1570, y 435–605 (dead centre). White high-contrast bold italic serif, cap height ≈97 px. Behind it, a thin white HUD of concentric arcs and crosshair lines (1–2 px, about 60% opacity) rotates around the globe's centre. | Plate starts as a 6 px vertical caret at 54.17, then wipes left→right with text revealed in 330–500 ms. HUD arcs rotate about 30°/s, drawing on in 600 ms. | Plate onset **−990 ms** before "projection" (55.16), on "called" (54.32); fully readable 490 ms before the word | Plate cuts off at the 56.6 cut |
| 8 | 58.7–61.2 | "imagine putting a theoretical cylinder over the globe" | LA | Overhead: paper cylinder wrapped around the globe. | Handheld. | Cut on "imagine" (59.28): −580 | Hard cut |
| 9 | 61.2–63.5 | "and projecting each of the points of the sphere" | LA + line overlay | Macro of the globe surface. White 1.5 px rays draw from off-frame left to points on the coastline, staggered. | Each ray draws in about 170 ms; stagger about 170 ms; 10+ rays by 63.0. | First ray at 61.5 on "globe" (61.64): **−140 ms** | Hard cut |
| 10 | 63.5–67.8 | "onto the cylinder surface" | LA + overlay | Wide globe-in-cylinder shot. White rays continue onto the paper, and a black coastline outline appears composited on the paper. | Rays and outline draw progressively over 2 s. | Sustained from "onto" (64.88) | Hard cut |
| 11 | 67.8–71.4 | "unroll the cylinder and you have a flat rectangular map" | LA | Overhead: presenter unrolls paper showing a world outline map (thin black line art on white). Final frame is a near-flat top-down hold that matches the paper look of the next act. | Hold of 1.5 s at the end. | Cut +500 ms after "unroll" (67.28) | **Whip pan** with directional blur (330 ms) into the projection gallery |
| 12 | 71.4–81.0 | "but you could also project the globe onto other objects… once it's all flattened out" | MAP (gallery) | Scanned black-and-white projection plates (black land, grey graticule, tiny captions) laid on a paper "wall". One projection is centred and fills about 70% of the width; neighbours peek in at the edges. Sequence: interrupted lobes → twin hemispheres → Pacific-centred → orthographic → heart/Bonne → Hammer. | **Whip pans** between plates every 1.3–2.0 s. Each whip is 300–500 ms of translate plus 5–20° rotation with heavy directional motion blur, then a slow drift until the next whip. | Whips fall on content words: "objects" 73.28 → whip 73.0; "map makers" 75.0 → 75.5; "looks" 78.24 → 78.0 | Rotational whip, 80.5→81.33 s |
| 13 | 81.0–84.8 | "**here's the big problem** every one of these projections comes with tradeoffs" | KT | Full-frame wallpaper of about 60 small projection plates (the same scans, tiled). Centred white card x 300–1615, y 318–738 with a 15 px rough black border, like a letterpress frame. Text: "*Here's the*" (italic serif, about 75 px, #19191B), "**BIG**" (ultra-heavy grotesque, about 110 px cap), "*problem:*" (italic serif). A black brush-marker swash underlines "BIG". | The card arrives inside the whip (rotated about −15° and blurred, then settling in about 330 ms). The underline draws left→right in about 170 ms. | Card settles at 81.33 vs "here's" (81.16): **+170 ms**. Underline at 81.5 vs "big" (81.52): **0 ms** | Whip pan out, 84.8–85.5 |
| 14 | 85.5–92.0 | "in shape distance direction and land area… misleading or very helpful" | MAP (gallery) | More single projections (Robinson, Mollweide-like, Bonne/heart). **No text labels for "shape / distance / direction / area".** | Whip every 1.5–2.5 s with drift between. | Whips at 85.3 ("shape" 85.48) and 89.0 ("projections" 88.92), each **≈ −150 ms** | Zoom-out cut |
| 15 | 92.0–94.0 | "depending on what you're using them for" | MAP | Grid of about 15 projection plates (92 s), then a wall of about 200 tiny plates (93 s). This shows the "library" size. | Continuous zoom-out, scale 1.0→0.25 over 2 s. | n/a | Cut to globe at 94.05, on "here's an example" (94.04): **0 ms** |

### Act 2: Mercator (94.0–199.8 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 16 | 94.0–99.1 | "here's an example this map is called the **Mercator** projection" | MAP | Paper background. Black orthographic globe with a graticule, centred at about 25% width, **unwraps** into a Mercator silhouette in 330 ms (94.5→94.83). Header "**M E R C A T O R**" at top centre (baseline y≈123, tracked bold grotesque caps, cap height ≈40 px, #202022). Map below it at 56% width, with Antarctica cropped off the bottom edge. | Header **mask-reveals upward** in 170–330 ms. Then a slow push 96→98.5 s takes the map from 56% to about 110% width (ease-in-out); the header leaves the top of the frame. | Unwrap on "example" (94.52): **0 ms**. Header at 95.0 vs "Mercator" (96.32): **−1320 ms** | **Diagonal hard-edge wipe** (45°, about 170 ms) to a colour classroom map |
| 17 | 99.1–101.5 | "if you're American you probably studied this map in school" | ARC-S | A colour political Mercator wall map fills the frame, then zooms out to reveal a classroom photo with a pink wall, chalkboard, and the map hanging at the centre third. | Zoom-out of 3x in 500 ms (99.17→99.67, ease-out), then a slow push back in. | Wipe +810 after "American"; reveal +150 after "studied" (99.52) | Push into the map, then a match-dissolve to Google Maps at 101.67 |
| 18 | 101.5–104.9 | "also the projection that **Google Maps** uses" | SCR | Full-frame Google Maps world view. | Static. | Onset **−570 ms** before "Google" (102.24) | Cut |
| 19 | 104.9–110.0 | "popular for a couple of reasons… preserves the shape of countries" | MAP | Black-and-white Mercator silhouette, full width (#1C1C20 land, hairline white borders). No header. | Slow lateral drift of about 2% of the width. | n/a | All countries except South America slide away; at 110.0 a globe flies in |
| 20 | 110.0–114.9 | "**Brazil** on the **globe** has the same shape as Brazil on the Mercator projection" | MAP (compare) | **Two-up.** Left: South America cutout in black (x 285–790, y 230–890). Right: satellite-texture globe with yellow-green border lines (diameter ≈740 px, centred at x 1325, y 490). Both float above **soft elliptical drop shadows** about 100 px below. | Globe enters from bottom-right in 330 ms (ease-out) and rotates to South America over 1.5 s. At 112.5 a black SA cutout copy slides onto the globe as an overlay (500 ms). At 113.33 Brazil floods **bright yellow #D6DD00** (a hard cut, no fade). | Globe in **+200 ms** after "globe" (109.80). Brazil fill **−310 ms** before "projection" (113.64) | Hard cut |
| 21 | 114.9–117.2 | "but the original purpose of the Mercator projection was navigation" | MAP (object) | Small **framed watercolour Mercator** (thick black 9 px frame, 800x450 px, centred), floating on paper. Header "M E R C A T O R" in tracked **serif** caps above it. | Hold of 1.2 s, then a **2.5D tilt-and-dive** into the map (perspective rotateX ≈20°, scale 1→5 over 900 ms, ease-in). | Onset +80 ms after "original" (114.92) | Continuous camera move |
| 22 | 117.2–125.0 | "it preserves direction… navigate the ocean with only a compass" | MAP + ARC-S | Watercolour map full-bleed: teal ocean, pastel countries. A Mercator engraving (rhumb-line compass chart and portrait) is laid at left as a paper card with a torn/soft edge. | Push into the engraving: scale 1→4 over 6 s, ending on the compass in Mercator's hands at "compass" (122.56). | Arrival matches "compass" within about 300 ms | Pull back out |
| 23 | 125.0–127.6 | "a **line drawn** between two points on the map" | MAP | Full-bleed watercolour map. A dark navy 2 px line draws from Venezuela to the UK. Small yellow angle ticks appear at each graticule crossing. | Line draws in about 1.0 s (124.5→125.5, linear). | Onset **0 ms** at "line" (124.48) | Continuous **push** |
| 24 | 127.6–131.3 | "would provide the exact **angle** to follow on a compass" | MAP (annotation) | Extreme push (scale about 6x) onto one graticule crossing. The route is now a red #B7090F / black dashed line about 9 px wide. A **yellow #F2B707** north reference line and arc (6 px) appear. **Counter "45.8°"** in thin geometric sans (about 110 px) in dark teal, placed in the open angle. | Push 127.5→128.0 (500 ms, ease-in-out). The counter runs **10.6→21.3→35.2→42.6→45.4→45.8** over 830 ms (ease-out) and the arc grows in step. Hold for 1.7 s. | Counter starts at 128.0 vs "angle" (127.96): **+40 ms** | Pull back 130→131.3 |
| 25 | 131.3–133.3 | "to travel between those two points" | MAP | Full map with the line; the yellow angle ticks stay visible. | Drift. | n/a | Morph |
| 26 | 133.3–136.0 | "if we go back to the **globe** you can see that this line is not the shortest route" | MAP (morph) | The flat map **morphs into an orthographic globe** (watercolour texture kept, on paper). The straight line becomes a curve. | Morph takes 500 ms (133.33→133.83, ease-in-out); slight rotation afterward. | **+90 ms** after "globe" (133.24) | Reverse morph back to flat (136.0) |
| 27 | 136.0–142.0 | "simple reliable way to navigate across the ocean" | MAP (2.5D) | Flat map, then tilted perspective (≈30° rotateX) showing the black frame edge and serif "MERCATOR" header. A paper-cutout **sailing ship** sprite rides the line. | Camera pans along the route about 400 px/s while the ship translates along the line; the camera follows the ship. | Ship appears at 137.8 ("simple reliable" 137.24/137.80) | Pan right |
| 28 | 142.0–145.0 | "Gerardus Mercator who created the projection in the 16th century" | MAP + ARC-S | Map shifted to the left 60%. An oval engraved **portrait of Mercator** (cream border with Latin inscription) occupies the right third (x 1260–1920, full height). | Portrait slides in from the right (≈500 ms, ease-out), then holds. | About +1000 ms after "Mercator" (141.0) | Map desaturates (cross-fade 400 ms) |
| 29 | 145.0–154.4 | "varying the distance between the latitude lines… straight, creating a **grid** of right angles" | MAP (diagram) | The map fades to a grey ghost (about 20% opacity). A black 2 px **graticule grid** overlays it. A **red #DC333A I-beam tick column** measures the latitude spacing, with each tick taller toward the pole. Then red grid cells draw over the top-left quadrant. The portrait stays on the right. | Grid fades in over 330 ms (145.17). Ticks draw top→bottom with a 220 ms stagger, 9 ticks in about 2 s. The red grid draws cell by cell over about 1.2 s. | Grid **−510 ms** before "varying" (145.68). Ticks synced to "distance between the latitude lines" (146.28–147.56). Red grid at 149.9 vs "grid" (149.92): **0 ms** | Hard cut on "where the Mercator fails" (154.48): **−80 ms** |
| 30 | 154.4–163.0 | "its representation of size look at the size of **Africa** as compared to **Greenland**… they look about the same size" | MAP (isolate) | Black-and-white Mercator under a "M E R C A T O R" header. Africa darkens and gets white borders. Then **every other country flies outward off-frame**, leaving Greenland (x 370–800) and Africa (x 1050–1490) centred as a pair. **Open-corner brackets** (6 px #1F1F1F) draw around each one. | Africa emphasis at 158.8. Explode 159.17→159.67 (500 ms, ease-in, radial). The two survivors re-centre in 330 ms. Each bracket draws its right vertical first, then the bottom-left L, then the top-left L, about 500 ms in total (159.83→160.33). | Africa **+480** after "Africa" (158.32). Explode **−190** before "Greenland" (159.36). Brackets **−290** before "map" (160.64) | Bracketed pair holds; the brackets retract and Greenland moves right; cut to globe at 163.0 |
| 31 | 163.0–168.4 | "if you look at a globe for **Greenland's true size**… it's way smaller than **Africa**" | MAP (globe) | Satellite globe centred (≈620 px) with a soft shadow. Camera pushes in on Greenland (scale 2.5x, 164→165.5). Then the Greenland ice cap is **lifted and dragged** down onto Africa, where it sits as a white blob. | Zoom 1.5 s ease-in-out, then zoom back out with the globe rotating to Africa (1 s). The Greenland shape translates onto Africa in 670 ms (166.67→167.33, ease-in-out). | Zoom **+120** after "Greenland's" (163.88). Drag **0 ms** at "smaller" (166.68) | Globe slides left and the split opens |
| 32 | 168.4–172.3 | "by a factor of **14**" | MAP (split compare) | **Split screen.** A 1 px #C1C1C1 divider at x=960 from y=0 to 1010. Headers "REALITY" (left, centred at x 480) and "MERCATOR" (right, centred at x 1440) at y≈170, tracked bold caps. Left: globe with Greenland on Africa. Right: a textured Mercator-size Greenland cutout laid over a Mercator-size Africa cutout; Greenland covers almost all of Africa. | Globe moves left 330 ms. Greenland and Africa rise in from below (500 ms, ease-out). Headers mask-reveal upward in 170 ms. | Split at 168.5 vs "factor" (168.64): **−140 ms** | Hard cut to empty paper (172.33) |
| 33 | 172.3–176.4 | "if we put a bunch of **dots** onto the globe that are all the same size" | MAP (Tissot) | A black-and-white globe with a graticule and about 30 **equal yellow Tissot dots** drops from the top to the centre (diameter ≈620 px), with a shadow. | Drop 800 ms (172.67→173.5, ease-out with a small settle bounce). | Drop **−170 ms** before "dots" (172.84) | **Bar wipe** |
| 34 | 176.4–190.8 | "project that onto the Mercator map… the circles remain round… enlarged as they get closer to the poles… imperialist attitude… southern hemisphere" | MAP (Tissot) | A 9 px black vertical bar sweeps right→left, revealing a small Mercator with dots behind it (the header slides out top). The camera then zooms the map to full bleed: Tissot circles are 44 px at the equator and ≈85 px at ±60°. Light grey graticule. | Bar wipe 500 ms (176.33→176.83), then zoom 0.45→1.0 in 1.3 s (ease-in-out). **Longest hold in the video: about 12.5 s** of near-static map (≈3% drift). | Bar wipe at 176.4 vs "Mercator" (176.40): **0 ms** | Inset opens |
| 35 | 190.8–199.8 | "the Mercator projection has fostered European imperialist attitudes…" (TV clip audio) "…really" | ARC-F inset | **Footage inset**: a West Wing clip at about 66% width (x 85–1270, y 50–720 of 1080), hard-edged with no border or shadow, sitting over the Tissot map. Two shots inside. | A 1 px vertical line appears at 190.67, then a **horizontal wipe** opens the clip left→right in 670 ms (ease-out). Slight push inside the clip. | Inset opens **−1170 ms** before the clip's dialogue (191.84), in the narration gap | Hard cut on "so if you want" (199.88): **−100 ms** |

### Act 3: Gall-Peters (199.8–224.3 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 36 | 199.8–203.5 | "a map that more accurately displays land area" | MAP | Black-and-white Mercator full bleed with graticule; no dots. | Slow pan of about 3% in 3.7 s. | n/a | Morph |
| 37 | 203.5–209.0 | "you can use the **Gall-Peters** projection this is called an equal area map" | MAP (morph) | The Mercator **morphs** into Gall-Peters; a grey ghost of the old outline trails for 1–2 frames. Header "G A L L - P E T E R S" mask-reveals at the top centre. | Morph 830 ms (203.5→204.33, ease-in-out). Header 330 ms. | Morph **−860** before "Peters" (204.64), on "use the G…". Header **−140** before "Peters" | Isolation |
| 38 | 209.0–213.0 | "look at **Greenland and Africa** now… much better than the **Mercator**" | MAP (split compare) | Other countries fly away, leaving GP Greenland (squashed, ≈250 px wide) and GP Africa. At 211 the right half slides in: **"GALL-PETERS \| MERCATOR" split** with a 1 px divider, Mercator Greenland and Africa on the right. | Explode 500 ms; split push-in from the right 500 ms. The right header mask-reveals (half-clipped at 211.5). | Isolation **+300–1000** after "Greenland and Africa". Split **−400** before "better" (211.64) | Hard cut |
| 39 | 213.0–217.3 | "the country shapes are totally **distorted**" | MAP | Full Gall-Peters, full bleed, no header. | Slow push of about 4%. | n/a | Dots pop |
| 40 | 217.3–224.3 | "put those **dots** again… preserves area while totally distorting shape" | MAP (Tissot) | Gall-Peters with vertically stretched yellow **Tissot ellipses**. | Ellipses **pop** (scale 0→1, 170 ms each) with a sweep stagger left→right over 500 ms (217.33→217.83). | Pop **−110** before "dots" (217.44) | Hard cut at the sentence end (224.31), **−730** before "something" |

### Act 4: GPS changes the purpose (224.3–296.3 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 41 | 224.3–262.0 | "something happened in the late 60s… satellites… position fixes… in any kind of weather… GPS wiped out the need for paper maps" | ARC-F ×10 | 1960s Navy Transit film, full frame, yellow-green faded stock with dust. Shots: rocket launch, satellite cel animation over the globe, printouts, dish, engineers, hands with dividers on a chart. | Cuts at 231.0, 237.9, 241.1, 243.7, 246.9, 249.4, 250.4, 255.8, 256.8; ASL ≈3.8 s. The original film plays with **no overlays at all**. | Cuts land on the content noun: satellite cel on "satellites" (231.08), dish on "weather" (250–251), hands on "paper maps" (255.8) | Hard cut |
| 42 | 262.0–268.0 | "and more about **aesthetic design** and presentation" | ARC-S collage | Modern world maps (Robinson, satellite, political, a CO₂ choropleth, night lights), each centred on paper at 70–85% width with a slight shadow. | **Staccato replacement every 170–420 ms** (about 14 images in 6 s), cut to the music beat. No motion inside an image. | Starts on "imperatives" / "aesthetic" | Hard cut |
| 43 | 268.0–274.3 | "the Mercator projection, that once vital tool… was shunned by cartographers who now saw it as misleading" | ARC-S | 19th-century engraved Mercator world map in sepia, nearly full frame. | Push 1.0→1.15 over 3.5 s, then an **ink-bleed / watercolour dissolve** to blank paper over 2.8 s (271.5→274.3); the matte eats inward from the top and bottom edges. | Bleed starts **+340** after "shunned" (271.16) | Blank paper for 2.3 s |
| 44 | 274.3–276.6 | "but even still most web mapping tools" | TR | Empty paper background only. | None. | n/a | Hard cut |
| 45 | 276.6–296.3 | "like **Google Maps** use the Mercator… a **90° left turn** on the map is a 90° left turn on the street… on a world map scale…" | SCR | Google search results with the cursor clicking "Google Maps", then Google Maps itself: zoom from the world to a city grid. A **pink-red route line** (≈14 px) is drawn along the streets and makes a 90° left turn. Zoom back out to the world. | Continuous screen-recorded zoom; route draws in about 600 ms per leg. | Search **+160** after "Google" (276.44). Route turn draws around "90° left turn" (285.0–285.84): **≈+100** | **Glitch colour-flash** transition |

### Act 5: Compromise projections and close (296.3–336.3 s)

| # | Time | Narration | Type | Layout / elements | Motion | Trigger (Δ) | Out |
|---|---|---|---|---|---|---|---|
| 46 | 296.3–297.6 | "cartographers rarely use the **Mercator**" | TR | 1–2-frame flashes: satellite tile, pink hue-shifted map, a red-tinted Robinson, a sepia Robinson, a cyan-white Robinson, then back to black-on-paper. | About 6 flashes of 40–170 ms each. | Starts **0 ms** at "Mercator" (296.36) | Lands in the morph series |
| 47 | 297.6–307.0 | "most modern cartographers have settled on a variety of non-rectangular projections that split the difference…" | MAP (morph series) | A centred black world in a 1.5 px projection outline on paper, at about 85% width. It **morphs continuously** through Robinson → Eckert → hexagonal → Wagner → Hammer → Aitoff → Bonne (305), and so on. | Each morph is 500–800 ms (ease-in-out), with holds of 0.3–1.0 s. | Morph cadence roughly follows the stressed syllables of the sentence | Settles |
| 48 | 307.0–311.0 | "in 1998 the National Geographic Society adopted the **Winkel Tripel**" | MAP | Winkel Tripel with header "W I N K E L   T R I P E L" at the top centre. | Header mask-reveal 170 ms (307.0→307.17); slow push of about 3%. | Header **−830** before "Winkel" (308.0) | Dots |
| 49 | 311.0–316.4 | "pleasant balance between **size and shape** accuracy… there's no right projection" | MAP (Tissot) | Winkel Tripel full bleed with yellow Tissot ellipses that are only mildly distorted. The header slides out. | Push to full bleed (330 ms); ellipses pop with a stagger. | **−320** before "size" (311.32) | Whip |
| 50 | 316.4–321.0 | "cartographers and mathematicians have created a **huge library** of available projections" | MAP (gallery) | Whip back to the scanned-plate wall (twin hemispheres), then a grid of about 15, then a wall of about 200. | Whip 500 ms; zoom-out 1.0→0.25 over 1.5 s. | Whip **+120** after "cartographers" (316.28). Wall **+460** after "library" (319.04) | Cut |
| 51 | 321.0–325.9 | "each with a new perspective… useful for a different task" | MAP (morph) | Robinson → Hammer → Bonne-ish morphs (same look as beat 47). | Same as beat 47. | n/a | Cut |
| 52 | 325.9–336.3 | "the best way to see the Earth is to look at a **globe**… there's no right answer" | LA ×7 | Callback to the cold-open footage: globe toss, cutting, flattening. | Handheld; ASL 1.5 s. | Cut **−520** before "look at" (326.52) | Cut to the end card |
| 53 | 336.3–360.0 | sponsor / credits / thetruesize.com | end card | Black background. Presenter selfie video at 512x512 (x 170–680, y 35–545). Credits in yellow (#F2E600-like) bold italic sans to the right. The video window switches to thetruesize.com and Bostock's "Projection Transitions" captures. | Hard swaps. | Synced to the URL mentions | End |

---

## 2. Statistics

**Runtime split by shot type** (360 s total; 336.3 s of body):

| Type | Seconds | % of 360 s | % of body |
|---|---|---|---|
| MAP / globe / diagram graphics on paper | 155.0 | 43.1 | 46.1 |
| LA presenter footage | 73.1 | 20.3 | 21.7 |
| ARC-F archival film (Transit film and TV clip) | 46.7 | 13.0 | 13.9 |
| ARC-S archival stills / collage | 31.2 | 8.7 | 9.3 |
| SCR screen capture | 23.1 | 6.4 | 6.9 |
| End card | 23.7 | 6.6 | n/a |
| KT stand-alone kinetic text card ("BIG problem") | 3.6 | 1.0 | 1.1 |
| TR blank paper / glitch | 3.6 | 1.0 | 1.1 |

**Shot and beat length.** I counted about 131 distinct beats (hard cuts plus clear layout changes such as morphs, whips and split opens) in the 336 s body, so **mean ≈ 2.6 s** and median ≈ 2.0 s. By segment:

| Segment | Mean shot / beat length |
|---|---|
| Live action | 1.6 s |
| Whip-pan gallery | 2.0 s |
| Morph series | 1.5 s |
| Archival film | 3.8 s |
| Explanatory map section (94–224 s), counting layout beats only | 5.0 s |
| Explanatory map section, counting every element event | a new event every **≈3.3 s** |
| Collage (262–268 s) | 0.4 s |

The longest static hold is 12.5 s (the Tissot Mercator, 178–190.5 s), and it sits under a quote-heavy passage. Graphics otherwise never go **more than about 5 s without a new element, morph or camera beat**.

**Authored text on screen.** Excluding the end card, authored text appears 14 times and is visible about 45 s in total (≈13% of the body). There are no subtitles and no chapter titles.

| Measure | Value |
|---|---|
| Words on screen at once | Usually 1–2 (e.g. "MERCATOR"). Maximum 4 ("Here's the BIG problem:"). |
| Text items at once | At most 2, and only in a split compare (left and right headers). |
| Numbers on screen | One animated number in the whole video ("45.8°"). |

**Elements on screen.** The typical graphics frame has **1–3 authored elements**, for example a map plus a header, or a globe plus a cutout plus a shadow. The maximum is the Gauss collage, with about 6 groups (portrait, plate and 4 diagram clusters). The Tissot field counts as one layer even though it has about 55 dots.

**Camera motion.**

| Material | Share of time the camera moves | Notes |
|---|---|---|
| Graphics | ≈85% | A slow 2–5% push or drift almost always runs. Deliberate push or zoom moves (≥1.5x) happen about 12 times. |
| Graphics, truly static | ≈15% | Mostly the Tissot holds, Gall-Peters at 205–208 s and Google Maps at 102 s. |
| Live action | 100% | Handheld throughout. |

**How beats line up with the narration.**

| Event kind | Δ to the trigger word | Notes |
|---|---|---|
| Illustrative actions (17 measured: draw, morph, pop, drag, isolate, wipe, fill) | Median **≈ −50 ms**; range −310…+120 ms; **all within ±320 ms** | n/a |
| Name / term labels (6 measured: Gauss, Projection, MERCATOR, GALL-PETERS, WINKEL TRIPEL, REALITY\|MERCATOR) | Median **≈ −900 ms** (lead); range −1320…−140 ms | Labels land during the lead-in phrase ("this map is called the…") so the viewer is reading the term as it is spoken. |
| Hard cuts between beats | Within −750…+500 ms of a **sentence start**; median \|Δ\| ≈ 250 ms | Cuts almost never fall mid-clause. |

---

## 3. Design tokens

### Surfaces

| Token | Value | Notes |
|---|---|---|
| `paper.base` | **#E6E6E8** (samples #E4E4E4–#ECECEE) | Cool light grey, never pure white. |
| `paper.mottle` | #D9D8DB patches, 1–4% luminance variation | Large soft clouds about 300–600 px across. |
| `paper.specks` | Black / dark grey dust, 1–4 px | About 20–40 per frame, sparse; a few larger flecks. Static per shot, so it is a texture rather than film grain. |
| `paper.vignette` | Edges about 3% lighter than the centre | Very subtle. |
| `shadow.float` | Ellipse, rgba(60,60,72,0.35) (#B5B5BA in the centre) | 70% of the object's width, about 12% of its height, offset 90–110 px below, blur ≈25 px. Used under every floating globe or cutout. |

### Ink (maps)

| Token | Value |
|---|---|
| `ink.land` | **#1C1C20** (flat silhouette, no outline stroke, no gradient) |
| `ink.borders` | Country borders as hairlines in paper colour, about 1.5 px at 1080 and about 60% opacity |
| `ink.graticule` | #B7BBBF-ish, 1.5 px, under the land |
| `ink.projectionOutline` | #1C1C20, 1.5–2 px |
| Ocean | **No ocean fill.** The ocean is paper. |

### Accents

Each beat uses one accent only.

| Token | Hex | Use |
|---|---|---|
| `accent.tissot` | Fill ≈ **#B5A514 at 70% alpha** (renders #C1B650 on paper, #857913 on land); 2 px stroke #E8E36A | Indicatrix dots and ellipses |
| `accent.highlight` | **#D6DD00** (acid yellow, 100% flat) | Country fill (Brazil) |
| `accent.angle` | **#F2B707** | Angle reference line and arc, 6 px |
| `accent.red` | **#DC333A** | Measurement ticks and grid; 2–3 px lines; I-beam ticks 6 px wide with 20 px caps |
| `accent.redDash` | **#B7090F** alternating with #1A1A1A, 30 px dashes, 9 px wide | Route line when zoomed in |
| `accent.globeBorders` | #C8E000-ish hairlines | Borders on the satellite globe |

### Watercolour map variant

Used in the 115–154 s section.

| Token | Hex |
|---|---|
| Ocean | #44B1CA → #65BED4, with a mottled watercolour bloom |
| Graticule (multiplied) | #398C99, 1.5 px |
| Country fills | cream #FFD785, light cream #FADBAE, orange #DF9141, tan #C69D65, oxblood #813228, mauve #B195AB, sage #88C67A, ink blue #215693, slate green #425E56 / #57736D |
| Borders | Thin dark lines |
| Rhumb line | Dark navy, 2 px |

### Plates and frames

| Element | Spec |
|---|---|
| Term or name plate | Background **#242424 / #282A32** (near-black, slightly blue), no radius, no shadow. Text #EFEFEF. Plate padding is about 0.35 em vertical and 0.4 em horizontal around the text. |
| Card border ("BIG problem") | 15 px black with a rough, inky edge (dry-brush), on a white #F4F4F4 card. |
| Brackets | 6 px #1F1F1F, square ends; asymmetric open corners, with a 2 px "thin" segment on the right edge. |
| Split divider | 1 px #C1C1C1; stops about 70 px short of the bottom edge. |
| Framed map object | 9 px #131217 frame, no mat. |

### Typography

Closest Google Fonts are given in brackets.

| Role | Look | Closest Google Font | Size at 1080 | Colour |
|---|---|---|---|---|
| Section header (MERCATOR, GALL-PETERS, REALITY, WINKEL TRIPEL) | Bold grotesque caps, letter-spacing ≈ **0.30–0.35 em** | **Libre Franklin 800** (alt. Archivo 700) | Cap height ≈40 px (font ≈56 px) | #202022–#363636; on split screens #5A5A5A → #363636 |
| Term / name plate (Projection, Carl Friedrich Gauss) | High-contrast **bold italic serif** | **Playfair Display 700 italic** (alt. DM Serif Display italic) | ≈140 px (centre term) / ≈90 px (name plate) | White |
| Card body ("Here's the… problem:") | Same italic serif, regular weight | Playfair Display 400 italic | ≈75 px | n/a |
| Card emphasis ("BIG") | Ultra-heavy grotesque | **Archivo Black** (or Libre Franklin 900) | ≈110 px cap | n/a |
| Antique header on the watercolour map | Tracked serif caps | **Libre Caslon Display** / Cormorant SC 600, letter-spacing 0.3 em | n/a | n/a |
| Numeric annotation (45.8°) | Thin geometric sans; superscript "°" set as a small "o" at about 40% size | **Montserrat 200–300** | ≈110 px | Dark teal ≈#1F5664 (black multiplied on teal) |

### Motion vocabulary

| Motion | Duration and easing |
|---|---|
| Entrances | 170–500 ms, ease-out (≈ `cubic-bezier(0.16,1,0.3,1)`). Pops (portrait, ellipses) overshoot about 5%. |
| Header text | **Mask-reveal upward** in 170–330 ms: text slides up 100% of its line height inside a clip box. |
| Plates | Caret then wipe: a 6 px bar appears, then the plate wipes left→right in 330–500 ms with the text revealed by the same mask. |
| Line draws | ~1 s for a long route (linear); ticks with a 170–220 ms stagger. |
| Counter | 830 ms ease-out to the final value; one decimal place. |
| Isolate / explode | Non-targets fly radially outward and off-frame in 500 ms (ease-in); survivors re-centre in 330 ms. |
| Projection morph | 500–830 ms ease-in-out, plus a 1–2-frame grey ghost. |
| Camera | Push / pull 500–1500 ms ease-in-out. Ambient drift 2–5% per shot. Whip pan 300–650 ms with directional motion blur (≈150–250 px streaks at 1080) and 5–20° rotation. |
| Transitions | Paper sheet wipe up 660 ms; diagonal hard wipe 170 ms; bar wipe 500 ms; ink-bleed dissolve 2.8 s; glitch / tint flashes 1.3 s (6 flashes); match-cut morph 330 ms (globe→map). **No plain cross-dissolves between graphic beats.** |

---

## 4. Widget candidates (Remotion)

These widgets share four conventions:

- `at` is a `WordAnchor = { word: string; occurrence?: number; offsetMs?: number }`. The planner resolves it against the TTS word timings to an absolute frame.
- Default offsets come from the measurements above: **actions use `offsetMs: 0`**, and **labels use `offsetMs: −600`** (clamped so a label never appears before its shot starts).
- Every widget renders on `PaperStage`.
- Geometry comes from `d3-geo` / `d3-geo-projection` (https://github.com/d3/d3-geo-projection). Projection morphs follow Bostock's "Projection Transitions" approach (https://bl.ocks.org/mbostock/3711652), which is the same source the video credits.

### W1. `PaperStage`: background and camera

- **Props:** `{ seed: number; camera?: CameraKey[] }`, where `CameraKey = { at: WordAnchor; scale: number; x: number; y: number; rotateX?: number; ease?: 'inOut'|'out'|'in' }`.
- **Behaviour:** Renders paper #E6E6E8, a mottle (seeded SVG `feTurbulence`), specks (seeded, static per shot) and the vignette. All children sit inside one `camera` transform.
- **Defaults:** An ambient drift of `scale` 1.00→1.04 across the shot unless a key overrides it. Explicit keys run 500–1500 ms ease-in-out. `rotateX` (perspective 2000 px) gives the 2.5D tilt.
- **Reproduces:** the background of every MAP beat; the pushes in 5, 16, 22, 24, 31 and 43; the tilt in 21 and 27.

### W2. `InkMap`: black silhouette world or regional map

- **Props:** `{ projection: 'mercator'|'gallPeters'|'winkel3'|'robinson'|'orthographic'|…; rotate?: [λ,φ]; graticule?: boolean; outline?: boolean; borders?: boolean; highlight?: { ids: string[]; color?: Token; at: WordAnchor }[]; isolate?: { keep: string[]; at: WordAnchor; layout?: 'pair'|'row' }; morphTo?: { projection; at: WordAnchor; ms?: 700 }[]; focus?: { ids: string[]; at: WordAnchor; padding?: number } }`.
- **Behaviour:** Land #1C1C20, hairline borders, no ocean fill. The map bleeds off the frame edge when full-width.
  - `isolate` explodes non-kept features radially (500 ms, ease-in), then re-centres the kept ones (330 ms).
  - `morphTo` interpolates projections (`d3.geoProjectionMutator`, or resample both paths and tween), 500–830 ms ease-in-out with a 2-frame ghost.
  - `highlight` is a hard flat fill.
  - `focus` drives the camera to the bbox.
- **Reproduces:** 16, 19, 30, 34, 36–39, 47, 48, 51. With `projection:'orthographic'` and graticule, it also covers 16's globe and 33.

### W3. `SectionHeader`: tracked caps title

- **Props:** `{ text: string; at: WordAnchor /* default offset −900 ms */; x?: number /* default 960 */; y?: number /* default 122 */; variant?: 'sans'|'antiqueSerif'; exitWithCamera?: boolean }`.
- **Behaviour:** Libre Franklin 800, cap 40 px, tracking 0.32 em, #202022. It enters by **mask-reveal up**, 170–330 ms ease-out, and does not exit on its own: it leaves when the camera pushes or the shot cuts. Only one header is allowed per half-frame.
- **Reproduces:** 16, 30, 37, 48, and the header in 21/27.

### W4. `SplitCompare`: two-up comparison

- **Props:** `{ left: { header: string; content: ReactNode }; right: { header: string; content: ReactNode }; at: WordAnchor; enterFrom?: 'right'|'below' }`.
- **Behaviour:** A 1 px #C1C1C1 divider at x=960 grows top→bottom in 330 ms. Headers are centred at x 480 / 1440, y 170, and mask-reveal 170 ms. Contents rise from below 500 ms ease-out.
- **Reproduces:** 32 and 38.

### W5. `TermPlate`: black plate with italic serif

- **Props:** `{ text: string; at: WordAnchor /* default −700 ms */; position?: 'center'|'lowerOverSubject'; anchorTo?: { x: number; y: number }; exitAt?: WordAnchor }`.
- **Behaviour:** Starts as a 6 px caret, then the plate wipes left→right 330–500 ms with the text revealed by the same mask. Plate #282A32, text #EFEFEF, Playfair Display 700 italic.
  - `center`: about 140 px, plate centred on the frame.
  - `lowerOverSubject`: about 90 px, overlapping the bottom 15% of the subject (portrait).
- **Exit:** a hard cut, or a reverse wipe of 250 ms.
- **Reproduces:** 4 (name) and 7 (term).

### W6. `PortraitCutout`: archival oval portrait

- **Props:** `{ src: string; shape?: 'oval'|'rect'|'engravedOval'; name?: string; backdrop?: { src: string; opacity?: number }[]; at: WordAnchor; slideFrom?: 'pop'|'right' }`.
- **Behaviour:** Pops 0→100% in 500 ms with a 5% overshoot, or slides from the right in 500 ms ease-out. Backdrop items (equations, diagrams, old maps) fade in 330 ms afterward. A `TermPlate` is attached for the name. Ambient push 3%.
- **Reproduces:** 4, 5, 22 and 28.

### W7. `BigProblemCard`: mixed-type statement card

- **Props:** `{ parts: { text: string; style: 'serifItalic'|'heavy' ; underline?: boolean }[]; wallpaper?: 'projectionTiles'|'paper'; at: WordAnchor }`.
- **Behaviour:** Arrives inside a `WhipPan` (rotation −15°→0, blur→0, 330 ms settle). A rough 15 px border. The marker underline under the `heavy` part draws in 170 ms, anchored to **that part's own word**. Maximum 6 words.
- **Reproduces:** 13.

### W8. `GlobeOrb`: floating globe

- **Props:** `{ texture: 'satellite'|'ink'|'watercolor'; rotate: [λ,φ]; rotateTo?: { rotate; at: WordAnchor; ms?: 1500 }[]; diameter?: number; x?: number; y?: number; enter?: 'drop'|'flyIn'|'none'; tissot?: boolean; highlight?: {...}; overlays?: ReactNode }`.
- **Behaviour:** Orthographic `d3-geo` rendering with `shadow.float` underneath.
  - `drop`: 800 ms ease-out with a small settle bounce; the shadow scales in as the globe lands.
  - `flyIn`: 330 ms from bottom-right.
  - Rotations use 1–1.5 s ease-in-out.
- **Reproduces:** 20, 26, 31, 33, and the left half of 32.

### W9. `ShapeTransfer`: drag a region onto another for size comparison

- **Props:** `{ shape: GeoFeatureId; fromProjection: Proj; to: { target: GeoFeatureId | {x;y}; projection?: Proj }; at: WordAnchor; ms?: 670; style?: 'ink'|'satelliteTexture'|'ice' }`.
- **Behaviour:** Lifts a copy of the shape and translates it with ease-in-out onto the target, rescaling to the target projection's true scale. It stays as an overlay; there is no label.
- **Reproduces:** 20 (South America onto the globe), 31 (Greenland onto Africa) and 32 (right panel).

### W10. `TissotField`: indicatrix circles and ellipses

- **Props:** `{ projection: Proj; spacingDeg?: 30; radiusDeg?: 4; at: WordAnchor; sweep?: 'leftToRight'|'all'; staggerMs?: 15 }`.
- **Behaviour:** Generates true geodesic circles (`d3.geoCircle`) and projects them, so the size or shape change is real data rather than drawn by hand. Fill #B5A514 at 70% with a 2 px #E8E36A stroke. Each pops in 170 ms; the field sweeps in 500 ms.
- **Reproduces:** 33, 34, 40 and 49.

### W11. `RouteAngle`: line, dashed route and angle gauge with counter

- **Props:** `{ from: [λ,φ]; to: [λ,φ]; kind: 'rhumb'|'greatCircle'; drawAt: WordAnchor; drawMs?: 1000; angle?: { at: WordAnchor; value: number; decimals?: 1; unit?: '°' } ; zoomTo?: 'midpoint'|'gridCrossing' }`.
- **Behaviour:** A 2 px navy line draws linearly. When zoomed in, it becomes a red/black dashed line about 9 px wide. The angle adds a yellow #F2B707 reference line and an arc that grows in step with the counter. The **counter only animates to a known final value** in 830 ms ease-out, starting at about 25% of the value, never at 0, and its text is drawn only when it has a value.
- **Reproduces:** 23–26 and 27 (with the ship sprite as a child).

### W12. `MeasureTicks`: red measurement overlay

- **Props:** `{ kind: 'latitudeSpacing'|'gridCells'|'bracket'; targets?: GeoFeatureId[]; at: WordAnchor; staggerMs?: 220 }`.
- **Behaviour:** `latitudeSpacing` draws an I-beam column whose heights equal the actual Mercator parallel spacing. `gridCells` draws red right-angle cells. `bracket` draws the asymmetric open brackets (6 px) around targets in 500 ms.
- **Reproduces:** 29 and the brackets in 30.

### W13. `MediaInset` and transitions (`FootageInset`, `WhipPan`, `PaperWipe`, `BarWipe`, `InkBleed`, `RapidCollage`)

- **`FootageInset`:** `{ src; rect?: {x,y,w,h} /* default 85,50,1185,670 */; at: WordAnchor }`. A 1 px line, then a horizontal wipe of 670 ms. No border, no radius, no shadow.
- **`WhipPan`:** `{ ms: 300–650; dir; rotateDeg?: 5–20 }`. Motion blur is done by sampling 8–12 sub-frames, as Remotion `<CameraMotionBlur>` allows (https://www.remotion.dev/docs/motion-blur).
- **`PaperWipe`:** 660 ms paper sheet up.
- **`BarWipe`:** 9 px black bar, 500 ms.
- **`InkBleed`:** a luma-matte video or an SVG turbulence threshold, 2.8 s.
- **`RapidCollage`:** `{ items: src[]; beatMs: 170–420 }`.
- **Reproduces:** 3→4, 11→12, 12–15, 33→34, 35, 42, 43 and 50.

---

## 5. Rules observed (hard never / always)

### Layout and composition

1. **One idea per beat.** Each beat shows one comparison, one term, or one measurement. When the next idea starts, the previous elements leave (cut, explode, morph or wipe). **They never accumulate into a build.** The only persistent element across beats is the map itself as it morphs.
2. **Maps are full-bleed or a free-floating object on paper.** There is never a dark card, a rounded panel or a UI frame around a map. The single framed map (21) is a *physical object* (black wood-like frame), and the camera dives into it within 1.5 s.
3. **The ocean is paper; land is flat ink.** No ocean fill, no gradients, no glow and no 3D bevel in the black-and-white map system. Colour appears only as **one accent per beat** (yellow or red).
4. **Labels go in fixed slots only:** a top-centre header (y≈122), centred split headers (y≈170), a centred term plate, or a name plate on the bottom edge of a portrait.
   - **Never in corners**, never as persistent chips or badges, never as chapter tags ("ACT III"), and never over the subject's key area.
   - Header and subject never overlap: the map starts below y≈260.
   - When the camera pushes, the header leaves the frame instead of being repositioned.
5. **No chapter cards and no act labels anywhere.** Structure is signalled by a single full-frame statement card ("Here's the BIG problem:") and by a change of material (paper → archival film → screen capture).
6. **No on-screen captions or subtitles, and never more than about 4 authored words at once.** Narration carries the content; text names things.

### Timing

7. **Actions land on their keyword (±300 ms).** A line draws on "line", the angle counts on "angle", dots pop on "dots", Greenland moves on "smaller", the grid draws on "grid".
8. **Labels lead their noun by 0.1–1.3 s** (median ≈0.9 s): they appear during "this map is called the…". They never trail the noun.
9. **Cuts land on sentence starts** (within about ±500 ms), never mid-clause. The live-action and archival sections cut on physical action.

### Numbers, motion and continuity

10. **Numbers appear only when spoken, and only as the real final value.** A counter runs for under 1 s to its exact value (45.8°); there are no "0.0" placeholders and no counters that idle.
11. **Comparisons are visual transfers, not text.** Size is shown by dragging true-scale shapes onto each other or by a split "REALITY | MERCATOR". Neither uses a numeric label ("14x" is spoken only).
12. **Something moves almost always:** an ambient 2–5% camera drift on every graphic shot, a deliberate push about every 10–15 s, and a new element, morph or cut at least every ~5 s. The exception is holds under quotes or TV-clip audio.
13. **Data is real geometry.** Projections are true projections (morphed with d3-style interpolation), Tissot circles are real geodesic circles, and latitude ticks reflect the real Mercator spacing. Nothing is "illustrative polygons".
14. **Transitions carry meaning.** A morph is used when the subject changes form (globe → map, Mercator → Gall-Peters). Whip pans are used inside a "library" of items. A paper wipe or ink-bleed marks a change of material or era. Plain cross-dissolves between graphic beats are never used.
15. **Floating objects get the same soft elliptical shadow.** Flat map layers never get shadows.
16. **The palette is consistent per section.** The black-and-white paper system is used for the argument. The watercolour colour map is used only for the navigation and history section (115–154 s), and the material switch itself marks the section.

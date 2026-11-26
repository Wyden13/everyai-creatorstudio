# Map Tech for Vox-Style Animated Maps in Remotion (offline, headless)

Scope: data sources, licenses, preprocessing, projection and camera, draw-on, territory growth, labels, and texture cost. It ends with a recommended pipeline and a `<VoxMap>` API. I verified the facts marked **[verified]** in this session: I downloaded the files, inspected them and measured sizes with mapshaper 0.6.121 in the scratchpad. No repo files were changed.

---

## 0. TL;DR

1. **Don't let the LLM draw maps.** The "crude polygons inside a dark boxed card" come from the LLM writing coordinates by hand. Maps must come from real, checked-in geodata, and the LLM may only choose **which layers, which regions, which camera keyframes and which labels**, as JSON.
2. **Data stack (all offline, all checked in):**
   - Base: **Natural Earth** (public domain) for land, coastline, lakes, rivers and modern countries. Clip it to a region and store it as TopoJSON.
   - Roman Empire extent: **AWMC geodata** (ODbL-1.0) has `roman_empire_bce_60`, `roman_empire_ce_117_extent` (the maximum extent under Trajan), `roman_empire_ce_200_provinces` (province border *lines*), post-Diocletian provinces and roads with names (Via Appia and so on).
   - Time series (-500 … 2010): **aourednik/historical-basemaps** (GPL-3.0) has Rome at **-500, -400, -323, -300, -200, -100, -1, 100, 200, 300 (tetrarchy split), 400 (East/West), 500, 600**. **There is no 117 file.** Use AWMC for 117.
3. **Render model:** fit the projection once with `fitExtent`, precompute SVG path strings once, then animate the camera as a single `<g transform>`. Interpolate between keyframes with `d3.interpolateZoom` (van Wijk smooth zoom). Keep strokes constant with `vector-effect="non-scaling-stroke"`. Re-project per frame only for globe spins.
4. **Territory growth** is shown as **precomputed gain polygons** (the difference between year N+1 and year N, made with polygon-clipping during preprocessing) that fade or wipe in. Don't use flubber on complex multipolygons.
5. **Labels:** take anchors from data (polylabel) and place them with a deterministic greedy collision pass (rbush) in screen space. Overlays (act chips, titles, captions) are passed in as **obstacle rectangles**. This is the structural fix for "ACT III covers the map title".
6. **Paper look:** bake roughness into the geometry during preprocessing and overlay one pre-baked paper texture PNG with `mix-blend-mode: multiply`. Avoid live `feTurbulence` or `feDisplacementMap` on any group that moves.
7. **Asset budget for a Mediterranean/Roman pack:** about 250–300 KB raw, about 80–100 KB gzipped (measured; see §9).

---

## 1. Natural Earth (base layers)

- **License:** public domain. No attribution is required, though it is appreciated. https://www.naturalearthdata.com/about/terms-of-use/
- **Scales:** 1:10m (most detailed), 1:50m and 1:110m. https://www.naturalearthdata.com/downloads/
- **GeoJSON mirror:** https://github.com/nvkelso/natural-earth-vector (`geojson/ne_50m_land.geojson`, …)
- **Prebuilt TopoJSON:** `world-atlas@2` (ISC), https://github.com/topojson/world-atlas

**Measured [verified]:**

| File | Size |
|---|---|
| `ne_10m_land.geojson` | 10.2 MB |
| `ne_50m_land.geojson` | 1.64 MB |
| `ne_50m_coastline.geojson` | 1.64 MB |
| `ne_50m_rivers_lake_centerlines.geojson` | 827 KB |
| `ne_50m_lakes.geojson` | 876 KB |
| world-atlas `land-110m.json` | 55 KB |
| world-atlas `land-50m.json` | 546 KB |
| world-atlas `land-10m.json` | 3.1 MB |
| world-atlas `countries-110m.json` | 108 KB |
| world-atlas `countries-50m.json` | 756 KB |
| world-atlas `countries-10m.json` | 3.7 MB |

**Clipped to the Mediterranean bbox [-12,22,50,58] as TopoJSON (q=1e5) [verified]:**

| Asset | Raw | Gzipped |
|---|---|---|
| 10m land, simplified 15% | 67 KB | 24.7 KB |
| 50m land, unsimplified | 66 KB | — |
| 50m rivers | 40 KB | — |

**Which scale to use:**
- **110m** for whole-world shots.
- **50m** for continent or regional shots, such as the Mediterranean full frame.
- **10m**, clipped to the bbox, only when the camera zooms closer than about 1/8 of the world. It makes islands and coastlines crisp at 1080p.

Layers worth having: `land`, `coastline`, `lakes`, `rivers_lake_centerlines` (Rhine and Danube for the limes), `geography_marine_polys` (sea names), `admin_0_countries` (modern "today" overlay) and `populated_places` (with `scalerank` for label priority).

**Caveat:** NE coastlines are modern. Ancient shorelines differ, for example Ravenna, Ephesus and the Nile delta. AWMC's `Physical Data/shoreline` is an ancient-world alternative where accuracy matters.

---

## 2. Historical boundaries

### 2a. aourednik/historical-basemaps [verified]

- Repo: https://github.com/aourednik/historical-basemaps. **License: GPL-3.0.**
- Files are `geojson/world_<year>.geojson`, with BC years written as `world_bc200.geojson`. `index.json` lists the years and the countries in each.
- Properties: `NAME`, `ABBREVN`, `SUBJECTO` (the ruling power, which is right for choropleth colour), `PARTOF`, and `BORDERPRECISION` (1 = approximate, 2 = moderately precise, 3 = fixed by international law). The README suggests showing uncertainty with blur or opacity.
- **Rome entries, read from `index.json`:**

| Year | Entity name(s) |
|---|---|
| -500 | "Rome" |
| -400 | "Roman Republic" |
| -323 | "Rome" |
| -300 | "Roman Republic" |
| **-200** | **"Rome" ✔** |
| -100 | "Roman Republic" |
| **-1** (file `world_bc1`, use it for year 1) | **"Roman Empire" ✔** |
| **100** | **"Roman Empire" ✔** |
| **117** | **✘ no file** |
| **200** | **"Roman Empire" ✔** |
| 300 | "Rome (Constantinus/Diocletianus/Galerius/Maximian)", the tetrarchy split |
| **400** | **"Western Roman Empire" + "Eastern Roman Empire" ✔** |
| 500 / 600+ | West/East, then Eastern Roman Empire, then "Byzantine Empire" from 800 |

- All Roman features have `BORDERPRECISION: 1` (approximate).
- Each `world_*.geojson` is about 1.1–1.2 MB. A single Roman MultiPolygon is about 60 KB. Simplified to 8% it is about 2.5 KB, which is too coarse. The sweet spot is about 15–30%.
- **GPL-3.0 implications:** redistributing the derived GeoJSON inside our repo means keeping it GPL-3.0 with attribution. Keep it in its own `assets/geo/historical-basemaps/` folder with a LICENSE file. Rendered videos are output, not a derivative program. This is the common reading, but it is not legal advice. Prefer AWMC (ODbL) for Roman maps and use historical-basemaps for coverage of other eras.
- **Accuracy:** the author says it is "a work in progress" at world or continent precision. Its coastlines don't match NE, so **clip it to NE land** during preprocessing so the coastline is consistent.

### 2b. AWMC (Ancient World Mapping Center, UNC) [verified]

- Repo: https://github.com/AWMC/geodata. **License: ODbL-1.0** per the GitHub license API. The AWMC *published map images* are CC BY-NC 4.0, but the *data repo* is ODbL. See https://awmc.unc.edu/gis-data/
- `Cultural-Data/political_shading/`:
  - `roman_empire_bce_60` (204 KB, 74 polygons)
  - `roman_empire_ce_117_extent` (564 KB, 112 polygons). After dissolve plus 20% simplification it is **36 KB** [verified].
  - `roman_empire_ce_200_provinces` (226 KB). These are **LineStrings of province borders without names**, so use them as internal hairlines. As TopoJSON at 20% they are **27 KB**.
  - `roman_empire_provinces post_diocletian`, `senatorial_province`, `alexanders_empire`, `persian_extent`, `hasmonean`, `herod`
- `Cultural-Data/roads/roads.geojson` is 5.3 MB with 3,166 MultiLineStrings. Fields include `Name` (for example "Via Appia", "Via Flaminia", "Via Aurelia" and "Via Traiana Nova") and `Major_or_M` ("1" for 1,228 major roads).
  - Major roads only, fields stripped, 5% simplification, TopoJSON q=1e4: **171 KB raw / 38 KB gzipped** [verified].
- Also available: `aqueducts`, `canals`, `walls` (Hadrian's Wall), `urban_areas`, and `Physical Data/shoreline|inland_water|open_water_*`, which are ancient physical geography.
- ODbL obligations: attribute "© Ancient World Mapping Center, ODbL". A *Produced Work* such as a video only needs the attribution notice. Put it in the end card.

### 2c. Other sources

- **Itiner-e** (2024–2025) is the best Roman road network, about 299,000 km, at roughly 150 CE.
  - Paper: Scientific Data, DOI 10.1038/s41597-025-06140-z (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12592351/)
  - Data: https://zenodo.org/records/17122148 (about 264 MB)
  - The site says CC BY 4.0 (https://www.itiner-e.org/about). Check the Zenodo record before you rely on that.
  - Use it only if AWMC roads are too sparse. It is large, so filter to major roads during preprocessing.
- **Pleiades** (https://pleiades.stoa.org) is a gazetteer of ancient places with coordinates. It is CC BY 3.0 per the site footer; confirm before use. Use it for city points and label anchors, such as Roma, Carthago and Byzantium. Bulk dumps are at https://pleiades.stoa.org/downloads.
- **DARMC** (Harvard, https://darmc.harvard.edu) has roads, shipwrecks, mines and provinces as shapefiles. I could not confirm its license this session. Treat it as reference only until you check.
- **OpenHistoricalMap** (https://www.openhistoricalmap.org) is CC0 but uneven for antiquity.
- **CShapes 2.0** covers 1886–2019 state borders and suits modern-history videos (https://icr.ethz.ch/data/cshapes/). Its license is non-commercial, so check it.

**Recommendation for Roman videos:**
- AWMC for the 117 extent, the 60 BCE extent, province lines and roads.
- historical-basemaps for -200, -100, -1, 100, 200, 300, 400 and 500 (growth and split sequences).
- Pleiades for cities.
- NE for land, sea and rivers.

---

## 3. Projection and fitting (d3-geo 3.1.2, ISC)

- Docs: https://d3js.org/d3-geo/projection
- `projection.fitExtent([[x0,y0],[x1,y1]], geojson)` sets scale and translate so the GeoJSON fills the box. `fitSize([w,h], obj)` is shorthand.
- Vox-like regional choices:
  - **Mediterranean:** `geoConicConformal().parallels([30,50]).rotate([-15,0])` or `geoAzimuthalEqualArea().rotate([-15,-40])`. Both are low-distortion and look "atlas-like".
  - **World:** `geoNaturalEarth1` (in core d3-geo). Equal Earth (`geoEqualEarth`) is also fine.
  - **Globe:** `geoOrthographic` with `rotate` and `clipAngle(90)`.
- Fit **once**, to the widest extent the scene will ever show (the "world frame") with a margin. Precompute every path string in a `useMemo` at module or composition scope. Remotion renders frames in parallel tabs, so that cost is paid once per tab, not per frame.

```ts
// geo/project.ts  (pure; called once per composition)
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
export const buildProjection = (W: number, H: number, frameExtent: GeoJSON.Feature) =>
  geoConicConformal().parallels([30, 50]).rotate([-15, 0])
    .fitExtent([[0, 0], [W, H]], frameExtent);
export const toPaths = (topo: any, obj: string, proj: any) => {
  const path = geoPath(proj).digits(1);               // d3-geo ≥3.1: fewer chars
  return (feature(topo, topo.objects[obj]) as any).features
    .map((f: any) => ({ id: f.id ?? f.properties?.NAME, d: path(f) ?? '' }));
};
```

---

## 4. Camera fly-to and zoom

| Approach | Per-frame cost | Quality | Use for |
|---|---|---|---|
| **SVG `<g transform>` over precomputed paths** | ~0 (compositor transform of an SVG) | Strokes scale unless `vector-effect="non-scaling-stroke"`; 10m data needed if zoom > 8× | **Default:** regional pans and zooms |
| Re-project per frame (`projection.scale/translate/rotate` → new `d`) | O(vertices) per frame, about 5–30 ms for 50k pts | Exact; resampling adapts to zoom | Globe rotation, or a projection change while zooming |
| Raster tiles (Mapbox and similar) | Network | Photo-real | **Not allowed:** offline-only, and not the Vox look |

**Camera keyframes as bboxes.** The LLM emits `{at: "word:42", bbox: [[lon0,lat0],[lon1,lat1]]}`. We convert each bbox to a view `[cx, cy, w]` in projected pixels. Between keyframes we use **`d3.interpolateZoom`** (van Wijk & Nuij 2003, "Smooth and efficient zooming and panning"; https://d3js.org/d3-interpolate/zoom). It zooms out, pans, then zooms back in, which is the classic map fly-to. The function also returns a recommended `duration`, which can be checked against the narration window.

```ts
// geo/camera.ts  (pure)
import { geoPath } from 'd3-geo';
import { interpolateZoom } from 'd3-interpolate';
export type View = [cx: number, cy: number, w: number];
export const bboxToView = (proj: any, [[a, b], [c, d]]: [[number, number], [number, number]], W: number, H: number, pad = 0.12): View => {
  const ring = { type: 'Polygon', coordinates: [[[a, b], [c, b], [c, d], [a, d], [a, b]]] } as any;
  const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(ring);
  const w = Math.max(x1 - x0, (y1 - y0) * (W / H)) * (1 + pad);
  return [(x0 + x1) / 2, (y0 + y1) / 2, w];
};
export const viewToTransform = ([cx, cy, w]: View, W: number, H: number) => {
  const k = W / w;
  return `translate(${W / 2 - k * cx},${H / 2 - k * cy}) scale(${k})`;
};
export const cameraAt = (keys: { frame: number; view: View }[], f: number, ease: (t: number) => number) => {
  const i = Math.max(0, keys.findLastIndex(k => k.frame <= f));
  const a = keys[i], b = keys[i + 1];
  if (!b) return a.view;
  const t = ease(Math.min(1, (f - a.frame) / (b.frame - a.frame)));
  return interpolateZoom.rho(1.2)(a.view, b.view)(t) as View;
};
```

- Use `Easing.inOut(Easing.cubic)` from Remotion, or `Easing.bezier(0.65,0,0.35,1)`.
- Vox camera moves are slow, about 1.5–3 s, and land on a held frame. Add a slow "Ken Burns" drift of 1–2% scale over the hold so the map never looks frozen.
- **LOD:** keep two path sets, 50m and 10m-clipped, and cross-fade to 10m when `k > 4`.

---

## 5. Stroke draw-on (routes, borders, roads, rivers)

- **`@remotion/paths` `evolvePath(progress, d)`** (MIT, v4.0.547, https://www.remotion.dev/docs/paths/evolve-path) returns `{strokeDasharray, strokeDashoffset}` [verified]. It computes the length in JS, so it is deterministic and correct in headless renders.
- On a scaled `<g>`, the dash lengths are in **user units of the path**. With `vector-effect="non-scaling-stroke"`, Chromium applies the dash pattern in screen space. **Do not combine** non-scaling-stroke with dash draw-on on a zooming group. Either draw-on in a non-zooming segment, or render the route in a separate overlay `<svg>` re-projected each frame. A route is only a few hundred points, so that is cheap.
- **Vox route grammar:**
  - A solid 3–4 px line draws on with an ease-out.
  - A leading dot or arrowhead rides the tip. Use `getPointAtLength` and `getTangentAtLength` from `@remotion/paths`.
  - A soft glow sits under the line: a duplicate path, 3× width, 25% opacity. That is cheap; use no blur filter.
  - City dots pop with a spring as the tip passes each city's arc-length position. Precompute those positions.
- For great-circle routes, interpolate with `d3.geoInterpolate(a,b)` or let `geoPath` handle LineStrings, which resample along great circles automatically.

```tsx
const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
const tip = getPointAtLength(d, getLength(d) * p);
<path d={d} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round"
      strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
<circle cx={tip.x} cy={tip.y} r={7} fill={ACCENT} />
```

---

## 6. Territory growth over time

**Don't morph multipolygons with flubber.** flubber 0.4.2 (MIT, https://github.com/veltman/flubber) works well for single rings. With empires (islands, holes, Sicily, Crete), `interpolateAll` or `combine` produces smeared, self-intersecting "goo" mid-frame, which is a large part of the "all over the place" look. It is fine for a country silhouette morphing into an icon.

**Recommended approach: precomputed gain and loss polygons, generated during preprocessing.**

```
gain[N] = difference(empire[N+1], empire[N])   // polygon-clipping (MIT) or turf.difference
loss[N] = difference(empire[N], empire[N+1])
```

At render time:
- **Base** shows `empire[N]` in a solid fill.
- **Gains** fade in, or wipe radially from the capital: a `<clipPath>` circle centred on Rome with a radius tied to the frame. They flash with the accent colour, then settle to the base fill.
- **Losses** desaturate and fade out.
- Optionally show a year counter, using Vox-style tabular numerals, that ticks with `interpolate(frame, …)`.

This is deterministic, cheap and *accurate*: every pixel comes from a real dataset year. Alternatives:
- Simpler: cross-fade full year shapes over about 12 frames, stacking two `<path>`s.
- Smoother: a mask reveal of year N+1 with a feathered radial gradient mask. Masks with gradients are cheap, unlike turbulence.

`d3-interpolate-path` (BSD-3) works for line paths such as frontier lines, not for filled multipolygons.

---

## 7. Label placement and collision (fixes the "ACT III over map title" class of bug)

**Root cause:** today every element self-positions in absolute coordinates the LLM made up. There is no shared layout authority. The fix is structural.

1. **A frame layout owns reserved zones.**
   - `chrome.topLeft` (act chip), `chrome.title`, `chrome.captions` (bottom 18%) and the title-safe margins are rectangles defined in a theme constant.
   - Every widget, including `<VoxMap>`, receives `obstacles: Rect[]`. The map itself uses the full bleed (no card, no box) and labels avoid the obstacles.
   - The act chip and the map title may never be co-scheduled in the same zone. That is a validator rule on the scene plan, not something the LLM has to remember.
2. **Anchors come from data, never from the LLM:**
   - Polygons use `polylabel` (mapbox, ISC; the pole of inaccessibility, https://github.com/mapbox/polylabel), computed during preprocessing and stored in the asset.
   - Points use Pleiades or NE coordinates.
   - Seas use NE `geography_marine_polys` label points, set in italics and letter-spaced.
3. **Placement is a deterministic greedy pass, per camera keyframe, in screen space.**
   - Sort labels by priority (LLM-given importance, then NE `scalerank`).
   - Try 8 candidate positions (N, NE, E, …) per point label.
   - Accept the first position whose bbox doesn't intersect accepted labels or obstacles. Use **rbush** (MIT, v4.0.1) for the intersection test.
   - Measure text with a fixed-metric font. Remotion `measureText` from `@remotion/layout-utils` is deterministic.
   - Results are a pure function of (keyframe, labels), so the same placement appears in every parallel render tab.
4. **labelgun** (MIT 6.1.0, https://github.com/Geovation/labelgun) does exactly that priority-based hide-on-collision. It is acceptable, but rbush plus about 40 lines is flatter and more transparent, which fits caveman-code rules.
5. **d3-force label layout:** avoid it. It is iterative and only deterministic if you fix the tick count and seed, and it jitters between keyframes.
6. **Between keyframes,** labels are positioned by `transform` with the camera, at a counter-scaled font size (`fontSize / k`). Labels that lose placement at the next keyframe fade out over 8 frames, and new ones fade in. Labels never jump.

---

## 8. Watercolor and paper texture: SVG filter cost in headless Chromium

- `feTurbulence` (Perlin noise) and `feDisplacementMap` run on the **CPU in Skia** in software-raster headless Chromium. Chromium has to re-run the filter **every frame the filtered subtree or its transform changes**. A filtered `<g>` that pans or zooms means full-resolution noise and displacement per frame. On 1920×1080 with `numOctaves=4`, expect tens to hundreds of ms per frame, depending on filter region size. This was not benchmarked precisely here: a quick one-frame `chromium --headless --screenshot` test showed startup-dominated times of about 0.5–0.7 s for all variants, which is inconclusive per frame. Measure with `npx remotion benchmark` before adopting any live filter.
- Remotion's own guidance is to avoid expensive CSS and SVG filters and to use `--gl=angle` or `swangle`. See https://www.remotion.dev/docs/performance and https://www.remotion.dev/docs/gl-options.

**The cheap way to get the same look:**
1. **Bake roughness into the geometry.** In preprocessing, densify coastlines and borders slightly (mapshaper `-densify` or turf), then jitter vertices with seeded 1-D noise along the line. That gives a hand-inked wobble at zero runtime cost.
2. **Use a paper texture as an image.** Ship one 1920×1080 (or 2560×1440) paper or grain JPEG/WebP, either a CC0 texture or one rendered once from feTurbulence into a still. Overlay it full-frame with `mix-blend-mode: multiply` at 20–35% opacity. It is static, so the compositor handles it cheaply. Size is about 150–400 KB as WebP.
3. **Use an inner shadow along the coast** ("land lifts off the sea", very Vox): a second copy of the land path with a wide sea-coloured stroke at low opacity, behind the land. Use no `feGaussianBlur`. If blur is wanted, apply it once to a **static, non-transforming** layer, or pre-render the land as a PNG at 2× and pan that image.
4. If live `feTurbulence` is used, restrict it to a **small filter region** on a **static** element, with `numOctaves ≤ 2` and a fixed `seed`. Animating the seed gives "boiling" lines; do it only for brief beats.

**Vox palette direction** (one style; tune against the reference frames from the Vox trace task):
- Warm off-white or cream paper land, a muted desaturated blue-grey sea and a thin dark warm-grey coastline.
- The focus region is filled with *one* saturated accent; everything else is muted.
- Use a condensed sans for country names in caps and letter-spaced, and italic serif or sans for seas.
- No dark boxed card behind maps: the map *is* the frame.

---

## 9. Size reduction: mapshaper vs topojson-simplify

- **mapshaper** (MPL-2.0 CLI, 0.6.121; https://github.com/mbloch/mapshaper) is the right tool. It does clip, dissolve, simplify (Visvalingam or DP), `keep-shapes`, `filter-fields`, topology-preserving output and TopoJSON quantization. It runs in Node, so add it as a devDependency in a `scripts/geo-build.ts`. Use `-simplify ... keep-shapes` so small islands don't vanish. Tune the percentage per zoom level.
- **topojson-server / -simplify / -client** (ISC, 3.x) are the programmatic alternative. TopoJSON shares arcs between neighbours, so borders never gap or overlap when simplified. That is also why province lines and empire fills stay aligned.

**Measured outputs [verified, mapshaper 0.6.121]:**

| Asset | Raw | Gzipped |
|---|---|---|
| Mediterranean land 10m (clipped, 15%, q1e5) | 67 KB | 24.7 KB |
| Mediterranean rivers 50m (clipped) | 40 KB | — |
| Rome 117 extent (AWMC, dissolved, 20%) | 36 KB | — |
| Rome province lines 200 CE (AWMC, 20%, topo) | 27 KB | — |
| Roman major roads with names (AWMC, 5%, topo q1e4) | 171 KB | 38 KB |
| Rome year shape (historical-basemaps, clipped to NE 10m land, 30%) | 15 KB per year | — |
| Rome years -200 … 500 (9 years × ~15 KB) | ~135 KB | — |
| Whole `world_100` (historical-basemaps, 10%, topo) | 146 KB | — |

**Roman pack total:** about 330–480 KB raw, about 100–140 KB gzipped. That is small enough to commit and bundle through esbuild JSON imports, with no fetch and no `delayRender`.

---

## 10. Recommended pipeline

```
backend/worker-agents/
  scripts/geo-build.ts        # one-off, deterministic; run manually, outputs committed
  assets/geo/
    LICENSES.md               # NE (PD), AWMC (ODbL), historical-basemaps (GPL-3.0), Pleiades (CC BY)
    world/land-110m.topo.json, countries-110m.topo.json
    regions/mediterranean.topo.json   # objects: land10, land50, lakes, rivers, seas(label pts)
    eras/rome.topo.json               # objects: y_-200,y_-100,y_-1,y_100,y_117,y_200,y_400W,y_400E,
                                      #          gain_*,loss_*, provinces200, roads_major
    places/ancient.json               # [{id,name,lon,lat,rank}]  from Pleiades
    labels/rome.json                  # polylabel anchors per object
    textures/paper-1920.webp
  src/remotion/vox/
    VoxMap.tsx  camera.ts  labels.ts  palette.ts
```

### 10a. Preprocessing (`scripts/geo-build.ts`, run with Bun)

Steps, each one explicit:
1. Download pinned commits of NE, AWMC and historical-basemaps into a cache directory. Check `sha256`.
2. **Region clip:** `mapshaper ne_10m_land -clip bbox=<region> -simplify 15% keep-shapes`, and the same for the 50m layer.
3. **Era shapes:** filter `NAME` with a regex, `-clip` to the NE 10m land for that region (so coastlines match exactly), then dissolve and simplify 30%.
4. Gains and losses with polygon-clipping `difference`, consecutive years.
5. Label anchors with polylabel.
6. Geometry roughening: seeded jitter on coastline and frontier lines only.
7. Combine with topojson-server into one topology per pack and quantize with `1e5`.
8. Write the size report and fail if a pack exceeds its budget (for example 600 KB raw).

```bash
mapshaper ne_10m_land.geojson -clip bbox=-12,22,50,58 -simplify 15% keep-shapes \
  -rename-layers land10 -o format=topojson quantization=1e5 med_land10.topo.json
mapshaper world_100.geojson -filter '/Roman/.test(NAME)' -clip med_land10.topo.json \
  -dissolve -simplify 30% keep-shapes -filter-fields NAME -o format=geojson precision=0.001 rome_100.json
mapshaper awmc_roads.geojson -filter 'Major_or_M=="1"' -filter-fields Name -simplify 5% \
  -o format=topojson quantization=1e4 roads_major.topo.json
```

### 10b. `<VoxMap>` API: a declarative spec the LLM fills, validated by a schema in `shared/`

```ts
// shared/schemas/vox-map.schema.json  ->  zod in worker
type VoxMapSpec = {
  pack: 'world' | 'mediterranean';            // enum of checked-in packs (no free coords)
  projection: 'conic-med' | 'natural-earth' | 'orthographic';
  layers: Array<
    | { kind: 'base' }                                    // land+sea+coast+rivers from pack
    | { kind: 'region'; object: string; style: 'focus' | 'muted' | 'hatch' }  // e.g. 'rome.y_117'
    | { kind: 'growth'; from: string; to: string; origin: [number, number] } // uses gain_*/loss_*
    | { kind: 'route'; object: string; draw: { start: Cue; end: Cue } }      // roads_major#Via Appia
    | { kind: 'points'; ids: string[]; pop: Cue }                            // Pleiades ids
  >;
  camera: Array<{ at: Cue; bbox: [[number, number], [number, number]] | { fit: string } }>;
  labels: Array<{ ref: string; text?: string; priority: 1 | 2 | 3; at: Cue }>;
  counter?: { from: number; to: number; unit: 'year' | 'km2'; format: 'BC/AD' | 'compact' };
};
type Cue = { word: number } | { sec: number };   // resolved to frames from narration timestamps
```

```tsx
// src/remotion/vox/VoxMap.tsx (sketch)
export const VoxMap: React.FC<{ spec: VoxMapSpec; cues: ResolvedCues; obstacles: Rect[] }> = ({ spec, cues, obstacles }) => {
  const frame = useCurrentFrame(); const { width: W, height: H } = useVideoConfig();
  const geo = useMemo(() => buildScene(spec, W, H), [spec, W, H]);     // projection + path strings + label anchors
  const keys = useMemo(() => spec.camera.map(c => ({ frame: cues.frameOf(c.at), view: geo.viewOf(c.bbox) })), [spec, geo]);
  const view = cameraAt(keys, frame, Easing.inOut(Easing.cubic));
  const placed = useMemo(() => placeLabelsPerKey(geo, keys, spec.labels, obstacles), [geo, keys, obstacles]);
  return (
    <AbsoluteFill style={{ background: PALETTE.sea }}>
      <svg width={W} height={H}>
        <g transform={viewToTransform(view, W, H)}>
          {geo.layers.map(l => <Layer key={l.id} layer={l} frame={frame} k={W / view[2]} />)}
        </g>
        <Labels placed={placed} frame={frame} view={view} />
      </svg>
      <Img src={staticFile('textures/paper-1920.webp')} style={{ position: 'absolute', inset: 0, mixBlendMode: 'multiply', opacity: 0.28 }} />
    </AbsoluteFill>
  );
};
```

**Validation at the boundary** (caveman rule 4):
- `object`, `ids` and `pack` must exist in the asset manifest.
- Camera bboxes must sit inside the pack extent.
- Cues must be within the narration duration.
- `counter.to` must be greater than 0 when the unit is `km2`. This catches the "0.0M km2" class of bug, together with a formatter that rejects zero for area units.
- No field accepts raw SVG path data or coordinates for polygons.

---

## 11. Why this fixes the observed failures

| Symptom | Cause | Fix here |
|---|---|---|
| Crude polygons in a dark card | LLM-authored coordinates and a card wrapper | Only checked-in NE/AWMC/HB geometry; full-bleed map; LLM picks object ids |
| "ACT III" chip over the map title | No layout authority | Reserved chrome zones passed as `obstacles`; greedy collision; validator forbids zone conflicts |
| Visuals out of sync with narration | Absolute frames guessed from 40 timestamps | Every camera key, draw-on and label uses a `Cue` (word index) resolved against full timestamps |
| Slides accumulate | Elements never leave | Each layer has an explicit lifecycle, `Entering → Held → Exiting`, from cues |
| "0.0M km2" counter | Unvalidated numbers | Schema plus formatter checks; area can come from `d3.geoArea` × R² of the actual polygon, so the number matches the shape |

---

## Sources

- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/ · downloads: https://www.naturalearthdata.com/downloads/ · GeoJSON: https://github.com/nvkelso/natural-earth-vector · world-atlas: https://github.com/topojson/world-atlas
- historical-basemaps: https://github.com/aourednik/historical-basemaps (GPL-3.0; `index.json` read directly)
- AWMC geodata: https://github.com/AWMC/geodata (ODbL-1.0) · https://awmc.unc.edu/gis-data/
- Itiner-e: https://www.itiner-e.org/about · https://zenodo.org/records/17122148 · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12592351/
- Pleiades: https://pleiades.stoa.org · DARMC: https://darmc.harvard.edu · OpenHistoricalMap: https://www.openhistoricalmap.org · CShapes: https://icr.ethz.ch/data/cshapes/
- d3-geo: https://d3js.org/d3-geo · d3 zoom interpolation: https://d3js.org/d3-interpolate/zoom (van Wijk & Nuij, "Smooth and efficient zooming and panning", InfoVis 2003)
- @remotion/paths evolvePath: https://www.remotion.dev/docs/paths/evolve-path · Remotion performance: https://www.remotion.dev/docs/performance · GL options: https://www.remotion.dev/docs/gl-options
- mapshaper: https://github.com/mbloch/mapshaper · topojson: https://github.com/topojson/topojson-simplify
- flubber: https://github.com/veltman/flubber · polylabel: https://github.com/mapbox/polylabel · labelgun: https://github.com/Geovation/labelgun · rbush: https://github.com/mourner/rbush · polygon-clipping: https://github.com/mfogel/polygon-clipping
- npm versions checked 2026-11-24: d3-geo 3.1.2, topojson-* 3.x, flubber 0.4.2, labelgun 6.1.0, @remotion/paths 4.0.547, polygon-clipping 0.15.7, rbush 4.0.1, @turf/turf 7.4.0, mapshaper 0.6.121.

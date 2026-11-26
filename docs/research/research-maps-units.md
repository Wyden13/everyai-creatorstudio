# Research: world map catalog and richer units for the Vox engine

Scope: `backend/worker-agents` (Vox style). Research only, no repo files changed. Facts marked **[measured]** were produced in this session (downloads and mapshaper 0.6.121 / d3-geo runs in the scratchpad, `scratchpad/dl/`). Facts marked **[web]** come from project pages or search results fetched this session. Facts marked **[recall]** are from memory and need a check at build time. Licence readings are engineering notes, not legal advice.

---

## 0. How the current system works (what the new catalog must fit)

**Geo (read from `src/vox/geo-manifest.ts`, `geo.ts`, `scripts/geo-build.ts`, `timing.ts`, `VoxVideo.tsx`):**

- `geo-manifest.ts` is the closed vocabulary: `MAP_LAYERS` (5 layers, each `{kind, label, origin}`), `PLACES` (25 rows `{name, at:[lon,lat]}`, names are ancient: "Londinium"), `MAP_VIEWS` (8 bboxes), plus `PACK_CLIP` and `PACK_EXTENT`.
- `beat-sheet.ts` builds zod enums from those tables (`ids(PLACES)`), so the LLM cannot name anything else. The map shot has `view`, `layers[≤3]`, `labels[≤4]`, `circle`, `arrow`, `armies[≤2]`.
- The screenplay prompt lists every view, place and layer inline (`screenplay.ts` lines 88-91) and says "if the topic is not about the Mediterranean world, do not use map shots". This is the prompt-size problem at 1000s of places.
- `geo.ts` fits ONE module-level projection (`geoConicConformal`, parallels 34/50, rotate -18) into the fixed 1920x1080 world, precomputes SVG path strings (`land`, one per layer), place points and view boxes, caches per process. Every aspect frames this one world through `viewOf()`. `clampToData` zooms a view in until the whole frame lies inside `PACK_CLIP` (the data has ragged clipped edges).
- `GeoScene` is a plain object that ends up in the Remotion `Timeline` input props: all path strings travel to the renderer as JSON. `VoxVideo.tsx` draws `geo.land` twice (sea halo + fill), each layer as a path with `mixBlendMode: multiply`, strokes with `vectorEffect="non-scaling-stroke"`, and moves one camera `<g transform>`.
- Pack today: `assets/geo/mediterranean.topo.json`, 94 KB, 1434 arcs, objects: land (1 geometry), rome_bce60, rome_ce117, rome_west_395, rome_east_395 (1 each), provinces_late (96). Built by `scripts/geo-build.ts` from pinned, sha256-checked sources (world-atlas land-50m, three AWMC GeoJSONs) with mapshaper, budget check 600 KB.
- Licences today (`src/vox/README.md`): Natural Earth via world-atlas is public domain / ISC; AWMC is ODbL (attribution "Ancient World Mapping Center"). Attribution is NOT on screen (project rule: no source lines on screen); it has to live in the video description / credits.

**Numbers (read from `format.ts`, `beat-sheet.ts`, `timing.ts`):**

- `NUMBER_UNITS = percent, people, soldiers, km2, years, count, usd, year`; `UNIT_SPEC` row = `{prefix, suffix, count}`; `MAGNITUDES` = billion, million (below that, full digits with grouping). `figureParts` returns `{main, unit}` (big glyphs + small words line). A count-up formats with the TARGET's magnitude. `year` swaps instead of counting.
- Schema: `number` shot has `value: z.number().positive()`, `unit`, `label`, `at` (phrase spoken verbatim), optional `compare {value, unit?, label, at}`. The `units` shot is a DIFFERENT thing: a grid of 4-100 squares split into 1-3 labelled groups (pictogram of "people"); the name collides with `NUMBER_UNITS` in conversation, so I call it the pictogram shot below.
- `timing.ts` `alignUnits` makes a spoken number ONE alignment unit keyed by value, so "five million", "5 million", "5,000,000" all match. Number words handled: zero-ninety, hundred, thousand, million, billion, "a" before multiplier, "point" fractions, digit groups, year pairs ("fourteen fifty-three"). Not handled: "trillion", ordinals, "oh" years ("nineteen oh five"), negatives, "percent" is just a following word token. British/American spelling is folded ("kilometres" = "kilometers").
- There is no rule today that `number.value` agrees with the number spoken in the narration. The phrase `at` is only checked to be spoken verbatim.
- The harness has only Anthropic SERVER tools (`web_search`); there is no client-side function-calling loop in `providers.ts`. The screenplay harness is "ask, validate, feed all violations back, retry" (`runScreenplay` loop in `screenplay.ts`). That loop is the natural place for a code-side resolver.

---

## 1. World map catalog

### 1.1 Data sources compared

| Source | What | Licence / attribution | Size we would ship **[measured]** unless noted | Accuracy and caveats | Update cadence |
|---|---|---|---|---|---|
| **Natural Earth** (NE) 1:110m / 50m / 10m | Land, countries (admin-0), admin-1 provinces/states, populated places (7.3k at 10m), rivers, lakes, disputed areas | **Public domain** **[web]**; attribution not required, "Made with Natural Earth" optional. A few themes carry third-party licensed inputs "for the sole purpose of creating a world base map" (still PD to us). Place names from Wikidata are CC0 **[web]** | 50m countries, TopoJSON q=1e5: **749 KB raw, 281 KB at 30% simplify, 169 KB at 15%** (31.6k vertices at 30%). 50m admin-1: only 294 features (just the big federations), 210 KB at 30%. **10m admin-1 (4,596 features, whole world): 1.81 MB at 10%, 1.44 MB at 5%, 1.29 MB at 3%** (98k vertices at 5%). 50m rivers 130 KB at 30%. 50m populated places: 1,251 points | Cartographic, generalised; de facto borders by default; coastlines modern | Irregular, years apart. world-atlas redistributes 4.1.0 (2018); worldview (POV) variants only exist from 5.0 (Dec 2021), so build from `nvkelso/natural-earth-vector` pinned tag, not world-atlas |
| **world-atlas** (npm) | Prebuilt NE 4.1.0 TopoJSON, country `id` = ISO 3166-1 numeric | ISC (NE data PD) **[web]** | countries-110m 108 KB, 50m 756 KB, 10m 3.7 MB; land-50m 546 KB | Old NE version, no worldviews | Frozen |
| **us-atlas** | US states/counties from Census TIGER, TopoJSON, FIPS ids, has pre-projected Albers (`states-albers-10m`) | ISC; underlying Census data is US public domain **[recall]** | states-10m **115 KB**, counties-10m 842 KB **[measured]** | Census-grade, includes AK/HI (use `geoAlbersUsa`) | Rare |
| **geoBoundaries** (gbOpen, ADM0..ADM5) | Open admin boundaries for ~200 countries at ADM0-5, "simplified" collection | **CC BY 4.0 (or ODbL)** **[web]**; attribution "geoBoundaries" with link; in films/products put it in credits/help menu, include the full web address if the link is not clickable | Not measured; ADM1/ADM2 world is far larger than NE (tens of MB raw). Needed only for sub-national detail NE lacks (counties, districts) | Per-country source records with per-boundary licences ("check each boundary's source licence" **[web]**); consistent treatment of disputed areas | Numbered releases |
| **Cliopatria** (Seshat) | 3400 BCE to 2024 CE polity polygons, ~13k rows (13,246 **[measured]**), ~1,600-1,800 entities; fields `Name, FromYear, ToYear, Area, Type (POLITY/RELATION), Wikipedia, Wikidata (QID), SeshatID, Components, MemberOf` | **CC BY 4.0** (LICENSE.md fetched **[measured]**); paper CC BY 4.0 | Download 47 MB zip / 177 MB GeoJSON. One year slice, 20% simplify, TopoJSON: **1914: 84 polities, 84 KB; 1500: 140 polities, 77 KB** (vs 234/150 KB unsimplified). Whole-world path as SVG at 1920x1080: ~95 KB (1914), ~50 KB (1500) | Hand-redrawn from 508 map images (Tollefson 2014), "necessarily approximate", polygons smoothed to 0.07 deg, alignment with coastlines imperfect, disputes and uncertainty not encoded **[web]**. Names in parentheses are RELATION rows (e.g. "(British Empire)" = overlord/nominal). Overlapping/duplicate polity rows per year must be dissolved by a rule. Wikidata QIDs are on every row (huge win for a resolver) | Active: v0.2.2 published 2026-11-25 **[measured]** |
| **aourednik/historical-basemaps** | 53 year snapshots, bc123000 to 2010 (e.g. 1880, 1914, 1920, 1938, 1945, 1960, 1994, 2000, 2010) | **GPL-3.0** repo licence; README names inputs CShapes, Euratlas, Geacron, Old Maps Online, AWMC etc. "collected, adapted and converted from diverse sources" **[web]** so provenance is mixed and unclear | 1914: 1.32 MB raw GeoJSON, 124 KB TopoJSON at 30%, 80 KB at 15%. Property `BORDERPRECISION` 1-3, `NAME`, `SUBJECTO`, `PARTOF`, no QIDs | "Work in progress", world/continent precision, verify before academic use **[web]** | Slow, last push 2026-11-02 |
| **CShapes 2.0** | State borders 1886-2019, very good for modern history | **CC BY-NC** (ETH record says NC 4.0, Essex copy NC 3.0; no SA) **[web]**. **Not usable for monetised YouTube** | n/a | n/a | n/a |
| **OpenHistoricalMap** | OSM-style history | CC0 **[recall, as in map-tech.md]**; very uneven coverage | n/a | n/a | n/a |
| **GeoNames** | Gazetteer. cities15000 (~25k records), cities5000 (~50k), cities1000 (~130k), alt names, admin codes, population | **CC BY 4.0** **[web]**, "as is" | tab-delimited; cities15000 trimmed to our columns about 1 MB **[estimate]** | Crowd-edited, good coverage, many alt names (good for aliases) | Daily |
| **Wikidata** | QIDs, labels, aliases, coordinates, inception/dissolution dates | **CC0** **[recall]** | n/a (build-time only) | Best cross-reference key between all sources above | Live |
| **OSM / Nominatim** | Full-detail geocoder | **ODbL**; public Nominatim usage policy forbids bulk/automated heavy use **[recall]** | n/a | Overkill for 7k-30k places we can bake | n/a |
| **AWMC / Pleiades** (already used / ancient) | Ancient Mediterranean | ODbL / CC BY 3.0 **[recall]** | already in pack | keep as is, see `map-tech.md` | n/a |

**Recommendation (sources):**

1. **Modern base = Natural Earth 5.x** (public domain, zero attribution burden). Build from the pinned `natural-earth-vector` tag with sha256 like `geo-build.ts` already does. Land, countries 50m, lakes, rivers, disputed areas, admin-1 10m, populated places.
2. **US detail = us-atlas** states (and counties only if a topic needs it; counties 842 KB, gate behind a US-only pack).
3. **Historical borders = Cliopatria** as the main source (CC BY 4.0, only attribution needed, QIDs on every polity, maintained, covers every era). Keep **AWMC** for Rome/ancient Mediterranean (already shipped, finer).
4. **historical-basemaps: avoid by default.** GPL-3.0 plus mixed/unclear upstream provenance (Euratlas and Geacron are commercial products). The old `map-tech.md` plan says to keep it in an isolated GPL folder; I would not ship it in a monetised pipeline unless a lawyer approves. Cliopatria replaces it for the same eras.
5. **CShapes: excluded** (NC).
6. **geoBoundaries: optional later** for sub-national detail NE lacks (districts, counties outside the US). CC BY 4.0, credit "geoBoundaries" in description.
7. **Places gazetteer = NE populated places (public domain, 7.3k at 10m, with wikidata ids in the full file) + a hand-authored overlay** (battles, landmarks, ancient cities, historical names, each with a QID). **GeoNames cities15000 only as an alias/alt-name source at build time** (CC BY 4.0), not shipped as geometry.

**Attribution on YouTube.** The "no source lines on screen" rule stays. Generate a credits block into the video description from a manifest of "layers/places actually used in this video" (`sources: ['cliopatria','awmc']`): Cliopatria CC BY 4.0 needs credit + link to licence + "changes made" (simplified/sliced); AWMC (ODbL Produced Work) needs a notice; geoBoundaries needs its name + URL; Natural Earth none. A table in code (`SOURCE_CREDITS`) keyed by source id; the publisher harness appends it. (Whether description-only credit satisfies each licence is the one thing to confirm with counsel.)

### 1.2 Disputed borders policy

- NE default is de facto (who controls), disputed areas flagged, de jure claims in an auxiliary file **[web]**. Since 5.0 there are 31 worldview (POV) variants: ar, bd, br, cn, eg, fr, de, gr, in, id, il, it, jp, ma, np, nl, pk, ps, pl, pt, ru, sa, ko, es, se, tw, tr, gb, us, vn, plus `iso` **[web]**. Pre-assembled files exist per POV (`ne_10m_admin_0_countries_<pov>`). I did NOT confirm the exact filename for `iso`; check at build.
- **Proposal:** ONE worldview baked per build, default `iso` (follows ISO 3166 listing: neutral-ish, matches the codes the LLM already knows), plus NE's disputed-areas polygon drawn as hatch/dashed (never filled in any country's tone). One extra worldview costs about +0.3 MB. Never show labels that take a side in a disputed area (a lint list `CONTESTED_LABELS` rejects them in the validator, e.g. Crimea, Kashmir, Taiwan as a "country" tone fill, Western Sahara, Golan, Kosovo - owner decides the list). Historical shots show borders "as of that year (approximate)": Cliopatria is explicit that disputes are not encoded.
- **Avoid**: per-viewer worldviews (YouTube is one file); and statements in narration about sovereignty that the map contradicts (a rule can flag a narration naming a contested place while its tone is filled).

### 1.3 Proposed data shape

Replace the single pack with a **tiered set of packs**, loaded by Bun from disk on demand (Bun reads files; only what a given video references is projected and sent to Chromium).

```
assets/geo/
  world.topo.json            land 50m, ocean sphere, lakes, countries 50m (id = ISO3), disputed, 30% simplify   ~0.5 MB
  rivers.topo.json           NE 50m rivers + lakes, named, 30%                                              ~0.15 MB
  admin1/<ISO2>.topo.json    NE 10m admin-1 split per country, 5% (id = ISO 3166-2 code)                   total ~1.4 MB
  hist/<year>.topo.json      Cliopatria slice per curated snapshot year, 20%, id = Wikidata QID            ~60-80 KB each
  ancient/mediterranean.topo.json   (the current file, unchanged; AWMC)
  places.json                gazetteer rows (below), minified                                              ~0.4 MB raw, ~0.12 MB gz
  index.json                 alias -> canonical id table + QID map (built; also what the validator loads)
```

**Why per-country admin-1:** the 10m worldwide admin-1 is 98k vertices / 1.14 MB of SVG path; almost no video needs it all. Split so only a referenced country's admin-1 is projected. **Why curated snapshot years for history:** 13k Cliopatria rows cannot be one pack; pick snapshot years (roughly: every 100 years before 1500, every 50 to 1900, then 1914, 1920, 1938, 1945, 1960, 1991, 2000, 2024: about 50-60 slices, 4-5 MB total). A shot says `year: 1914`, code picks the nearest snapshot at or before that year (and states it in the log). For a "borders shift between 1914 and 1920" video, two snapshots with the same polity QIDs let the code morph/cross-fade (the polity identity is the QID, so "Austria-Hungary" disappears while "Austria" appears).

**Catalog rows** (one table shape for everything, so the validator is one function):

```ts
type Kind = 'country' | 'admin1' | 'city' | 'feature' | 'polity';          // 'feature' = river, sea, mountain, battle, landmark
interface Place {
  id: string;            // canonical, human readable and stable: 'country:FR', 'admin1:US-CA', 'city:paris-fr', 'polity:Q7318' ...
  kind: Kind;
  name: string;          // label on screen, modern
  names?: { until: number; name: string }[];   // era names: [{until:330,name:'Byzantium'},{until:1930,name:'Constantinople'}] -> Istanbul
  at: [lon, lat];        // label anchor / dot
  bbox?: [w, s, e, n];   // for fit-camera and highlight
  country?: string;      // ISO2, for disambiguation text
  pop?: number;          // ranks candidates, picks tier
  qid?: string;          // Wikidata
  tier: 1 | 2 | 3;       // 1 = listed in prompt, 2 = resolvable by name, 3 = only by exact id
  aliases?: string[];    // 'USA','United States of America','Türkiye','Turkey', ...
}
```

Era-dependent names are the one thing the current manifest does by hand (`london: 'Londinium'`). Making it data (`names[]`) lets a map shot with `year: 100` show "Londinium" without the LLM picking an ancient id.

**Shot schema sketch (additive, keeps the current ids working during migration):**

```ts
map: {
  kind: 'map',
  view: ViewRef,                       // named region OR { fit: PlaceRef[] } (code frames camera; frameView() already does this for subjects)
  year?: Year,                         // selects hist snapshot, era names
  title?, 
  layers: [{ layer: LayerRef, tone, at? }]   // LayerRef: 'country:FR' | 'admin1:US-CA' | 'polity:Q7318' | 'rome_ce117' | 'rivers' ...
  labels: [{ place: PlaceRef, at? }], circle, arrow, armies: ...
}
```

`LayerRef` and `PlaceRef` are strings (see 1.4). Layers on a modern map are "fill this country/state in tone X" (fill shapes by id from the pack); on a historical map "fill this polity". That removes the manual `MAP_LAYERS` table: the id exists if the pack has it.

**`GeoScene` changes** (`timeline.ts`): `layers: Record<MapLayerId,string>` becomes `Record<string, string>` containing only layers referenced by the sheet; `places` likewise; `land` becomes `base` paths per needed projection. This also fixes the payload problem below.

### 1.4 How the LLM addresses places

Candidates:

| Option | Verdict |
|---|---|
| ISO codes (3166-1 alpha-2/3, 3166-2) | LLMs know these well for countries and US states ("FR", "US-CA"). Ambiguity-free. Good as an ACCEPTED alias, not a full solution (cities/rivers/battles have no ISO code) |
| Wikidata QIDs | Universal key, but LLMs hallucinate QIDs for anything not famous (Q90 Paris, Q84 London yes; obscure ones no). Use as a build-time join key and as an optional input, never as what the model must recall |
| Geocoder at runtime (Nominatim/GeoNames) | Rejected: network at render time breaks "validate at the edge, closed vocabulary", rate limits (Nominatim), non-determinism, an ODbL dependency. A geocoder at BUILD time is fine, to produce the gazetteer |
| Large inline list in the prompt | Fails at 1000s (a place row is ~8-12 tokens; 7k places = 70k+ tokens, every call, every retry) |
| **Names with a code-side resolver (recommended)** | The model writes natural names plus optional qualifier: `"Paris"`, `"Paris, FR"`, `"Georgia (US state)"`, `"US-CA"`, `"Q90"`. The schema type is `z.string()` with a `.transform(resolve)` that maps to a canonical id or fails with candidates. Still a closed vocabulary: anything that does not resolve is rejected |

**Resolver rules (declarative, one table + one function):** normalise (lowercase, strip diacritics/punctuation, fold British/American spelling as `timing.ts` does), match against `index.json` alias map; resolution order exact id, ISO code, QID, exact name, alias, then name+qualifier; if multiple hits, rank by `pop` and `tier`, but REJECT as ambiguous when the top two are within a factor (e.g. Georgia the country vs state, Cambridge, Birmingham, Washington) and return the candidates; if zero hits return the 5 nearest by edit distance/prefix. The violation text is fed back through the existing retry loop:

> `[place_unknown] b7: "Syrakusa" is not in the catalog. Closest: "Syracuse, IT" (city:syracuse-it), "Syracuse, US-NY" (city:syracuse-us). Use one of these ids or add a qualifier.`

This needs NO new harness capability (no client tool calling), only a new rule row in `BEAT_SHEET_RULES` plus a transform in the schema. The beat sheet stored/rendered contains canonical ids only.

**Keeping the prompt small:**

- Inline only: views (~30 named regions), layer families (the few kinds), and a **tier-1 "famous" list** (about 150-250 places: top world cities, every sovereign state's id form, US states, major seas/rivers) at ~6 tokens each, ~1.5k tokens. Everything else is "any name from the world gazetteer, I will check it" (tier 2: ~7-30k places).
- **Retrieval pre-pass (code-side, cheap):** before the screenplay call, run the topic and any Scout notes through the resolver (token n-grams against the alias index) and add `"known_places": [...]` (the 30-60 best matches with canonical ids, era names) to the task JSON. The model then rarely guesses. This is plain data transformation, in the spirit of "no hidden behaviors".
- **Lookup tool (phase 2):** a client-side `lookup_place(query, kind?, year?)` the model can call. It needs a client tool loop in `providers.ts`/`LlmCall` that does not exist today (only `serverTools`). Worth building if the retry loop proves wasteful, because it is the same resolver behind a tool spec (`ToolSpec{kind:'coded'}` exists in the harness contract already). Start without it.
- Keep a rule: max N distinct places per video (e.g. 12) so the prompt can say so.

### 1.5 Projections (d3-geo)

Today one projection serves all views. A world catalog needs a **projection table** keyed per view/world, chosen by code from the framing bbox (declarative, with the model never choosing):

| Situation | Projection | Notes |
|---|---|---|
| Whole world / hemisphere overview, 16:9 | `geoEqualEarth` (core d3-geo, equal area, 2:1 sphere) or `geoNaturalEarth1` (core). `geoWinkel3`/`geoRobinson` exist in `d3-geo-projection` (BSD-3, adds a dependency) | Equal Earth is the sensible default: area-true, which matters for "how big is X" claims |
| Whole world, **9:16** | Equal Earth only fills ~28% of a 1080x1920 frame vertically (2:1 shape) | Either (a) tall crops: camera starts on a hemisphere (two views `world_west`, `world_east`) and zooms; or (b) an **orthographic globe** (`geoOrthographic`), which is vertical-friendly and gives constant motion by rotating. A globe needs per-frame reprojection: with 110m countries that is ~10k vertices, ~1-3 ms per frame, fine (map-tech.md measured 5-30 ms for 50k points). Different widget path than the precomputed-string model; do it in a later phase |
| Continental/regional, mid-latitude E-W extent (Europe, N. America, Asia, Russia) | `geoConicConformal` or `geoAlbers` (equal-area) with parallels at 1/6 and 5/6 of the lat range (the usual d3 recipe); existing Mediterranean uses conformal 34/50 | Keep conformal for classic atlas look; Albers when areas are compared |
| Near-equator regions (Africa, SE Asia, N. South America) | `geoMercator` (fine below ~±35 degrees) or `geoAzimuthalEqualArea` centred | Mercator inflates high latitudes; never use for world or Arctic |
| USA with Alaska and Hawaii | `geoAlbersUsa` (composite, d3-geo core). us-atlas also ships pre-projected | Inset projection needs special handling in `invert` (used by `clampToData`: `invert` of the composite is not a plain inverse; check) |
| Polar | `geoAzimuthalEqualArea` / `geoAzimuthalEquidistant` rotated to the pole | Rare |
| Pacific-centred views, Russia Far East, Fiji, "Asia-Pacific" | Same projections with `rotate([-150,0])` etc. | d3's spherical clipping handles the antimeridian when data is GeoJSON in lon/lat; keep data unsplit |

Mechanics to keep: **one projection per `world` id** (the existing rule that beats sharing a world are one continuous canvas). A camera glide only happens inside one projection; crossing projections is a cut/dissolve, which the transition system already has. Name them as rows in a `PROJECTIONS` table `{id, make, rotate, parallels, fitExtent}`; `loadGeoScene(projectionIds)` projects only what a sheet uses, cached per (projection, pack).

Notes that bite:

- `PACK_CLIP`/`clampToData` exist because the Mediterranean pack has artificial clipped edges. World packs have none, but non-rectangular spheres (Equal Earth, Natural Earth, orthographic) leave empty corners: fill the stage with sea colour and clamp views to the projected sphere bbox, not to a lat/lon box. Ancient pack clamp stays.
- Antarctica (huge polygon, ruins Equal Earth framing): drop below -60 degrees in the world pack (as map apps do).
- Label anchors: for polygons use `d3.geoCentroid`-based anchors only as default; for ugly shapes (Chile, Norway, Russia, USA with Alaska) store a hand anchor `at` in the row. Same idea as the current `PLACES.at`.
- Mercator lat clip ±85.

### 1.6 Performance in headless Chromium (Remotion renders every frame as a screenshot)

Measured payload sizes (SVG path strings with 1 decimal, Equal Earth 1920x1080 **[measured]**):

| Layer | Vertices | Path bytes | d3 projection time (Bun, 5-run mean) |
|---|---|---|---|
| NE 50m countries @30% | 31.6k | 375 KB | 24 ms |
| NE 50m countries @15% | 16.8k | 199 KB | 10 ms |
| NE 10m admin-1 world @5% | 97.9k | 1.14 MB | 47 ms |
| NE 10m admin-1 world @3% | 70.8k | 0.81 MB | 43 ms |
| 50m rivers @30% | 9.0k | 110 KB | 3 ms |
| Cliopatria 1914 @20% | 8.1k | 95 KB | 4 ms |
| Cliopatria 1500 @20% | 4.2k | 50 KB | 2 ms |

(vs. the current Mediterranean pack: 94 KB TopoJSON in total.)

Consequences and mitigations (the Chromium per-frame cost is NOT measured here; it must be benchmarked with a world scene before committing. The prior `map-tech.md` notes that live SVG filters are the expensive thing and plain transformed paths are cheap):

1. **Embedding all paths in props is wrong at world scale.** Input props are JSON passed to every render worker/frame. Put only what the sheet uses in `GeoScene`: culled by bbox against the union of the sheet's views (drop features that never intersect any view of any beat), plus only referenced country/admin-1 packs. A typical video then ships 150-400 KB of path, comparable to today's.
2. **LOD by zoom:** pick the data tier from the view's world width (as `map-tech.md` suggests: 110m world, 50m continent, 10m zoomed): world views use countries @15%, regional views use @30% clipped, country-level views use 10m admin-1. Choose per beat; the cross-fade the old note describes (at k>4) avoids popping.
3. **Cull per frame** (cheap): if a layer's projected bbox is outside the current camera frame, do not render the `<path>` (precompute bbox per feature in Bun).
4. **Avoid per-feature `mix-blend-mode: multiply` on hundreds of paths** (current code does it on a few layers): composite blends are the costly part. For many-country maps draw one `<path>` per TONE (merge geometries by tone with one `d`), not per country. Same for `vectorEffect="non-scaling-stroke"` on large `d`s: measure; fall back to a stroke width computed from the camera scale.
5. Keep a **fixed upper vertex budget per frame** as a test (like the 600 KB pack budget check in `geo-build.ts`): e.g. assert vertices drawn in any frame ≤ 60k.
6. Globe mode (later): reproject per frame only the 110m layers.

**Pack-size budget:** total committed assets ~7-8 MB (world 0.5, rivers 0.15, admin-1 1.4, hist 4-5, places 0.4). Fine for a git repo; if it grows, move hist snapshots to LFS or a release artifact fetched by `bun run geo:build` with sha256 pins (the pinned-download pattern is already in `geo-build.ts`).

### 1.7 Risks (maps)

- **Cliopatria accuracy and overlap:** approximate, smoothed, imperfect coastline alignment; RELATION rows and nested/overlapping polities per year need a deterministic dissolve rule or the fills overlap. Clip to NE land like `geo-build.ts` does for AWMC (the existing approach).
- **Wrong or contested labels** are a channel risk (demonetisation / geo-blocking in India, China, Pakistan, Turkey, Russia). Needs the policy in 1.2 and a validator lint.
- **Name drift:** "Turkey/Türkiye", "Burma/Myanmar", "Swaziland/Eswatini": aliases table; display name chosen once (modern official English).
- **Era mismatch:** a modern place on a 100 CE map (`Paris` dot beside Roman borders). The `names[]`/`year` design handles names; also add a rule `place_exists_in_year` for polity layers (a QID's `FromYear..ToYear` from Cliopatria must include `year`).
- **Prompt cost/quality:** more places means more chances for hallucinated ones; the resolver + retry loop absorbs it but adds attempts (MAX_SCREENPLAY_ATTEMPTS). Watch repair-loop rate in the live test.
- **Licence provenance:** historical-basemaps (GPL, mixed upstream); geoBoundaries per-boundary licences; description-credit sufficiency for ODbL/CC BY needs a legal read.
- **Dependencies:** `d3-geo-projection` only if Winkel/Robinson is wanted; mapshaper is already a devDependency.
- **Refactor surface:** `geo.ts` assumes one module-level projection and a fixed `PACK_CLIP`; `timing.ts` `placeLabels`/`frameView`/`clampToData` and `VoxVideo` `MapShot` read `geo.places[...]`/`geo.layers[...]` by typed ids; `emit-schemas.ts` emits JSON schemas for `shared/` (enums become strings with a documented resolver; the shared schema cannot enumerate 30k ids).

---

## 2. More units for `number` shots

### 2.1 Proposed unit model (declarative)

Today `UNIT_SPEC` has `{prefix, suffix, count}` and magnitude words only for million/billion. Proposed row:

```ts
interface UnitSpec {
  dim: 'money' | 'count' | 'length' | 'area' | 'mass' | 'speed' | 'duration' | 'temperature' | 'energy' | 'data' | 'density' | 'volume' | 'power' | 'share' | 'year';
  toBase: number;            // factor to the dimension's base unit (for compare bars only)
  prefix: string;            // '$', '€', '£', '¥', '₹'
  suffix: string;            // ' km²', ' mph', ' °C'
  spoken: [singular: string, plural: string];   // what TTS says: 'kilometer','kilometers'; 'square kilometer'...
  scales: ('thousand'|'million'|'billion'|'trillion')[];  // magnitude words allowed
  count: boolean;
  signed?: boolean;          // temperature
  decimals?: number;         // fixed precision where convention exists (temperature 1, percent 0)
}
```

Rules that fall out of this:

- **Compare shots must share `dim`:** a rule `compare_same_dimension` (km² vs sq miles is fine, converted with `toBase` to size the bars; usd vs people is rejected). Today `compare.unit` is optional and unchecked.
- **Never auto-convert units.** The LLM states the unit it speaks ("square miles"); code does not silently rewrite miles to km (would desync from narration). Conversion only for comparison bar lengths.
- **Number schema must allow zero/negative** for temperature (and "change" figures): `z.number().positive()` becomes `z.number()` with `.positive()` enforced per `dim` (a table field `signed`). Speech for negatives: "minus forty" / "forty below zero"; add `minus` to the alignment grammar or keep temperature positive-only and phrase as "below zero" in `label` (cheaper). I recommend positive-only first, `signed` later.
- Add **`trillion`** to `MAGNITUDES` and to `MULTIPLIERS` in `timing.ts` (US national debt, global GDP, market caps; currently a spoken "trillion" is NOT recognised by alignment, so a $5 trillion beat would mis-key). Also consider `thousand` abbreviation for counts ≥ 10,000 ("250 thousand people").

### 2.2 Candidate units (v1 list, 30-40 rows; extend as rows)

| Dim | Units (id: written / spoken) | Notes |
|---|---|---|
| money | usd `$` "dollars", eur `€` "euros", gbp `£` "pounds", jpy `¥` "yen", cny `¥` "yuan", inr `₹` "rupees", plus `usd_today`/`usd_then` variants if inflation shots are added | glyph coverage in Libre Franklin must be checked for €, £, ¥, ₹, ₽, ₩, ₺, ₦ (render and see; `₹` is the usual gap) |
| count | people, soldiers, count, plus a few nouns as `count` + label ("ships", "votes" go in `label`, not as new units) | prefer labels over a unit per noun |
| length | meters (`m`), kilometers (`km`), miles | no auto-scaling, LLM picks |
| area | square kilometers (`km²`, exists), square miles, hectares, acres | "football fields" etc. are comparisons, belong in `units` pictograms |
| mass | kilograms, tonnes ("metric tons"), tons (short), pounds | "million tonnes" via magnitudes |
| speed | km/h ("kilometers per hour"), mph, m/s, knots | |
| duration | seconds, minutes, hours, days, years (exists), centuries | one unit per figure (no "2 h 30 min"); LLM expresses as "150 minutes" or splits beats |
| temperature | °C, °F, kelvin | signed; "degrees Celsius" |
| energy | joules/kilojoules, kilowatt-hours, calories (kcal), megatons TNT | |
| power | watts (kW, MW, GW) | |
| data | bytes with decimal prefixes (kilobytes, megabytes, gigabytes, terabytes) | use SI 1000, say so once; `MAGNITUDES` words differ from SI prefix words, so store as unit rows (`gigabytes`) not "billion bytes" |
| density | people per km², people per sq mile | `suffix ' /km²'`, spoken "people per square kilometer" |
| volume | liters, cubic meters, barrels | barrels for oil |
| share | percent (exists), "one in N" (ratio: render "1 in 4"; `value` = N) | Vox uses ratios often; spoken "one in four" aligns as numbers 1 and 4 |
| rate | per-capita: "per person" via label | |

### 2.3 Speaking the numbers (TTS + alignment)

The existing rule is right: narration spells numbers as words, the figure on screen is derived from `value`. What to add:

1. **Narration lint:** reject digits-with-symbols and unit abbreviations in narration (`$`, `%`, `°`, `²`, `km`, `mph`, `/`) because TTS misreads them and alignment tokenises them oddly. A `spoken_form` rule row: banned character class in `narration` (but years as digits ARE handled, keep allowing plain digits).
2. **Value-to-speech agreement rule (missing today):** `number_matches_speech`: parse the number in the `at` span (reuse `readNumber`/`alignUnits` from `timing.ts`, export it) and require it equal `value` within the magnitude rounding used on screen (5,200,000 on screen at "5.2 million" = value 5.2e6). It makes the screen figure and the voice never disagree, and it is the same check for `compare`. Cheap because the parser exists.
3. **Unit word agreement:** the narration within ±N tokens of the number must contain `spoken[0|1]` for the shot's unit (British folding already exists in `SPELLING`).
4. **Alignment extensions** (rows in the `NUMBER_FOLLOWS`/`NUMBER_WORDS` grammar tables, not branches): `trillion` (multiplier), `percent` as a unit token, ordinals if needed ("third"), `minus`, "half"/"quarter" fractions optional, "oh" years (already listed as unsupported in the code comment).
5. **Rounding/hedging:** UI shows "about 5.2 million" only as the `label`; the figure itself stays clean. The editorial rule "hedge estimates" stays in narration.
6. **Currencies spoken:** "five dollars", "three hundred euros"; avoid "bucks"/slang; large: "two point five trillion dollars" (value 2.5e12, unit usd, magnitude trillion).

### 2.4 Inflation-adjusted money

Goal: "$1 in 1900 is about $37 today" derived by code, not invented by the LLM (project rule: never invent numbers).

Design: shot field `money: { year, inflate_to?: year }` on a `number` of unit usd/gbp/eur; code computes `value_adjusted` from a baked table and the validator checks the narration's spoken number against it (the violation message includes the computed figure, so the retry loop self-corrects: `[number_matches_speech] b4: narration says "twenty dollars" but $1,000 in 1900 is about $37,000 in 2024`). Because the LLM writes narration BEFORE code can compute, the computed value comes back through the retry loop or the retrieval pre-pass (code tells the model `inflation_factors` for the years in the topic).

Free data sources:

| Source | Coverage | Licence | Notes |
|---|---|---|---|
| **US BLS CPI-U** (and FRED `CPIAUCNS`) | 1913-now monthly | US federal data, public domain **[recall]**; FRED republishes with source notes | Official, authoritative |
| **Minneapolis Fed "Consumer Price Index, 1800-"** | USD annual 1800-now | Freely published, cite the Fed **[recall]** | Back to 1800 (spliced Warren/Pearson, Officer) |
| **Bank of England "Millennium of Macroeconomic Data" (v3.1)** | UK CPI from 1209, plus wages, GDP, FX | **OGL v3.0** per a datahub mirror **[web, third-party mirror, verify on the Bank site]**; 28 MB xlsx | Gives GBP back to the 13th century |
| **World Bank CPI** (`FP.CPI.TOTL`) | ~1960-now, ~200 countries | **CC BY 4.0** **[recall]** | For EUR/other currencies, short history |
| **Maddison Project Database** | GDP per capita, long run | CC BY 4.0 **[recall]** | For "relative to income" comparisons rather than CPI |
| **ECB reference rates / Frankfurter** | FX from 1999 | ECB rates reusable **[recall]** | Modern FX only |
| MeasuringWorth | Best-known long series | Terms restrict redistribution; not usable as shipped data | Avoid shipping |
| **Jordà-Schularick-Taylor Macrohistory** | FX, CPI since 1870 for 17 economies | Custom licence **forbids integration by commercial data providers** **[web]**, treat as unavailable | Avoid |

**Recommendation:** v1 supports ONLY same-currency inflation adjustment for **USD (1800-)** and **GBP (1209-)** from baked annual tables (a 200-row JSON each; no network at render). Cross-currency historical FX is out of scope (no clean free source for the pre-1999 era; and the question "what was 100 francs worth" needs a purchasing-power definition anyway). For antiquity ("a denarius per day") use `label` text and `count` units; do not pretend to convert. Show the base year on screen ("in 2024 dollars"): required by an audit/validator rule so a bare adjusted number is never shown.

### 2.5 Pictogram units with icons

Today's `units` shot is a grid of tone-coloured squares. Proposal: each group gets an **`icon`** id from a closed catalog (square stays the default), so "1 in 4 voters" shows person glyphs, a ship count shows ships, money shows coins. Icon rows as data: `{id, path d (single combined path), viewBox, source, licence, credit}`; extracted at build time from a pinned npm/GitHub release (sha256-checked, like `geo-build.ts`) into `src/vox/icons.ts`/a JSON. They are drawn as an SVG path filled with the group tone, no foreign fonts or `<img>`, so there is no network or colour-emoji rendering path. The LLM chooses among ~150-300 ids listed in the prompt (~1.5-2.5k tokens).

| Set | Licence | Style | Fit for Vox pictograms |
|---|---|---|---|
| **Phosphor Icons** | MIT | ~1,500 icons x 6 weights (thin..bold, **fill**, duotone) | Best fit: the `fill` weight gives solid silhouettes that take a flat tone; consistent design language; people, coins, buildings, vehicles, weapons (sword), flags, food |
| **Lucide** | ISC (parts MIT from Feather) | ~1,600 monoline outline | Clean, but outline-only does not read as "filled squares become people"; use only if outline look is wanted |
| **Tabler Icons** | MIT | ~5,900 outline + ~1,000 filled | Largest breadth; filled subset is small |
| **Noto Emoji** (monochrome variable font / SVG) | Apache 2.0 for artwork, OFL for the font **[recall; sources disagree, check LICENSE in the folder used]** | Black-and-white glyphs, huge coverage (all emoji concepts) | Good for odd concepts ("camel", "ship", "scroll"); monochrome renders in a tone; avoid the colour set (colours fight the palette) |
| **Twemoji** (jdecked fork) | **CC BY 4.0** (graphics), MIT (code) **[web: third-party tables]** | Flat colour | Attribution required; colour art fights the paper palette; skip |
| **OpenMoji** | **CC BY-SA 4.0** **[web]** | Flat, black-outline colour + monochrome variants | **Avoid:** share-alike applies if we modify/recolour the artwork; unclear what "distribute your contributions" means for a video |
| **Fluent Emoji (Microsoft)** | MIT **[recall]** | 3D/flat/high-contrast | Not a Vox look |
| **Material Symbols** | Apache 2.0 **[recall]** | Variable-weight outlines/fill | Fine alternative, same tier as Phosphor |
| **game-icons.net** | **CC BY 3.0** (per-author credits) **[recall]** | 4,000+ single-colour silhouettes (soldiers, ships, swords, castles, ...) | The best source for historical/military pictograms (our `soldiers` unit); needs a per-author credit list in the video description (generated from the manifest) |

**Recommendation:** Phosphor **fill** as the primary set (MIT, no attribution needed in practice though keep the licence file in the repo), curated to 150-250 icons by editors, plus game-icons.net (CC BY 3.0) for military/history silhouettes with automatic description credits. No emoji sets for v1. Do not mix more than two visual families in one video: tie each icon row to a `family` and add an audit/validator rule "one family per shot".

Pictogram unit semantics: a group may say `{count, label, tone, icon, at}` and the shot gets a `per` ("1 icon = 1,000 people") so large numbers are legible: `total` stays ≤ 100 icons; `per` is a power of ten and drawn in the legend as "each icon = 1,000 people". The rule `units_fit` becomes `sum(count) ≤ total` in icons, and a new rule checks that `count × per` equals the number spoken (reuse the `number_matches_speech` parser).

### 2.6 Risks (units)

- Currency glyph coverage in the bundled fonts (₹ ₽ ₩ ₺); test render before listing a currency.
- Misformatting signed/zero values (schema is `positive()` today).
- "Trillion" absent from the alignment grammar: silent mis-timing, not a crash.
- TTS pronunciations: "km/h", "°C", "m²" if the narration contains symbols: handled by the lint in 2.3.
- Inflation figures are contestable (different CPI baskets, pre-1913 US data is reconstructed): always show base year and say "about"; label as such in the narration.
- Icon licences with attribution (CC BY) require credits in the description; no on-screen source lines.

---

## 3. Suggested phasing

1. **P0 (small, no schema risk):** add `trillion` to timing + format; add unit rows (money, length, area, mass, speed, duration, data, density), `compare_same_dimension` and `number_matches_speech` rules; narration symbol lint.
2. **P1:** gazetteer + resolver + `place_unknown`/ambiguity rule; world pack (NE 5.x countries, rivers, land), `PROJECTIONS` table, `fit` views, culling and LOD; world and regional shots in both aspects, benchmark in Chromium.
3. **P2:** admin-1 per-country packs, US states, era names, `year` + Cliopatria snapshots, credits manifest in the description, disputed-areas policy.
4. **P3:** icons for pictograms (Phosphor fill + game-icons), `per` scaling; inflation tables (USD, GBP).
5. **P4:** orthographic globe widget, lookup tool (client function-calling), geoBoundaries sub-national.

---

## 4. Open design questions (with recommended answers)

1. **Which worldview for disputed borders?** Recommend `iso` (NE POV), one per build, disputed areas hatched, a contested-label lint, no per-viewer variants.
2. **Do we ship Cliopatria or avoid unverified-provenance historical sets?** Recommend Cliopatria (CC BY 4.0, QIDs, maintained) and drop historical-basemaps (GPL, mixed upstream); exclude CShapes (NC).
3. **Are credits in the YouTube description enough?** Recommend yes by design (no on-screen sources), generated from a per-video source manifest; confirm with counsel for ODbL and CC BY.
4. **How do models reference places?** Recommend names/ISO codes resolved in code, with canonical ids stored, ambiguity returned through the existing retry loop; QIDs accepted but never required.
5. **Do we build a lookup tool now?** Recommend no: resolver + retrieval pre-pass first; add client tool-calling only if the repair rate is high.
6. **How big may the catalog grow in the repo?** Recommend up to ~8 MB committed (tiered packs), larger (e.g. geoBoundaries) as pinned build-time downloads.
7. **9:16 world overview: tall crops or globe?** Recommend crops/hemisphere views in P1, globe in P4 (needs a per-frame reprojection widget and an audit for it).
8. **How does `year` work for maps?** Recommend `year` on the map shot picks the nearest snapshot at or before it, shows era names, and the shot may say `approximate: true` badge text; polity existence rule via QID dates.
9. **Max places per video?** Recommend 12 distinct places, 3 highlighted layers per shot (as today), 3 country fills per shot on world views, unlimited labels only on regional views.
10. **Do modern-day place names appear on historical maps?** Recommend: era name when known (`names[]`), otherwise modern name in smaller "today" style; never a modern country border on an ancient map.
11. **Inflation: which currencies and which CPI series?** Recommend USD (Minneapolis Fed/BLS) and GBP (BoE millennium, verify OGL) only, same-currency, base year always on screen, no cross-currency history.
12. **Allow negative numbers (temperature, change)?** Recommend phase 2: `signed` unit rows and "minus"/"below zero" grammar rows; start positive-only.
13. **Binary vs decimal data units?** Recommend decimal (kilobyte = 1000), spoken "gigabytes", never write "GiB".
14. **Icon family?** Recommend Phosphor fill (MIT) + game-icons.net (CC BY 3.0), at most two families per video, closed list of 150-250 ids in the prompt.
15. **Is `units` the right name?** Recommend rename the pictogram shot kind to `pictogram` (migration row in the schema) so "units" means measurement units everywhere.
16. **Per-frame budget?** Recommend a hard test: ≤60k drawn vertices and ≤ N paths per frame; one path per tone; benchmark in the real Chromium render before turning world maps on.

---

## 5. Sources consulted

- Natural Earth terms of use https://www.naturalearthdata.com/about/terms-of-use/ ; disputed boundaries policy https://www.naturalearthdata.com/about/disputed-boundaries-policy/ ; admin-0 point-of-views https://www.naturalearthdata.com/?p=5118
- world-atlas https://github.com/topojson/world-atlas ; us-atlas (npm `us-atlas@3.0.1`, sizes measured)
- geoBoundaries https://www.geoboundaries.org/
- Cliopatria https://github.com/Seshat-Global-History-Databank/cliopatria (LICENSE.md fetched), docs https://seshat-global-history-databank.readthedocs.io/en/latest/cliopatria.html , paper https://pmc.ncbi.nlm.nih.gov/articles/PMC11822181/
- historical-basemaps https://github.com/aourednik/historical-basemaps (GPL-3.0 via GitHub API)
- CShapes 2.0 licence record https://www.research-collection.ethz.ch/handle/20.500.11850/487987?show=full
- GeoNames readme https://download.geonames.org/export/dump/readme.txt
- Bank of England millennium dataset https://www.bankofengland.co.uk/statistics/research-datasets (licence via datahub mirror https://datahub.io/economic-history/millennium-macroeconomic-data-uk)
- Macrohistory database https://www.nber.org/research/data/jorda-schularick-taylor-macrohistory
- Emoji set licences (secondary): OpenMoji FAQ https://openmoji.org/faq , https://shop.emojipedia.org/pages/licenses
- Repo: `docs/research/vox-harness/map-tech.md` (prior research on projections, camera, mapshaper, AWMC)
- Measurement files and scripts: `scratchpad/dl/*.topo.json`, `scratchpad/measure.ts` (not in the repo)

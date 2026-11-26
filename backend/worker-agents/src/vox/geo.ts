/**
 * Map compilation (runs in Bun, never in the browser). Per sheet: groups map beats into worlds
 * (one projection each, so cameras glide), picks the projection from the framed area, frames
 * every camera on its subjects and clamps it to real data, then projects ONLY what the sheet
 * uses into SVG path strings: base layers clipped to the union of that world's camera frames and
 * thinned to half a screen pixel at its closest zoom, plus the referenced fills and places. The
 * widget only draws these strings and moves a camera transform, so frames stay cheap.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoAlbersUsa, geoArea, geoCentroid, geoClipRectangle, geoConicConformal, geoEqualEarth, geoMercator, geoPath, type GeoPermissibleObjects, type GeoProjection, type GeoStream } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { feature, merge, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { continues, type BeatSheet, type Shot } from './beat-sheet';
import { ANCIENT_LAYERS, MAP_VIEWS, PACK_CLIP, PACK_EXTENT, WORLDVIEWS, type AncientLayerId, type BBox, type GeoSourceId, type MapViewId, type ProjectionId, type Worldview } from './geo-manifest';
import { mainBox, partsOf } from './geo-shapes';
import { kindOf, mapEra, placeById, placeName, viewBox, type MapEra } from './places';
import type { GeoMap, GeoScene, WorldBox } from './timeline';
import { LAYOUTS, toScreen, viewOf, type Layout, type Rect, type View } from './tokens';

type MapShot = Extract<Shot, { kind: 'map' }>;
type Point = readonly [number, number];
const ROOT = join(import.meta.dir, '../..');
const WORLD = [LAYOUTS['16:9'].width, LAYOUTS['16:9'].height] as [number, number];

// ── Packs ────────────────────────────────────────────────────────────────────

const PACKS = {
  ancient: () => 'assets/geo/mediterranean.topo.json',
  world: (wv: Worldview) => WORLDVIEWS[wv].pack,
  admin1: (cc: string) => `assets/geo/admin1/${cc}.topo.json`,
  hist: (year: number) => `assets/geo/hist/${year}.topo.json`,
};
const topos = new Map<string, Topology>();
/** Loads a pack once per process; a missing pack names the build command (fail loud). */
function topo(rel: string): Topology {
  const hit = topos.get(rel);
  if (hit) return hit;
  const path = join(ROOT, rel);
  if (!existsSync(path)) throw new Error(`geo pack ${rel} is missing: run bun scripts/geo-build.ts (see geo-manifest WORLDVIEWS for other worldviews)`);
  const t = JSON.parse(readFileSync(path, 'utf8')) as Topology;
  topos.set(rel, t);
  return t;
}
const objectOf = (t: Topology, name: string, rel: string) => {
  const o = t.objects[name];
  if (!o) throw new Error(`geo pack ${rel} has no layer "${name}" (re-run scripts/geo-build.ts)`);
  return o as GeometryCollection;
};
/** A pack layer as GeoJSON, its geometries merged (land), or its interior borders (shared arcs). */
const collection = (rel: string, name: string) => feature(topo(rel), objectOf(topo(rel), name, rel)) as unknown as FeatureCollection;
const merged = (rel: string, name: string) => merge(topo(rel), objectOf(topo(rel), name, rel).geometries as Parameters<typeof merge>[1]) as MultiPolygon;
const borders = (rel: string, name: string) => mesh(topo(rel), objectOf(topo(rel), name, rel), (a, b) => a !== b);

/** One feature by id from a pack's collection, or a fail-loud error naming the pack. */
function featureById(rel: string, object: string, id: string): Feature<Geometry> {
  const t = topo(rel);
  const g = objectOf(t, object, rel).geometries.find((x) => x.id === id);
  if (!g) throw new Error(`${id} is not in ${rel} (worldview or snapshot without it)`);
  return feature(t, g) as Feature<Geometry>;
}

// ── Projections ─────────────────────────────────────────────────────────────

/**
 * A bbox outline as a densified LineString. (A Polygon would need d3's clockwise winding, and
 * a counter-clockwise ring means "the whole globe except this box"; lines have no winding.)
 */
const bboxOutline = ([w, s, e, n]: readonly number[]) => {
  const steps = Array.from({ length: 25 }, (_, i) => i / 24);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    type: 'LineString' as const,
    coordinates: [...steps.map((t) => [lerp(w!, e!, t), s!]), ...steps.map((t) => [e!, lerp(s!, n!, t)]), ...steps.map((t) => [lerp(e!, w!, t), n!]), ...steps.map((t) => [w!, lerp(n!, s!, t)])],
  };
};

/** The ancient projection: fixed to the AWMC pack's extent, so Roman sheets keep their framing. */
const ANCIENT: GeoProjection = geoConicConformal().parallels([34, 50]).rotate([-18, 0]).fitSize(WORLD, bboxOutline(PACK_EXTENT));

const mid = (a: number, b: number) => (a + b) / 2;
/**
 * Every projection a map can use (geo-manifest ProjectionId), fitted into the 1920x1080 world:
 * to the world's framed box, to the AWMC extent (ancient), or to the US states with their insets.
 */
const PROJECTIONS: Record<ProjectionId, (box: BBox) => GeoProjection> = {
  ancient: () => ANCIENT,
  equal_earth: (b) => geoEqualEarth().rotate([-mid(b[0], b[2]), 0]).fitSize(WORLD, bboxOutline(b)),
  conic: (b) => geoConicConformal().parallels([b[1] + (b[3] - b[1]) / 6, b[3] - (b[3] - b[1]) / 6]).rotate([-mid(b[0], b[2]), 0]).fitSize(WORLD, bboxOutline(b)),
  mercator: (b) => geoMercator().rotate([-mid(b[0], b[2]), 0]).fitSize(WORLD, bboxOutline(b)),
  albers_usa: () => (geoAlbersUsa() as unknown as GeoProjection).fitSize(WORLD, collection(PACKS.admin1('US'), 'admin1')),
};

/** What a world's projection is chosen from: its union box and the projections its views pin. */
interface WorldFrame {
  era: MapEra;
  box: BBox;
  pinned: ReadonlySet<ProjectionId>;
  /** Every view is the USA or one of its states. */
  usOnly: boolean;
}
/**
 * First matching row picks a world's projection. Add a projection as a row (and a PROJECTIONS
 * entry); never branch on a view id elsewhere.
 */
const PROJECTION_RULES: { use: ProjectionId; when: (f: WorldFrame) => boolean }[] = [
  { use: 'ancient', when: (f) => f.era === 'ancient' },
  { use: 'equal_earth', when: (f) => f.pinned.has('equal_earth') },
  { use: 'albers_usa', when: (f) => f.usOnly && f.pinned.has('albers_usa') },
  { use: 'conic', when: (f) => f.pinned.has('conic') },
  { use: 'equal_earth', when: (f) => f.box[2] - f.box[0] >= 100 },
  { use: 'mercator', when: (f) => Math.max(Math.abs(f.box[1]), Math.abs(f.box[3])) <= 30 },
  { use: 'conic', when: () => true },
];
export const projectionFor = (f: WorldFrame): ProjectionId => PROJECTION_RULES.find((r) => r.when(f))!.use;
/** Projections whose sphere has a finite outline a view is cropped to (AlbersUsa's composite has none; ancient clamps to its data instead). */
const SPHERE_CLAMPED: ReadonlySet<ProjectionId> = new Set(['equal_earth', 'conic', 'mercator']);

// ── Camera framing and clamping ─────────────────────────────────────────────

export const inside = (r: Rect, box: Rect): boolean => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;

/**
 * Auto-framing: keeps the requested view if every subject already sits inside the stage (inset
 * so its label still fits); otherwise widens and re-centres the camera on the subjects. The LLM
 * picks a framing by name; code guarantees the things being talked about are on screen and clear
 * of the title and subtitle zones.
 */
export function frameView(base: View, points: readonly Point[], layout: Layout): View {
  const { stage } = layout.zone;
  const box: Rect = { x: stage.x + stage.w * 0.064, y: stage.y + stage.h * 0.074, w: stage.w * 0.872, h: stage.h * 0.852 };
  const { width: W, height: H } = layout;
  const fits = (v: View) =>
    points.every((p) => {
      const [x, y] = toScreen(v, p, layout);
      return inside({ x, y, w: 0, h: 0 }, box);
    });
  if (points.length === 0 || fits(base)) return base;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(base[2], ((x1 - x0) * W) / box.w, ((y1 - y0) * W) / box.h) * 1.001;
  const k = W / w;
  return [(x0 + x1) / 2 - (box.x + box.w / 2 - W / 2) / k, (y0 + y1) / 2 - (box.y + box.h / 2 - H / 2) / k, w];
}

/** Margin (share of the view width) kept between the frame edge and the data extent. */
const EXTENT_MARGIN = 0.03;
const EDGE_SAMPLES = 16;

/**
 * Ancient pack: zooms a camera view in about its centre (binary search) until the frame shows
 * only real geodata, so the clip edge (cut coastlines, curved sea margin) never appears. A view
 * whose centre lies outside the data is a manifest bug: fail loud.
 */
export function clampToData(view: View, layout: Layout): View {
  const showsOnlyData = ([cx, cy, w]: View) => {
    const m = w * EXTENT_MARGIN;
    const [hw, hh] = [w / 2 + m, (w * layout.height) / layout.width / 2 + m];
    const [west, south, east, north] = PACK_CLIP;
    return Array.from({ length: EDGE_SAMPLES + 1 }, (_, i) => -1 + (2 * i) / EDGE_SAMPLES).every((s) =>
      ([[s, -1], [s, 1], [-1, s], [1, s]] as const).every(([u, v]) => {
        const ll = ANCIENT.invert!([cx + u * hw, cy + v * hh]);
        return !!ll && ll[0] >= west && ll[0] <= east && ll[1] >= south && ll[1] <= north;
      }),
    );
  };
  if (showsOnlyData(view)) return view;
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (showsOnlyData([view[0], view[1], view[2] * m])) lo = m;
    else hi = m;
  }
  if (lo === 0) throw new Error(`map view centre [${view[0]}, ${view[1]}] lies outside the geodata extent`);
  return [view[0], view[1], view[2] * lo];
}

/**
 * World packs: the frame never zooms out past the projected sphere along its long axis (a 16:9
 * world shows the whole width; a 9:16 world is a crop of the globe's height), then each axis is
 * clamped: where the frame is smaller than the sphere it stays inside it, where it is bigger it
 * keeps the whole sphere in view. The sea colour fills whatever lies past the globe.
 */
export function clampToBox(view: View, layout: Layout, [x0, y0, x1, y1]: WorldBox): View {
  const { width: W, height: H } = layout;
  const w = Math.min(view[2], W >= H ? x1 - x0 : ((y1 - y0) * W) / H);
  const axis = (c: number, half: number, lo: number, hi: number) => (2 * half <= hi - lo ? Math.min(Math.max(c, lo + half), hi - half) : Math.min(Math.max(c, hi - half), lo + half));
  return [axis(view[0], w / 2, x0, x1), axis(view[1], (w * H) / W / 2, y0, y1), w];
}

// ── Paths ───────────────────────────────────────────────────────────────────

/** Drops projected points closer than `tol` px to the last kept one (keeps every line's end): LOD by zoom. */
function thinned(out: GeoStream, tol: number): GeoStream {
  let last: Point | null = null;
  let held: Point | null = null;
  return {
    point(x, y) {
      if (last && Math.abs(x - last[0]) < tol && Math.abs(y - last[1]) < tol) {
        held = [x, y];
        return;
      }
      out.point(x, y);
      [last, held] = [[x, y], null];
    },
    lineStart() {
      [last, held] = [null, null];
      out.lineStart();
    },
    lineEnd() {
      if (held) out.point(held[0], held[1]);
      out.lineEnd();
    },
    polygonStart: () => out.polygonStart(),
    polygonEnd: () => out.polygonEnd(),
    sphere: () => out.sphere?.(),
  };
}

/** Thinning tolerance at the closest zoom, in screen px. */
const THIN_PX = 0.5;
/** Share of the frames' union added around it before clipping (camera drift and push stay inside it). */
const CLIP_MARGIN = 0.1;

/** A path generator that clips to a world box and thins to the given tolerance. */
const pathIn = (projection: GeoProjection, [x0, y0, x1, y1]: WorldBox, tol: number) => {
  const clip = geoClipRectangle(x0, y0, x1, y1);
  return geoPath({ stream: (out: GeoStream) => projection.stream(clip(thinned(out, tol))) }).digits(1);
};

/** A polity's label anchor: the centroid of its biggest part (a multi-part empire's centroid can sit in the sea). */
function anchorOf(g: Geometry): [number, number] {
  const big = partsOf(g).reduce<Polygon | null>((a, p) => (!a || geoArea(p) > geoArea(a) ? p : a), null);
  return geoCentroid(big ?? g) as [number, number];
}

// ── Compilation ─────────────────────────────────────────────────────────────

/** A beat's map: which compiled map it draws and its (framed, clamped) camera target. */
export interface MapBeat {
  map: string;
  view: View;
}
export interface CompiledMaps {
  scene: GeoScene;
  beats: (MapBeat | null)[];
  sources: GeoSourceId[];
}

/**
 * Per era: the datasets it draws (GEO_SOURCES ids; a US admin-1 pack adds us_atlas) and whether
 * its borders are approximate (reconstructed history, not surveyed borders).
 */
const ERAS: Record<MapEra, { sources: GeoSourceId[]; approximate: boolean }> = {
  ancient: { sources: ['world_atlas', 'awmc'], approximate: true },
  modern: { sources: ['natural_earth'], approximate: false },
  historical: { sources: ['natural_earth', 'cliopatria'], approximate: true },
};

/** Every place a map shot points at (labels, pins, pen circle, arrow and army ends). */
export function mapSubjects(shot: MapShot): string[] {
  const arrows = [...(shot.arrow ? [shot.arrow] : []), ...(shot.armies ?? [])];
  return [...shot.labels.map((l) => l.place), ...(shot.pins ?? []).map((p) => p.place), ...(shot.circle ? [shot.circle.place] : []), ...arrows.flatMap((a) => [a.from, a.to])];
}

/** The compiled map a beat draws: its world run, and its era's year (snapshot or ancient era-name year). */
const mapKey = (run: number, shot: MapShot) => {
  const { year, snapshot } = mapEra(shot);
  return `w${run}${snapshot !== undefined ? `@${snapshot}` : year !== undefined ? `~${year}` : ''}`;
};

/** Fill geometry per kind of fill id (places.ts kindOf); a kind missing here cannot be filled. */
const FILL_GEOMETRY: Partial<Record<NonNullable<ReturnType<typeof kindOf>>, (id: string, ctx: { worldview: Worldview; snapshot?: number }) => Feature<Geometry>>> = {
  country: (id, { worldview }) => featureById(PACKS.world(worldview), 'countries', id),
  admin1: (id) => featureById(PACKS.admin1(id.slice('admin1:'.length).split('-')[0]!), 'admin1', id),
  polity: (id, { snapshot }) => featureById(PACKS.hist(snapshot!), 'polities', id),
  ancient: (id) => collection(PACKS.ancient(), id) as unknown as Feature<Geometry>,
};

/**
 * Compiles every map beat of a resolved sheet for one frame layout: worlds, projections,
 * cameras, and the pruned scene. Null when the sheet has no map.
 */
export function compileMaps(sheet: BeatSheet, layout: Layout, worldview: Worldview): CompiledMaps | null {
  if (!sheet.beats.some((b) => b.shot.kind === 'map')) return null;
  // Worlds: a run of beats that continue each other is one canvas with one projection.
  const runOf = sheet.beats.reduce<number[]>((acc, b, i) => [...acc, i > 0 && continues(sheet.beats[i - 1], b) ? acc[i - 1]! : i], []);
  const mapBeats = sheet.beats.flatMap((b, i) => (b.shot.kind === 'map' ? [{ i, shot: b.shot as MapShot, run: runOf[i]! }] : []));
  const runs = [...new Set(mapBeats.map((b) => b.run))];

  const scene: GeoScene = { maps: {} };
  const beats: (MapBeat | null)[] = sheet.beats.map(() => null);
  const sources = new Set<GeoSourceId>();

  for (const run of runs) {
    const members = mapBeats.filter((b) => b.run === run);
    const era = mapEra(members[0]!.shot).era;
    const polityBox = (shot: MapShot) => mainBox(FILL_GEOMETRY.polity!(shot.view, { worldview, snapshot: mapEra(shot).snapshot }).geometry);
    const boxes = members.map(({ shot }) => viewBox(shot.view) ?? polityBox(shot));
    const box: BBox = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
    const pinned = new Set(members.flatMap(({ shot }) => {
      const v = MAP_VIEWS[shot.view as MapViewId];
      return v && 'projection' in v ? [v.projection] : [];
    }));
    const usOnly = members.every(({ shot }) => shot.view === 'usa' || shot.view.startsWith('admin1:US-') || shot.view === 'country:US');
    const projectionId = projectionFor({ era, box, pinned, usOnly });
    const projection = PROJECTIONS[projectionId](box);
    const project = (lonLat: readonly [number, number], what: string): Point => {
      const xy = projection(lonLat as [number, number]);
      if (!xy) throw new Error(`${what} is outside this map's ${projectionId} projection (world of beat ${sheet.beats[run]!.id})`);
      return [Math.round(xy[0] * 10) / 10, Math.round(xy[1] * 10) / 10];
    };
    const path = geoPath(projection);
    const worldBox = (b: BBox): WorldBox => {
      const [[x0, y0], [x1, y1]] = path.bounds(bboxOutline(b));
      return [x0, y0, x1, y1];
    };
    const sphere = path.bounds({ type: 'Sphere' });
    const sphereBox: WorldBox | null = SPHERE_CLAMPED.has(projectionId) && sphere.flat().every(Number.isFinite) ? [sphere[0][0], sphere[0][1], sphere[1][0], sphere[1][1]] : null;

    // Places: every subject and fill origin of the run, projected once (era names per map below).
    const fillCtx = (shot: MapShot) => ({ worldview, snapshot: mapEra(shot).snapshot });
    const pointOf = (id: string, shot: MapShot): Point => {
      const at = placeById(id)?.at;
      return at ? project(at, id) : project(anchorOf(FILL_GEOMETRY.polity!(id, fillCtx(shot)).geometry), id);
    };

    // Cameras: the view's box (a world view cropped to the sphere), framed on its subjects; the ancient
    // pack's ragged edge is clamped after framing, while past the sphere there is only sea, so subjects win there.
    members.forEach(({ i, shot }, k) => {
      const base = viewOf(worldBox(boxes[k]!), layout);
      const framed = frameView(sphereBox ? clampToBox(base, layout, sphereBox) : base, mapSubjects(shot).map((p) => pointOf(p, shot)), layout);
      beats[i] = { map: mapKey(run, shot), view: era === 'ancient' ? clampToData(framed, layout) : framed };
    });

    // Pruning: base layers are clipped to the union of the run's frames (plus margin) and thinned for its closest zoom.
    const frames = members.map(({ i }) => {
      const [cx, cy, w] = beats[i]!.view;
      const h = (w * layout.height) / layout.width;
      return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] as const;
    });
    const [fx0, fy0, fx1, fy1] = [Math.min(...frames.map((f) => f[0])), Math.min(...frames.map((f) => f[1])), Math.max(...frames.map((f) => f[2])), Math.max(...frames.map((f) => f[3]))];
    const m = (fx1 - fx0) * CLIP_MARGIN;
    const clip: WorldBox = [fx0 - m, fy0 - m, fx1 + m, fy1 + m];
    const tol = (THIN_PX * Math.min(...members.map(({ i }) => beats[i]!.view[2]))) / layout.width / 2;
    const draw = pathIn(projection, clip, tol);
    const d = (g: GeoPermissibleObjects) => draw(g) ?? '';

    for (const key of [...new Set(members.map(({ shot }) => mapKey(run, shot)))]) {
      const shots = members.filter(({ shot }) => mapKey(run, shot) === key).map((b) => b.shot);
      const { year, snapshot } = mapEra(shots[0]!);
      for (const s of ERAS[era].sources) sources.add(s);
      // A fill fades out in the next beat of its world (timing.ts `fading`), so the map drawing that beat needs it too.
      const fillShots = members.flatMap(({ shot }, k) => (mapKey(run, shot) === key ? [shot, ...(k > 0 ? [members[k - 1]!.shot] : [])] : []));
      const fillOwner = new Map(fillShots.flatMap((s) => s.layers.map((l) => [l.layer, s] as const)).reverse());
      const fills = [...fillOwner.keys()];
      const placeIds = [...new Set(shots.flatMap(mapSubjects))];
      // Admin-1 borders show for a country framed as the view, or whose admin-1 areas are filled or framed (modern maps only).
      const admin1Of = (id: string): string[] => (id === 'usa' ? ['US'] : id.startsWith('admin1:') ? [id.slice(7).split('-')[0]!] : []);
      const framed = (id: string): string[] => (id.startsWith('country:') && existsSync(join(ROOT, PACKS.admin1(id.slice(8)))) ? [id.slice(8)] : admin1Of(id));
      const admin1Countries = era !== 'modern' ? [] : [...new Set(shots.flatMap((s) => [...framed(s.view), ...s.layers.flatMap((l) => admin1Of(l.layer))]))];
      if (admin1Countries.includes('US') || fills.some((f) => f.startsWith('admin1:US-'))) sources.add('us_atlas');
      scene.maps[key] = {
        era,
        projection: projectionId,
        approximate: ERAS[era].approximate,
        ...(year !== undefined && { year }),
        base: { ...EMPTY_BASE, ...BASES[projectionId === 'albers_usa' ? 'us' : era]({ worldview, snapshot, admin1Countries, d }) },
        fills: Object.fromEntries(
          fills.map((id) => {
            const owner = fillOwner.get(id)!;
            const f = FILL_GEOMETRY[kindOf(id)!]!(id, fillCtx(owner));
            const ancient = ANCIENT_LAYERS[id as AncientLayerId];
            const origin = pointOf(ancient?.origin ?? id, owner);
            return [id, { d: d(f), kind: ancient?.kind ?? 'area', origin }];
          }),
        ),
        places: Object.fromEntries(placeIds.map((id) => [id, { at: pointOf(id, shots[0]!), name: placeName(id, year) }])),
      } satisfies GeoMap;
    }
  }
  return { scene, beats, sources: [...sources].sort() };
}

interface BaseContext {
  worldview: Worldview;
  snapshot?: number;
  admin1Countries: string[];
  d: (g: GeoPermissibleObjects) => string;
}
const EMPTY_BASE: GeoMap['base'] = { land: '', borders: '', admin1: '', disputed: '', lakes: '', rivers: '' };
/** Modern water, shared by modern and historical maps. */
const waters = ({ worldview, d }: BaseContext) => ({ lakes: d(collection(PACKS.world(worldview), 'lakes')), rivers: d(collection(PACKS.world(worldview), 'rivers')) });

/**
 * Base layers per kind of map (a row each): ancient land only; modern land (countries merged, so
 * coasts and borders share arcs), borders, disputed areas, lakes, rivers, and admin-1 borders of
 * framed countries; historical land with that year's polity borders (never modern ones); the
 * AlbersUsa map only the US and its states (its Alaska and Hawaii insets would otherwise draw
 * their neighbours into the inset boxes).
 */
const BASES: Record<MapEra | 'us', (c: BaseContext) => Partial<GeoMap['base']>> = {
  ancient: ({ d }) => ({ land: d(collection(PACKS.ancient(), 'land')) }),
  us: ({ d }) => ({ land: d(merged(PACKS.admin1('US'), 'admin1')), admin1: d(borders(PACKS.admin1('US'), 'admin1')) }),
  historical: (c) => ({ ...waters(c), land: c.d(merged(PACKS.world(c.worldview), 'countries')), borders: c.d(borders(PACKS.hist(c.snapshot!), 'polities')) }),
  modern: (c) => ({
    ...waters(c),
    land: c.d(merged(PACKS.world(c.worldview), 'countries')),
    borders: c.d(borders(PACKS.world(c.worldview), 'countries')),
    admin1: c.admin1Countries.map((cc) => c.d(borders(PACKS.admin1(cc), 'admin1'))).join(''),
    disputed: c.d(collection(PACKS.world(c.worldview), 'disputed')),
  }),
};

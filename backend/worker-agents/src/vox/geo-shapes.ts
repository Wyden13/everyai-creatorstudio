/**
 * Shape helpers shared by the map compiler (geo.ts) and the pack build (scripts/geo-build.ts).
 * Pure d3-geo maths, no packs: the build can run before any catalog exists.
 */
import { geoArea, geoBounds } from 'd3-geo';
import type { Geometry, MultiPolygon, Polygon } from 'geojson';
import type { BBox } from './geo-manifest';

/** A shape's polygons (a Polygon is one part; lines and points have none). */
export const partsOf = (g: Geometry): Polygon[] => (g.type === 'Polygon' ? [g] : g.type === 'MultiPolygon' ? g.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })) : []);

/**
 * Framing box of a shape (degrees, 0.1° steps): the parts at least a quarter the area of its
 * biggest part, so France frames Europe-sized (not stretched to French Guiana), the US is the
 * lower 48 and Austria-Hungary leaves out its Tianjin concession. A box across the
 * antimeridian keeps east > west (east + 360).
 */
export function mainBox(g: Geometry): BBox {
  const parts = partsOf(g);
  const areas = parts.map((p) => geoArea(p));
  const big = Math.max(...areas);
  const kept: MultiPolygon = { type: 'MultiPolygon', coordinates: parts.filter((_, i) => areas[i]! >= big / 4).map((p) => p.coordinates) };
  const [[w, s], [e, n]] = geoBounds(kept);
  return [w, s, e < w ? e + 360 : e, n].map((v) => Math.round(v * 10) / 10) as unknown as BBox;
}

/**
 * iOS continuous corners, in closed form (Figma's corner-smoothing construction).
 * Each corner is a short circular arc flanked by two cubic Béziers that ramp curvature in from zero,
 * so the edge never jumps from straight to round the way a CSS circular radius does.
 * smoothing 0.6 matches iOS. Returns an SVG path in the box (0,0)-(w,h).
 */
const rad = (d: number) => (d * Math.PI) / 180;

function corner(r: number, smoothing: number, budget: number) {
  let p = (1 + smoothing) * r;
  const maxS = budget / r - 1;
  smoothing = Math.max(0, Math.min(smoothing, maxS));
  p = Math.min(p, budget);
  const arcMeasure = 90 * (1 - smoothing);
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * smoothing;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  return { a, b, c, d, p, arc, r };
}

const f = (n: number) => +n.toFixed(2);

export function smoothRect(w: number, h: number, radius: number, smoothing = 0.6, inset = 0): string {
  const x0 = inset, y0 = inset;
  w -= inset * 2; h -= inset * 2;
  if (w <= 0 || h <= 0) return '';
  const budget = Math.min(w, h) / 2;
  const r = Math.min(radius, budget);
  if (r <= 0) return `M${x0} ${y0}h${f(w)}v${f(h)}h${f(-w)}Z`;
  const { a, b, c, d, p, arc } = corner(r, smoothing, budget);
  const R = f(r), A = f(a), AB = f(a + b), ABC = f(a + b + c), BC = f(b + c), C = f(c), D = f(d), S = f(arc);
  return [
    `M${f(x0 + w - p)} ${f(y0)}`,
    `c${A} 0 ${AB} 0 ${ABC} ${D}a${R} ${R} 0 0 1 ${S} ${S}c${D} ${C} ${D} ${BC} ${D} ${ABC}`,
    `L${f(x0 + w)} ${f(y0 + h - p)}`,
    `c0 ${A} 0 ${AB} ${-D} ${ABC}a${R} ${R} 0 0 1 ${-S} ${S}c${-C} ${D} ${-BC} ${D} ${-ABC} ${D}`,
    `L${f(x0 + p)} ${f(y0 + h)}`,
    `c${-A} 0 ${-AB} 0 ${-ABC} ${-D}a${R} ${R} 0 0 1 ${-S} ${-S}c${-D} ${-C} ${-D} ${-BC} ${-D} ${-ABC}`,
    `L${f(x0)} ${f(y0 + p)}`,
    `c0 ${-A} 0 ${-AB} ${D} ${-ABC}a${R} ${R} 0 0 1 ${S} ${-S}c${C} ${-D} ${BC} ${-D} ${ABC} ${-D}`,
    'Z',
  ].join('');
}

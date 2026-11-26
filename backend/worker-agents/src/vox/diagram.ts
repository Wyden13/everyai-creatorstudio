/**
 * Diagram geometry (pure; shared by the widgets and the tests): where a split's parts and a
 * chain's nodes sit on the stage, per orientation. Every count the schema allows (COUNTS in
 * beat-sheet.ts) fits the stage by construction; vox.test.ts proves it for both aspects.
 */
import type { Layout, Rect } from './tokens';

type Point = readonly [number, number];

/**
 * Average advance per character (em): heavy sans for node names and figures, tracked heavy caps
 * for part labels, the wider-tracked caps of sub lines and captions under figures (CAPS), and
 * bold sentence-case text (checklist items, chat messages; rounded up so wraps never run long),
 * and its mean advance (for pen strokes meant to end with the text).
 */
export const GLYPH_EM = { heavy: 0.62, caps: 0.78, trackedCaps: 0.86, text: 0.58, textMean: 0.5 } as const;

/** Line heights and sub size (px) of a label stack (timeline marks, chain nodes) for a head size. */
export const stackLines = (fontPx: number, stack: Layout['markStack']) => ({
  head: Math.round(fontPx * stack.head),
  sub: Math.round(fontPx * stack.sub),
  subPx: Math.round(fontPx * stack.subPx),
});

/** Lines a tracked caps label takes at `px` in a box `w` wide, up to the layout's `labelLines` (1: it never wraps). */
export const capsLines = (text: string, px: number, w: number, L: Layout) => Math.min(L.labelLines, Math.max(1, Math.ceil((text.length * GLYPH_EM.trackedCaps * px) / w)));

/** 1-D de-overlap: moves centres at least `gap` apart inside [lo, hi], keeping their order. */
export function spread(centres: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = centres.map((_, i) => i).sort((i, j) => centres[i]! - centres[j]!);
  const out = [...centres];
  order.forEach((i, k) => (out[i] = Math.max(out[i]!, k ? out[order[k - 1]!]! + gap : lo)));
  for (let k = order.length - 1; k >= 0; k--) out[order[k]!] = Math.min(out[order[k]!]!, k < order.length - 1 ? out[order[k + 1]!]! - gap : hi);
  return out;
}

// ── Split: one slab tears into parts that drift apart ───────────────────────

/** Split geometry (px): the separation at the end of the tear, the extra drift after it, crack teeth. */
export const SPLIT = { gap: 64, drift: 32, jag: 16, teeth: 7, labelPad: 24, labelMinPx: 24 } as const;

/**
 * The whole slab per orientation (share of the stage), centred. A row tears along x (parts side
 * by side), a column along y (stacked bands, for the phone). Add an orientation as a row.
 */
const SLAB: Record<Layout['compare'], { w: number; h: number; axis: 'x' | 'y' }> = {
  row: { w: 0.88, h: 0.5, axis: 'x' },
  // The phone's slab spans the stage width and leaves room for three parts' full separation.
  column: { w: 1, h: 0.8, axis: 'y' },
};

export interface SplitGeometry {
  slab: Rect;
  axis: 'x' | 'y';
  /** Jagged tear lines between neighbouring parts, at zero separation. */
  cracks: Point[][];
  /** Per part: its outline at zero separation, its label box, and its shift per px of separation along the axis. */
  parts: { poly: Point[]; label: Rect; shift: number }[];
  labelPx: number;
}

export function splitLayout(L: Layout, labels: readonly string[]): SplitGeometry {
  const { stage } = L.zone;
  const spec = SLAB[L.compare];
  const slab: Rect = { x: stage.x + (stage.w * (1 - spec.w)) / 2, y: stage.y + (stage.h * (1 - spec.h)) / 2, w: stage.w * spec.w, h: stage.h * spec.h };
  const n = labels.length;
  // Work in (u along the tear axis, v across it), then map back to screen x/y.
  const [u0, U, v0, V] = spec.axis === 'x' ? [slab.x, slab.w, slab.y, slab.h] : [slab.y, slab.h, slab.x, slab.w];
  const xy = (u: number, v: number): Point => (spec.axis === 'x' ? [u, v] : [v, u]);
  const cut = (k: number) => u0 + (U * k) / n;
  const crack = (k: number): Point[] =>
    Array.from({ length: SPLIT.teeth + 1 }, (_, j) => xy(cut(k) + (j === 0 || j === SPLIT.teeth ? 0 : j % 2 ? SPLIT.jag : -SPLIT.jag), v0 + (V * j) / SPLIT.teeth));
  const edge = (k: number): Point[] => (k === 0 || k === n ? [xy(cut(k), v0), xy(cut(k), v0 + V)] : crack(k));
  // The label runs along x: across a part's width in a row, along the band in a column.
  const textW = (spec.axis === 'x' ? U / n - 2 * SPLIT.jag : V) - 2 * SPLIT.labelPad;
  const labelPx = Math.min(L.type.part, Math.floor(textW / (Math.max(...labels.map((l) => l.length)) * GLYPH_EM.caps)));
  const labelH = Math.round(labelPx * 1.3);
  return {
    slab,
    axis: spec.axis,
    cracks: Array.from({ length: n - 1 }, (_, k) => crack(k + 1)),
    parts: labels.map((_, i) => {
      const [cx, cy] = xy((cut(i) + cut(i + 1)) / 2, v0 + V / 2);
      return {
        poly: [...edge(i), ...edge(i + 1).reverse()],
        label: { x: cx - textW / 2, y: cy - labelH / 2, w: textW, h: labelH },
        shift: i - (n - 1) / 2,
      };
    }),
    labelPx,
  };
}

// ── Chain: labelled nodes joined by arrows, built one link at a time ────────

/** Chain geometry (px): node ring radius, label distance from the spine, gap between labels, arrow inset. */
export const CHAIN = { node: 14, offset: 40, gap: 24, inset: 26, labelMinPx: 28 } as const;

export interface ChainNode {
  label: string;
  sub?: string;
}

export interface ChainGeometry {
  points: Point[];
  /** Label stack box per node (head line + optional sub line). */
  labels: Rect[];
  headPx: number;
}

/**
 * Node and label placement per orientation, for the nodes on screen. A row runs left→right
 * along the stage middle with labels alternating below/above (spread so same-side neighbours
 * never touch); a column (phone) runs top→bottom down the stage's left edge with labels filling
 * the width right of the spine. Add an orientation as a row.
 */
const CHAINS: Record<Layout['ruler'], (stage: Rect, nodes: readonly ChainNode[], fit: (w: number) => number, L: Layout) => ChainGeometry> = {
  row: (stage, nodes, fit, L) => {
    const n = nodes.length;
    const y = stage.y + stage.h / 2;
    const xs = nodes.map((_, i) => stage.x + ((i + 0.5) * stage.w) / n);
    const w = Math.min(stage.w * 0.46, stage.w / Math.ceil(n / 2)) - CHAIN.gap;
    const headPx = Math.min(L.type.mark, fit(w));
    const lines = stackLines(headPx, L.markStack);
    const below = (i: number) => i % 2 === 0;
    const centres = new Map(
      [true, false].flatMap((side) => {
        const idx = nodes.map((_, i) => i).filter((i) => below(i) === side);
        const cx = spread(idx.map((i) => xs[i]!), w + CHAIN.gap, stage.x + w / 2, stage.x + stage.w - w / 2);
        return idx.map((i, k) => [i, cx[k]!] as const);
      }),
    );
    return {
      points: xs.map((x) => [x, y] as const),
      labels: nodes.map((node, i) => {
        const h = lines.head + (node.sub ? lines.sub : 0);
        return { x: centres.get(i)! - w / 2, y: below(i) ? y + CHAIN.offset : y - CHAIN.offset - h, w, h };
      }),
      headPx,
    };
  },
  column: (stage, nodes, fit, L) => {
    const n = nodes.length;
    const x = stage.x + CHAIN.node * 2;
    const step = stage.h / n;
    const left = x + CHAIN.offset;
    const w = stage.x + stage.w - left;
    // Sub lines are counted at the largest head size (an upper bound), so the stack always fits its step.
    const subLines = (sub: string | undefined, px: number) => (sub ? capsLines(sub, px * L.markStack.subPx, w, L) : 0);
    const most = Math.max(...nodes.map((node) => subLines(node.sub, L.type.mark)));
    const headPx = Math.min(L.type.mark, fit(w), Math.floor((step - CHAIN.gap) / (L.markStack.head + most * L.markStack.sub)));
    const lines = stackLines(headPx, L.markStack);
    return {
      points: nodes.map((_, i) => [x, stage.y + (i + 0.5) * step] as const),
      labels: nodes.map((node, i) => {
        const h = lines.head + subLines(node.sub, headPx) * lines.sub;
        return { x: left, y: stage.y + (i + 0.5) * step - h / 2, w, h };
      }),
      headPx,
    };
  },
};

export function chainLayout(L: Layout, nodes: readonly ChainNode[]): ChainGeometry {
  const longest = Math.max(...nodes.map((n) => n.label.length));
  return CHAINS[L.ruler](L.zone.stage, nodes, (w) => Math.floor(w / (longest * GLYPH_EM.heavy)), L);
}

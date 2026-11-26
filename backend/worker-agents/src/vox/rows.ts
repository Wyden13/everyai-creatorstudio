/**
 * The list shots' logic and geometry (pure; shared by the validator, the widgets and the tests).
 * Who wins is computed here from typed values, never taken from the model: a ranking's order and
 * a versus row's winner. Where a ranking's rows, a versus's halves, a checklist's rows and a
 * chat's bubbles sit on the stage is one table row per orientation (`Layout['compare']`), with
 * every size from LAYOUTS (tokens.ts).
 */
import type { Better } from './beat-sheet';
import { GLYPH_EM } from './diagram';
import { figureParts, formatFigure, type NumberUnit } from './format';
import type { Layout, Rect, TextLine } from './tokens';

// ── Standings ───────────────────────────────────────────────────────────────

/** How a value scores under `better`: the bigger score wins (`none`: nobody does). */
const SCORE: Record<Better, (v: number) => number> = { higher: (v) => v, lower: (v) => -v, none: () => 0 };

/** Rank of each value (0 = #1) under `better`; equal values keep their order. */
export function rankOrder(values: readonly number[], better: Exclude<Better, 'none'>): number[] {
  const score = values.map(SCORE[better]);
  const order = values.map((_, i) => i).sort((i, j) => score[j]! - score[i]! || i - j);
  return values.map((_, i) => order.indexOf(i));
}

/**
 * Slot (0 = top) of each item once the first `k` items in arrival order are on screen: arrived
 * items pack from the top in rank order, so a newcomer pushes worse items down; an item not yet
 * arrived has no slot.
 */
export function rankSlots(ranks: readonly number[], arrival: readonly number[], k: number): (number | undefined)[] {
  const on = arrival.slice(0, k);
  return ranks.map((r, i) => (on.includes(i) ? on.filter((j) => ranks[j]! < r).length : undefined));
}

export type SideId = 'left' | 'right';
type VersusRow = { left: number; right: number; better: Better };

/** A versus row's winner, or null (a tie, or a row whose `better` is `none`). */
export function rowWinner({ left, right, better }: VersusRow): SideId | null {
  const d = SCORE[better](left) - SCORE[better](right);
  return d > 0 ? 'left' : d < 0 ? 'right' : null;
}

/** Every row's winner, and the side that wins more rows (null on a draw). */
export function versusVerdict(rows: readonly VersusRow[]): { rows: (SideId | null)[]; winner: SideId | null } {
  const won = rows.map(rowWinner);
  const tally = (s: SideId) => won.filter((w) => w === s).length;
  const d = tally('left') - tally('right');
  return { rows: won, winner: d > 0 ? 'left' : d < 0 ? 'right' : null };
}

// ── Text measure ────────────────────────────────────────────────────────────

/** Greedy word wrap of sentence-case text at `px` into lines no wider than `w` (GLYPH_EM.text per character). */
export function wrapLines(text: string, px: number, w: number): string[] {
  const fits = (s: string) => s.length * GLYPH_EM.text * px <= w;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((lines, word) => {
      const last = lines.at(-1);
      return last !== undefined && fits(`${last} ${word}`) ? [...lines.slice(0, -1), `${last} ${word}`] : [...lines, word];
    }, []);
}

/** A text role scaled to `px`, keeping its line-height ratio. */
const scaled = (t: TextLine, px: number): TextLine => ({ px, line: Math.round((t.line * px) / t.px) });

// ── Ranking ─────────────────────────────────────────────────────────────────

/** A ranking's figures share the largest one's magnitude ("6.5", "2.8" under "million km²"). */
export const rankFigure = (value: number, unit: NumberUnit, values: readonly number[]) => figureParts(value, unit, Math.max(...values)).main;

export interface RankingGeometry {
  /** The shared unit line ("million km²") above the value column, when the unit has one. */
  head: { box: Rect; text: string } | null;
  /** Top of slot 0 and the height of one slot; slot k's top is `top + k * slot`. */
  top: number;
  slot: number;
  /** Row parts, with `y` relative to the slot top. The bar's `w` is its full length (the largest value). */
  numeral: Rect;
  label: Rect;
  bar: Rect;
  /** The value box's width and top; it rides just past the bar head. */
  value: { w: number; y: number };
}

/**
 * Per orientation: a row (16:9) is numeral | label | bar → value on one line; a column (phone)
 * puts the label above a full-width bar. Add an orientation as a row.
 */
type RankingRows = Omit<RankingGeometry, 'head' | 'top'>;
const RANKINGS: Record<Layout['compare'], (L: Layout, n: number, valueW: number, h: number) => RankingRows> = {
  row: (L, n, valueW, h) => {
    const { stage } = L.zone;
    const r = L.rank;
    const slot = h / n;
    const mid = (h: number) => (slot - h) / 2;
    const [numW, labelW] = [150, 500];
    const barX = stage.x + numW + labelW + 32;
    return {
      slot,
      numeral: { x: stage.x, y: mid(r.numeral.line), w: numW, h: r.numeral.line },
      label: { x: stage.x + numW, y: mid(r.label.line), w: labelW, h: r.label.line },
      bar: { x: barX, y: mid(r.bar), w: stage.x + stage.w - barX - valueW, h: r.bar },
      value: { w: valueW, y: mid(r.value.line) },
    };
  },
  column: (L, n, valueW, h) => {
    const { stage } = L.zone;
    const r = L.rank;
    const slot = h / n;
    const numW = 150;
    const x = stage.x + numW;
    const top = (slot - (r.label.line + 10 + Math.max(r.bar, r.value.line))) / 2;
    const barY = top + r.label.line + 10 + (Math.max(r.bar, r.value.line) - r.bar) / 2;
    return {
      slot,
      numeral: { x: stage.x, y: (slot - r.numeral.line) / 2, w: numW, h: r.numeral.line },
      label: { x, y: top, w: stage.x + stage.w - x, h: r.label.line },
      bar: { x, y: barY, w: stage.x + stage.w - x - valueW, h: r.bar },
      value: { w: valueW, y: barY + r.bar / 2 - r.value.line / 2 },
    };
  },
};

/** Rows fill the stage under the unit line (when the unit has one: "million km²", "days"; none for "51%"). */
export function rankingLayout(L: Layout, items: readonly { value: number }[], unit: NumberUnit): RankingGeometry {
  const { stage } = L.zone;
  const values = items.map((i) => i.value);
  const widest = Math.max(...values.map((v) => rankFigure(v, unit, values).length));
  const text = figureParts(Math.max(...values), unit).unit;
  const headH = text ? L.rank.label.line + 8 : 0;
  const rows = RANKINGS[L.compare](L, items.length, Math.ceil(widest * GLYPH_EM.heavy * L.rank.value.px) + 24, stage.h - headH);
  return { ...rows, head: text ? { box: { x: stage.x, y: stage.y, w: stage.w, h: L.rank.label.line }, text } : null, top: stage.y + headH };
}

// ── Versus ──────────────────────────────────────────────────────────────────

export interface VersusRowGeometry {
  /** The row label: once between the columns (row), or once per half (column). */
  labels: Rect[];
  values: [Rect, Rect];
  /** Both values share one size, fitted to their boxes. */
  value: TextLine;
}

export interface VersusGeometry {
  sides: [Rect, Rect];
  /** The VS badge's centre. */
  badge: readonly [number, number];
  rows: VersusRowGeometry[];
  align: { label: 'left' | 'center'; values: ['left' | 'right', 'left' | 'right'] };
}

type VersusInput = { label: string; unit: NumberUnit; left: number; right: number };

/** Value px that fits `chars` heavy figures in `w`, under the layout's ceiling and the slot's height. */
const valueFit = (L: Layout, chars: number, w: number, slot: number) => scaled(L.versus.value, Math.min(L.versus.value.px, Math.floor(w / (chars * GLYPH_EM.heavy)), Math.floor(slot / 1.15)));
const versusChars = (r: VersusInput) => Math.max(formatFigure(r.left, r.unit).length, formatFigure(r.right, r.unit).length);

/**
 * Per orientation: side by side (16:9) puts the names over two value columns with the row labels
 * between them; stacked halves (phone) give each side a half (name, then label | value rows) and
 * the VS badge sits in the seam between them. Add an orientation as a row.
 */
const VERSUS: Record<Layout['compare'], (L: Layout, rows: readonly VersusInput[]) => VersusGeometry> = {
  row: (L, rows) => {
    const { stage } = L.zone;
    const v = L.versus;
    const colW = stage.w * 0.34;
    const [lx, mx, rx] = [stage.x, stage.x + colW, stage.x + stage.w - colW];
    const top = stage.y + v.side.line + 48;
    const slot = (stage.y + stage.h - top) / rows.length;
    return {
      sides: [
        { x: lx, y: stage.y, w: colW, h: v.side.line },
        { x: rx, y: stage.y, w: colW, h: v.side.line },
      ],
      badge: [stage.x + stage.w / 2, stage.y + v.side.line / 2],
      rows: rows.map((r, i) => {
        const value = valueFit(L, versusChars(r), colW - 24, slot);
        const y = top + i * slot;
        return {
          labels: [{ x: mx, y: y + (slot - v.label.line) / 2, w: rx - mx, h: v.label.line }],
          values: [
            { x: lx, y: y + (slot - value.line) / 2, w: colW - 24, h: value.line },
            { x: rx + 24, y: y + (slot - value.line) / 2, w: colW - 24, h: value.line },
          ],
          value,
        };
      }),
      align: { label: 'center', values: ['right', 'left'] },
    };
  },
  column: (L, rows) => {
    const { stage } = L.zone;
    const v = L.versus;
    const halfH = (stage.h - v.seam) / 2;
    const halves = [stage.y, stage.y + halfH + v.seam];
    const labelW = Math.ceil(Math.max(...rows.map((r) => r.label.length)) * GLYPH_EM.caps * v.label.px);
    const valueW = stage.w - labelW - 24;
    const slot = (halfH - v.side.line - 12) / rows.length;
    const rowTop = (half: number, i: number) => half + v.side.line + 12 + i * slot;
    return {
      sides: halves.map((y) => ({ x: stage.x, y, w: stage.w - v.badge, h: v.side.line })) as [Rect, Rect],
      badge: [stage.x + stage.w - v.badge / 2, stage.y + halfH + v.seam / 2],
      rows: rows.map((r, i) => {
        const value = valueFit(L, versusChars(r), valueW, slot);
        const box = (half: number, x: number, w: number, line: number): Rect => ({ x, y: rowTop(half, i) + (slot - line) / 2, w, h: line });
        return {
          labels: halves.map((h) => box(h, stage.x, labelW, v.label.line)),
          values: halves.map((h) => box(h, stage.x + labelW + 24, valueW, value.line)) as [Rect, Rect],
          value,
        };
      }),
      align: { label: 'left', values: ['right', 'right'] },
    };
  },
};

export const versusLayout = (L: Layout, rows: readonly VersusInput[]): VersusGeometry => VERSUS[L.compare](L, rows);

// ── Checklist ───────────────────────────────────────────────────────────────

/** Lines an item may wrap onto. */
const CHECK_LINES = 2;

export interface ChecklistGeometry {
  text: TextLine;
  /** Per item: the pen box, the text box and its wrapped lines. */
  rows: { box: Rect; text: Rect; lines: string[] }[];
}

/**
 * Items spread evenly down the stage, a pen box left of each; the text shrinks (never under
 * `readable`) until every item fits its slot in at most CHECK_LINES lines.
 */
export function checklistLayout(L: Layout, items: readonly string[]): ChecklistGeometry {
  const { stage } = L.zone;
  const { box } = L.check;
  const gap = Math.round(box * 0.4);
  const textW = stage.w - box - gap;
  const slot = stage.h / items.length;
  const fitsAt = (t: TextLine) => items.every((s) => {
    const n = wrapLines(s, t.px, textW).length;
    return n <= CHECK_LINES && n * t.line <= slot - 8;
  });
  const sizes = Array.from({ length: L.check.text.px - L.readable + 1 }, (_, k) => scaled(L.check.text, L.check.text.px - k));
  const text = sizes.find(fitsAt) ?? sizes.at(-1)!;
  return {
    text,
    rows: items.map((s, i) => {
      const lines = wrapLines(s, text.px, textW);
      const mid = stage.y + (i + 0.5) * slot;
      const h = lines.length * text.line;
      return { box: { x: stage.x, y: mid - box / 2, w: box, h: box }, text: { x: stage.x + box + gap, y: mid - h / 2, w: textW, h }, lines };
    }),
  };
}

// ── Chat ────────────────────────────────────────────────────────────────────

/** The chat's header in the title zone: both participants. */
export const chatTitle = (people: { a: string; b: string }) => `${people.a} & ${people.b}`;

export interface ChatBubble {
  side: 'a' | 'b';
  /** Left edge and size; the stack decides `y`. */
  x: number;
  w: number;
  h: number;
  lines: string[];
}

export interface ChatGeometry {
  bubbles: ChatBubble[];
  /** The typing-dots bubble's size, and the avatar column per side (x). */
  dots: { w: number; h: number };
  avatarX: Record<'a' | 'b', number>;
  gap: number;
}

/** `a` speaks from the left, `b` from the right, each beside its avatar; bubbles shrink-wrap their wrapped text. */
export function chatLayout(L: Layout, messages: readonly { from: 'a' | 'b'; text: string }[]): ChatGeometry {
  const { stage } = L.zone;
  const { text, pad, maxShare, avatar } = L.chat;
  const inner = stage.w * maxShare - 2 * pad;
  const avatarX = { a: stage.x, b: stage.x + stage.w - avatar };
  const bubbles = messages.map((m) => {
    const lines = wrapLines(m.text, text.px, inner);
    const w = Math.ceil(Math.max(...lines.map((l) => l.length)) * GLYPH_EM.text * text.px) + 2 * pad;
    const x = m.from === 'a' ? avatarX.a + avatar + 16 : avatarX.b - 16 - w;
    return { side: m.from, x, w, h: lines.length * text.line + 2 * pad, lines };
  });
  return { bubbles, dots: { w: 2 * pad + 3 * 22 + 2 * 14, h: Math.round(text.line * 0.8) + 2 * pad }, avatarX, gap: Math.round(pad * 0.9) };
}

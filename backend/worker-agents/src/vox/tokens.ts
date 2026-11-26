/**
 * VOX_SPEC: the one visual style, written once as numbers.
 * Widgets, the layout solver, the DOM audit and the critic all read these values; nothing else
 * may hard-code a colour, font, zone or timing. Values are sampled from traced Vox reference
 * frames (paper mode).
 */

import { ASPECT_SPECS, CAPTION_LINE_EM } from '../remotion/primitives';
import type { ShotKind } from './beat-sheet';

export const FPS = 30;

export const COLOR = {
  paper: '#EDE0C8',
  paperEdge: '#D7C8AE',
  ink: '#131313',
  inkSoft: '#4A4A4A',
  inkMuted: '#6B6253',
  ochre: '#8A6A2C',
  highlight: '#FFF200',
  penRed: '#C8261E',
  sea: '#B7C3BD',
  seaDeep: '#A3B1AB',
  land: '#EFE5CF',
  coast: '#5E5446',
  /** A punch word's camera flash. */
  flash: '#FFFCF2',
  /** Data tones: meaning is global (red = the subject / alarm, teal = the other side, muted = context). */
  tone: { red: '#D7322B', teal: '#2F9BB8', ochre: '#C9A15A', muted: '#C9B48E', ink: '#2A2622' },
} as const;

export type Tone = keyof typeof COLOR.tone;

/**
 * The paper look's grade: every colour a non-map widget paints with, plus how its marks blend
 * into the field. A register (register.ts) may only re-grade inside the Vox look (tint, highlight,
 * grain, ink mode); fonts and layouts never change. Maps are pictures and keep COLOR.
 */
export interface Grade {
  /** The page colour under the paper texture. */
  field: string;
  /** Paper texture opacity (0 in ink mode: the field is the page). */
  paper: number;
  /** A multiply wash over the paper texture, or none. */
  tint: string | null;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  /** The pen red (rules, pen strokes). */
  accent: string;
  ochre: string;
  highlight: string;
  /** How highlights, bars and fills meet the field: multiply on paper, screen on an ink field. */
  blend: 'multiply' | 'screen';
  grain: { opacity: number; blend: 'multiply' | 'screen' };
  /** Data tones; hues keep their meaning, only `ink` flips with the field. */
  tone: Record<Tone, string>;
}

/** Today's paper look (documentary). */
export const PAPER_GRADE: Grade = {
  field: COLOR.paper,
  paper: 1,
  tint: null,
  ink: COLOR.ink,
  inkSoft: COLOR.inkSoft,
  inkMuted: COLOR.inkMuted,
  accent: COLOR.penRed,
  ochre: COLOR.ochre,
  highlight: COLOR.highlight,
  blend: 'multiply',
  grain: { opacity: 0.55, blend: 'multiply' },
  tone: COLOR.tone,
};

export const FONT = {
  sans: '"Libre Franklin", "Helvetica Neue", Arial, sans-serif',
  serif: '"Source Serif 4", Georgia, serif',
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Aspect = '16:9' | '9:16';

/** One text role: font size and line height (px). */
export interface TextLine {
  px: number;
  line: number;
}

export interface Layout {
  width: number;
  height: number;
  /**
   * Every text element lives in exactly one zone; one zone holds one element group. There is no
   * zone for act/chapter chips: chapters are full-frame cards only.
   */
  zone: { title: Rect; stage: Rect; subtitles: Rect; safe: Rect };
  /**
   * Type scale (px) per role. `figure` and `mark` are ceilings: a figure, a timeline mark or a
   * chain node shrinks to fit its box. `part` is a split part's label ceiling, `punch` a punch
   * word's. `sub` is a title's sub line, `by` a quote's attribution.
   */
  type: { headline: number; chapter: number; figure: number; quote: number; mark: number; part: number; punch: number; kicker: TextLine; end: TextLine; sub: TextLine; by: TextLine };
  /** The smallest text this frame shows on stage (px): a phone shows the stage small. */
  readable: number;
  /** A line chart's x labels and end value, and how many x labels fit across. */
  chart: { x: TextLine; end: TextLine; xLabels: number };
  /** A ranking row: its rank numeral, caps label, value at the bar head, and the bar's thickness (px). */
  rank: { numeral: TextLine; label: TextLine; value: TextLine; bar: number };
  /** A versus: side names, row labels, the value ceiling, the VS badge diameter and the seam stacked halves leave for it (px). */
  versus: { side: TextLine; label: TextLine; value: TextLine; badge: number; seam: number };
  /** A checklist row: the item text ceiling and the pen box (px). */
  check: { text: TextLine; box: number };
  /** A chat: message text, bubble padding (px), a bubble's widest share of the stage, avatar diameter (px). */
  chat: { text: TextLine; pad: number; maxShare: number; avatar: number };
  /** Caps labels may wrap onto this many lines (a phone is too narrow for a 34-character label at a readable size). */
  labelLines: 1 | 2;
  /**
   * A number shot's lines under its figure; `*At` are offsets (px) below the figure's line box.
   * `weighMin`: the smallest scale a compared figure's block settles to when it shows its share
   * (1 on a phone: its label would drop under a readable size; the bars still show the share).
   */
  figureStack: { unit: TextLine; unitAt: number; label: TextLine; labelAt: number; bareLabelAt: number; slack: number; weighMin: number };
  /** A pictogram shot's legend entry: the group's count and its caps label. `countW` is the count column when they sit side by side. */
  legend: { count: TextLine; label: TextLine; countW: number };
  /** A label stack (timeline mark, chain node), as em of its head size: head and sub line heights, and the sub's font size. */
  markStack: { head: number; sub: number; subPx: number };
  /** How two things sit next to each other: a number's comparison, a split's parts. */
  compare: 'row' | 'column';
  /** Which way a sequence runs: a timeline ruler, a chain (a phone is too narrow for six marks side by side). */
  ruler: 'row' | 'column';
}

/**
 * The burned caption line (remotion/captions.ts, ASPECT_SPECS) owns the band from its top edge
 * to the frame bottom, so the audit's subtitle_band check measures against the real captions.
 */
const SUBTITLES = Object.fromEntries(
  (['16:9', '9:16'] as const).map((a) => {
    const c = ASPECT_SPECS[a];
    const y = Math.floor(c.height - c.captionMarginBottom - c.captionFontPx * CAPTION_LINE_EM);
    return [a, { x: 0, y, w: c.width, h: c.height - y }];
  }),
) as Record<Aspect, Rect>;

/**
 * Frame layouts per aspect. 9:16 keeps clear of the YouTube Shorts UI: the right-hand action
 * rail (x > 980), the top bar (y < 110) and the bottom title/description block (y > 1520);
 * Shorts captions sit mid-lower (~y 1326-1440), so the stage ends above them. Every text zone
 * lies inside `safe`, which ends where the captions begin, so a zone-wide (e.g. centred) text
 * block can never cross them.
 */
export const LAYOUTS: Record<Aspect, Layout> = {
  '16:9': {
    width: 1920,
    height: 1080,
    zone: {
      title: { x: 96, y: 56, w: 1728, h: 132 },
      stage: { x: 96, y: 196, w: 1728, h: 680 },
      subtitles: SUBTITLES['16:9'],
      safe: { x: 48, y: 32, w: 1824, h: SUBTITLES['16:9'].y - 32 },
    },
    type: { headline: 96, chapter: 112, figure: 200, quote: 64, mark: 52, part: 46, punch: 340, kicker: { px: 30, line: 40 }, end: { px: 22, line: 30 }, sub: { px: 21, line: 30 }, by: { px: 24, line: 34 } },
    readable: 20,
    chart: { x: { px: 20, line: 28 }, end: { px: 48, line: 60 }, xLabels: 6 },
    rank: { numeral: { px: 84, line: 96 }, label: { px: 30, line: 40 }, value: { px: 40, line: 48 }, bar: 28 },
    versus: { side: { px: 64, line: 76 }, label: { px: 28, line: 40 }, value: { px: 64, line: 76 }, badge: 96, seam: 0 },
    check: { text: { px: 52, line: 64 }, box: 64 },
    chat: { text: { px: 36, line: 46 }, pad: 18, maxShare: 0.5, avatar: 56 },
    labelLines: 1,
    figureStack: { unit: { px: 44, line: 54 }, unitAt: 28, label: { px: 28, line: 40 }, labelAt: 108, bareLabelAt: 30, slack: 12, weighMin: 0.72 },
    legend: { count: { px: 72, line: 78 }, label: { px: 24, line: 32 }, countW: 0 },
    markStack: { head: 1.15, sub: 0.62, subPx: 0.42 },
    compare: 'row',
    ruler: 'row',
  },
  '9:16': {
    width: 1080,
    height: 1920,
    zone: {
      title: { x: 72, y: 124, w: 900, h: 166 },
      stage: { x: 72, y: 300, w: 900, h: 960 },
      subtitles: SUBTITLES['9:16'],
      safe: { x: 48, y: 110, w: 930, h: SUBTITLES['9:16'].y - 110 },
    },
    // A phone is held close but small: shots fill the stage and no stage text is under 48 px.
    type: { headline: 124, chapter: 104, figure: 480, quote: 70, mark: 116, part: 96, punch: 300, kicker: { px: 48, line: 58 }, end: { px: 48, line: 58 }, sub: { px: 48, line: 58 }, by: { px: 48, line: 58 } },
    readable: 48,
    chart: { x: { px: 48, line: 58 }, end: { px: 96, line: 108 }, xLabels: 3 },
    rank: { numeral: { px: 104, line: 112 }, label: { px: 48, line: 58 }, value: { px: 52, line: 60 }, bar: 40 },
    versus: { side: { px: 72, line: 84 }, label: { px: 48, line: 58 }, value: { px: 64, line: 72 }, badge: 112, seam: 136 },
    check: { text: { px: 60, line: 70 }, box: 84 },
    chat: { text: { px: 50, line: 62 }, pad: 22, maxShare: 0.74, avatar: 84 },
    labelLines: 2,
    figureStack: { unit: { px: 68, line: 80 }, unitAt: 28, label: { px: 48, line: 58 }, labelAt: 128, bareLabelAt: 34, slack: 8, weighMin: 1 },
    legend: { count: { px: 104, line: 112 }, label: { px: 48, line: 56 }, countW: 210 },
    markStack: { head: 1.12, sub: 0.62, subPx: 0.5 },
    compare: 'column',
    ruler: 'column',
  },
};

/**
 * Word-anchored timing: how far (ms) an element lands after (+) or before (−) its spoken
 * phrase starts. Medians measured from the traced Vox videos.
 */
export const CUE_LAG_MS = {
  layer: 0,
  label: 200,
  annotate: 150,
  number: 250,
  highlight: 0,
  mark: 150,
  pictogram: 0,
  line: 0,
  // Not traced (no Vox reference uses these shots): starting values.
  punch: 0,
  rank: 150,
  versus: 200,
  check: 150,
  message: 0,
} as const;

export type CueRole = keyof typeof CUE_LAG_MS;

/**
 * Motion vocabulary (frames @30fps). Motion is constant: elements land on their spoken word,
 * then the shot keeps living (push, drawing, regrouping) until the next beat takes over.
 * No bounces, no flashy pops.
 */
export const MOTION = {
  enter: 9,
  /** One word of kinetic type rising into place on the frame it is spoken. */
  wordPop: 7,
  /** Gap between words that are on screen but never spoken (quotes read silently). */
  wordStagger: 3,
  /** A word never waits longer than this after its predecessor, even if it is spoken later: the frame is never empty for long. */
  wordWaitMax: 15,
  highlightWipe: 10,
  layerBleed: 20,
  labelFade: 8,
  /** A map pin dropping onto its place (back-eased bounce); its label fades in as it lands. */
  pinDrop: 12,
  penDraw: 14,
  arrowDraw: 22,
  cameraMove: 36,
  numberCount: 42,
  /** Odometer ticks per second while a figure counts. */
  numberTicksPerSec: 12,
  barGrow: 24,
  lineDraw: 45,
  /** A split's parts pulling apart after the tear is drawn (frames). */
  splitApart: 18,
  /** A chain link's arrow drawing toward the node it lands on. */
  linkDraw: 12,
  /** An army arrow advancing along its route (frames); its march pattern then keeps flowing (px per second). */
  armyAdvance: 40,
  armyMarchPerSec: 60,
  /** Living elements (a drawing line, a count) finish this many frames before their beat ends, so the resting frame shows them complete. */
  settleTail: 15,
  unitSweep: 18,
  /** Unit squares flying into the grid, and sliding into their group on its cue. */
  unitFly: 16,
  unitRegroup: 14,
  ruleDraw: 18,
  /** A chapter rule keeps extending after it is drawn (px per second). */
  ruleGrowPerSec: 24,
  /** Slow continuous map push-in during holds (scale gain per second). */
  driftPerSec: 0.004,
  /** Paper "boil": texture offset steps per second. */
  boilPerSec: 4,
  /** Ranking rows sliding to their new slot to make room for an arriving item (ending as it lands). */
  rankShift: 14,
  /** The VS badge slamming in after both side names land. */
  vsSlam: 10,
  /** A row's loser fading back once its winner is ticked (to this opacity). */
  loserDim: 0.45,
  /** Typing dots shown before a chat message lands (frames), and their pulse (cycles per second). */
  typing: 20,
  typingPulse: 2.2,
  /** The newest chat bubble's float (px amplitude, cycles per second). */
  floatPx: 5,
  floatPerSec: 0.6,
  /** A punch flash decaying after each word lands (frames). */
  flashDecay: 8,
} as const;

/**
 * Camera push per non-map shot: [scale at the start, scale at the end] of the beat (or of its
 * same-world run), so every frame moves. Every push ends at 1: scaling down about a point inside
 * the stage keeps the audited layout inside its zones by construction. Maps own a real camera
 * (`driftPerSec`). Add a shot kind as a row.
 */
export const PUSH: Record<Exclude<ShotKind, 'map'>, readonly [number, number]> = {
  headline: [0.94, 1],
  chapter: [0.93, 1],
  number: [0.94, 1],
  pictogram: [0.95, 1],
  timeline: [0.95, 1],
  quote: [0.95, 1],
  line: [0.92, 1],
  split: [0.95, 1],
  chain: [0.94, 1],
  punch: [0.9, 1],
  ranking: [0.95, 1],
  versus: [0.95, 1],
  checklist: [0.95, 1],
  chat: [0.96, 1],
};

/**
 * How consecutive beats join. `frames` is the overlap window, centred on the boundary; a glide
 * has none because the same-world camera and carried elements are already continuous. Which
 * pair gets which kind is TRANSITION_RULES (motion.ts); a register (register.ts) may swap kinds
 * (`zoom`, `dip`) or hard-`cut` into its punchline beats, and nothing else may cut.
 */
export const TRANSITIONS = {
  glide: { frames: 0 },
  push: { frames: 16 },
  /** The push, vertical: the phone's paper slides up (a sideways push reads wrong on a tall frame). */
  rise: { frames: 16 },
  wipe: { frames: 14 },
  /** Hard cut: register-gated (deadpan/comedic punchline beats only). */
  cut: { frames: 0 },
  /** A fast zoom punch (hype). */
  zoom: { frames: 8 },
  /** Fade through the field colour (dramatic: dip to ink). */
  dip: { frames: 20 },
} as const;
export type TransitionKind = keyof typeof TRANSITIONS;
/** A transition never takes more than this share of either beat it joins. */
export const TRANSITION_MAX_SHARE = 0.3;

/** Beat boundaries relative to narration: visuals cut slightly before the first word. */
export const BEAT_LEAD_MS = 120;
export const TAIL_MS = 700;

// ── Camera + label geometry (pure; shared by the compiler and the widgets) ───

/** Camera view in world px: centre x/y and visible width. */
export type View = readonly [cx: number, cy: number, w: number];

/** World point → screen point for a camera view (same maths as the map widget's transform). */
export function toScreen(view: View, [x, y]: readonly [number, number], layout: Layout): [number, number] {
  const k = layout.width / view[2];
  return [layout.width / 2 + (x - view[0]) * k, layout.height / 2 + (y - view[1]) * k];
}

/** Camera view that shows a world-space box, for a frame's aspect. */
export function viewOf([x0, y0, x1, y1]: readonly number[], layout: Layout): View {
  return [(x0! + x1!) / 2, (y0! + y1!) / 2, Math.max(x1! - x0!, ((y1! - y0!) * layout.width) / layout.height)];
}

export type LabelSide = 'right' | 'left' | 'above' | 'below';
export const LABEL_FONT_PX = 28;
const LABEL_GAP = 16;

/** Label box for a place at screen point (x, y) on a given side. */
export function labelRect(text: string, [x, y]: readonly [number, number], side: LabelSide): Rect {
  const w = Math.ceil(text.length * LABEL_FONT_PX * 0.64) + 20;
  const h = LABEL_FONT_PX + 10;
  const bySide: Record<LabelSide, Rect> = {
    right: { x: x + LABEL_GAP, y: y - h / 2, w, h },
    left: { x: x - LABEL_GAP - w, y: y - h / 2, w, h },
    above: { x: x - w / 2, y: y - LABEL_GAP - h, w, h },
    below: { x: x - w / 2, y: y + LABEL_GAP, w, h },
  };
  return bySide[side];
}

type Point = readonly [number, number];
/** Pen arrow geometry: a quadratic curve that bulges to one side and stops short of both dots. */
export interface PenArrow {
  from: Point;
  ctrl: Point;
  to: Point;
}
const ARROW_BEND = 0.22;
const ARROW_INSET = 16;

/** Map pin geometry (px): head radius, total height from tip to head top, and how far it falls from. */
export const PIN = { head: 14, height: 52, fall: 90 } as const;

export function penArrow([x0, y0]: Point, [x1, y1]: Point): PenArrow {
  const ctrl: Point = [(x0 + x1) / 2 - (y1 - y0) * ARROW_BEND, (y0 + y1) / 2 + (x1 - x0) * ARROW_BEND];
  const toward = ([x, y]: Point): Point => {
    const d = Math.hypot(ctrl[0] - x, ctrl[1] - y) || 1;
    return [x + ((ctrl[0] - x) * ARROW_INSET) / d, y + ((ctrl[1] - y) * ARROW_INSET) / d];
  };
  return { from: toward([x0, y0]), ctrl, to: toward([x1, y1]) };
}

/** Point at t∈[0,1] along a pen arrow. */
export function arrowPoint({ from, ctrl, to }: PenArrow, t: number): Point {
  const u = 1 - t;
  return [u * u * from[0] + 2 * u * t * ctrl[0] + t * t * to[0], u * u * from[1] + 2 * u * t * ctrl[1] + t * t * to[1]];
}

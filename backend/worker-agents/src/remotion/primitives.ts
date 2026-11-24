/**
 * Curated Vox / 3Blue1Brown Remotion visual primitives & native multi-aspect layout specs.
 * 9:16 compositions are laid out natively from ASPECT_SPECS — never cropped from 16:9.
 */

export type AspectRatio = '16:9' | '9:16';

export interface AspectLayoutSpec {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  safePaddingX: number;
  safePaddingY: number;
  captionMarginBottom: number;
  maxWordsPerCue: number;
  titleFontPx: number;
  captionFontPx: number;
}

/** Canonical responsive layout table; add new formats as rows here. */
export const ASPECT_SPECS: Record<AspectRatio, AspectLayoutSpec> = {
  '16:9': {
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 60,
    safePaddingX: 120,
    safePaddingY: 84,
    captionMarginBottom: 72,
    maxWordsPerCue: 6,
    titleFontPx: 72,
    captionFontPx: 52,
  },
  '9:16': {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 60,
    safePaddingX: 72,
    safePaddingY: 220,
    captionMarginBottom: 340,
    maxWordsPerCue: 3,
    titleFontPx: 64,
    captionFontPx: 64,
  },
};

export type PrimitiveKind =
  | 'animated_chart'
  | 'map_callout'
  | 'kinetic_typography'
  | 'data_card'
  | 'equation_morph'
  | 'vector_graph';

export interface PrimitiveSpec {
  kind: PrimitiveKind;
  engine: 'remotion' | 'manim';
  description: string;
  requiredProps: readonly string[];
}

/** Curated visual primitive catalog constraining AI code generation. */
export const PRIMITIVE_CATALOG: Record<PrimitiveKind, PrimitiveSpec> = {
  animated_chart: {
    kind: 'animated_chart',
    engine: 'remotion',
    description: 'Spring-animated bar or line chart with highlighted callout series.',
    requiredProps: ['title', 'series', 'accentColor'],
  },
  map_callout: {
    kind: 'map_callout',
    engine: 'remotion',
    description: 'Dark-graphite regional map with animated pin drop and label leader.',
    requiredProps: ['region', 'coordinates', 'label'],
  },
  kinetic_typography: {
    kind: 'kinetic_typography',
    engine: 'remotion',
    description: 'Word-locked typographic emphasis synced to voiceover timestamps.',
    requiredProps: ['words', 'emphasisIndices'],
  },
  data_card: {
    kind: 'data_card',
    engine: 'remotion',
    description: 'Continuous-corner frosted card displaying a headline metric and delta.',
    requiredProps: ['label', 'value', 'delta'],
  },
  equation_morph: {
    kind: 'equation_morph',
    engine: 'manim',
    description: '3Blue1Brown LaTeX equation transform rendered with transparent alpha.',
    requiredProps: ['fromLatex', 'toLatex'],
  },
  vector_graph: {
    kind: 'vector_graph',
    engine: 'manim',
    description: 'Animated coordinate axes, vectors, and smooth path morphs.',
    requiredProps: ['axesRange', 'vectors'],
  },
};

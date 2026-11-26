/**
 * Native multi-aspect layout specs (frame size, caption band) for the compiler and captions.
 * 9:16 compositions are laid out natively from ASPECT_SPECS — never cropped from 16:9.
 */

export type AspectRatio = '16:9' | '9:16';

/**
 * How burned captions light up: `karaoke` sweeps each word in as it is spoken (a band under a
 * wide frame); `active_word` shows a short group with only the spoken word highlighted
 * (TikTok/Shorts style).
 */
export type CaptionMode = 'karaoke' | 'active_word';

/** Burned caption styles (rows in captions.ts CAPTION_STYLES); `vox_flat`, `vox_hype` and `vox_serif` are the Vox Tone variants (vox/register.ts). Here so browser code can name them. */
export type CaptionStyleId = 'vox_clean' | 'vox_flat' | 'vox_hype' | 'vox_serif' | 'violet_pop' | 'minimal_mono';

/** A caption line's height in em (libass line box plus outline); the band above the margin. */
export const CAPTION_LINE_EM = 1.3;

export interface AspectLayoutSpec {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  safePaddingX: number;
  safePaddingY: number;
  /** Bottom edge of the (single) caption line, px above the frame bottom. */
  captionMarginBottom: number;
  maxWordsPerCue: number;
  /** One caption line never wraps (WrapStyle 2), so a cue stops before it would run wider. */
  maxCharsPerCue: number;
  captionMode: CaptionMode;
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
    maxCharsPerCue: 56,
    captionMode: 'karaoke',
    titleFontPx: 72,
    captionFontPx: 52,
  },
  '9:16': {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fps: 60,
    // Clear of the Shorts UI: right action rail (~100 px), bottom title block (~400 px).
    safePaddingX: 100,
    safePaddingY: 220,
    captionMarginBottom: 480,
    maxWordsPerCue: 3,
    maxCharsPerCue: 18,
    captionMode: 'active_word',
    titleFontPx: 64,
    captionFontPx: 88,
  },
};

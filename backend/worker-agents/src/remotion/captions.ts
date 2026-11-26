/**
 * Dedicated Burned-In Captions engine:
 * 1. Groups word-level timestamps into native 16:9 / 9:16 cues.
 * 2. Emits ASS (Advanced SubStation Alpha) subtitles that FFmpeg burns frame-accurately:
 *    16:9 sweeps words in with \kf karaoke; 9:16 shows big Shorts-style word groups with only
 *    the spoken word highlighted (one event per word).
 */
import { resolve } from 'node:path';
import type { WordTimestamp } from '../providers';
import { ASPECT_SPECS, type AspectRatio, type CaptionMode, type CaptionStyleId } from './primitives';

/** Fonts shipped with the worker; pass to FFmpeg's ass filter so captions never fall back. */
export const CAPTION_FONTS_DIR = resolve(import.meta.dir, '../../assets/fonts');

export type { CaptionStyleId };

export interface CaptionStyleSpec {
  id: CaptionStyleId;
  label: string;
  fontName: string;
  /** ASS BGR hex color (&H00BBGGRR): karaoke = swept-in words; active_word = the other words. */
  primaryAssColor: string;
  /** ASS BGR hex color for upcoming karaoke words. */
  secondaryAssColor: string;
  /** ASS BGR hex color for the word being spoken (active_word mode). */
  activeAssColor: string;
  outlineAssColor: string;
  outlinePx: number;
  bold: boolean;
  italic: boolean;
  /** Letter case of the burned words (the spoken words are unchanged). */
  letterCase: 'as_written' | 'upper' | 'lower';
  /** Scale (%) of the word being spoken in active_word mode; 100 = no pop. */
  activeScale: number;
  /** Caps words per cue below the aspect's limit (null = the aspect's limit). */
  maxWords: number | null;
}

/** The house Vox caption: bold Libre Franklin, spoken word in highlighter yellow #FFF200. */
const VOX_CLEAN: CaptionStyleSpec = {
  id: 'vox_clean',
  label: 'Vox Clean',
  fontName: 'Libre Franklin',
  primaryAssColor: '&H00F1ECEC',
  secondaryAssColor: '&H00ACA1A0',
  activeAssColor: '&H0000F2FF',
  outlineAssColor: '&H000F0C0B',
  outlinePx: 4,
  bold: true,
  italic: false,
  letterCase: 'as_written',
  activeScale: 100,
  maxWords: null,
};

/** Declarative caption style table shared across FFmpeg ASS burning and UI previews. */
export const CAPTION_STYLES: Record<CaptionStyleId, CaptionStyleSpec> = {
  vox_clean: VOX_CLEAN,
  /** Deadpan: no active-word colour; the words just sit there. */
  vox_flat: { ...VOX_CLEAN, id: 'vox_flat', label: 'Vox Flat', activeAssColor: VOX_CLEAN.primaryAssColor },
  /** Hype: ALL CAPS, at most 2 words, the spoken word pops to 115%. */
  vox_hype: { ...VOX_CLEAN, id: 'vox_hype', label: 'Vox Hype', letterCase: 'upper', activeScale: 115, maxWords: 2 },
  /** Dramatic: Source Serif 4 italic, lowercase, a soft paper-tone active word. */
  vox_serif: { ...VOX_CLEAN, id: 'vox_serif', label: 'Vox Serif', fontName: 'Source Serif 4', bold: false, italic: true, letterCase: 'lower', activeAssColor: '&H00C8E0ED' },
  violet_pop: {
    id: 'violet_pop',
    label: 'Violet Pop',
    fontName: 'Geist',
    primaryAssColor: '&H00FF6C8B',
    secondaryAssColor: '&H00F1ECEC',
    activeAssColor: '&H00F1ECEC',
    outlineAssColor: '&H000F0C0B',
    outlinePx: 5,
    bold: true,
    italic: false,
    letterCase: 'as_written',
    activeScale: 100,
    maxWords: null,
  },
  minimal_mono: {
    id: 'minimal_mono',
    label: 'Minimal Mono',
    fontName: 'Geist Mono',
    primaryAssColor: '&H00A2D65E',
    secondaryAssColor: '&H00F1ECEC',
    activeAssColor: '&H00F1ECEC',
    outlineAssColor: '&H000F0C0B',
    outlinePx: 3,
    bold: false,
    italic: false,
    letterCase: 'as_written',
    activeScale: 100,
    maxWords: null,
  },
};

export interface CaptionCue {
  index: number;
  start_ms: number;
  end_ms: number;
  words: WordTimestamp[];
  text: string;
}

/**
 * Pure chunker: groups word timestamps into aspect-appropriate cues (at most maxWordsPerCue
 * words and maxCharsPerCue characters), also breaking on sentence punctuation or >450ms pauses.
 */
export function groupWordsIntoCaptionCues(
  words: readonly WordTimestamp[],
  aspectRatio: AspectRatio,
  maxWords: number | null = null,
): CaptionCue[] {
  const { maxCharsPerCue } = ASPECT_SPECS[aspectRatio];
  const maxWordsPerCue = Math.min(ASPECT_SPECS[aspectRatio].maxWordsPerCue, maxWords ?? Infinity);
  const buckets: WordTimestamp[][] = [];
  for (const w of words) {
    const bucket = buckets[buckets.length - 1];
    const last = bucket?.[bucket.length - 1];
    const fits =
      !!bucket &&
      bucket.length < maxWordsPerCue &&
      !/[.!?]$/.test(last!.word) &&
      w.start_ms - last!.end_ms <= 450 &&
      [...bucket, w].map((x) => x.word).join(' ').length <= maxCharsPerCue;
    if (fits) bucket.push(w);
    else buckets.push([w]);
  }
  return buckets.map((b, index) => ({ index, start_ms: b[0]!.start_ms, end_ms: b[b.length - 1]!.end_ms, words: b, text: b.map((w) => w.word).join(' ') }));
}

function formatAssTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const cs = Math.floor((safe % 1000) / 10);
  const totalSec = Math.floor(safe / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${hr}:${pad(min)}:${pad(sec)}.${pad(cs)}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

/**
 * Generates a complete ASS v4.00+ subtitle document, word-timed in the aspect's caption mode
 * and sized natively for 16:9 (1920x1080) or 9:16 (1080x1920).
 */
export function buildAssSubtitles(
  words: readonly WordTimestamp[],
  aspectRatio: AspectRatio,
  styleId: CaptionStyleId = 'violet_pop',
): string {
  const layout = ASPECT_SPECS[aspectRatio];
  const style = CAPTION_STYLES[styleId];
  const toCase = { as_written: (w: string) => w, upper: (w: string) => w.toUpperCase(), lower: (w: string) => w.toLowerCase() }[style.letterCase];
  const cues = groupWordsIntoCaptionCues(words.map((w) => ({ ...w, word: toCase(w.word) })), aspectRatio, style.maxWords);
  const pop = style.activeScale === 100 ? '' : `\\fscx${style.activeScale}\\fscy${style.activeScale}`;
  const unpop = style.activeScale === 100 ? '' : '\\fscx100\\fscy100';

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${layout.width}`,
    `PlayResY: ${layout.height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${style.fontName},${layout.captionFontPx},${style.primaryAssColor},${style.secondaryAssColor},${style.outlineAssColor},&H80000000,${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${style.outlinePx},1,2,${layout.safePaddingX},${layout.safePaddingX},${layout.captionMarginBottom},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  // A thick outline swallows the space glyph ("Thesystemworked"); widen only the spaces by
  // the two outlines that eat into them.
  const wordGap = `{\\fsp${style.outlinePx * 2}} {\\fsp0}`;
  /** Caption mode → the timed events of one cue. Add a mode as a row here and in CaptionMode. */
  const CUE_EVENTS: Record<CaptionMode, (cue: CaptionCue) => { start_ms: number; end_ms: number; text: string }[]> = {
    karaoke: (cue) => [
      { start_ms: cue.start_ms, end_ms: cue.end_ms, text: cue.words.map((w) => `{\\kf${Math.max(1, Math.round((w.end_ms - w.start_ms) / 10))}}${escapeAssText(w.word)}`).join(wordGap) },
    ],
    // One event per word, held until the next word starts, so the highlight never blinks off.
    active_word: (cue) =>
      cue.words.map((w, i) => ({
        start_ms: w.start_ms,
        end_ms: cue.words[i + 1]?.start_ms ?? cue.end_ms,
        text: cue.words.map((x, j) => (j === i ? `{\\c${style.activeAssColor}${pop}}${escapeAssText(x.word)}{\\c${style.primaryAssColor}${unpop}}` : escapeAssText(x.word))).join(wordGap),
      })),
  };
  const lines = cues
    .flatMap(CUE_EVENTS[layout.captionMode])
    .map((e) => `Dialogue: 0,${formatAssTime(e.start_ms)},${formatAssTime(e.end_ms)},Default,,0,0,0,,${e.text}`);

  return [...header, ...lines, ''].join('\n');
}

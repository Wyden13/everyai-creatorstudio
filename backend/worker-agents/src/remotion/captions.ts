/**
 * Dedicated Burned-In Captions engine:
 * 1. Groups word-level timestamps into native 16:9 / 9:16 cues.
 * 2. Emits ASS (Advanced SubStation Alpha) subtitles with exact \kf karaoke timing
 *    so FFmpeg burns frame-accurate, word-highlighted captions into MP4 outputs.
 */
import type { WordTimestamp } from '../providers';
import { ASPECT_SPECS, type AspectRatio } from './primitives';

export type CaptionStyleId = 'vox_clean' | 'violet_pop' | 'minimal_mono';

export interface CaptionStyleSpec {
  id: CaptionStyleId;
  label: string;
  fontName: string;
  /** ASS BGR hex color (&H00BBGGRR) for active/highlighted word. */
  primaryAssColor: string;
  /** ASS BGR hex color for spoken/upcoming words. */
  secondaryAssColor: string;
  outlineAssColor: string;
  outlinePx: number;
  bold: boolean;
}

/** Declarative caption style table shared across FFmpeg ASS burning and UI previews. */
export const CAPTION_STYLES: Record<CaptionStyleId, CaptionStyleSpec> = {
  vox_clean: {
    id: 'vox_clean',
    label: 'Vox Clean',
    fontName: 'Geist',
    primaryAssColor: '&H00F1ECEC',
    secondaryAssColor: '&H00ACA1A0',
    outlineAssColor: '&H000F0C0B',
    outlinePx: 4,
    bold: true,
  },
  violet_pop: {
    id: 'violet_pop',
    label: 'Violet Pop',
    fontName: 'Geist',
    primaryAssColor: '&H00FF6C8B',
    secondaryAssColor: '&H00F1ECEC',
    outlineAssColor: '&H000F0C0B',
    outlinePx: 5,
    bold: true,
  },
  minimal_mono: {
    id: 'minimal_mono',
    label: 'Minimal Mono',
    fontName: 'Geist Mono',
    primaryAssColor: '&H00A2D65E',
    secondaryAssColor: '&H00F1ECEC',
    outlineAssColor: '&H000F0C0B',
    outlinePx: 3,
    bold: false,
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
 * Pure chunker: groups word timestamps into aspect-appropriate cues (3 words for 9:16,
 * 6 words for 16:9), also breaking early on sentence punctuation or >450ms pauses.
 */
export function groupWordsIntoCaptionCues(
  words: readonly WordTimestamp[],
  aspectRatio: AspectRatio,
): CaptionCue[] {
  const maxWords = ASPECT_SPECS[aspectRatio].maxWordsPerCue;
  const cues: CaptionCue[] = [];
  let bucket: WordTimestamp[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    cues.push({
      index: cues.length,
      start_ms: bucket[0]!.start_ms,
      end_ms: bucket[bucket.length - 1]!.end_ms,
      words: bucket,
      text: bucket.map((w) => w.word).join(' '),
    });
    bucket = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const prev = bucket[bucket.length - 1];
    const pauseMs = prev ? w.start_ms - prev.end_ms : 0;
    if (bucket.length > 0 && pauseMs > 450) flush();

    bucket.push(w);
    const endsSentence = /[.!?]$/.test(w.word);
    if (bucket.length >= maxWords || endsSentence) flush();
  }
  flush();
  return cues;
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
 * Generates a complete ASS v4.00+ subtitle document with \kf karaoke word timing
 * sized natively for 16:9 (1920x1080) or 9:16 (1080x1920).
 */
export function buildAssSubtitles(
  words: readonly WordTimestamp[],
  aspectRatio: AspectRatio,
  styleId: CaptionStyleId = 'violet_pop',
): string {
  const layout = ASPECT_SPECS[aspectRatio];
  const style = CAPTION_STYLES[styleId];
  const cues = groupWordsIntoCaptionCues(words, aspectRatio);

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
    `Style: Default,${style.fontName},${layout.captionFontPx},${style.primaryAssColor},${style.secondaryAssColor},${style.outlineAssColor},&H80000000,${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outlinePx},1,2,${layout.safePaddingX},${layout.safePaddingX},${layout.captionMarginBottom},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const lines = cues.map((cue) => {
    const karaoke = cue.words
      .map((w) => {
        const durCs = Math.max(1, Math.round((w.end_ms - w.start_ms) / 10));
        return `{\\kf${durCs}}${escapeAssText(w.word)}`;
      })
      .join(' ');
    return `Dialogue: 0,${formatAssTime(cue.start_ms)},${formatAssTime(cue.end_ms)},Default,,0,0,0,,${karaoke}`;
  });

  return [...header, ...lines, ''].join('\n');
}

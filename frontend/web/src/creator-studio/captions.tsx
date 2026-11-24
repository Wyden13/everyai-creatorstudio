/**
 * Dedicated Burned-In Captions overlay component for 16:9 and 9:16 video previews.
 * Renders word-synced cues matching backend/worker-agents/src/remotion/captions.ts.
 */
import { useEffect, useState } from 'react';

export type CaptionStyleId = 'violet_pop' | 'vox_clean' | 'minimal_mono';

export const CAPTION_PRESETS: { id: CaptionStyleId; label: string }[] = [
  { id: 'violet_pop', label: 'Violet Pop' },
  { id: 'vox_clean', label: 'Vox Clean' },
  { id: 'minimal_mono', label: 'Minimal Mono' },
];

export function BurnedCaptionsOverlay({
  text,
  tall,
  playing,
  styleId,
}: {
  text: string;
  tall: boolean;
  playing: boolean;
  styleId: CaptionStyleId;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const cueSize = tall ? 3 : 6;
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    setWordIdx(0);
    if (!playing || words.length === 0) return;
    const timer = window.setInterval(() => {
      setWordIdx((i) => (i + 1) % words.length);
    }, 340);
    return () => window.clearInterval(timer);
  }, [playing, text]);

  if (!playing || words.length === 0) return null;

  const cueStart = Math.floor(wordIdx / cueSize) * cueSize;
  const slice = words.slice(cueStart, cueStart + cueSize);

  return (
    <div className={`burned-cap ${tall ? 'tall' : 'wide'} st-${styleId}`} aria-live="off">
      {slice.map((w, i) => {
        const globalIdx = cueStart + i;
        const active = globalIdx === wordIdx;
        const spoken = globalIdx < wordIdx;
        return (
          <span key={`${cueStart}-${i}`} className={`cap-w ${active ? 'now' : spoken ? 'said' : ''}`}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

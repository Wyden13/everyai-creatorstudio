/**
 * Concrete Remotion composition generator & CLI render runner.
 * Turns any Storyboard + WordTimestamp[] into a self-contained native 16:9 or 9:16
 * Remotion composition using curated Vox-style primitives (never cropped).
 */
import type { Storyboard } from '../contracts';
import type { WordTimestamp } from '../providers';
import { ASPECT_SPECS, type AspectRatio } from './primitives';

export interface RemotionRenderInput {
  entryPath: string;
  compositionId: string;
  aspectRatio: AspectRatio;
  propsJsonPath: string;
  outputPath: string;
}

/** Pure CLI argument builder for `remotion render`. */
export function buildRemotionRenderCommand(input: RemotionRenderInput): string[] {
  const spec = ASPECT_SPECS[input.aspectRatio];
  return [
    'bunx',
    'remotion',
    'render',
    input.entryPath,
    input.compositionId,
    input.outputPath,
    '--width',
    String(spec.width),
    '--height',
    String(spec.height),
    '--fps',
    String(spec.fps),
    '--props',
    input.propsJsonPath,
    '--log',
    'error',
  ];
}

/**
 * Generates a concrete, self-contained Remotion TSX composition bound to ASPECT_SPECS
 * and locked to scene durations & word timestamps.
 */
export function buildRemotionCompositionTsx(
  storyboard: Storyboard,
  words: readonly WordTimestamp[],
  aspectRatio: AspectRatio,
): string {
  const spec = ASPECT_SPECS[aspectRatio];
  const totalMs =
    words.length > 0
      ? words[words.length - 1]!.end_ms
      : storyboard.scenes.reduce((sum, sc) => sum + (sc.estimated_duration_ms ?? 5000), 0);
  const durationInFrames = Math.max(spec.fps, Math.ceil((totalMs / 1000) * spec.fps));
  const payload = JSON.stringify({ storyboard, spec, durationInFrames });

  return `import React from 'react';
import { AbsoluteFill, Composition, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const DATA = ${payload} as const;

const SceneSlide: React.FC<{ title: string; directive: string; index: number }> = ({ title, directive, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 24, stiffness: 220 } });
  const y = interpolate(enter, [0, 1], [28, 0]);
  return (
    <AbsoluteFill style={{
      backgroundColor: '#0B0C0F',
      color: '#ECECF1',
      padding: \`\${DATA.spec.safePaddingY}px \${DATA.spec.safePaddingX}px\`,
      justifyContent: 'center',
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      <div style={{ transform: \`translateY(\${y}px)\`, opacity: enter }}>
        <div style={{ color: '#8B6CFF', fontSize: 22, fontWeight: 600, marginBottom: 14 }}>SCENE {index + 1}</div>
        <h1 style={{ fontSize: DATA.spec.titleFontPx, lineHeight: 1.08, margin: '0 0 20px' }}>{title}</h1>
        <p style={{ fontSize: 30, color: '#A0A1AC', maxWidth: 960, margin: 0 }}>{directive}</p>
      </div>
    </AbsoluteFill>
  );
};

export const MainComposition: React.FC = () => {
  const perScene = Math.max(30, Math.floor(DATA.durationInFrames / Math.max(1, DATA.storyboard.scenes.length)));
  return (
    <AbsoluteFill style={{ backgroundColor: '#0B0C0F' }}>
      {DATA.storyboard.scenes.map((sc, i) => (
        <Sequence key={sc.scene_id} from={i * perScene} durationInFrames={perScene}>
          <SceneSlide title={i === 0 ? DATA.storyboard.title : sc.narration} directive={sc.visual_directive} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="EveryAIComposition"
    component={MainComposition}
    durationInFrames={DATA.durationInFrames}
    fps={DATA.spec.fps}
    width={DATA.spec.width}
    height={DATA.spec.height}
  />
);
`;
}

export async function executeRemotionRender(input: RemotionRenderInput): Promise<void> {
  const cmd = buildRemotionRenderCommand(input);
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`Remotion render failed (exit ${code}): ${err.slice(-500)}`);
  }
}

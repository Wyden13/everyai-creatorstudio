/**
 * Compiler & Formatter Worker: builds declarative FFmpeg command plans for native
 * 16:9 and 9:16 renders, optional transparent Manim overlays, -14 LUFS loudness mix,
 * and burned-in ASS word-synced captions.
 */
import { ASPECT_SPECS, type AspectRatio } from './remotion/primitives';
import { CAPTION_FONTS_DIR } from './remotion/captions';

/** Encoder arguments per codec (libx264 is absent from some distro FFmpeg builds, e.g. Fedora's). */
export const VIDEO_CODEC_ARGS = {
  libx264: ['-c:v', 'libx264', '-preset', 'veryfast'],
  libopenh264: ['-c:v', 'libopenh264', '-b:v', '10M'],
  mpeg4: ['-c:v', 'mpeg4', '-q:v', '3'],
} as const satisfies Record<string, readonly string[]>;
export type VideoCodec = keyof typeof VIDEO_CODEC_ARGS;

export interface CompileInput {
  aspectRatio: AspectRatio;
  baseVideoPath: string;
  manimOverlayPath?: string | null;
  audioPath?: string | null;
  /** Optional background music bed (e.g. Freesound); auto-ducked under narration. */
  musicBedPath?: string | null;
  assSubtitlePath?: string | null;
  videoCodec?: VideoCodec;
  outputPath: string;
}

export interface CompilePlan {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  args: string[];
}

function escapeAssFilterPath(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/** Pure FFmpeg argument builder — testable without spawning subprocesses. */
export function buildCompilePlan(input: CompileInput): CompilePlan {
  const spec = ASPECT_SPECS[input.aspectRatio];
  const args: string[] = ['-y', '-i', input.baseVideoPath];

  let nextIdx = 1;
  const manimIdx = input.manimOverlayPath ? nextIdx++ : null;
  if (input.manimOverlayPath) args.push('-i', input.manimOverlayPath);

  const audioIdx = input.audioPath ? nextIdx++ : null;
  if (input.audioPath) args.push('-i', input.audioPath);

  const musicIdx = input.musicBedPath ? nextIdx++ : null;
  if (input.musicBedPath) args.push('-i', input.musicBedPath);

  const filters: string[] = [];
  let videoLabel = '0:v';

  filters.push(`[${videoLabel}]scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2:color=#0B0C0F,setsar=1[vbase]`);
  videoLabel = 'vbase';

  if (manimIdx !== null) {
    filters.push(`[${videoLabel}][${manimIdx}:v]overlay=0:0:shortest=1[vcomp]`);
    videoLabel = 'vcomp';
  }

  if (input.assSubtitlePath) {
    filters.push(`[${videoLabel}]ass='${escapeAssFilterPath(input.assSubtitlePath)}':fontsdir='${escapeAssFilterPath(CAPTION_FONTS_DIR)}'[vout]`);
    videoLabel = 'vout';
  }

  let audioMap: string | null = null;
  if (audioIdx !== null && musicIdx !== null) {
    // Sidechain-duck background music bed to ~-24 LUFS under -14 LUFS narration.
    filters.push(`[${musicIdx}:a]volume=-18dB[mbed]`);
    filters.push(`[${audioIdx}:a]asplit=2[vmain][vsc]`);
    filters.push(`[mbed][vsc]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=250[mduck]`);
    filters.push(`[vmain][mduck]amix=inputs=2:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
    audioMap = '[aout]';
  } else if (audioIdx !== null) {
    audioMap = `${audioIdx}:a`;
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${videoLabel}]`);

  if (audioMap !== null) {
    args.push('-map', audioMap);
    if (musicIdx === null) {
      args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11');
    }
    args.push('-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-an');
  }

  args.push(...VIDEO_CODEC_ARGS[input.videoCodec ?? 'libx264']);
  args.push(
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(spec.fps),
    '-movflags',
    '+faststart',
    input.outputPath,
  );

  return { aspectRatio: input.aspectRatio, width: spec.width, height: spec.height, args };
}

/** Executes a CompilePlan via local FFmpeg subprocess and fails loudly on non-zero exit. */
export async function executeCompilePlan(plan: CompilePlan): Promise<void> {
  const proc = Bun.spawn(['ffmpeg', ...plan.args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`FFmpeg failed (exit ${code}): ${err.slice(-500)}`);
  }
}

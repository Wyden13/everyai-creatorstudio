/**
 * Renders a compiled Vox Timeline in the headless-Chromium sandbox:
 *  - auditTimeline: samples each beat at its settled cue-landing frames and resting frame,
 *    measures every tagged text node's real ink box and runs the deterministic layout audit; in
 *    parallel, probes the whole video at low resolution for frozen frames.
 *  - renderTimelineVideo: renders every frame across parallel Chromium workers and muxes
 *    audio + burned subtitles with FFmpeg; a register's procedural SFX (audio.ts) are generated
 *    with FFmpeg and mixed in, ducked under the voice.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { VIDEO_CODEC_ARGS, type VideoCodec } from '../compiler';
import { CAPTION_FONTS_DIR } from '../remotion/captions';
import { withSandbox, type SandboxOutcome } from '../remotion/visual-sandbox';
import { MOTION_PROBE, auditFrame, auditMotion, auditTimelineMotion, frameChange, type AuditViolation, type AuditedText, type MotionSample } from './audit';
import { SFX, sfxMixGraph, type SfxCue } from './audio';
import type { Timeline } from './timeline';
import { CUE_LAG_MS, FPS, LAYOUTS, MOTION } from './tokens';

const ASSETS = resolve(import.meta.dir, '../../assets');
const VOX_VIDEO = join(import.meta.dir, 'VoxVideo.tsx');

const FONT_FACES = `<style>
@font-face { font-family: "Libre Franklin"; src: url("file://${ASSETS}/fonts/LibreFranklin.ttf"); font-weight: 100 900; }
@font-face { font-family: "Source Serif 4"; font-style: italic; src: url("file://${ASSETS}/fonts/SourceSerif4-Italic.ttf"); font-weight: 200 900; }
</style><link rel="preload" as="image" href="file://${ASSETS}/textures/paper-1920.jpg"><link rel="preload" as="image" href="file://${ASSETS}/textures/grain-1920.jpg">`;

const ASSET_URLS = {
  paper: `file://${ASSETS}/textures/paper-1920.jpg`,
  grain: `file://${ASSETS}/textures/grain-1920.jpg`,
};
/** Textures off (a transparent pixel): the motion probe must not count the paper boil as motion, nor a fill measure count paper as ink. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const FLAT_ASSETS = { paper: BLANK, grain: BLANK };

/** Collects the ink box of every visible tagged text node (text extent, not the layout box). */
const COLLECT_TEXT_RECTS = `(() => [...document.querySelectorAll('[data-vox-text]')].map((el) => {
  const range = document.createRange(); range.selectNodeContents(el);
  const ink = range.getBoundingClientRect(); const box = el.getBoundingClientRect();
  const boxed = el.style.width !== '';
  return { beatId: el.dataset.voxBeat, role: el.dataset.voxRole, x: ink.x, y: ink.y, w: ink.width, h: ink.height,
    overflow: boxed && (ink.left < box.left - 1 || ink.right > box.right + 1) };
}))()`;

/** Decodes a base64 PNG in the page into per-pixel luma (0-255). */
export const DECODE_LUMA = (png: string) => `(async () => {
  const img = new Image(); img.src = 'data:image/png;base64,${png}'; await img.decode();
  const g = new OffscreenCanvas(img.width, img.height).getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data; const out = new Array(d.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  return out;
})()`;

/** Mounts the Vox composition for a timeline in the render sandbox, at the timeline's frame size. */
export function withVoxScene<T>(timeline: Timeline, use: Parameters<typeof withSandbox<T>>[1], assets = ASSET_URLS): Promise<SandboxOutcome<T>> {
  return withSandbox(
    {
      tsxSource: `import React from 'react';
import { VoxVideo } from '${VOX_VIDEO}';
import timeline from './timeline.json';
export default function Scene() { return <VoxVideo timeline={timeline as any} assets={${JSON.stringify(assets)}} />; }`,
      files: { 'timeline.json': JSON.stringify(timeline) },
      headHtml: FONT_FACES,
      totalFrames: timeline.durationInFrames,
      fps: timeline.fps,
      width: timeline.width,
      height: timeline.height,
    },
    use,
  );
}

/**
 * Frames worth auditing per beat: just after each cue lands, and the resting frame. Only the
 * settled part of a beat (outside both transition windows) is audited: mid-transition text is
 * deliberately sliding off-frame or under a wipe, so the frames either side of every window are
 * audited instead.
 */
export function auditFrames(timeline: Timeline): { beatId: string; frame: number }[] {
  const lag = Math.round((Math.max(...Object.values(CUE_LAG_MS)) / 1000) * FPS);
  return timeline.beats.flatMap((b, i) => {
    // A slower register lands later: audit after its scaled entrance (and any overshoot) settles.
    const settle = lag + Math.ceil(MOTION.layerBleed * b.feel.duration);
    const [from, to] = [b.enter?.to ?? b.from, timeline.beats[i + 1]?.enter?.from ?? b.to];
    const frames = [...Object.values(b.cues).map((f) => f + settle), to - 3].filter((f) => f >= from && f < to);
    return [...new Set(frames)].sort((a, c) => a - c).map((frame) => ({ beatId: b.id, frame }));
  });
}

/** Frames the motion probe samples: the whole video every MOTION_PROBE.everySec. */
export const probeFrames = (timeline: Timeline): number[] => {
  const step = Math.round(MOTION_PROBE.everySec * timeline.fps);
  return Array.from({ length: Math.ceil(timeline.durationInFrames / step) }, (_, i) => i * step);
};

export interface AuditReport {
  violations: AuditViolation[];
  /** One PNG per beat at its resting frame, for the (optional) taste critic. */
  restFrames: { beatId: string; frame: number; pngBase64: string }[];
}

/** Layout audit at the settled frames, plus the frozen-frame probe over the whole video (in parallel). */
export async function auditTimeline(timeline: Timeline): Promise<SandboxOutcome<AuditReport>> {
  const [layout, motion] = await Promise.all([
    withVoxScene(timeline, async (s) => {
      const violations: AuditViolation[] = [];
      const restFrames: AuditReport['restFrames'] = [];
      const frames = auditFrames(timeline);
      const rest = new Map(frames.map((f) => [f.beatId, f.frame]));
      for (const { beatId, frame } of frames) {
        await s.renderFrame(frame);
        const texts = await s.evaluate<AuditedText[]>(COLLECT_TEXT_RECTS);
        violations.push(...auditFrame(frame, texts, LAYOUTS[timeline.aspect]));
        if (rest.get(beatId) === frame) restFrames.push({ beatId, frame, pngBase64: await s.screenshot('png') });
      }
      return { violations, restFrames };
    }),
    // Frozen-frame probe: low-res, texture-free render of every probe frame → change from the previous sample.
    withVoxScene(
      timeline,
      async (s) => {
        const samples: MotionSample[] = [];
        let prev: number[] | null = null;
        for (const frame of probeFrames(timeline)) {
          await s.renderFrame(frame);
          const luma = await s.evaluate<number[]>(DECODE_LUMA(await s.screenshot('png', undefined, MOTION_PROBE.scale)));
          samples.push({ frame, change: prev ? frameChange(prev, luma) : Infinity });
          prev = luma;
        }
        return samples;
      },
      FLAT_ASSETS,
    ),
  ]);
  if (!layout.ok) return layout;
  if (!motion.ok) return motion;
  const beats = timeline.beats.map((b) => ({ id: b.id, kind: b.shot.kind, from: b.from, to: b.to }));
  return { ok: true, value: { ...layout.value, violations: [...layout.value.violations, ...auditMotion(motion.value, beats, timeline.fps), ...auditTimelineMotion(timeline)] } };
}

/** Renders the full video to MP4: parallel frame capture, then one FFmpeg mux. */
export async function renderTimelineVideo(opts: {
  timeline: Timeline;
  audioPath: string;
  outputPath: string;
  assSubtitlesPath?: string;
  /** Placed sound effects (audio.ts sfxCues); none = the voice alone. */
  sfx?: readonly SfxCue[];
  workers?: number;
  videoCodec?: VideoCodec;
}): Promise<void> {
  const { timeline } = opts;
  const workers = Math.max(1, opts.workers ?? 6);
  const dir = mkdtempSync(join(tmpdir(), 'everyai-vox-frames-'));
  try {
    const chunk = Math.ceil(timeline.durationInFrames / workers);
    const results = await Promise.all(
      Array.from({ length: workers }, (_, w) =>
        withVoxScene(timeline, async (s) => {
          for (let f = w * chunk; f < Math.min(timeline.durationInFrames, (w + 1) * chunk); f++) {
            await s.renderFrame(f);
            writeFileSync(join(dir, `f_${String(f).padStart(6, '0')}.jpg`), Buffer.from(await s.screenshot('jpeg', 92), 'base64'));
          }
        }),
      ),
    );
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) throw new Error(`frame render failed (${failed.stage}): ${failed.error}`);

    mkdirSync(resolve(opts.outputPath, '..'), { recursive: true });
    const vf = opts.assSubtitlesPath ? ['-vf', `ass=${opts.assSubtitlesPath}:fontsdir=${CAPTION_FONTS_DIR}`] : [];
    const sfx = opts.sfx ?? [];
    const sounds = [...new Set(sfx.map((c) => c.sound))];
    for (const sound of sounds) await ffmpeg(['-f', 'lavfi', '-i', SFX[sound].lavfi, '-ac', '1', join(dir, `${sound}.wav`)], `sfx ${sound}`);
    // No SFX: the voice is muxed as-is (today's output); otherwise one input per placed cue.
    const audio = sfx.length === 0 ? [] : [...sfx.flatMap((c) => ['-i', join(dir, `${c.sound}.wav`)]), '-filter_complex', sfxMixGraph(sfx, 1, 2), '-map', '0:v', '-map', '[aout]'];
    await ffmpeg(
      ['-framerate', String(timeline.fps), '-i', join(dir, 'f_%06d.jpg'), '-i', opts.audioPath, ...audio, ...vf,
        ...VIDEO_CODEC_ARGS[opts.videoCodec ?? 'libx264'], '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', opts.outputPath],
      'mux',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs FFmpeg once; a non-zero exit fails loud with its stderr tail. */
async function ffmpeg(args: readonly string[], what: string): Promise<void> {
  const proc = Bun.spawn(['ffmpeg', '-y', '-loglevel', 'error', ...args], { stdout: 'pipe', stderr: 'pipe' });
  if ((await proc.exited) !== 0) throw new Error(`ffmpeg ${what} failed: ${(await new Response(proc.stderr).text()).slice(-600)}`);
}

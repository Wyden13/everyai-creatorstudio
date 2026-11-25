/**
 * Long-Form Video Essay Pipeline (10–120 minutes).
 *
 * Architecture:
 *  1. Immutable Show Bible + Global Beat Sheet -> byte-identical cached prefix (90% Anthropic cache hits).
 *  2. Decoupled Chapter Checkpoints with explicit state machine & SHA-256 content addressing
 *     (editing Chapter 7 never re-pays LLM/TTS/render for Chapters 1–6 or 8–N).
 *  3. Hybrid Visual Tiering ("Visual Budget"): FFmpeg B-roll (~65%) + Remotion (~25%) + Manim (~10%)
 *     so a 60–120 min video never tries to render 100k+ frames through Headless Chromium.
 *  4. ElevenLabs prosody continuity (`previous_text` / `next_text`) + cumulative `chapterOffsetMs`.
 *  5. VM Capacity Preflight Gate (`checkVmRenderCapacity`) + zero-reencode FFmpeg concat demuxer.
 */
import { createHash } from 'node:crypto';
import { rmSync, statfsSync, writeFileSync } from 'node:fs';
import { freemem, totalmem } from 'node:os';
import { z } from 'zod';
import {
  callLlmJsonWithUsage,
  callTtsWithTimestamps,
  type LlmUsage,
  type WordTimestamp,
} from './providers';

// ── 1. Explicit Chapter Lifecycle State Machine ─────────────────────────────

export type ChapterState =
  | 'Pending'
  | 'Scripting'
  | 'Scripted'
  | 'Voicing'
  | 'Voiced'
  | 'Rendering'
  | 'Rendered'
  | 'Failed';

export type ChapterEvent =
  | 'START_SCRIPT'
  | 'SCRIPT_OK'
  | 'START_VOICE'
  | 'VOICE_OK'
  | 'START_RENDER'
  | 'RENDER_OK'
  | 'FAIL'
  | 'INVALIDATE';

/** Declarative transition table (state × event → next). */
const CHAPTER_TRANSITIONS: Readonly<Record<ChapterState, Partial<Record<ChapterEvent, ChapterState>>>> = {
  Pending: { START_SCRIPT: 'Scripting', FAIL: 'Failed' },
  Scripting: { SCRIPT_OK: 'Scripted', FAIL: 'Failed', INVALIDATE: 'Pending' },
  Scripted: { START_VOICE: 'Voicing', FAIL: 'Failed', INVALIDATE: 'Pending' },
  Voicing: { VOICE_OK: 'Voiced', FAIL: 'Failed', INVALIDATE: 'Scripted' },
  Voiced: { START_RENDER: 'Rendering', FAIL: 'Failed', INVALIDATE: 'Scripted' },
  Rendering: { RENDER_OK: 'Rendered', FAIL: 'Failed', INVALIDATE: 'Voiced' },
  Rendered: { INVALIDATE: 'Pending' },
  Failed: { START_SCRIPT: 'Scripting', START_VOICE: 'Voicing', START_RENDER: 'Rendering', INVALIDATE: 'Pending' },
};

export function transitionChapterState(current: ChapterState, event: ChapterEvent): ChapterState {
  const next = CHAPTER_TRANSITIONS[current][event];
  if (!next) {
    throw new Error(`Invalid chapter transition: ${current} + ${event}`);
  }
  return next;
}

// ── 2. Hybrid Visual Tiering & VM Capacity Preflight Gate ───────────────────

export type VisualTier = 'ffmpeg_broll' | 'remotion_motion' | 'manim_diagram';

export interface VisualBudget {
  /** % of runtime rendered via fast FFmpeg B-roll / Ken Burns / kinetic captions. */
  ffmpeg_broll: number;
  /** % of runtime rendered via Headless Chromium Remotion motion graphics. */
  remotion_motion: number;
  /** % of runtime rendered via Manim CE mathematical/diagram clips. */
  manim_diagram: number;
}

export const DEFAULT_VISUAL_BUDGET: Readonly<VisualBudget> = {
  ffmpeg_broll: 65,
  remotion_motion: 25,
  manim_diagram: 10,
};

interface TierCostSpec {
  /** Wall-clock render minutes per 1 minute of output video on a typical 4-vCPU VM. */
  renderFactorRealtime: number;
  /** Peak RAM required while rendering a single chapter with this tier (MB). */
  peakRamMb: number;
  /** Uncompressed temporary scratch disk needed per minute of this tier (MB). */
  scratchMbPerMin: number;
}

/** Declarative VM resource model per visual tier. */
export const VISUAL_TIER_SPECS: Readonly<Record<VisualTier, TierCostSpec>> = {
  ffmpeg_broll: { renderFactorRealtime: 0.08, peakRamMb: 256, scratchMbPerMin: 35 },
  remotion_motion: { renderFactorRealtime: 1.8, peakRamMb: 1400, scratchMbPerMin: 180 },
  manim_diagram: { renderFactorRealtime: 1.2, peakRamMb: 900, scratchMbPerMin: 95 },
};

export interface VmResources {
  freeRamMb: number;
  totalRamMb: number;
  freeDiskMb: number;
}

export interface VmCapacityReport {
  targetMinutes: number;
  chapterCount: number;
  chapterMinutes: number;
  requiredPeakRamMb: number;
  requiredScratchDiskMb: number;
  estimatedRenderMinutes: number;
  availableRamMb: number;
  availableDiskMb: number;
}

export type VmCapacityCheck =
  | { ok: true; report: VmCapacityReport }
  | { ok: false; reason: string; suggestions: string[]; report: VmCapacityReport };

/** Reads live host RAM & free disk on `scratchDir`. */
export function probeVmResources(scratchDir = '/tmp'): VmResources {
  const freeRamMb = Math.floor(freemem() / (1024 * 1024));
  const totalRamMb = Math.floor(totalmem() / (1024 * 1024));
  let freeDiskMb = 0;
  try {
    const stat = statfsSync(scratchDir);
    freeDiskMb = Math.floor((Number(stat.bavail) * Number(stat.bsize)) / (1024 * 1024));
  } catch {
    freeDiskMb = 0;
  }
  return { freeRamMb, totalRamMb, freeDiskMb };
}

/**
 * Preflight gate: fails loudly before spending LLM/TTS/render money if the single VM
 * lacks RAM, scratch disk, or wall-clock budget for the requested essay length & visual mix.
 */
export function checkVmRenderCapacity(opts: {
  targetMinutes: number;
  chapterMinutes?: number;
  visualBudget?: VisualBudget;
  maxRenderMinutes?: number;
  vmResources?: VmResources;
}): VmCapacityCheck {
  if (opts.targetMinutes < 10 || opts.targetMinutes > 120) {
    throw new Error(`Long-form targetMinutes must be between 10 and 120 (got ${opts.targetMinutes})`);
  }
  const budget = opts.visualBudget ?? DEFAULT_VISUAL_BUDGET;
  const budgetSum = budget.ffmpeg_broll + budget.remotion_motion + budget.manim_diagram;
  if (Math.round(budgetSum) !== 100) {
    throw new Error(`visualBudget percentages must sum to 100 (got ${budgetSum})`);
  }

  const chapterMinutes = Math.min(4, Math.max(2, opts.chapterMinutes ?? 3));
  const chapterCount = Math.ceil(opts.targetMinutes / chapterMinutes);
  const vm = opts.vmResources ?? probeVmResources();
  const maxRenderMinutes = opts.maxRenderMinutes ?? 180;

  // Chapters render 1-at-a-time and free raw frames immediately -> RAM is bounded by 1 chapter's heaviest active tier.
  const activeTierRams: number[] = [];
  if (budget.ffmpeg_broll > 0) activeTierRams.push(VISUAL_TIER_SPECS.ffmpeg_broll.peakRamMb);
  if (budget.remotion_motion > 0) activeTierRams.push(VISUAL_TIER_SPECS.remotion_motion.peakRamMb);
  if (budget.manim_diagram > 0) activeTierRams.push(VISUAL_TIER_SPECS.manim_diagram.peakRamMb);
  const requiredPeakRamMb = Math.max(...activeTierRams) + 512; // 512 MB OS/worker headroom

  // Scratch disk = 1 chapter raw temp frames + encoded chapter MP4s (~45 MB/min) + final concat MP4 (~45 MB/min) + 1024 MB safety margin.
  const weightedScratchPerMin =
    (budget.ffmpeg_broll / 100) * VISUAL_TIER_SPECS.ffmpeg_broll.scratchMbPerMin +
    (budget.remotion_motion / 100) * VISUAL_TIER_SPECS.remotion_motion.scratchMbPerMin +
    (budget.manim_diagram / 100) * VISUAL_TIER_SPECS.manim_diagram.scratchMbPerMin;
  const oneChapterScratchMb = Math.ceil(chapterMinutes * weightedScratchPerMin);
  const encodedChaptersMb = Math.ceil(opts.targetMinutes * 45);
  const finalConcatMb = Math.ceil(opts.targetMinutes * 45);
  const requiredScratchDiskMb = oneChapterScratchMb + encodedChaptersMb + finalConcatMb + 1024;

  const weightedRenderFactor =
    (budget.ffmpeg_broll / 100) * VISUAL_TIER_SPECS.ffmpeg_broll.renderFactorRealtime +
    (budget.remotion_motion / 100) * VISUAL_TIER_SPECS.remotion_motion.renderFactorRealtime +
    (budget.manim_diagram / 100) * VISUAL_TIER_SPECS.manim_diagram.renderFactorRealtime;
  const estimatedRenderMinutes = Number((opts.targetMinutes * weightedRenderFactor).toFixed(1));

  const report: VmCapacityReport = {
    targetMinutes: opts.targetMinutes,
    chapterCount,
    chapterMinutes,
    requiredPeakRamMb,
    requiredScratchDiskMb,
    estimatedRenderMinutes,
    availableRamMb: vm.freeRamMb,
    availableDiskMb: vm.freeDiskMb,
  };

  const failures: string[] = [];
  const suggestions: string[] = [];

  if (vm.freeRamMb < requiredPeakRamMb) {
    failures.push(`RAM insufficient: need ${requiredPeakRamMb} MB peak, VM has ${vm.freeRamMb} MB free`);
    suggestions.push('Reduce remotion_motion tier or burst heavy chapters to Cloud Run.');
  }
  if (vm.freeDiskMb < requiredScratchDiskMb) {
    failures.push(
      `Scratch disk insufficient: need ${(requiredScratchDiskMb / 1024).toFixed(1)} GB, VM has ${(vm.freeDiskMb / 1024).toFixed(1)} GB free`,
    );
    suggestions.push('Free disk space, stream finished chapters to Google Drive/S3, or shorten targetMinutes.');
  }
  if (estimatedRenderMinutes > maxRenderMinutes) {
    failures.push(
      `Estimated render time (${estimatedRenderMinutes} min) exceeds VM budget (${maxRenderMinutes} min)`,
    );
    suggestions.push(
      `Shift visual budget toward ffmpeg_broll (currently ${budget.ffmpeg_broll}%) or enable Cloud Run burst.`,
    );
  }

  if (failures.length > 0) {
    return { ok: false, reason: failures.join('; '), suggestions, report };
  }
  return { ok: true, report };
}

// ── 3. Immutable Show Bible & Global Beat Sheet (Cached Prefix) ─────────────

export const VisualTierSchema = z.enum(['ffmpeg_broll', 'remotion_motion', 'manim_diagram']);

export const ChapterBeatSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  title: z.string().min(1),
  target_sec: z.number().int().min(60).max(360),
  key_claim: z.string().min(1),
  transition_in: z.string().min(1),
  transition_out: z.string().min(1),
  callbacks: z.array(z.string()).default([]),
  dominant_tier: VisualTierSchema,
});
export type ChapterBeat = z.infer<typeof ChapterBeatSchema>;

export const ShowBibleSchema = z.object({
  title: z.string().min(1),
  thesis: z.string().min(1),
  tone: z.string().min(1),
  visual_style: z.string().min(1),
  glossary: z.array(z.string()).default([]),
  beats: z.array(ChapterBeatSchema).min(3),
});
export type ShowBible = z.infer<typeof ShowBibleSchema>;

export const EssaySceneSchema = z.object({
  scene_id: z.string().min(1),
  narration: z.string().min(1),
  visual_tier: VisualTierSchema,
  visual_directive: z.string().min(1),
  broll_query: z.string().optional(),
  estimated_sec: z.number().positive(),
});
export type EssayScene = z.infer<typeof EssaySceneSchema>;

export const ChapterScreenplaySchema = z.object({
  chapter_id: z.string().min(1),
  summary_one_liner: z.string().min(1),
  scenes: z.array(EssaySceneSchema).min(1),
});
export type ChapterScreenplay = z.infer<typeof ChapterScreenplaySchema>;

/**
 * Deterministic, byte-identical Show Bible prefix so every chapter drafting call
 * hits Anthropic/OpenAI/Gemini prompt caching (up to 90% input token discount).
 */
export function buildShowBibleCachePrefix(bible: ShowBible): string {
  const beatLines = bible.beats
    .map(
      (b) =>
        `[${b.id} | #${b.index + 1} | ${b.target_sec}s | ${b.dominant_tier}] ${b.title}\n` +
        `  Claim: ${b.key_claim}\n` +
        `  In: ${b.transition_in} -> Out: ${b.transition_out}\n` +
        (b.callbacks.length > 0 ? `  Callbacks: ${b.callbacks.join(', ')}\n` : ''),
    )
    .join('\n');

  return [
    `# SHOW BIBLE (IMMUTABLE ACROSS ALL CHAPTERS)`,
    `Title: ${bible.title}`,
    `Thesis: ${bible.thesis}`,
    `Tone: ${bible.tone}`,
    `Visual Style: ${bible.visual_style}`,
    `Glossary & Verified Facts:\n${bible.glossary.map((g) => `- ${g}`).join('\n')}`,
    `\n# GLOBAL CHAPTER BEAT SHEET\n${beatLines}`,
  ].join('\n');
}

/** Extracts the last N words of a chapter's narration for smooth verbal handoff into `nextId`. */
export function extractVerbalBridge(narration: string, maxWords = 150): string {
  const words = narration.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(-maxWords).join(' ');
}

export async function generateShowBible(opts: {
  topic: string;
  targetMinutes: number;
  visualBudget?: VisualBudget;
  providerId: string;
  modelId: string;
  apiKey: string;
  effort?: 'low' | 'medium' | 'high';
}): Promise<{ bible: ShowBible; usage: LlmUsage }> {
  const budget = opts.visualBudget ?? DEFAULT_VISUAL_BUDGET;
  const chapterCount = Math.max(3, Math.ceil(opts.targetMinutes / 3));

  const { text, usage } = await callLlmJsonWithUsage({
    nodeKind: 'screenplay',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    effort: opts.effort,
    maxTokens: 4096,
    systemPrompt:
      'You are a documentary video essay showrunner. Return ONLY valid JSON matching ShowBibleSchema (no markdown fences).',
    userPrompt: JSON.stringify({
      topic: opts.topic,
      target_minutes: opts.targetMinutes,
      chapter_count: chapterCount,
      visual_budget: budget,
      required_shape: {
        title: 'string',
        thesis: 'string',
        tone: 'string',
        visual_style: 'string',
        glossary: ['key fact or term'],
        beats: [
          {
            id: 'ch_01',
            index: 0,
            title: 'string',
            target_sec: 180,
            key_claim: 'string',
            transition_in: 'string',
            transition_out: 'string',
            callbacks: [],
            dominant_tier: 'ffmpeg_broll | remotion_motion | manim_diagram',
          },
        ],
      },
    }),
  });

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = ShowBibleSchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`ShowBible violated contract: ${parsed.error.message}`);
  }
  return { bible: parsed.data, usage };
}

export async function generateChapterScreenplay(opts: {
  essayId: string;
  bible: ShowBible;
  beat: ChapterBeat;
  previousNarrationTail?: string;
  callbackExcerpts?: Readonly<Record<string, string>>;
  providerId: string;
  modelId: string;
  apiKey: string;
  effort?: 'low' | 'medium' | 'high';
}): Promise<{ screenplay: ChapterScreenplay; usage: LlmUsage }> {
  const cachedPrefix = buildShowBibleCachePrefix(opts.bible);
  const { text, usage } = await callLlmJsonWithUsage({
    nodeKind: 'screenplay',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    effort: opts.effort,
    maxTokens: 4096,
    cacheKey: `essay:${opts.essayId}`,
    systemPrompt:
      'You are writing ONE chapter of a long-form video essay. Stay strictly aligned to the Show Bible thesis and avoid repeating earlier chapters. Assign each scene a visual_tier matching the visual budget. Return ONLY valid JSON matching ChapterScreenplaySchema.',
    cachedContext: cachedPrefix,
    userPrompt: JSON.stringify({
      chapter_beat: opts.beat,
      previous_chapter_ending: opts.previousNarrationTail ?? null,
      referenced_callbacks: opts.callbackExcerpts ?? {},
      required_shape: {
        chapter_id: opts.beat.id,
        summary_one_liner: 'string',
        scenes: [
          {
            scene_id: `${opts.beat.id}_sc_01`,
            narration: 'string',
            visual_tier: opts.beat.dominant_tier,
            visual_directive: 'string',
            broll_query: 'optional Pexels search query when visual_tier is ffmpeg_broll',
            estimated_sec: 15,
          },
        ],
      },
    }),
  });

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = ChapterScreenplaySchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`Chapter ${opts.beat.id} screenplay violated contract: ${parsed.error.message}`);
  }
  return { screenplay: parsed.data, usage };
}

// ── 4. Content-Addressed Chapter Checkpoints & Prosody Voiceover ────────────

export interface ChapterCheckpoint {
  id: string;
  index: number;
  prevId: string | null;
  nextId: string | null;
  state: ChapterState;
  inputHash: string;
  screenplay?: ChapterScreenplay;
  chapterOffsetMs: number;
  durationMs: number;
  audioPath: string | null;
  clipPath: string | null;
  words: WordTimestamp[];
}

/** Deterministic SHA-256 hash so unchanged chapters skip LLM/TTS/render on retries or edits. */
export function hashChapterInput(input: {
  beat: ChapterBeat;
  narration?: string;
  voiceId?: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({ beat: input.beat, narration: input.narration ?? '', voiceId: input.voiceId ?? '' }))
    .digest('hex')
    .slice(0, 16);
}

export function shouldReuseChapterCheckpoint(
  existing: ChapterCheckpoint | undefined,
  nextHash: string,
): boolean {
  return Boolean(existing && existing.state === 'Rendered' && existing.inputHash === nextHash && existing.clipPath);
}

/** Pure timestamp shifter: aligns chapter-local word timings onto the global 2-hour timeline. */
export function offsetWordTimestamps(
  words: readonly WordTimestamp[],
  chapterOffsetMs: number,
): WordTimestamp[] {
  return words.map((w) => ({
    word: w.word,
    start_ms: w.start_ms + chapterOffsetMs,
    end_ms: w.end_ms + chapterOffsetMs,
  }));
}

export async function synthesizeChapterVoiceover(opts: {
  providerId: string;
  modelId: string;
  apiKey: string;
  voiceId?: string;
  narration: string;
  previousChapterEnding?: string;
  nextChapterOpening?: string;
  chapterOffsetMs: number;
}): Promise<{
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  globalWords: WordTimestamp[];
}> {
  const res = await callTtsWithTimestamps({
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    voiceId: opts.voiceId,
    text: opts.narration,
    previousText: opts.previousChapterEnding?.slice(-200),
    nextText: opts.nextChapterOpening?.slice(0, 200),
  });
  return {
    audioBase64: res.audio_base64,
    mimeType: res.mime_type,
    durationMs: res.duration_ms,
    globalWords: offsetWordTimestamps(res.words, opts.chapterOffsetMs),
  };
}

// ── 5. Streaming Zero-Reencode FFmpeg Concat & Scratch Cleanup ──────────────

export interface ConcatPlan {
  manifestPath: string;
  manifestContent: string;
  outputPath: string;
  args: string[];
}

/** Builds an FFmpeg concat demuxer manifest (escaped for single quotes). */
export function buildConcatManifest(chapterClipPaths: readonly string[]): string {
  if (chapterClipPaths.length === 0) {
    throw new Error('Cannot concat zero chapter clips');
  }
  return chapterClipPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n') + '\n';
}

/**
 * Pure zero-reencode FFmpeg concat plan (`-c copy`): joins 20–40 normalized chapter MP4s
 * into a 2-hour master in seconds with near-zero RAM/CPU.
 */
export function buildConcatPlan(opts: {
  chapterClipPaths: readonly string[];
  manifestPath: string;
  outputPath: string;
}): ConcatPlan {
  const manifestContent = buildConcatManifest(opts.chapterClipPaths);
  return {
    manifestPath: opts.manifestPath,
    manifestContent,
    outputPath: opts.outputPath,
    args: [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      opts.manifestPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      opts.outputPath,
    ],
  };
}

export async function executeConcatPlan(plan: ConcatPlan): Promise<void> {
  writeFileSync(plan.manifestPath, plan.manifestContent, 'utf8');
  const proc = Bun.spawn(['ffmpeg', ...plan.args], { stdout: 'pipe', stderr: 'pipe' });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`FFmpeg concat failed (exit ${code}): ${err.slice(-500)}`);
  }
}

/** Frees raw per-chapter temp frames immediately after a chapter MP4 is finalized. */
export function cleanupChapterScratch(tempDir: string): void {
  rmSync(tempDir, { recursive: true, force: true });
}

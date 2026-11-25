/**
 * Code-Based Animation Agent: turns an approved Storyboard + word timestamps into
 * validated Remotion TSX and/or Manim CE Python scene code.
 *
 * Includes a Multimodal Vision-in-the-Loop Self-Improvement Harness:
 *   Draft (no artificial line cap, pre-built Vox/3Blue1Brown widgets)
 *     -> RenderKeyframesSandbox (Chromium)
 *     -> Multimodal Vision Critic (inspects real PNGs for overlaps/clipping/craft)
 *     -> Revise until approved!
 */
import { z } from 'zod';
import type { Storyboard } from '../contracts';
import { callLlmJson, callLlmJsonWithUsage, type LlmAttachment, type LlmUsage, type WordTimestamp } from '../providers';
import { PRIMITIVE_CATALOG } from '../remotion/primitives';
import { THEME_WIDGET_CATALOG_DOCS, type StudioTheme } from '../remotion/theme-catalog';
import { renderKeyframesSandbox, type RenderedKeyframe, type SandboxRenderResult } from '../remotion/visual-sandbox';

export const MAX_CODEGEN_ATTEMPTS = 3;

export interface GeneratedAnimationBundle {
  remotionTsx: string | null;
  manimPython: string | null;
  attempts: number;
}

export const VisionCritiqueSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(1).max(10),
  summary: z.string().min(1),
  issues: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
});
export type VisionCritique = z.infer<typeof VisionCritiqueSchema>;

export type VisualLoopState = 'Drafting' | 'RenderingSandbox' | 'VisionCritiquing' | 'Approved' | 'Failed';

export interface SelfImproveIteration {
  iteration: number;
  renderOk: boolean;
  renderError?: string;
  critique?: VisionCritique;
  codeChars: number;
}

export interface SelfImprovingAnimationResult {
  state: 'Approved' | 'Failed';
  remotionTsx: string;
  iterations: SelfImproveIteration[];
  finalKeyframes: RenderedKeyframe[];
  totalUsd: number;
  totalSavedUsd: number;
}

const DISALLOWED_TSX_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(node:)?(fs|child_process|net|dgram|tls|http|https)\b/, reason: 'disallowed Node I/O import' },
  { pattern: /\b(eval|Function)\s*\(/, reason: 'disallowed dynamic code execution' },
  { pattern: /\bprocess\.env\b/, reason: 'disallowed environment access' },
];

const DISALLOWED_PYTHON_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(import|from)\s+(os|sys|subprocess|socket|urllib|http|shutil|pathlib)\b/, reason: 'disallowed Python system/network import' },
  { pattern: /\b(__import__|eval|exec|open)\s*\(/, reason: 'disallowed Python builtin' },
];

/** Static boundary validator: fails loudly before any Remotion or Manim subprocess runs. */
export function validateGeneratedCode(
  kind: 'remotion_tsx' | 'manim_python',
  source: string,
): { ok: true } | { ok: false; reason: string } {
  if (source.trim().length < 20) {
    return { ok: false, reason: `${kind} output is empty or too short` };
  }
  const rules = kind === 'remotion_tsx' ? DISALLOWED_TSX_PATTERNS : DISALLOWED_PYTHON_PATTERNS;
  for (const rule of rules) {
    if (rule.pattern.test(source)) {
      return { ok: false, reason: `${kind} violated sandbox rule: ${rule.reason}` };
    }
  }
  return { ok: true };
}

export async function runAnimationCodegenAgent(opts: {
  storyboard: Storyboard;
  words: readonly WordTimestamp[];
  styleDirective?: string;
  effort?: 'low' | 'medium' | 'high';
  providerId: string;
  modelId: string;
  apiKey: string;
}): Promise<GeneratedAnimationBundle> {
  const needsManim = opts.storyboard.scenes.some(
    (s) => s.animation_engine === 'manim' || s.animation_engine === 'hybrid',
  );
  const needsRemotion = opts.storyboard.scenes.some(
    (s) => s.animation_engine === 'remotion' || s.animation_engine === 'hybrid',
  );

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_CODEGEN_ATTEMPTS; attempt++) {
    const raw = await callLlmJson({
      nodeKind: needsRemotion ? 'animation_remotion' : 'animation_manim',
      providerId: opts.providerId,
      modelId: opts.modelId,
      apiKey: opts.apiKey,
      effort: opts.effort,
      maxTokens: 16384,
      cachedContext: THEME_WIDGET_CATALOG_DOCS,
      systemPrompt:
        'You are a broadcast motion graphics engineer. Return ONLY a single valid JSON object with keys "remotionTsx" (string or null) and "manimPython" (string or null). No markdown fences or prose. Write rich, varied, high-craft visual scenes — DO NOT artificially limit your code length. Use the pre-built widgets from "./theme-widgets" (VoxBackdrop, VoxGeoMap, VoxDataChart, VoxHighlighterHeadline, VoxStatCard, VoxTimeline, ThreeB1BBackdrop, ThreeB1BPlane, ThreeB1BEquation) instead of drawing placeholder shapes. Keep bottom 140px clear for burned-in subtitles. Set manimPython to null if needsManim is false. Use ONLY safe imports (remotion/react/./theme-widgets for TSX; manim/math/numpy for Python).',
      userPrompt: JSON.stringify({
        storyboard: opts.storyboard,
        style_directive: opts.styleDirective,
        words: opts.words,
        primitives: Object.values(PRIMITIVE_CATALOG),
        needsRemotion,
        needsManim,
        previousValidationError: lastError || undefined,
      }),
    });

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed: { remotionTsx?: string | null; manimPython?: string | null };
    try {
      parsed = JSON.parse(cleaned) as { remotionTsx?: string | null; manimPython?: string | null };
    } catch (e) {
      lastError = `Invalid JSON: ${(e as Error).message}`;
      continue;
    }

    if (needsRemotion) {
      const check = validateGeneratedCode('remotion_tsx', parsed.remotionTsx ?? '');
      if (!check.ok) {
        lastError = check.reason;
        continue;
      }
    }
    if (needsManim) {
      const check = validateGeneratedCode('manim_python', parsed.manimPython ?? '');
      if (!check.ok) {
        lastError = check.reason;
        continue;
      }
    }

    return {
      remotionTsx: parsed.remotionTsx ?? null,
      manimPython: parsed.manimPython ?? null,
      attempts: attempt,
    };
  }

  throw new Error(`Animation codegen failed after ${MAX_CODEGEN_ATTEMPTS} attempts: ${lastError}`);
}

/** Extracts raw TSX code cleanly whether the model returned a ```tsx fence or plain source. */
export function extractTsxSource(raw: string): string {
  const fenced = raw.match(/```(?:tsx|typescript|jsx)?\s*\n([\s\S]*)\n```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return raw.trim();
}

/**
 * Multimodal Vision Critic: inspects actual rendered PNG keyframes and flags
 * overlapping text, clipped headers, subtitle safe-zone collisions, fake geometric
 * placeholders, or monotonous slide layouts.
 */
export async function critiqueRenderedKeyframes(opts: {
  storyboard: Storyboard;
  theme: StudioTheme;
  keyframes: readonly RenderedKeyframe[];
  providerId: string;
  modelId: string;
  apiKey: string;
  effort?: 'low' | 'medium' | 'high';
}): Promise<{ critique: VisionCritique; usage: LlmUsage }> {
  const attachments: LlmAttachment[] = opts.keyframes.map((kf, i) => ({
    name: `keyframe_${i + 1}_t${kf.sec}s.png`,
    mimeType: 'image/png',
    data: kf.pngBase64,
    kind: 'image',
  }));

  const { text, usage } = await callLlmJsonWithUsage({
    nodeKind: 'animation_remotion',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    effort: opts.effort ?? 'medium',
    maxTokens: 2048,
    attachments,
    systemPrompt:
      `You are a strict Creative Director reviewing rendered keyframes of a ${opts.theme === 'vox' ? 'Vox-style documentary motion-graphics' : '3Blue1Brown mathematical'} video. Return ONLY valid JSON matching VisionCritiqueSchema: {"approved": boolean, "score": 1..10, "summary": string, "issues": string[], "improvements": string[]}. Be ruthlessly honest: reject (approved: false) if ANY text overlaps or clips, if ANY element intrudes into the bottom 140px subtitle safe zone, if a map/chart looks like a crude placeholder shape, or if all keyframes look like the exact same static PowerPoint template. Only set approved: true when score >= 8 and the frames genuinely look broadcast-ready.`,
    userPrompt: JSON.stringify({
      video_title: opts.storyboard.title,
      theme: opts.theme,
      keyframe_timestamps_sec: opts.keyframes.map((k) => k.sec),
      rubric: [
        'Zero text/card/chart overlaps or clipping',
        'Bottom 140px strictly clear for burned-in subtitles',
        'Visual variety across scenes (different layouts, full-bleed maps, charts, editorial typography)',
        'Uses pre-built theme widgets cleanly with polished spacing and typography',
      ],
    }),
  });

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = VisionCritiqueSchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`VisionCritic output violated schema: ${parsed.error.message}`);
  }
  return { critique: parsed.data, usage };
}

/**
 * Closed-loop Multimodal Animation Harness:
 *   1. Generates rich, unbounded Remotion TSX using pre-built Vox / 3Blue1Brown widgets.
 *   2. Renders real keyframes in the Chromium Visual Sandbox (surfacing any bundle/runtime errors).
 *   3. Runs the Multimodal Vision Critic on the actual rendered PNGs.
 *   4. Feeds both the rendered PNGs AND critique back to the Animation Agent to improve until approved!
 */
export async function runSelfImprovingAnimationAgent(opts: {
  storyboard: Storyboard;
  words: readonly WordTimestamp[];
  theme: StudioTheme;
  styleDirective?: string;
  providerId: string;
  coderModelId: string;
  criticModelId?: string;
  apiKey: string;
  effort?: 'low' | 'medium' | 'high';
  maxIterations?: number;
  /** Optional dependency injection for unit testing without spawning Chromium. */
  renderSandboxFn?: typeof renderKeyframesSandbox;
  critiqueFn?: typeof critiqueRenderedKeyframes;
}): Promise<SelfImprovingAnimationResult> {
  const maxIterations = Math.max(1, Math.min(5, opts.maxIterations ?? 3));
  const durationSec = Math.max(
    10,
    Math.round(opts.storyboard.scenes.reduce((a, s) => a + (s.estimated_duration_ms ?? 15000), 0) / 1000),
  );
  const renderFn = opts.renderSandboxFn ?? renderKeyframesSandbox;
  const criticFn = opts.critiqueFn ?? critiqueRenderedKeyframes;

  const iterations: SelfImproveIteration[] = [];
  let currentTsx = '';
  let lastKeyframes: RenderedKeyframe[] = [];
  let lastFeedback = '';
  let totalUsd = 0;
  let totalSavedUsd = 0;

  const themeRule =
    opts.theme === 'vox'
      ? 'STRICT THEME: Vox editorial documentary. Vary layouts across every scene (e.g., full-bleed VoxGeoMap with pan/zoom & arrows, split headline + VoxStatCard, full-width VoxDataChart with labeled axes, dramatic kinetic typography with yellow highlights). NEVER repeat the exact same 2-column slide across all scenes.'
      : 'STRICT THEME: 3Blue1Brown mathematical explainer. Use ThreeB1BBackdrop, ThreeB1BPlane with animated vectors/curves, and ThreeB1BEquation with color-coded terms.';

  for (let iter = 1; iter <= maxIterations; iter++) {
    // On revision turns, attach the actual rendered PNGs so the coder agent can SEE its own mistakes!
    const attachments: LlmAttachment[] = lastKeyframes.map((kf, idx) => ({
      name: `previous_render_${idx + 1}_t${kf.sec}s.png`,
      mimeType: 'image/png',
      data: kf.pngBase64,
      kind: 'image',
    }));

    const { text, usage } = await callLlmJsonWithUsage({
      nodeKind: 'animation_remotion',
      providerId: opts.providerId,
      modelId: opts.coderModelId,
      apiKey: opts.apiKey,
      effort: opts.effort ?? 'medium',
      maxTokens: 16384,
      cacheKey: `anim:${opts.storyboard.video_id}:${opts.theme}`,
      attachments,
      systemPrompt:
        `You are an elite motion-graphics engineer writing a complete Remotion TSX composition. Return ONLY raw TypeScript/JSX inside a single \`\`\`tsx ... \`\`\` code block (do NOT wrap in JSON). Write as much clean code as needed for genuinely broadcast-grade visuals — there is NO line limit. Export your root component as default export. Use ONLY safe imports: "react", "remotion", and "./theme-widgets". Keep bottom 140px strictly clear for subtitles.`,
      cachedContext: `${themeRule}\n\n${THEME_WIDGET_CATALOG_DOCS}`,
      userPrompt:
        iter === 1
          ? JSON.stringify({
              task: 'Build the initial Remotion composition for this storyboard with distinct, visually rich layouts per scene.',
              storyboard: opts.storyboard,
              style_directive: opts.styleDirective,
              duration_sec: durationSec,
              sample_word_timings: opts.words.slice(0, 40),
            })
          : JSON.stringify({
              task: `REVISION #${iter}: Inspect the attached rendered screenshots of your previous code and fix EVERY listed issue. Return the complete improved TSX file.`,
              feedback_from_sandbox_and_vision_critic: lastFeedback,
              previous_tsx: currentTsx,
            }),
    });
    totalUsd += usage.estimatedUsd;
    totalSavedUsd += usage.savedUsd;

    currentTsx = extractTsxSource(text);
    const staticCheck = validateGeneratedCode('remotion_tsx', currentTsx);
    if (!staticCheck.ok) {
      lastFeedback = `Static security check failed: ${staticCheck.reason}`;
      iterations.push({ iteration: iter, renderOk: false, renderError: lastFeedback, codeChars: currentTsx.length });
      continue;
    }

    const rendered: SandboxRenderResult = await renderFn({
      tsxSource: currentTsx,
      durationSec,
      fps: 30,
      sampleFractions: [0.12, 0.35, 0.58, 0.82],
    });
    if (!rendered.ok) {
      lastFeedback = `Sandbox ${rendered.stage} error:\n${rendered.error}`;
      iterations.push({ iteration: iter, renderOk: false, renderError: lastFeedback, codeChars: currentTsx.length });
      continue;
    }

    lastKeyframes = rendered.frames;
    const { critique, usage: criticUsage } = await criticFn({
      storyboard: opts.storyboard,
      theme: opts.theme,
      keyframes: rendered.frames,
      providerId: opts.providerId,
      modelId: opts.criticModelId ?? opts.coderModelId,
      apiKey: opts.apiKey,
      effort: 'medium',
    });
    totalUsd += criticUsage.estimatedUsd;
    totalSavedUsd += criticUsage.savedUsd;

    iterations.push({ iteration: iter, renderOk: true, critique, codeChars: currentTsx.length });
    if (critique.approved && critique.score >= 8) {
      return {
        state: 'Approved',
        remotionTsx: currentTsx,
        iterations,
        finalKeyframes: lastKeyframes,
        totalUsd: Number(totalUsd.toFixed(5)),
        totalSavedUsd: Number(totalSavedUsd.toFixed(5)),
      };
    }

    lastFeedback = `Vision Critic Score ${critique.score}/10 (${critique.summary}).\nIssues to fix:\n- ${critique.issues.join('\n- ')}\nRequired improvements:\n- ${critique.improvements.join('\n- ')}`;
  }

  return {
    state: 'Failed',
    remotionTsx: currentTsx,
    iterations,
    finalKeyframes: lastKeyframes,
    totalUsd: Number(totalUsd.toFixed(5)),
    totalSavedUsd: Number(totalSavedUsd.toFixed(5)),
  };
}

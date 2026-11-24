/**
 * Code-Based Animation Agent: turns an approved Storyboard + word timestamps into
 * validated Remotion TSX and/or Manim CE Python scene code, with a bounded self-heal loop.
 */
import type { Storyboard } from '../contracts';
import { callLlmJson, type WordTimestamp } from '../providers';
import { PRIMITIVE_CATALOG } from '../remotion/primitives';

export const MAX_CODEGEN_ATTEMPTS = 3;

export interface GeneratedAnimationBundle {
  remotionTsx: string | null;
  manimPython: string | null;
  attempts: number;
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
      systemPrompt:
        'You are a motion graphics engineer. Return ONLY valid JSON with keys "remotionTsx" (string or null) and "manimPython" (string or null). Use ONLY curated primitives and safe imports (remotion/react for TSX; manim/math/numpy for Python). Lock animations to the provided word timestamps.',
      userPrompt: JSON.stringify({
        storyboard: opts.storyboard,
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

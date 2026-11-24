import { z } from 'zod';
import modelRegistry from '../../../shared/model-registry.json';

export const CapabilitySchema = z.enum(['llm_text', 'llm_code', 'tts', 'search', 'publish']);
export type Capability = z.infer<typeof CapabilitySchema>;

export const PipelineStateSchema = z.enum([
  'Idle',
  'Queued',
  'Running',
  'NeedsApproval',
  'Failed',
  'Done',
]);
export type PipelineState = z.infer<typeof PipelineStateSchema>;

export const StoryboardSceneSchema = z.object({
  scene_id: z.string().min(1),
  index: z.number().int().min(0),
  narration: z.string().min(1),
  visual_directive: z.string().min(1),
  animation_engine: z.enum(['remotion', 'manim', 'hybrid']),
  primitive_hints: z
    .array(
      z.enum([
        'animated_chart',
        'map_callout',
        'kinetic_typography',
        'data_card',
        'equation_morph',
        'vector_graph',
      ]),
    )
    .optional(),
  estimated_duration_ms: z.number().int().min(500).optional(),
});

export const StoryboardSchema = z.object({
  video_id: z.string().min(1),
  title: z.string().min(1),
  hook: z.string().min(1),
  source_topic: z.string().optional(),
  aspect_ratios: z.array(z.enum(['16:9', '9:16'])).min(1),
  scenes: z.array(StoryboardSceneSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

type NodeKind = keyof typeof modelRegistry.node_capability_rules;

/**
 * Validates that a provider/model pair is explicitly eligible for a node kind.
 * Fails loudly by returning a typed error result rather than silently falling back.
 */
export function validateModelForNode(
  nodeKind: NodeKind,
  providerId: string,
  modelId: string,
): { ok: true } | { ok: false; reason: string } {
  const allowedCaps = modelRegistry.node_capability_rules[nodeKind] as readonly string[];
  const provider = modelRegistry.providers.find((p) => p.id === providerId);
  if (!provider) {
    return { ok: false, reason: `Unknown provider "${providerId}"` };
  }
  const model = provider.models.find((m) => m.id === modelId);
  if (!model) {
    return { ok: false, reason: `Unknown model "${modelId}" for provider "${providerId}"` };
  }
  const eligible = model.capabilities.some((cap) => allowedCaps.includes(cap));
  if (!eligible) {
    return {
      ok: false,
      reason: `Model "${modelId}" (${model.capabilities.join(', ')}) is not eligible for node "${nodeKind}" (requires: ${allowedCaps.join(' | ')})`,
    };
  }
  return { ok: true };
}

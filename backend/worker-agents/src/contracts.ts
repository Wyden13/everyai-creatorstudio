import { z } from 'zod';
import modelRegistry from '../../../shared/model-registry.json';

export const CapabilitySchema = z.enum(['llm_text', 'llm_code', 'tts', 'search', 'publish', 'image_gen']);
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

/**
 * Capability-typed model registry consumer for the Inspector UI.
 * Reads directly from shared/model-registry.json so UI selectors and backend
 * validators enforce the exact same capability boundaries.
 */
import registry from '../../../../shared/model-registry.json';
import type { Kind } from './store';

export type Capability = keyof typeof registry.capabilities;

export interface ModelOption {
  id: string;
  providerId: string;
  modelId: string;
  label: string;
  hint: string;
  secretKeyName: string;
}

/**
 * Maps UI board node kinds to canonical registry node kinds.
 * Every UI node kind with a model selector is a row here; add new kinds as rows.
 */
const UI_KIND_TO_RULE: Partial<Record<Kind, keyof typeof registry.node_capability_rules>> = {
  trend: 'trend_scout',
  screenplay: 'screenplay',
  voice: 'voiceover',
  animation: 'animation_remotion',
  manim: 'animation_manim',
  publisher: 'publisher',
  research: 'trend_scout',
  thumbs: 'screenplay',
};

/**
 * Returns only the provider/model options whose capabilities are legal for `kind`.
 * E.g., `voice` only yields TTS models (ElevenLabs, Google Cloud TTS, OpenAI TTS)
 * and never yields LLM/coding models, and vice versa.
 */
export function eligibleModelsForKind(kind: Kind): ModelOption[] {
  const ruleKey = UI_KIND_TO_RULE[kind] ?? 'screenplay';
  const allowedCaps = registry.node_capability_rules[ruleKey] as readonly string[];

  const options: ModelOption[] = [];
  for (const provider of registry.providers) {
    for (const model of provider.models) {
      if (model.capabilities.some((cap) => allowedCaps.includes(cap))) {
        options.push({
          id: `${provider.id}:${model.id}`,
          providerId: provider.id,
          modelId: model.id,
          label: model.label,
          hint: `${provider.label} · ${provider.secret_key_name}`,
          secretKeyName: provider.secret_key_name,
        });
      }
    }
  }
  return options;
}

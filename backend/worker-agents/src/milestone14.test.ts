import { describe, expect, test } from 'bun:test';
import { validateArchitectTurn } from './agents/architect';

describe('Architect edit_board_component (kind: edit)', () => {
  test('accepts valid in-place style & prompt edit by component ID', () => {
    const res = validateArchitectTurn({
      kind: 'edit',
      edit: {
        target_component_id: 'cmp_animation_01',
        summary: 'Updated Animation component to Vox editorial motion style.',
        patch: {
          subtitle: 'Remotion · Vox editorial style',
          style_preset: 'vox_editorial',
          system_prompt: 'Use Vox-style data cards, warm cream highlights, and crisp kinetic typography.',
        },
      },
    });
    expect(res.ok).toBe(true);
  });

  test('rejects capability-mismatched model swap inside edit_board_component', () => {
    const bad = validateArchitectTurn({
      kind: 'edit',
      edit: {
        target_component_id: 'cmp_animation_01',
        summary: 'Invalid TTS model on animation',
        patch: {
          node_kind: 'animation_remotion',
          provider_id: 'elevenlabs',
          model_id: 'eleven_multilingual_v2',
        },
      },
    });
    expect(bad.ok).toBe(false);
  });
});

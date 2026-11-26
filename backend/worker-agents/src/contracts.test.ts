import { describe, expect, test } from 'bun:test';
import { validateModelForNode } from './contracts';

describe('capability-typed model routing', () => {
  test('allows TTS models on voiceover and forbids LLM/code models', () => {
    expect(validateModelForNode('voiceover', 'elevenlabs', 'eleven_multilingual_v2').ok).toBe(true);
    expect(validateModelForNode('voiceover', 'google_tts', 'google-chirp3-hd').ok).toBe(true);
    expect(validateModelForNode('voiceover', 'openai', 'gpt-4o-mini-tts').ok).toBe(true);
    expect(validateModelForNode('voiceover', 'anthropic', 'claude-sonnet-4-5').ok).toBe(false);
  });

  test('forbids TTS models on screenplay, animation, and architect nodes', () => {
    expect(validateModelForNode('screenplay', 'elevenlabs', 'eleven_multilingual_v2').ok).toBe(false);
    expect(validateModelForNode('animation_remotion', 'elevenlabs', 'eleven_multilingual_v2').ok).toBe(false);
    expect(validateModelForNode('architect', 'google_tts', 'google-neural2').ok).toBe(false);
  });
});

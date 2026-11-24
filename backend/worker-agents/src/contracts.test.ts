import { describe, expect, test } from 'bun:test';
import { StoryboardSchema, validateModelForNode } from './contracts';

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

  test('validates structured storyboard contract', () => {
    const parsed = StoryboardSchema.safeParse({
      video_id: 'vid_001',
      title: 'Why WebTransport beats TCP',
      hook: 'TCP head-of-line blocking silently stalls realtime boards.',
      aspect_ratios: ['16:9', '9:16'],
      scenes: [
        {
          scene_id: 'sc_1',
          index: 0,
          narration: 'When one packet drops, every stream waits.',
          visual_directive: 'Animated packet queue stalling on red packet drop.',
          animation_engine: 'manim',
          primitive_hints: ['vector_graph'],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

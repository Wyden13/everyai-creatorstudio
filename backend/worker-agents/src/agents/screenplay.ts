/**
 * Screenplay Agent: generates a strict StoryboardSchema JSON storyboard from a topic.
 * Supports both 'gate' (pause at NeedsApproval) and 'auto' (advance straight to Voiceover).
 */
import { StoryboardSchema, type Storyboard } from '../contracts';
import { callLlmJson } from '../providers';

export type ApprovalMode = 'gate' | 'auto';

export async function runScreenplayAgent(opts: {
  videoId: string;
  topic: string;
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  aspectRatios?: ('16:9' | '9:16')[];
}): Promise<Storyboard> {
  const aspects = opts.aspectRatios ?? ['16:9', '9:16'];
  const userPrompt = JSON.stringify({
    instruction: 'Return ONLY valid JSON matching the Storyboard schema. No markdown fences.',
    video_id: opts.videoId,
    topic: opts.topic,
    aspect_ratios: aspects,
    required_shape: {
      video_id: opts.videoId,
      title: 'string',
      hook: 'string (<12 words)',
      source_topic: opts.topic,
      aspect_ratios: aspects,
      scenes: [
        {
          scene_id: 'sc_1',
          index: 0,
          narration: 'string',
          visual_directive: 'string',
          animation_engine: 'remotion | manim | hybrid',
          primitive_hints: ['kinetic_typography'],
          estimated_duration_ms: 6000,
        },
      ],
    },
  });

  const raw = await callLlmJson({
    nodeKind: 'screenplay',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    systemPrompt: opts.systemPrompt,
    userPrompt,
  });

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = StoryboardSchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`Screenplay output violated StoryboardSchema: ${parsed.error.message}`);
  }
  return parsed.data;
}

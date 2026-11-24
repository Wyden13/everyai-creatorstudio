/**
 * Voiceover Agent: synthesizes approved storyboard narration via any eligible TTS provider
 * (ElevenLabs /with-timestamps, Google Cloud TTS, or OpenAI TTS) and returns audio + word alignment.
 */
import type { Storyboard } from '../contracts';
import { callTtsWithTimestamps, type TtsResult } from '../providers';

export async function runVoiceoverAgent(opts: {
  storyboard: Storyboard;
  providerId: string;
  modelId: string;
  apiKey: string;
  voiceId?: string;
}): Promise<TtsResult> {
  const fullNarration = [opts.storyboard.hook, ...opts.storyboard.scenes.map((s) => s.narration)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');

  return callTtsWithTimestamps({
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    text: fullNarration,
    voiceId: opts.voiceId,
  });
}

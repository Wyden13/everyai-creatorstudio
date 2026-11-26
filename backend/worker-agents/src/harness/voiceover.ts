/**
 * Voiceover stage: TOOL-ONLY (no LLM, no system prompt). It is registered with the harnesses
 * because it is a pipeline stage with the same input/output/session contract.
 *   locked beat-sheet narration → TTS (one take, natural prosody) → WAV on disk
 *     → word-alignment tool on the real audio (Gemini TTS returns no timestamps).
 * The Tone (sheet.register, src/vox/register.ts) picks the voice, the `style` delivery string and
 * the vocal tags, which code inserts into the TTS text only; the aligned script stays plain narration.
 * Resume reruns it from scratch: there is no conversation to continue.
 */
import { z } from 'zod';
import { WordTrackSchema } from '../align';
import { BeatSheetSchema, FORMATS } from '../vox/beat-sheet';
import { resolveStyle, stripVocalTags, voiceScript } from '../vox/register';
import { defineHarness } from './contract';

/** The TTS model of the channel; the voice and its `style` come from the register (spoken text stays a verbatim transcript). */
export const VOICE = { providerId: 'google_gemini', modelId: 'gemini-3.8-flash-tts' } as const;

export const VoiceoverInputSchema = z.object({ sheet: BeatSheetSchema, audioPath: z.string().min(1) });
export const VoiceoverOutputSchema = z.object({
  audioPath: z.string(),
  durationMs: z.number().int().positive(),
  words: WordTrackSchema,
  /** The TTS provider's C2PA content credentials (AI-generated audio), stored beside the audio for disclosure at publish time. */
  provenancePath: z.string().optional(),
});

export const voiceoverHarness = defineHarness({
  id: 'voiceover',
  capability: 'tts',
  systemPrompt: '',
  tools: [
    { id: 'tts', kind: 'coded', description: `${VOICE.providerId} ${VOICE.modelId}, voice + style per Tone (REGISTERS)` },
    { id: 'align', kind: 'coded', description: 'faster-whisper word timestamps on the real audio' },
  ],
  input: VoiceoverInputSchema,
  output: VoiceoverOutputSchema,
  edges: ['tts', 'align'],
  async body({ input, edges }) {
    const { sheet } = input;
    const { voice } = resolveStyle(FORMATS[sheet.format], sheet.register);
    const text = voiceScript(sheet.beats, sheet.register);
    const plain = sheet.beats.map((b) => b.narration).join(' ');
    if (stripVocalTags(text) !== plain) throw new Error('vocal tag insertion changed the spoken words');
    const tts = await edges.tts({ ...VOICE, voiceId: voice.voiceId, ...(voice.style !== null && { style: voice.style }), text });
    await Bun.write(input.audioPath, Buffer.from(tts.audio_base64, 'base64'));
    const provenancePath = tts.c2pa_base64 ? `${input.audioPath}.c2pa` : undefined;
    if (provenancePath) await Bun.write(provenancePath, Buffer.from(tts.c2pa_base64!, 'base64'));
    const words = await edges.align(input.audioPath);
    return { state: 'Done', output: { audioPath: input.audioPath, durationMs: tts.duration_ms, words, provenancePath } };
  },
});

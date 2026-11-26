import { describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLlmJson, type LlmRequest } from '../providers';
import { edgesFromEnv, LIVE } from './env';
import { liveMediaPath } from './live-run';
import { VOICE } from './voiceover';

/** Cheapest real checks of the provider boundary: one streamed reply, one server web_search. */
describe.skipIf(!LIVE)('providers (live: Anthropic streaming smoke)', () => {
  const base = { nodeKind: 'trend_scout', providerId: 'anthropic', modelId: 'claude-opus-5-5', effort: 'low', maxTokens: 4000, systemPrompt: 'Reply with ONLY a JSON object.' } as const;
  const rows: [string, LlmRequest, (reply: { answer: string }) => void][] = [
    ['streams a tiny reply', { ...base, userPrompt: 'Return {"answer":"ok"}.' }, (r) => expect(r.answer).toBe('ok')],
    [
      'answers after a web_search',
      { ...base, serverTools: ['web_search'], userPrompt: 'Search the web once for the latest stable Python version. Return {"answer":"<version>"}.' },
      (r) => expect(r.answer).toMatch(/^3\.\d+/),
    ],
  ];
  for (const [name, req, check] of rows) {
    test(name, async () => check(parseLlmJson((await edgesFromEnv(['llm']).llm(req)).text) as { answer: string }), 120_000);
  }
});

/**
 * Gemini TTS style field: no tone may speak a word that is not in the script (style text and vocal
 * tags never leak into speech), checked by the word-alignment tool on the real audio. Whisper can
 * drop a hushed word, so missed script words are logged, not failed. WAVs land in .live/tts-styles/.
 */
describe.skipIf(!LIVE)('providers (live: Gemini TTS style, no instruction leakage)', () => {
  const SCRIPT =
    'Julius Caesar walked into the Senate expecting a quiet morning. Instead, dozens of senators were waiting with knives under their togas. ' +
    'He had been warned to beware the Ides of March. He went anyway, and Rome never forgot it.';
  const TAGGED = SCRIPT.replace('He went anyway,', '<chuckle> He went anyway, <short pause>');
  const TONES: [name: string, voiceId: string, style: string, text: string][] = [
    ['documentary', 'Charon', 'calm, clear and measured, quietly curious', SCRIPT],
    ['deadpan', 'Schedar', 'monotone and flat, dry, understated', SCRIPT],
    ['comedic', 'Puck', 'playful and wry, quick, a hint of a smirk', SCRIPT],
    ['hype', 'Fenrir', 'energetic, speaking rapidly, excited', SCRIPT],
    ['wholesome', 'Sulafat', 'warm, gentle, smiling', SCRIPT],
    ['dramatic', 'Algenib', 'low and hushed, speaking slowly, building tension', SCRIPT],
    ['comedic-tagged', 'Puck', 'playful and wry, quick, a hint of a smirk', TAGGED],
  ];
  const words = (s: string) => s.replace(/<[^>]+>/g, ' ').toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  const dir = liveMediaPath('tts-styles');

  for (const [name, voiceId, style, text] of TONES) {
    test(
      `${name} (${voiceId}): speaks exactly the script`,
      async () => {
        const { tts, align } = edgesFromEnv(['tts', 'align']);
        const out = await tts({ providerId: VOICE.providerId, modelId: VOICE.modelId, voiceId, style, text });
        const wav = Buffer.from(out.audio_base64, 'base64');
        mkdirSync(dir, { recursive: true });
        const path = join(dir, `${name}.wav`);
        await Bun.write(path, wav);
        const heard = (await align(path)).map((w) => w.word).join(' ');
        // Walk the script in order: a heard word matches the next unmatched script word, or it is extra.
        const script = words(SCRIPT);
        let at = 0;
        const extra = words(heard).filter((w) => {
          const i = script.indexOf(w, at);
          if (i < 0) return true;
          at = i + 1;
          return false;
        });
        const missed = script.length - (words(heard).length - extra.length);
        // Samples start after the 44-byte header splitWavC2pa writes for a fmt + data WAV.
        const samples = new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length));
        const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        console.log(JSON.stringify({ tone: name, voiceId, durationMs: out.duration_ms, wordsPerSec: +(script.length / (out.duration_ms / 1000)).toFixed(2), peakDbfs: +(20 * Math.log10(peak / 32768)).toFixed(1), clipped: samples.filter((v) => Math.abs(v) >= 32767).length, c2paBytes: out.c2pa_base64 ? Buffer.from(out.c2pa_base64, 'base64').length : 0, missed, heard }));
        expect(extra).toEqual([]);
      },
      180_000,
    );
  }
});

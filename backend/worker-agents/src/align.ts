/**
 * Word-alignment tool: real word timestamps for a spoken audio file, from faster-whisper ASR
 * (scripts/align_words.py). Needed because some TTS providers (Gemini) return no timestamps.
 * The Python interpreter is injected (ALIGN_PYTHON at the env edge); a missing one fails loud.
 */
import { resolve } from 'node:path';
import { z } from 'zod';
import type { WordTimestamp } from './providers';

const ALIGN_SCRIPT = resolve(import.meta.dir, '../scripts/align_words.py');

export const WordTimestampSchema = z.object({ word: z.string(), start_ms: z.number().int().nonnegative(), end_ms: z.number().int().nonnegative() });
export const WordTrackSchema = z.array(WordTimestampSchema).min(1, 'no words recognised in the audio');

export async function alignWords(python: string, audioPath: string): Promise<WordTimestamp[]> {
  const proc = Bun.spawn([python, '-I', ALIGN_SCRIPT, audioPath], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`word alignment failed (${python} exited ${code}): ${err.slice(-600)}`);
  return WordTrackSchema.parse(JSON.parse(out));
}

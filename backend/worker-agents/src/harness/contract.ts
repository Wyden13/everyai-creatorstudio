/**
 * The harness contract (AGENTS.md §3). A harness = system prompt + tools + one LLM task, with
 * zod-typed input/output and injected I/O edges. Every run returns a resumable session, so a
 * status flag (or a person) can restart it with the whole context, the last output and a failure.
 */
import type { ZodType } from 'zod';
import type { Capability } from '../contracts';
import { TTS_USD_PER_AUDIO_SEC, type WordTimestamp, type LlmCall, type LlmModel, type LlmUsage, type SearchResult, type TtsCall } from '../providers';
import type { ImageGenEdges, ImageRef } from '../assets/image-gen';
import type { auditTimeline, renderTimelineVideo } from '../vox/render';
import { roundUsd } from './spend';

/** A tool a harness can use: Anthropic-hosted (server) or our own code (coded). */
export interface ToolSpec {
  id: string;
  kind: 'server' | 'coded';
  description: string;
}

/** Every I/O edge a harness may be given. Harnesses never read env, the Vault or globals. */
export interface HarnessEdges {
  /** LLM call with the key already bound. */
  llm: LlmCall;
  model: LlmModel;
  /** TTS call with the key already bound. */
  tts: TtsCall;
  /** Word timestamps for a spoken audio file. */
  align: (audioPath: string) => Promise<WordTimestamp[]>;
  audit: typeof auditTimeline;
  render: typeof renderTimelineVideo;
  /** Image generation, one bound call per configured provider (src/assets/image-gen.ts). */
  imageGen: ImageGenEdges;
  /** Bytes of a Ready org-library asset, e.g. as a reference image (src/assets/store.ts). */
  assetRefs: (assetId: string) => Promise<ImageRef>;
}
export type EdgeName = keyof HarnessEdges;

/**
 * A reply keeps its tool evidence (search count in usage, result URLs), so a resumed or judged run can check it.
 * A TTS or image call keeps what it cost, so a session always knows its spend (spend.ts).
 */
export type HarnessMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; usage: LlmUsage; searchResults: SearchResult[] }
  | { role: 'tts'; providerId: string; modelId: string; chars: number; durationMs: number; estimatedUsd: number }
  | { role: 'image'; providerId: string; modelId: string; promptChars: number; refs: number; costUsd: number };

/** Everything needed to resume: what was said, what came out last, and why it failed (if it did). */
export interface HarnessSession {
  harnessId: string;
  messages: HarnessMessage[];
  lastOutput?: unknown;
  /** Set by a failed run, or by whoever restarts it (e.g. a failing status flag). */
  failure?: string;
}

export type HarnessResult<O> =
  | { state: 'Done'; output: O; session: HarnessSession }
  | { state: 'Failed'; error: string; session: HarnessSession };

/** What a harness body returns; `partial` is the output worth resuming from after a failure. */
export type HarnessOutcome<O> = { state: 'Done'; output: O } | { state: 'Failed'; error: string; partial?: unknown };

export interface Harness<I, O, E extends EdgeName> {
  id: string;
  capability: Capability;
  systemPrompt: string;
  tools: readonly ToolSpec[];
  input: ZodType<I, any, unknown>;
  output: ZodType<O, any, unknown>;
  /** The edges this harness needs; the caller builds exactly these. */
  edges: readonly E[];
  /** Files the run reads besides its JSON input (e.g. the voiceover audio); their contents are part of its checkpoint input hash. */
  inputFiles?: (input: I) => readonly string[];
  run(input: I, edges: Pick<HarnessEdges, E>, resume?: HarnessSession): Promise<HarnessResult<O>>;
}

export interface HarnessBody<I, O, E extends EdgeName> {
  input: I;
  edges: Pick<HarnessEdges, E>;
  resume?: HarnessSession;
  /** The run's LLM edge; every exchange is recorded into the session. */
  llm: LlmCall;
}

/**
 * Builds a harness from its declaration and body. The shell validates input and output at the
 * boundary, records every LLM exchange, TTS and image call (with its cost), and turns any throw into a
 * Failed result with its session.
 */
export function defineHarness<I, O, E extends EdgeName>(
  spec: Omit<Harness<I, O, E>, 'run'> & { body: (ctx: HarnessBody<I, O, E>) => Promise<HarnessOutcome<O>> },
): Harness<I, O, E> {
  const { body, ...declared } = spec;
  return {
    ...declared,
    async run(rawInput, edges, resume) {
      const messages: HarnessMessage[] = [...(resume?.messages ?? [])];
      const session = (extra: Pick<HarnessSession, 'lastOutput' | 'failure'>): HarnessSession => ({ harnessId: spec.id, messages, ...extra });
      const llm: LlmCall = async (req) => {
        if (!('llm' in edges)) throw new Error(`harness ${spec.id} declared no llm edge`);
        messages.push({ role: 'user', content: req.userPrompt });
        const reply = await (edges as Pick<HarnessEdges, 'llm'>).llm(req);
        messages.push({ role: 'assistant', content: reply.text, usage: reply.usage, searchResults: reply.searchResults });
        return reply;
      };
      const tts: TtsCall = async (req) => {
        const usdPerSec = TTS_USD_PER_AUDIO_SEC[req.modelId];
        if (usdPerSec === undefined) throw new Error(`no TTS price for ${req.modelId}; add a row to TTS_USD_PER_AUDIO_SEC (src/providers.ts)`);
        const audio = await (edges as Pick<HarnessEdges, 'tts'>).tts(req);
        const { providerId, modelId, text } = req;
        messages.push({ role: 'tts', providerId, modelId, chars: text.length, durationMs: audio.duration_ms, estimatedUsd: roundUsd((audio.duration_ms / 1000) * usdPerSec) });
        return audio;
      };
      const recordImage = ([providerId, call]: [string, ImageGenEdges[string]]) => [
        providerId,
        async (req: Parameters<NonNullable<ImageGenEdges[string]>>[0]) => {
          const image = await call!(req);
          messages.push({ role: 'image', providerId: req.providerId, modelId: req.modelId, promptChars: req.prompt.length, refs: req.refs.length, costUsd: image.costUsd });
          return image;
        },
      ];
      try {
        const recorded = {
          ...edges,
          ...('tts' in edges && { tts }),
          ...('imageGen' in edges && { imageGen: Object.fromEntries(Object.entries((edges as Pick<HarnessEdges, 'imageGen'>).imageGen).map(recordImage)) }),
        };
        const outcome = await body({ input: spec.input.parse(rawInput), edges: recorded, resume, llm });
        if (outcome.state === 'Failed') return { state: 'Failed', error: outcome.error, session: session({ lastOutput: outcome.partial ?? resume?.lastOutput, failure: outcome.error }) };
        const output = spec.output.parse(outcome.output);
        return { state: 'Done', output, session: session({ lastOutput: output }) };
      } catch (e) {
        const error = (e as Error).message;
        return { state: 'Failed', error, session: session({ lastOutput: resume?.lastOutput, failure: error }) };
      }
    },
  };
}

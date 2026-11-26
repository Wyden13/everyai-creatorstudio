/**
 * Capability-typed external API provider adapters for backend/worker-agents.
 * Every call validates (nodeKind, providerId, modelId) against shared/model-registry.json
 * BEFORE touching the network. Never silently falls back across providers.
 */
import { validateModelForNode } from './contracts';
import { REAL_RETRY_DEPS, ProviderStreamError, fetchBody, withRetry, type RetryDeps } from './retry';

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TtsResult {
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  words: WordTimestamp[];
  /** Provenance record that came with the audio (C2PA content credentials, base64 JUMBF), kept so it can be stored and disclosed. */
  c2pa_base64?: string;
}

/**
 * Reads the WAV Gemini TTS returns and splits out its signed content credentials: a RIFF `C2PA`
 * chunk (a JUMBF manifest) after `data`. Every other chunk is kept, so the result is plain audio.
 * Fails loud on anything that is not a well-formed RIFF/WAVE with `fmt ` and `data`.
 */
export function splitWavC2pa(file: Buffer): { wav: Buffer; manifest?: Buffer; durationMs: number } {
  if (file.length < 12 || file.toString('latin1', 0, 4) !== 'RIFF' || file.toString('latin1', 8, 12) !== 'WAVE') throw new Error('Gemini TTS audio is not a RIFF/WAVE file');
  const chunks: { id: string; body: Buffer }[] = [];
  for (let at = 12; at < file.length; ) {
    if (at + 8 > file.length) throw new Error(`Gemini TTS WAV has a truncated chunk header at byte ${at}`);
    const id = file.toString('latin1', at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (at + 8 + size > file.length) throw new Error(`Gemini TTS WAV chunk "${id}" overruns the file`);
    chunks.push({ id, body: file.subarray(at + 8, at + 8 + size) });
    at += 8 + size + (size % 2); // RIFF pads odd-sized chunks to an even boundary
  }
  const fmt = chunks.find((c) => c.id === 'fmt ')?.body;
  const data = chunks.find((c) => c.id === 'data')?.body;
  if (!fmt || fmt.length < 16 || !data) throw new Error('Gemini TTS WAV has no fmt or data chunk');
  const kept = chunks.filter((c) => c.id !== 'C2PA').flatMap(({ id, body }) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, 'latin1');
    head.writeUInt32LE(body.length, 4);
    return [head, body, Buffer.alloc(body.length % 2)];
  });
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0);
  riff.writeUInt32LE(4 + kept.reduce((n, b) => n + b.length, 0), 4);
  riff.write('WAVE', 8);
  const manifest = chunks.find((c) => c.id === 'C2PA')?.body;
  return {
    wav: Buffer.concat([riff, ...kept]),
    ...(manifest && { manifest }),
    durationMs: Math.round((data.length / fmt.readUInt32LE(8)) * 1000), // fmt byte rate
  };
}

/**
 * Pure converter: turns ElevenLabs character-level alignment arrays into word-level timestamps
 * so Remotion & Manim animations lock directly to speech cadence.
 */
export function alignCharactersToWords(
  characters: readonly string[],
  startsSec: readonly number[],
  endsSec: readonly number[],
): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  let buf = '';
  let wordStart = -1;
  let wordEnd = 0;

  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed.length > 0 && wordStart >= 0) {
      words.push({
        word: trimmed,
        start_ms: Math.round(wordStart * 1000),
        end_ms: Math.round(wordEnd * 1000),
      });
    }
    buf = '';
    wordStart = -1;
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i] ?? '';
    const s = startsSec[i] ?? 0;
    const e = endsSec[i] ?? s;
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (wordStart < 0) wordStart = s;
    buf += ch;
    wordEnd = e;
  }
  flush();
  return words;
}

/** Fallback uniform word timing when a TTS provider (e.g. OpenAI TTS) omits timestamps. */
export function estimateWordTimestamps(text: string, totalDurationMs: number): WordTimestamp[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const step = Math.max(1, Math.floor(totalDurationMs / tokens.length));
  return tokens.map((word, idx) => ({
    word,
    start_ms: idx * step,
    end_ms: idx === tokens.length - 1 ? totalDurationMs : (idx + 1) * step,
  }));
}

export interface LlmAttachment {
  name: string;
  mimeType: string;
  /** Base64 payload (no data: prefix) for images, or UTF-8 text content for files. */
  data: string;
  kind: 'image' | 'file';
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  /** Server web_search calls; billed per search on top of tokens. */
  webSearchRequests: number;
  estimatedUsd: number;
  savedUsd: number;
}

/** One page a server web_search returned (the evidence a harness checks its sources against). */
export interface SearchResult {
  url: string;
  title: string;
}

/** Anthropic `output_config.effort` levels (thinking is always on for Opus 5.5; effort is the only dial). */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * Anthropic server-side tools, by the name a harness asks for. They run on Anthropic's side
 * inside one request (no client loop). Add a tool as a row here.
 */
export const SERVER_TOOLS = {
  web_search: { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
} as const;
export type ServerTool = keyof typeof SERVER_TOOLS;

export interface LlmJsonOptions {
  nodeKind: 'trend_scout' | 'screenplay' | 'animation_remotion' | 'animation_manim' | 'architect' | 'publisher' | 'asset_generation';
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  /**
   * Static shared context (e.g. loaded SKILL.md docs, Show Bible + Beat Sheet).
   * Marked with ephemeral cache_control on Anthropic and placed in the stable prefix on OpenAI/Gemini.
   */
  cachedContext?: string;
  /** Optional cache routing key (e.g. 'essay:<runId>' or 'architect:<skills>') for OpenAI prompt caching. */
  cacheKey?: string;
  /** Anthropic `output_config.effort`; omitted = the model's default. */
  effort?: Effort;
  /** Defaults to the model's output ceiling on Anthropic (requests stream, so only an idle timeout applies). */
  maxTokens?: number;
  /** Anthropic server tools; the answer is the text after the last tool result. */
  serverTools?: readonly ServerTool[];
  enablePromptCache?: boolean;
  attachments?: readonly LlmAttachment[];
}

/** What every LLM call returns: the answer text plus the tool evidence behind it. */
export interface LlmReply {
  text: string;
  usage: LlmUsage;
  /** Every result of every server web_search in the turn, in stream order (empty without tools). */
  searchResults: SearchResult[];
}

/** A request with its key still unbound: what harnesses build. The key is bound at the edge. */
export type LlmRequest = Omit<LlmJsonOptions, 'apiKey'>;
export type LlmCall = (req: LlmRequest) => Promise<LlmReply>;
/** Which model a harness runs on (no key: keys never reach a harness). */
export type LlmModel = Pick<LlmJsonOptions, 'providerId' | 'modelId' | 'effort'>;

interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
}

/** Declarative USD pricing table per 1M tokens (used for cost telemetry & cache savings). */
export const MODEL_PRICING_USD_PER_M: Readonly<Record<string, ModelPrice>> = {
  'claude-opus-5-5': { inputPerM: 4.0, outputPerM: 20.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.05 },
  'claude-sonnet-5-5': { inputPerM: 2.0, outputPerM: 10.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.05 },
  'claude-haiku-5-5': { inputPerM: 0.1, outputPerM: 0.5, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-sonnet-4-6': { inputPerM: 3.0, outputPerM: 15.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-sonnet-4-5': { inputPerM: 3.0, outputPerM: 15.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-opus-4-5': { inputPerM: 15.0, outputPerM: 75.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-haiku-4-5': { inputPerM: 0.8, outputPerM: 4.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.5 },
  'o3': { inputPerM: 10.0, outputPerM: 40.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.5 },
  'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.25 },
  'gemini-2.5-flash': { inputPerM: 0.15, outputPerM: 0.6, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.25 },
};

/**
 * Estimated USD per second of generated audio, per TTS model. A model without a row fails loud
 * before the call is made (src/harness/contract.ts), so no TTS spend goes unrecorded. Add a model as a row.
 */
export const TTS_USD_PER_AUDIO_SEC: Readonly<Record<string, number>> = {
  // Google model page (gemini-3.8-flash-tts, Standard tier): $9 per 1M audio output tokens at 25 tokens/s
  // through 2026-12-31 ($18 from 2027-01-01: update this row then). Text input ($0.50/1M) is negligible.
  'gemini-3.8-flash-tts': (9 / 1e6) * 25,
};

/** Anthropic server web_search: $10 per 1,000 searches, any model. */
const WEB_SEARCH_USD = 10 / 1000;

const DEFAULT_MODEL_PRICE: ModelPrice = {
  inputPerM: 3.0,
  outputPerM: 15.0,
  cacheWriteMultiplier: 1.25,
  cacheReadMultiplier: 0.1,
};

/** Pure cost & cache-savings calculator from provider token counts. */
export function computeLlmCost(
  modelId: string,
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    webSearchRequests?: number;
  },
): LlmUsage {
  const price = MODEL_PRICING_USD_PER_M[modelId] ?? DEFAULT_MODEL_PRICE;
  const cacheCreate = tokens.cacheCreationTokens ?? 0;
  const cacheRead = tokens.cacheReadTokens ?? 0;
  const inputUsd = (tokens.inputTokens / 1_000_000) * price.inputPerM;
  const outputUsd = (tokens.outputTokens / 1_000_000) * price.outputPerM;
  const cacheWriteUsd = (cacheCreate / 1_000_000) * price.inputPerM * price.cacheWriteMultiplier;
  const cacheReadUsd = (cacheRead / 1_000_000) * price.inputPerM * price.cacheReadMultiplier;
  const fullReadUsd = (cacheRead / 1_000_000) * price.inputPerM;
  const searches = tokens.webSearchRequests ?? 0;
  return {
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    webSearchRequests: searches,
    estimatedUsd: Number((inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd + searches * WEB_SEARCH_USD).toFixed(6)),
    savedUsd: Number(Math.max(0, fullReadUsd - cacheReadUsd).toFixed(6)),
  };
}

/** Maps legacy shorthand IDs in model-registry.json to current live Anthropic API model IDs. */
const ANTHROPIC_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-6',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

/** Output-token ceiling per Anthropic model (thinking + answer share it); unlisted models get 128k. */
const ANTHROPIC_MAX_OUTPUT: Readonly<Record<string, number>> = {
  'claude-sonnet-4-5': 64_000,
  'claude-opus-4-5': 64_000,
  'claude-haiku-4-5': 64_000,
};

/** Pure request-body builder so prompt-caching layout is unit-testable without network calls. */
export function buildLlmRequestPayload(opts: LlmRequest): Record<string, unknown> {
  const attachments = opts.attachments ?? [];
  const useCache = opts.enablePromptCache !== false;

  if (opts.providerId === 'anthropic') {
    const systemBlocks: Record<string, unknown>[] = [
      useCache
        ? { type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }
        : { type: 'text', text: opts.systemPrompt },
    ];
    if (opts.cachedContext) {
      systemBlocks.push(
        useCache
          ? { type: 'text', text: opts.cachedContext, cache_control: { type: 'ephemeral' } }
          : { type: 'text', text: opts.cachedContext },
      );
    }

    const blocks: Record<string, unknown>[] = [];
    for (const att of attachments) {
      if (att.kind === 'image') {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: att.mimeType, data: att.data },
        });
      } else {
        blocks.push({
          type: 'text',
          text: `[Attached file: ${att.name} (${att.mimeType})]\n${att.data.slice(0, 16000)}`,
        });
      }
    }
    blocks.push({ type: 'text', text: opts.userPrompt });

    const body: Record<string, unknown> = {
      model: ANTHROPIC_MODEL_ALIASES[opts.modelId] ?? opts.modelId,
      max_tokens: opts.maxTokens ?? ANTHROPIC_MAX_OUTPUT[opts.modelId] ?? 128_000,
      stream: true,
      system: systemBlocks,
      messages: [{ role: 'user', content: blocks }],
    };
    if (opts.effort) body.output_config = { effort: opts.effort };
    if (opts.serverTools?.length) body.tools = opts.serverTools.map((t) => SERVER_TOOLS[t]);
    return body;
  }

  if (opts.providerId === 'openai') {
    const parts: Record<string, unknown>[] = [];
    for (const att of attachments) {
      if (att.kind === 'image') {
        parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.data}` } });
      } else {
        parts.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.data.slice(0, 16000)}` });
      }
    }
    parts.push({ type: 'text', text: opts.userPrompt });

    const messages: Record<string, unknown>[] = [
      {
        role: 'system',
        content: opts.cachedContext ? `${opts.systemPrompt}\n\n${opts.cachedContext}` : opts.systemPrompt,
      },
      { role: 'user', content: parts },
    ];
    const body: Record<string, unknown> = {
      model: opts.modelId,
      response_format: { type: 'json_object' },
      messages,
    };
    if (useCache && opts.cacheKey) body.prompt_cache_key = opts.cacheKey;
    return body;
  }

  if (opts.providerId === 'google_gemini') {
    const parts: Record<string, unknown>[] = [];
    for (const att of attachments) {
      if (att.kind === 'image') {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
      } else {
        parts.push({ text: `[Attached file: ${att.name}]\n${att.data.slice(0, 16000)}` });
      }
    }
    parts.push({ text: opts.userPrompt });

    const sysParts: Record<string, unknown>[] = [{ text: opts.systemPrompt }];
    if (opts.cachedContext) sysParts.push({ text: opts.cachedContext });

    return {
      systemInstruction: { parts: sysParts },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json' },
    };
  }

  throw new Error(`Unsupported LLM provider "${opts.providerId}"`);
}

// ── Anthropic streaming (SSE) ───────────────────────────────────────────────

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

/** One content block as accumulated from the stream; only text blocks carry text. */
export interface StreamedBlock {
  type: string;
  text: string;
}

export interface StreamedMessage {
  blocks: StreamedBlock[];
  /** Results of every web_search_tool_result block; these arrive whole in content_block_start. */
  searchResults: SearchResult[];
  stopReason: string;
  usage: AnthropicUsage;
}

/** Wire JSON; each SSE_FOLD row reads only the fields its event type is documented to carry. */
type SseEvent = any;

/**
 * How each stream event folds into the message. message_delta usage is cumulative, so later
 * values replace earlier ones. Add new event handling as a row; any other event (ping,
 * content_block_stop, message_stop, thinking/signature/tool-input deltas) carries nothing we keep.
 */
const SSE_FOLD: Record<string, (m: StreamedMessage, e: SseEvent) => void> = {
  message_start: (m, e) => Object.assign(m.usage, e.message?.usage),
  content_block_start: (m, e) => {
    const block = e.content_block;
    m.blocks[e.index] = { type: block.type, text: block.text ?? '' };
    // A failed search carries an error object instead of a result list: it adds no evidence.
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      m.searchResults.push(...block.content.map((r: SearchResult) => ({ url: r.url, title: r.title })));
    }
  },
  content_block_delta: (m, e) => {
    if (e.delta.type === 'text_delta') m.blocks[e.index]!.text += e.delta.text;
  },
  message_delta: (m, e) => {
    m.stopReason = e.delta?.stop_reason ?? m.stopReason;
    Object.assign(m.usage, e.usage);
  },
  // overloaded_error / api_error mid-stream are retryable (src/retry.ts RETRY_POLICY); the rest are fatal.
  error: (m, e) => {
    throw new ProviderStreamError(`Anthropic stream error: ${JSON.stringify(e.error)}`, String(e.error?.type), m.usage);
  },
};

/** Pure SSE parser for a complete Anthropic Messages stream body. Throws ProviderStreamError<AnthropicUsage> if it died early. */
export function parseAnthropicStream(body: string): StreamedMessage {
  const message: StreamedMessage = { blocks: [], searchResults: [], stopReason: '', usage: {} };
  for (const frame of body.split(/\r?\n\r?\n/)) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    const event = JSON.parse(data) as SseEvent;
    SSE_FOLD[event.type]?.(message, event);
  }
  if (!message.stopReason) throw new ProviderStreamError('Anthropic stream ended without a stop_reason (connection cut?)', 'stream_cut', message.usage);
  return message;
}

/**
 * The answer text: with server tools the reply interleaves text with tool-use and tool-result
 * blocks, and only the text after the last tool result is the answer. Without tools that is all text.
 */
export function anthropicAnswerText(blocks: readonly StreamedBlock[]): string {
  const lastResult = blocks.reduce((last, b, i) => (b.type.endsWith('_tool_result') ? i : last), -1);
  return blocks
    .slice(lastResult + 1)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Stop reasons that mean the text is not a usable answer; each fails loud with its cause. */
const ANTHROPIC_STOP_FAILURES: Readonly<Record<string, (maxTokens: number) => string>> = {
  // Thinking shares max_tokens with the answer (always on for Opus 5.5): a cut-off reply is half a JSON document.
  max_tokens: (n) => `Anthropic reply truncated at max_tokens=${n} (thinking + output); raise maxTokens or lower effort`,
  refusal: () => 'Anthropic declined the request (stop_reason: refusal)',
  // The server-tool loop hit its iteration cap; resuming needs the full block history, which we do not keep.
  pause_turn: () => 'Anthropic paused the turn (stop_reason: pause_turn): server-tool loop hit its iteration limit; lower max_uses or narrow the task',
};

/** A non-streamed JSON call with retries (src/retry.ts); a 2xx body that is not JSON is fatal. */
export async function requestJson<T>(label: string, url: string, init: RequestInit, deps: RetryDeps): Promise<T> {
  const parse = async () => JSON.parse((await fetchBody(label, url, init, deps.timeouts.responseIdleMs, deps)).toString()) as T;
  return (await withRetry(label, parse, deps)).value;
}

export async function callLlm(opts: LlmJsonOptions, deps: RetryDeps = REAL_RETRY_DEPS): Promise<LlmReply> {
  const check = validateModelForNode(opts.nodeKind, opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing API key for provider "${opts.providerId}"`);

  const payload = buildLlmRequestPayload(opts);

  if (opts.providerId === 'anthropic') {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    };
    // A stream that dies before its stop_reason is retried as a whole: parsing is part of the attempt.
    const { value: message, failures } = await withRetry(
      'Anthropic',
      async () => parseAnthropicStream((await fetchBody('Anthropic', 'https://api.anthropic.com/v1/messages', init, deps.timeouts.streamIdleMs, deps)).toString()),
      deps,
    );
    const failure = ANTHROPIC_STOP_FAILURES[message.stopReason];
    if (failure) throw new Error(failure(payload.max_tokens as number));
    // Billing: an HTTP error bills nothing; a stream that died may have billed, so its last reported
    // usage counts. Output tokens arrive only in message_delta, so a stream cut before that counts
    // just the input side: the total is a lower bound in that case.
    const usages = [...failures.flatMap((f) => (f instanceof ProviderStreamError ? [f.partialUsage as AnthropicUsage] : [])), message.usage];
    const total = (pick: (u: AnthropicUsage) => number | undefined) => usages.reduce((sum, u) => sum + (pick(u) ?? 0), 0);
    return {
      text: anthropicAnswerText(message.blocks),
      usage: computeLlmCost(opts.modelId, {
        inputTokens: total((u) => u.input_tokens),
        outputTokens: total((u) => u.output_tokens),
        cacheCreationTokens: total((u) => u.cache_creation_input_tokens),
        cacheReadTokens: total((u) => u.cache_read_input_tokens),
        webSearchRequests: total((u) => u.server_tool_use?.web_search_requests),
      }),
      searchResults: message.searchResults,
    };
  }

  if (opts.providerId === 'openai') {
    const data = await requestJson<{
      choices: { message: { content: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    }>(
      'OpenAI',
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      deps,
    );
    const u = data.usage ?? {};
    const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
    const uncachedInput = Math.max(0, (u.prompt_tokens ?? 0) - cached);
    return {
      text: data.choices[0]?.message.content ?? '',
      usage: computeLlmCost(opts.modelId, {
        inputTokens: uncachedInput,
        outputTokens: u.completion_tokens ?? 0,
        cacheReadTokens: cached,
      }),
      searchResults: [],
    };
  }

  if (opts.providerId === 'google_gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.modelId)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const data = await requestJson<{
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        cachedContentTokenCount?: number;
      };
    }>('Gemini', url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }, deps);
    const u = data.usageMetadata ?? {};
    const cached = u.cachedContentTokenCount ?? 0;
    const uncachedInput = Math.max(0, (u.promptTokenCount ?? 0) - cached);
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      usage: computeLlmCost(opts.modelId, {
        inputTokens: uncachedInput,
        outputTokens: u.candidatesTokenCount ?? 0,
        cacheReadTokens: cached,
      }),
      searchResults: [],
    };
  }

  throw new Error(`Unsupported LLM provider "${opts.providerId}"`);
}

/** Parses a model's JSON reply, tolerating a markdown fence around it. Throws on anything else. */
export const parseLlmJson = (raw: string): unknown => JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

export interface TtsOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  text: string;
  voiceId?: string;
  /**
   * Delivery direction, sent apart from the words (Gemini `speech_metadata.style`, e.g. "calm, clear
   * and measured"), so it is never spoken. Only Gemini has the field; any other provider fails loud.
   * Vocal tags (`<short pause>`, `<chuckle>` ...) go inline in `text`.
   */
  style?: string;
  /** Optional prosody continuity context for ElevenLabs chapter seams. */
  previousText?: string;
  nextText?: string;
}
/** A TTS request with its key still unbound (bound at the edge, like LlmCall). */
export type TtsCall = (req: Omit<TtsOptions, 'apiKey'>) => Promise<TtsResult>;

export async function callTtsWithTimestamps(opts: TtsOptions, deps: RetryDeps = REAL_RETRY_DEPS): Promise<TtsResult> {
  const check = validateModelForNode('voiceover', opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing TTS API key for provider "${opts.providerId}"`);
  if (opts.style !== undefined && opts.providerId !== 'google_gemini') throw new Error(`TTS provider "${opts.providerId}" has no style field; only google_gemini takes a style`);

  if (opts.providerId === 'elevenlabs') {
    const voiceId = opts.voiceId ?? '21m00Tcm4TlvDq8ikWAM';
    const body: Record<string, unknown> = { text: opts.text, model_id: opts.modelId };
    if (opts.previousText) body.previous_text = opts.previousText;
    if (opts.nextText) body.next_text = opts.nextText;
    const data = await requestJson<{
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    }>(
      'ElevenLabs',
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
      { method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': opts.apiKey }, body: JSON.stringify(body) },
      deps,
    );
    const words = data.alignment
      ? alignCharactersToWords(
          data.alignment.characters,
          data.alignment.character_start_times_seconds,
          data.alignment.character_end_times_seconds,
        )
      : [];
    const duration_ms = words.length > 0 ? words[words.length - 1]!.end_ms : 0;
    return { audio_base64: data.audio_base64, mime_type: 'audio/mpeg', duration_ms, words };
  }

  if (opts.providerId === 'google_tts') {
    const data = await requestJson<{ audioContent: string }>(
      'Google TTS',
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${encodeURIComponent(opts.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: { text: opts.text },
          voice: { languageCode: 'en-US', name: opts.voiceId ?? 'en-US-Chirp3-HD-Charon' },
          audioConfig: { audioEncoding: 'MP3' },
          enableTimePointing: ['SSML_MARK'],
        }),
      },
      deps,
    );
    const estDuration = Math.max(1000, opts.text.split(/\s+/).length * 360);
    return {
      audio_base64: data.audioContent,
      mime_type: 'audio/mpeg',
      duration_ms: estDuration,
      words: estimateWordTimestamps(opts.text, estDuration),
    };
  }

  if (opts.providerId === 'openai') {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.modelId,
        voice: opts.voiceId ?? 'alloy',
        input: opts.text,
        response_format: 'mp3',
      }),
    };
    const { value: bytes } = await withRetry(
      'OpenAI TTS',
      () => fetchBody('OpenAI TTS', 'https://api.openai.com/v1/audio/speech', init, deps.timeouts.responseIdleMs, deps),
      deps,
    );
    const estDuration = Math.max(1000, opts.text.split(/\s+/).length * 360);
    return {
      audio_base64: Buffer.from(bytes).toString('base64'),
      mime_type: 'audio/mpeg',
      duration_ms: estDuration,
      words: estimateWordTimestamps(opts.text, estDuration),
    };
  }

  if (opts.providerId === 'google_gemini') {
    type Interaction = { status?: string; steps?: { type: string; content?: { type: string; data?: string }[] }[] };
    // Interactions API: the text is a verbatim transcript; delivery goes in the separate style annotation.
    const data = await requestJson<Interaction>('Gemini TTS', 'https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
      body: JSON.stringify({
        model: opts.modelId,
        input: [{ type: 'user_input', content: [{ type: 'text', text: opts.text, ...(opts.style !== undefined && { annotations: [{ type: 'speech_metadata', style: opts.style }] }) }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: opts.voiceId ?? 'Charon' }] },
        // The narration is org content: don't let Google keep the interaction server-side.
        store: false,
      }),
    }, deps);
    const audio = data.steps?.filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).filter((c) => c.type === 'audio' && c.data).at(-1)?.data;
    if (!audio) throw new Error(`Gemini TTS returned no audio (interaction status: ${data.status ?? 'none'})`);
    const { wav, manifest, durationMs } = splitWavC2pa(Buffer.from(audio, 'base64'));
    return {
      audio_base64: wav.toString('base64'),
      mime_type: 'audio/wav',
      duration_ms: durationMs,
      // No native timestamps: estimated here; the Vox harness re-aligns against the real audio.
      words: estimateWordTimestamps(opts.text, durationMs),
      ...(manifest && { c2pa_base64: manifest.toString('base64') }),
    };
  }

  throw new Error(`Unsupported TTS provider "${opts.providerId}"`);
}

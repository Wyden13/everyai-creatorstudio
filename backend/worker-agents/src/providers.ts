/**
 * Capability-typed external API provider adapters for backend/worker-agents.
 * Every call validates (nodeKind, providerId, modelId) against shared/model-registry.json
 * BEFORE touching the network. Never silently falls back across providers.
 */
import { validateModelForNode } from './contracts';

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  source: string;
  published_hours_ago: number;
}

export interface TtsResult {
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  words: WordTimestamp[];
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
  estimatedUsd: number;
  savedUsd: number;
}

export interface LlmJsonOptions {
  nodeKind: 'trend_scout' | 'screenplay' | 'animation_remotion' | 'animation_manim' | 'architect' | 'publisher';
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
  maxTokens?: number;
  enablePromptCache?: boolean;
  attachments?: readonly LlmAttachment[];
}

export interface LlmJsonResult {
  text: string;
  usage: LlmUsage;
}

interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
}

/** Declarative USD pricing table per 1M tokens (used for cost telemetry & cache savings). */
export const MODEL_PRICING_USD_PER_M: Readonly<Record<string, ModelPrice>> = {
  'claude-sonnet-4-5': { inputPerM: 3.0, outputPerM: 15.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-opus-4-5': { inputPerM: 15.0, outputPerM: 75.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'claude-haiku-4-5': { inputPerM: 0.8, outputPerM: 4.0, cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.5 },
  'o3': { inputPerM: 10.0, outputPerM: 40.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.5 },
  'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10.0, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.25 },
  'gemini-2.5-flash': { inputPerM: 0.15, outputPerM: 0.6, cacheWriteMultiplier: 1.0, cacheReadMultiplier: 0.25 },
};

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
  return {
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    estimatedUsd: Number((inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd).toFixed(6)),
    savedUsd: Number(Math.max(0, fullReadUsd - cacheReadUsd).toFixed(6)),
  };
}

/** Maps legacy shorthand IDs in model-registry.json to current live Anthropic API model IDs. */
const ANTHROPIC_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-6',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

/** Pure request-body builder so prompt-caching layout is unit-testable without network calls. */
export function buildLlmRequestPayload(opts: Omit<LlmJsonOptions, 'apiKey'>): Record<string, unknown> {
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

    return {
      model: ANTHROPIC_MODEL_ALIASES[opts.modelId] ?? opts.modelId,
      max_tokens: opts.maxTokens ?? 4096,
      system: systemBlocks,
      messages: [{ role: 'user', content: blocks }],
    };
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

export async function callLlmJsonWithUsage(opts: LlmJsonOptions): Promise<LlmJsonResult> {
  const check = validateModelForNode(opts.nodeKind, opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing API key for provider "${opts.providerId}"`);

  const payload = buildLlmRequestPayload(opts);

  if (opts.providerId === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      content: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    const u = data.usage ?? {};
    return {
      text: data.content.find((c) => c.type === 'text')?.text ?? '',
      usage: computeLlmCost(opts.modelId, {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
      }),
    };
  }

  if (opts.providerId === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
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
    };
  }

  if (opts.providerId === 'google_gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.modelId)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        cachedContentTokenCount?: number;
      };
    };
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
    };
  }

  throw new Error(`Unsupported LLM provider "${opts.providerId}"`);
}

export async function callLlmJson(opts: LlmJsonOptions): Promise<string> {
  const { text } = await callLlmJsonWithUsage(opts);
  return text;
}

export async function callTtsWithTimestamps(opts: {
  providerId: string;
  modelId: string;
  apiKey: string;
  text: string;
  voiceId?: string;
  /** Optional prosody continuity context for ElevenLabs chapter seams. */
  previousText?: string;
  nextText?: string;
}): Promise<TtsResult> {
  const check = validateModelForNode('voiceover', opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing TTS API key for provider "${opts.providerId}"`);

  if (opts.providerId === 'elevenlabs') {
    const voiceId = opts.voiceId ?? '21m00Tcm4TlvDq8ikWAM';
    const body: Record<string, unknown> = { text: opts.text, model_id: opts.modelId };
    if (opts.previousText) body.previous_text = opts.previousText;
    if (opts.nextText) body.next_text = opts.nextText;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': opts.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ElevenLabs API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    };
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
    const res = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${encodeURIComponent(opts.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text: opts.text },
        voice: { languageCode: 'en-US', name: opts.voiceId ?? 'en-US-Chirp3-HD-Charon' },
        audioConfig: { audioEncoding: 'MP3' },
        enableTimePointing: ['SSML_MARK'],
      }),
    });
    if (!res.ok) throw new Error(`Google TTS API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { audioContent: string };
    const estDuration = Math.max(1000, opts.text.split(/\s+/).length * 360);
    return {
      audio_base64: data.audioContent,
      mime_type: 'audio/mpeg',
      duration_ms: estDuration,
      words: estimateWordTimestamps(opts.text, estDuration),
    };
  }

  if (opts.providerId === 'openai') {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
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
    });
    if (!res.ok) throw new Error(`OpenAI TTS API error ${res.status}: ${await res.text()}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const estDuration = Math.max(1000, opts.text.split(/\s+/).length * 360);
    return {
      audio_base64: Buffer.from(bytes).toString('base64'),
      mime_type: 'audio/mpeg',
      duration_ms: estDuration,
      words: estimateWordTimestamps(opts.text, estDuration),
    };
  }

  throw new Error(`Unsupported TTS provider "${opts.providerId}"`);
}

export async function callSearchProvider(opts: {
  providerId: string;
  modelId: string;
  apiKey: string;
  query: string;
}): Promise<SearchHit[]> {
  const check = validateModelForNode('trend_scout', opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing Search API key for provider "${opts.providerId}"`);

  if (opts.providerId === 'serpapi') {
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(opts.query)}&api_key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpApi error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      news_results?: { title?: string; link?: string; snippet?: string; source?: { name?: string } }[];
    };
    return (data.news_results ?? []).slice(0, 10).map((r, i) => ({
      title: r.title ?? opts.query,
      url: r.link ?? '',
      snippet: r.snippet ?? '',
      source: r.source?.name ?? 'Google News',
      published_hours_ago: Math.max(1, i * 3),
    }));
  }

  if (opts.providerId === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: opts.apiKey, query: opts.query, max_results: 10 }),
    });
    if (!res.ok) throw new Error(`Tavily error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? []).map((r, i) => ({
      title: r.title ?? opts.query,
      url: r.url ?? '',
      snippet: r.content ?? '',
      source: 'Tavily',
      published_hours_ago: Math.max(1, i * 4),
    }));
  }

  if (opts.providerId === 'exa') {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey },
      body: JSON.stringify({ query: opts.query, numResults: 10 }),
    });
    if (!res.ok) throw new Error(`Exa error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; text?: string }[] };
    return (data.results ?? []).map((r, i) => ({
      title: r.title ?? opts.query,
      url: r.url ?? '',
      snippet: r.text ?? '',
      source: 'Exa',
      published_hours_ago: Math.max(1, i * 4),
    }));
  }

  throw new Error(`Unsupported Search provider "${opts.providerId}"`);
}

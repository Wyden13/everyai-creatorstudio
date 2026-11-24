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

export async function callLlmJson(opts: {
  nodeKind: 'trend_scout' | 'screenplay' | 'animation_remotion' | 'animation_manim' | 'architect' | 'publisher';
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  attachments?: readonly LlmAttachment[];
}): Promise<string> {
  const check = validateModelForNode(opts.nodeKind, opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing API key for provider "${opts.providerId}"`);

  const attachments = opts.attachments ?? [];

  if (opts.providerId === 'anthropic') {
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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.modelId,
        max_tokens: 4096,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: blocks }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.find((c) => c.type === 'text')?.text ?? '';
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.modelId,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: parts },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? '';
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.modelId)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error(`Unsupported LLM provider "${opts.providerId}"`);
}

export async function callTtsWithTimestamps(opts: {
  providerId: string;
  modelId: string;
  apiKey: string;
  text: string;
  voiceId?: string;
}): Promise<TtsResult> {
  const check = validateModelForNode('voiceover', opts.providerId, opts.modelId);
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error(`Missing TTS API key for provider "${opts.providerId}"`);

  if (opts.providerId === 'elevenlabs') {
    const voiceId = opts.voiceId ?? '21m00Tcm4TlvDq8ikWAM';
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': opts.apiKey,
      },
      body: JSON.stringify({ text: opts.text, model_id: opts.modelId }),
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

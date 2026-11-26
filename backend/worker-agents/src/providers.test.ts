import { afterEach, describe, expect, test } from 'bun:test';
import { anthropicAnswerText, buildLlmRequestPayload, callLlm, callTtsWithTimestamps, computeLlmCost, parseAnthropicStream, splitWavC2pa, type LlmRequest, type SearchResult } from './providers';
import type { RetryDeps } from './retry';

/** A RIFF/WAVE file from [id, body] chunks, padding odd chunks as RIFF requires. */
const riff = (...chunks: [string, Buffer][]) => {
  const parts = chunks.flatMap(([id, body]) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, 'latin1');
    head.writeUInt32LE(body.length, 4);
    return [head, body, Buffer.alloc(body.length % 2)];
  });
  const head = Buffer.alloc(12);
  head.write('RIFF', 0);
  head.writeUInt32LE(4 + parts.reduce((n, b) => n + b.length, 0), 4);
  head.write('WAVE', 8);
  return Buffer.concat([head, ...parts]);
};
/** fmt chunk: PCM, mono, 24 kHz, 16-bit (byte rate 48000), as Gemini TTS sends it. */
const FMT: [string, Buffer] = ['fmt ', Buffer.from('01000100c05d000080bb000002001000', 'hex')];
/** A C2PA chunk body: a JUMBF superbox labelled c2pa. */
const C2PA: [string, Buffer] = ['C2PA', Buffer.from('\0\0\0\x1ejumb\0\0\0\x0ejumdc2pa-signature', 'latin1')];
/** A Gemini Interactions TTS reply carrying `file` as its audio. */
const interaction = (file: Buffer) => JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: file.toString('base64') }] }] });

/** Builds an SSE body exactly as the Messages API frames it: `event:` + `data:` lines, blank-line separated. */
const sse = (...events: Record<string, unknown>[]) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

const start = (usage: Record<string, number> = { input_tokens: 12, cache_read_input_tokens: 3 }) => ({ type: 'message_start', message: { usage } });
const block = (index: number, content_block: Record<string, unknown>) => ({ type: 'content_block_start', index, content_block });
const text = (index: number, t: string) => ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: t } });
const stop = (index: number) => ({ type: 'content_block_stop', index });
const end = (stop_reason: string, usage: Record<string, unknown> = { output_tokens: 40 }) => ({ type: 'message_delta', delta: { stop_reason }, usage });

const PLAIN = sse(
  start(),
  { type: 'ping' },
  block(0, { type: 'thinking', thinking: '' }),
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } },
  stop(0),
  block(1, { type: 'text', text: '' }),
  text(1, '{"ok":'),
  text(1, 'true}'),
  stop(1),
  end('end_turn'),
  { type: 'message_stop' },
);

/**
 * Server web_search as the API streams it: tool-result blocks arrive whole in content_block_start
 * (results, or an error object), and the search count is in the final usage.server_tool_use.
 */
const WEB_SEARCH = sse(
  start({ input_tokens: 900 }),
  block(0, { type: 'text', text: '' }),
  text(0, "I'll search for that."),
  stop(0),
  block(1, { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} }),
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query":"python release"}' } },
  stop(1),
  block(2, { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [
    { type: 'web_search_result', url: 'https://python.org', title: 'Python', encrypted_content: 'enc', page_age: '1 day' },
    { type: 'web_search_result', url: 'https://docs.python.org/3/whatsnew/', title: "What's New", encrypted_content: 'enc', page_age: null },
  ] }),
  stop(2),
  block(3, { type: 'text', text: '' }),
  text(3, 'Let me check one more source.'),
  stop(3),
  block(4, { type: 'server_tool_use', id: 'srvtoolu_2', name: 'web_search', input: {} }),
  stop(4),
  block(5, { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } }),
  stop(5),
  block(6, { type: 'text', text: '' }),
  text(6, 'The latest is '),
  stop(6),
  block(7, { type: 'text', text: '', citations: [] }),
  text(7, 'Python 3.15'),
  stop(7),
  block(8, { type: 'text', text: '' }),
  text(8, '.'),
  stop(8),
  end('end_turn', { input_tokens: 5200, output_tokens: 310, server_tool_use: { web_search_requests: 2 } }),
  { type: 'message_stop' },
);

describe('Anthropic SSE parser', () => {
  const plain = { answer: '{"ok":true}', searchResults: [] as SearchResult[], stopReason: 'end_turn', usage: { input_tokens: 12, cache_read_input_tokens: 3, output_tokens: 40 } };
  const rows: [string, string, Omit<typeof plain, 'usage'> & { usage: Record<string, unknown> }][] = [
    ['plain reply: text deltas joined, thinking ignored', PLAIN, plain],
    [
      'web search: answer after the last tool result, every result url/title kept, errors add none',
      WEB_SEARCH,
      {
        answer: 'The latest is Python 3.15.',
        searchResults: [{ url: 'https://python.org', title: 'Python' }, { url: 'https://docs.python.org/3/whatsnew/', title: "What's New" }],
        stopReason: 'end_turn',
        usage: { input_tokens: 5200, output_tokens: 310, server_tool_use: { web_search_requests: 2 } },
      },
    ],
    ['CRLF framing parses the same', PLAIN.replaceAll('\n', '\r\n'), plain],
  ];
  for (const [name, body, want] of rows) {
    test(name, () => {
      const m = parseAnthropicStream(body);
      expect({ answer: anthropicAnswerText(m.blocks), searchResults: m.searchResults, stopReason: m.stopReason, usage: m.usage }).toEqual(want);
    });
  }

  const failures: [string, string, string][] = [
    ['stream error event', sse(start(), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), 'overloaded_error'],
    ['stream cut before message_delta', sse(start(), block(0, { type: 'text', text: '' }), text(0, 'half')), 'without a stop_reason'],
  ];
  for (const [name, body, message] of failures) test(name, () => expect(() => parseAnthropicStream(body)).toThrow(message));

  test('no blocks means an empty answer', () => expect(anthropicAnswerText([])).toBe(''));
});

describe('Anthropic call (fetch mocked at the network edge)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const req: LlmRequest = { nodeKind: 'trend_scout', providerId: 'anthropic', modelId: 'claude-opus-5-5', systemPrompt: 's', userPrompt: 'u' };
  const replyWith = (body: string, status = 200) => {
    const sent: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(body, { status });
    }) as unknown as typeof fetch;
    return sent;
  };

  test('streams and returns the answer with Opus 5.5 pricing', async () => {
    const sent = replyWith(PLAIN);
    const r = await callLlm({ ...req, apiKey: 'k' });
    expect(r.text).toBe('{"ok":true}');
    expect(r.usage).toEqual(computeLlmCost('claude-opus-5-5', { inputTokens: 12, outputTokens: 40, cacheReadTokens: 3 }));
    expect(r.searchResults).toEqual([]);
    expect(sent[0]).toMatchObject({ stream: true, max_tokens: 128_000 });
  });

  test('a web search reply carries its results and bills each search', async () => {
    replyWith(WEB_SEARCH);
    const r = await callLlm({ ...req, apiKey: 'k', serverTools: ['web_search'] });
    expect(r.text).toBe('The latest is Python 3.15.');
    expect(r.searchResults.map((s) => s.url)).toEqual(['https://python.org', 'https://docs.python.org/3/whatsnew/']);
    expect(r.usage).toEqual(computeLlmCost('claude-opus-5-5', { inputTokens: 5200, outputTokens: 310, webSearchRequests: 2 }));
  });

  const stops: [string, string][] = [
    ['max_tokens', 'truncated at max_tokens=128000'],
    ['refusal', 'declined'],
    ['pause_turn', 'pause_turn'],
  ];
  for (const [reason, message] of stops) {
    test(`stop_reason ${reason} fails loud`, async () => {
      replyWith(sse(start(), block(0, { type: 'text', text: '' }), text(0, '{"half":'), end(reason)));
      await expect(callLlm({ ...req, apiKey: 'k' })).rejects.toThrow(message);
    });
  }

  test('HTTP error status fails loud with the body', async () => {
    replyWith('{"error":"bad"}', 400);
    await expect(callLlm({ ...req, apiKey: 'k' })).rejects.toThrow('Anthropic API error 400');
  });
});

describe('retries with backoff (scripted fetch at the network edge, injected sleep)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** One scripted reply per attempt: a Response, a thrown network error, or a connection that hangs. */
  type Step = () => Response | Error | 'hang-headers' | 'hang-body';
  const status = (code: number, headers: Record<string, string> = {}): Step => () => new Response(`{"error":"e${code}"}`, { status: code, headers });
  const body = (b: string): Step => () => new Response(b);
  const netErr = (code: string): Step => () => Object.assign(new Error(`socket ${code}`), { code });
  const hang = (kind: 'hang-headers' | 'hang-body'): Step => () => kind;

  const GEMINI_AUDIO = interaction(riff(FMT, ['data', Buffer.alloc(4800)], C2PA)); // 100 ms of 24 kHz 16-bit mono
  const CUT = sse(start(), block(0, { type: 'text', text: '' }), text(0, '{"ok"'));
  const plainUsage = computeLlmCost('claude-opus-5-5', { inputTokens: 12, outputTokens: 40, cacheReadTokens: 3 });

  const run = async (steps: Step[], call: 'llm' | 'tts') => {
    let n = 0;
    globalThis.fetch = (async () => {
      const step = steps[n++];
      if (!step) throw new Error('script ran out of steps');
      const r = step();
      if (r === 'hang-headers') return new Promise<never>(() => {});
      if (r === 'hang-body') return new Response(new ReadableStream({ start() {} }));
      if (r instanceof Error) throw r;
      return r;
    }) as unknown as typeof fetch;
    const sleeps: number[] = [];
    const logs: string[] = [];
    const deps: RetryDeps = {
      sleep: async (ms) => void sleeps.push(ms),
      random: () => 0.5,
      now: () => Date.parse('2026-01-01T00:00:00Z'),
      log: (l) => void logs.push(l),
      timeouts: { streamIdleMs: 20, responseIdleMs: 20 },
    };
    const outcome =
      call === 'llm'
        ? callLlm({ nodeKind: 'trend_scout', providerId: 'anthropic', modelId: 'claude-opus-5-5', systemPrompt: 's', userPrompt: 'u', apiKey: 'k' }, deps).then((r) => ({ usage: r.usage }))
        : callTtsWithTimestamps({ providerId: 'google_gemini', modelId: 'gemini-3.8-flash-tts', apiKey: 'k', text: 'hi there' }, deps).then((r) => ({ durationMs: r.duration_ms }));
    const result = await outcome.then(
      (ok) => ({ ok }),
      (e: Error) => ({ error: e.message }),
    );
    return { result, calls: n, sleeps, logs };
  };

  interface Row {
    name: string;
    call: 'llm' | 'tts';
    steps: Step[];
    /** Expected sleeps between attempts (random() = 0.5, base 1 s doubling: 500, 1000, 2000 ...). */
    sleeps: number[];
    /** Substrings of the final error; absent means the call succeeds. */
    error?: string[];
    ok?: Record<string, unknown>;
  }
  const rows: Row[] = [
    { name: '429 then 200 succeeds after one jittered wait', call: 'llm', steps: [status(429), body(PLAIN)], sleeps: [500], ok: { usage: plainUsage } },
    { name: 'retry-after seconds is honoured', call: 'llm', steps: [status(429, { 'retry-after': '7' }), body(PLAIN)], sleeps: [7000], ok: { usage: plainUsage } },
    { name: 'retry-after-ms wins over retry-after', call: 'llm', steps: [status(529, { 'retry-after-ms': '250', 'retry-after': '9' }), body(PLAIN)], sleeps: [250], ok: { usage: plainUsage } },
    { name: 'retry-after as an HTTP date', call: 'llm', steps: [status(503, { 'retry-after': 'Thu, 01 Jan 2026 00:00:03 GMT' }), body(PLAIN)], sleeps: [3000], ok: { usage: plainUsage } },
    { name: '500, 502, 504 each retried with doubling backoff', call: 'llm', steps: [status(500), status(502), status(504), body(PLAIN)], sleeps: [500, 1000, 2000], ok: { usage: plainUsage } },
    { name: '400 is not retried', call: 'llm', steps: [status(400)], sleeps: [], error: ['Anthropic API error 400'] },
    { name: '401 is not retried', call: 'llm', steps: [status(401)], sleeps: [], error: ['Anthropic API error 401'] },
    {
      name: 'exhausted attempts name every attempt',
      call: 'llm',
      steps: [status(529), status(529), status(503), status(529)],
      sleeps: [500, 1000, 2000],
      error: ['Anthropic failed after 4 attempts', '#1 http 529', '#3 http 503', '#4 http 529: Anthropic API error 529'],
    },
    { name: 'a fatal failure after a retry names both attempts', call: 'llm', steps: [status(429), status(403)], sleeps: [500], error: ['fatal failure on attempt 2', '#1 http 429', '#2 http 403'] },
    { name: 'a retry-after past the wait budget stops at once', call: 'llm', steps: [status(429, { 'retry-after': '600' })], sleeps: [], error: ['after 1 attempts (next wait 600000 ms would pass the 120000 ms retry budget)'] },
    {
      name: 'mid-stream drop is retried; the dropped stream input usage is still billed',
      call: 'llm',
      steps: [body(CUT), body(PLAIN)],
      sleeps: [500],
      ok: { usage: computeLlmCost('claude-opus-5-5', { inputTokens: 24, outputTokens: 40, cacheReadTokens: 6 }) },
    },
    { name: 'overloaded_error event mid-stream is retried', call: 'llm', steps: [body(sse(start(), { type: 'error', error: { type: 'overloaded_error' } })), body(PLAIN)], sleeps: [500], ok: { usage: computeLlmCost('claude-opus-5-5', { inputTokens: 24, outputTokens: 40, cacheReadTokens: 6 }) } },
    { name: 'invalid_request_error event mid-stream is fatal', call: 'llm', steps: [body(sse(start(), { type: 'error', error: { type: 'invalid_request_error' } }))], sleeps: [], error: ['invalid_request_error'] },
    { name: 'refusal is not retried', call: 'llm', steps: [body(sse(start(), end('refusal')))], sleeps: [], error: ['declined'] },
    { name: 'max_tokens is not retried', call: 'llm', steps: [body(sse(start(), end('max_tokens')))], sleeps: [], error: ['truncated at max_tokens'] },
    { name: 'ECONNRESET is retried', call: 'llm', steps: [netErr('ECONNRESET'), body(PLAIN)], sleeps: [500], ok: { usage: plainUsage } },
    { name: 'an unknown thrown error is fatal', call: 'llm', steps: [() => new Error('boom')], sleeps: [], error: ['boom'] },
    { name: 'no headers before the idle timeout is retried', call: 'llm', steps: [hang('hang-headers'), body(PLAIN)], sleeps: [500], ok: { usage: plainUsage } },
    { name: 'a stream that goes silent is retried', call: 'llm', steps: [hang('hang-body'), body(PLAIN)], sleeps: [500], ok: { usage: plainUsage } },
    { name: 'every attempt hanging ends in a timeout error', call: 'llm', steps: [hang('hang-body'), hang('hang-headers'), hang('hang-body'), hang('hang-body')], sleeps: [500, 1000, 2000], error: ['#4 timeout: Anthropic: no bytes from the server for 20 ms'] },
    { name: 'Gemini TTS 503 then audio', call: 'tts', steps: [status(503), body(GEMINI_AUDIO)], sleeps: [500], ok: { durationMs: 100 } },
    { name: 'Gemini TTS 403 is not retried', call: 'tts', steps: [status(403)], sleeps: [], error: ['Gemini TTS API error 403'] },
    { name: 'Gemini TTS hung response is retried', call: 'tts', steps: [hang('hang-headers'), body(GEMINI_AUDIO)], sleeps: [500], ok: { durationMs: 100 } },
  ];
  for (const row of rows) {
    test(row.name, async () => {
      const got = await run(row.steps, row.call);
      expect(got.calls).toBe(row.steps.length);
      expect(got.sleeps).toEqual(row.sleeps);
      expect(got.logs.length).toBe(row.sleeps.length);
      if (row.error) {
        expect(got.result).toHaveProperty('error');
        for (const part of row.error) expect((got.result as { error: string }).error).toContain(part);
      } else {
        expect(got.result as unknown).toEqual({ ok: row.ok });
      }
    });
  }

  test('each retry log names provider, attempt, cause and wait (never the key)', async () => {
    const got = await run([status(429), body(PLAIN)], 'llm');
    expect(got.logs).toEqual(['[retry] Anthropic attempt 1/4 failed (http 429); waiting 500 ms']);
  });
});

describe('Anthropic request payload', () => {
  const base: LlmRequest = { nodeKind: 'screenplay', providerId: 'anthropic', modelId: 'claude-opus-5-5', systemPrompt: 's', userPrompt: 'u' };
  const rows: [string, LlmRequest, Record<string, unknown>][] = [
    ['defaults to the 128k output ceiling', base, { max_tokens: 128_000, stream: true }],
    ['older models get their own ceiling', { ...base, modelId: 'claude-sonnet-4-5' }, { max_tokens: 64_000 }],
    ['explicit maxTokens wins', { ...base, maxTokens: 900 }, { max_tokens: 900 }],
    ['effort goes in output_config, any level', { ...base, effort: 'xhigh' }, { output_config: { effort: 'xhigh' } }],
    ['web_search maps to the server tool', { ...base, serverTools: ['web_search'] }, { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] }],
  ];
  for (const [name, opts, want] of rows) test(name, () => expect(buildLlmRequestPayload(opts)).toMatchObject(want));

  test('never sends a thinking config or tools unless asked', () => {
    const p = buildLlmRequestPayload(base);
    expect(p.thinking).toBeUndefined();
    expect(p.tools).toBeUndefined();
  });
});

describe('model pricing (USD per 1M tokens)', () => {
  const M = 1_000_000;
  const rows: [string, number, number, number][] = [
    // model, cost of 1M in, cost of 1M out, cost of 1M cache reads
    ['claude-opus-5-5', 4, 20, 0.2],
    ['claude-sonnet-5-5', 2, 10, 0.1],
    ['claude-haiku-5-5', 0.1, 0.5, 0.01],
  ];
  for (const [model, inUsd, outUsd, readUsd] of rows) {
    test(model, () => {
      expect(computeLlmCost(model, { inputTokens: M, outputTokens: 0 }).estimatedUsd).toBeCloseTo(inUsd, 6);
      expect(computeLlmCost(model, { inputTokens: 0, outputTokens: M }).estimatedUsd).toBeCloseTo(outUsd, 6);
      expect(computeLlmCost(model, { inputTokens: 0, outputTokens: 0, cacheReadTokens: M }).estimatedUsd).toBeCloseTo(readUsd, 6);
    });
  }

  // searches, USD on top of tokens: web_search is $10 per 1,000 on any model
  const searches: [number, number][] = [
    [0, 0],
    [1, 0.01],
    [1000, 10],
  ];
  for (const [n, usd] of searches) {
    test(`${n} web searches cost $${usd} extra`, () => {
      const tokens = { inputTokens: 1000, outputTokens: 1000 };
      const base = computeLlmCost('claude-opus-5-5', tokens).estimatedUsd;
      const u = computeLlmCost('claude-opus-5-5', { ...tokens, webSearchRequests: n });
      expect(u.webSearchRequests).toBe(n);
      expect(u.estimatedUsd - base).toBeCloseTo(usd, 6);
    });
  }
});

describe('splitWavC2pa (Gemini TTS WAV carries signed content credentials in a C2PA chunk)', () => {
  const data: [string, Buffer] = ['data', Buffer.alloc(4800)];
  const odd: [string, Buffer] = ['LIST', Buffer.from('abc')];
  const rows: [string, Buffer, ReturnType<typeof splitWavC2pa> | string][] = [
    ['a WAV with no C2PA chunk is kept as is', riff(FMT, data), { wav: riff(FMT, data), durationMs: 100 }],
    ['the C2PA chunk after data is split off (as Gemini sends it)', riff(FMT, data, C2PA), { wav: riff(FMT, data), manifest: C2PA[1], durationMs: 100 }],
    ['a C2PA chunk before data is split off too', riff(FMT, C2PA, data), { wav: riff(FMT, data), manifest: C2PA[1], durationMs: 100 }],
    ['other chunks (odd-sized, padded) are kept', riff(FMT, odd, data, C2PA), { wav: riff(FMT, odd, data), manifest: C2PA[1], durationMs: 100 }],
    ['an empty data chunk is 0 ms', riff(FMT, ['data', Buffer.alloc(0)]), { wav: riff(FMT, ['data', Buffer.alloc(0)]), durationMs: 0 }],
    ['raw PCM (no RIFF header) fails loud', Buffer.alloc(4800), 'not a RIFF/WAVE file'],
    ['an empty reply fails loud', Buffer.alloc(0), 'not a RIFF/WAVE file'],
    ['no data chunk fails loud', riff(FMT, C2PA), 'no fmt or data chunk'],
    ['no fmt chunk fails loud', riff(data), 'no fmt or data chunk'],
    ['a chunk overrunning the file fails loud', riff(FMT, data).subarray(0, 100), 'chunk "data" overruns the file'],
    ['a cut chunk header fails loud', Buffer.concat([riff(FMT, data), Buffer.from('dat')]), 'truncated chunk header'],
  ];
  for (const [name, file, want] of rows) {
    test(name, () => {
      if (typeof want === 'string') return expect(() => splitWavC2pa(file)).toThrow(want);
      expect(splitWavC2pa(file)).toEqual(want);
    });
  }
});

describe('Gemini TTS request and reply (fetch mocked at the network edge)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const tts = { providerId: 'google_gemini', modelId: 'gemini-3.8-flash-tts', apiKey: 'k', text: 'Rome <short pause> fell.' };
  const audioWav = riff(FMT, ['data', Buffer.alloc(9600)], C2PA);
  const send = async (opts: Partial<typeof tts> & { style?: string; voiceId?: string }, reply = interaction(audioWav)) => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(reply);
    }) as unknown as typeof fetch;
    const result = await callTtsWithTimestamps({ ...tts, ...opts }).then((r) => r, (e: Error) => e.message);
    return { sent, result };
  };
  const part = (extra: Record<string, unknown> = {}) => ({ type: 'text', text: tts.text, ...extra });
  const rows: [string, Partial<typeof tts> & { style?: string; voiceId?: string }, Record<string, unknown>][] = [
    ['no style: plain text part, default voice Charon', {}, { model: 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: [part()] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: 'Charon' }] } }],
    ['style rides in a speech_metadata annotation, never in the text', { style: 'calm, clear and measured' }, { input: [{ type: 'user_input', content: [part({ annotations: [{ type: 'speech_metadata', style: 'calm, clear and measured' }] })] }] }],
    ['an empty style is still sent as given', { style: '' }, { input: [{ type: 'user_input', content: [part({ annotations: [{ type: 'speech_metadata', style: '' }] })] }] }],
    ['the voice is passed through', { voiceId: 'Puck' }, { generation_config: { speech_config: [{ voice: 'Puck' }] } }],
    ['the interaction is never stored server-side', {}, { store: false }],
  ];
  for (const [name, opts, want] of rows) {
    test(name, async () => {
      const { sent } = await send(opts);
      expect(sent.map((s) => s.url)).toEqual(['https://generativelanguage.googleapis.com/v1beta/interactions']);
      expect(sent[0]!.body).toMatchObject(want);
      if (opts.style === undefined) expect((sent[0]!.body.input as { content: Record<string, unknown>[] }[])[0]!.content[0]).not.toHaveProperty('annotations');
    });
  }

  test('reply: WAV without the C2PA chunk, its duration, and the manifest kept for disclosure', async () => {
    const { result } = await send({});
    expect(result).toMatchObject({ audio_base64: riff(FMT, ['data', Buffer.alloc(9600)]).toString('base64'), mime_type: 'audio/wav', duration_ms: 200, c2pa_base64: C2PA[1].toString('base64') });
  });

  const failures: [string, Partial<typeof tts> & { style?: string }, string | undefined, string][] = [
    ['a reply with no audio step fails loud with its status', {}, JSON.stringify({ status: 'failed', steps: [] }), 'Gemini TTS returned no audio (interaction status: failed)'],
    ['a style on a provider without the field fails loud before any request', { providerId: 'elevenlabs', modelId: 'eleven_multilingual_v2', style: 'calm' }, undefined, 'TTS provider "elevenlabs" has no style field'],
  ];
  for (const [name, opts, reply, message] of failures) {
    test(name, async () => {
      const { sent, result } = await send(opts, reply);
      expect(result).toContain(message);
      if (!reply) expect(sent).toEqual([]);
    });
  }
});

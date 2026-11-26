/**
 * Retries with backoff for every external provider call (src/providers.ts).
 *
 * One attempt = one `fetchBody` (request + full body under an idle timeout) plus whatever parsing
 * must succeed for the reply to count. A failure is retried only if its key is a `retry` row in
 * RETRY_POLICY; everything else is thrown at once, loud, as before. Each retry is logged, and when
 * attempts or the wait budget run out the error names every attempt.
 */

export const RETRY_MAX_ATTEMPTS = 4;
export const RETRY_BASE_DELAY_MS = 1_000;
/** Ceiling of one computed backoff (before jitter). A server `retry-after` hint is used as given. */
export const RETRY_MAX_DELAY_MS = 30_000;
/** Total sleep across all retries of one call; a wait that would pass it ends the call instead. */
export const RETRY_MAX_TOTAL_WAIT_MS = 120_000;

/**
 * Idle timeouts: the time with no bytes from the server before the attempt is abandoned as hung.
 * Streams (Anthropic SSE) send ping events while the model thinks, so silence there means a dead
 * connection. Non-streamed replies stay silent until the whole answer (or audio) is generated.
 */
export interface EdgeTimeouts {
  streamIdleMs: number;
  responseIdleMs: number;
}
export const EDGE_TIMEOUTS: EdgeTimeouts = { streamIdleMs: 90_000, responseIdleMs: 10 * 60_000 };

/** Everything time- or chance-dependent, injected so unit tests never wait. */
export interface RetryDeps {
  sleep: (ms: number) => Promise<void>;
  /** Uniform in [0, 1); drives full jitter. */
  random: () => number;
  /** Epoch ms; only used to read an HTTP-date `retry-after`. */
  now: () => number;
  log: (line: string) => void;
  timeouts: EdgeTimeouts;
}

export const REAL_RETRY_DEPS: RetryDeps = {
  sleep: (ms) => Bun.sleep(ms),
  random: Math.random,
  now: Date.now,
  log: (line) => console.warn(line),
  timeouts: EDGE_TIMEOUTS,
};

/** A non-2xx reply. The message format (`<Provider> API error <status>: <body>`) is what callers see. */
export class ProviderHttpError extends Error {
  constructor(
    label: string,
    readonly status: number,
    readonly retryAfterMs: number | undefined,
    body: string,
  ) {
    super(`${label} API error ${status}: ${body}`);
  }
}

/**
 * A stream that failed before its final event: `kind` is the provider's error type from an
 * `error` event, or `stream_cut` when the body ended early. `partialUsage` is whatever usage the
 * stream reported before it died (the provider may bill it).
 */
export class ProviderStreamError<U = unknown> extends Error {
  constructor(
    message: string,
    readonly kind: string,
    readonly partialUsage: U,
  ) {
    super(message);
  }
}

/**
 * Which failures earn another attempt. Every failure maps to one key (see `failureKey`); a key
 * with no row is fatal. Add a cause as a row here, never as a branch in `withRetry`.
 */
const RETRY_POLICY: Readonly<Record<string, 'retry' | 'fatal'>> = {
  'http 429': 'retry', // rate limited
  'http 500': 'retry',
  'http 502': 'retry',
  'http 503': 'retry',
  'http 504': 'retry',
  'http 529': 'retry', // Anthropic overloaded
  'http 400': 'fatal',
  'http 401': 'fatal',
  'http 403': 'fatal',
  'http 404': 'fatal',
  'stream stream_cut': 'retry', // body ended before the final event
  'stream overloaded_error': 'retry',
  'stream api_error': 'retry',
  timeout: 'retry', // idle timeout: a hung connection
  // Socket-level failures as Bun and Node report them.
  'network ECONNRESET': 'retry',
  'network ECONNREFUSED': 'retry',
  'network ETIMEDOUT': 'retry',
  'network EPIPE': 'retry',
  'network EAI_AGAIN': 'retry',
  'network ConnectionRefused': 'retry',
  'network ConnectionClosed': 'retry',
  'network FailedToOpenSocket': 'retry',
};

/** The RETRY_POLICY key of one failure. Unknown errors (schema, JSON, refusal) get `fatal`. */
function failureKey(err: unknown): string {
  if (err instanceof ProviderHttpError) return `http ${err.status}`;
  if (err instanceof ProviderStreamError) return `stream ${err.kind}`;
  if (err instanceof Error && err.name === 'TimeoutError') return 'timeout';
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? `network ${code}` : 'fatal';
}

/** Server wait hint in ms: `retry-after-ms`, else `retry-after` as seconds or an HTTP date. */
export function retryAfterMs(headers: Headers, now: number): number | undefined {
  const ms = Number(headers.get('retry-after-ms'));
  if (headers.has('retry-after-ms') && Number.isFinite(ms)) return Math.max(0, ms);
  const value = headers.get('retry-after');
  if (value === null) return undefined;
  const seconds = Number(value);
  if (value.trim() !== '' && Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

const describeFailure = (err: unknown) => `${failureKey(err)}: ${err instanceof Error ? err.message : String(err)}`;

/** The result plus every failed attempt before it (so callers can count what those billed). */
export interface Retried<T> {
  value: T;
  failures: unknown[];
}

/** Runs `attempt` until it succeeds, a failure is fatal, attempts run out, or the wait budget does. */
export async function withRetry<T>(provider: string, attempt: () => Promise<T>, deps: RetryDeps): Promise<Retried<T>> {
  const failures: unknown[] = [];
  let waited = 0;
  for (let n = 1; ; n++) {
    try {
      return { value: await attempt(), failures };
    } catch (err) {
      failures.push(err);
      const fatal = RETRY_POLICY[failureKey(err)] !== 'retry';
      if (fatal && n === 1) throw err;
      const hint = err instanceof ProviderHttpError ? err.retryAfterMs : undefined;
      const wait = Math.round(hint ?? deps.random() * Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (n - 1)));
      const stop = fatal
        ? `a fatal failure on attempt ${n}`
        : n >= RETRY_MAX_ATTEMPTS
          ? `${n} attempts`
          : waited + wait > RETRY_MAX_TOTAL_WAIT_MS
            ? `${n} attempts (next wait ${wait} ms would pass the ${RETRY_MAX_TOTAL_WAIT_MS} ms retry budget)`
            : undefined;
      if (stop) {
        const history = failures.map((f, i) => `#${i + 1} ${describeFailure(f)}`).join('; ');
        throw new Error(`${provider} failed after ${stop}: ${history}`, { cause: err });
      }
      deps.log(`[retry] ${provider} attempt ${n}/${RETRY_MAX_ATTEMPTS} failed (${failureKey(err)}); waiting ${wait} ms`);
      await deps.sleep(wait);
      waited += wait;
    }
  }
}

/**
 * One request with its whole body read under an idle timeout (reset on every chunk), so a hung
 * connection becomes a `timeout` failure. Throws ProviderHttpError on a non-2xx status.
 */
export async function fetchBody(label: string, url: string, init: RequestInit, idleMs: number, deps: RetryDeps): Promise<Buffer> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expire!: (e: Error) => void;
  const expired = new Promise<never>((_, reject) => (expire = reject));
  // Only ever observed through the races below; this keeps a late rejection from being "unhandled".
  expired.catch(() => {});
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const e = new DOMException(`${label}: no bytes from the server for ${idleMs} ms`, 'TimeoutError');
      controller.abort(e);
      expire(e);
    }, idleMs);
  };
  arm();
  try {
    const res = await Promise.race([fetch(url, { ...init, signal: controller.signal }), expired]);
    const chunks: Uint8Array[] = [];
    const reader = res.body?.getReader();
    for (;;) {
      if (!reader) break;
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      chunks.push(value);
      arm();
    }
    const body = Buffer.concat(chunks);
    if (!res.ok) throw new ProviderHttpError(label, res.status, retryAfterMs(res.headers, deps.now()), body.toString());
    return body;
  } finally {
    clearTimeout(timer);
  }
}

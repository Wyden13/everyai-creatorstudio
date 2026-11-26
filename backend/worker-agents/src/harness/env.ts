/**
 * The ONE place real harness edges are built from environment variables (live tests, scripts).
 * Keys are checked for presence only, bound into the call, and never logged. A missing key or
 * tool fails loud when the edge is built, before any money is spent.
 *
 *   ANTHROPIC_TEST_API_KEY | ANTHROPIC_API_KEY   llm
 *   GEMINI_API_KEY                               tts, imageGen (Nano Banana)
 *   RECRAFT_API_KEY   optional                   imageGen (Recraft); without it Recraft has no row
 *   ALIGN_PYTHON   default .venv-align/bin/python (python with faster-whisper; see README)   align
 *   LIVE_MODEL     default claude-opus-5-5       model
 *   LIVE_EFFORT    default high                  model
 *   VIDEO_CODEC    default libx264 (Fedora: libopenh264)   render
 *   ASSETS_DIR     default backend/worker-agents/.assets   assetRefs (the local Asset Storage tool)
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { alignWords } from '../align';
import { IMAGE_PROVIDERS, callImageGen } from '../assets/image-gen';
import { ASSETS_DIR, localAssetStore, readReadyAsset } from '../assets/store';
import { VIDEO_CODEC_ARGS, type VideoCodec } from '../compiler';
import { EFFORTS, callLlm, callTtsWithTimestamps } from '../providers';
import { auditTimeline, renderTimelineVideo } from '../vox/render';
import type { EdgeName, HarnessEdges } from './contract';

/** Env var names per provider, first present wins. Add a provider as a row. */
const KEY_ENV: Readonly<Record<string, readonly string[]>> = {
  anthropic: ['ANTHROPIC_TEST_API_KEY', 'ANTHROPIC_API_KEY'],
  google_gemini: ['GEMINI_API_KEY'],
  recraft: ['RECRAFT_API_KEY'],
};

const firstEnv = (names: readonly string[]) => names.map((n) => Bun.env[n]).find((v) => v && v.trim() !== '');

/** Whether a provider's key is set (presence only; the value is never read out). */
export const hasProviderKey = (providerId: string) => firstEnv(KEY_ENV[providerId] ?? []) !== undefined;

function requireEnv(names: readonly string[], purpose: string): string {
  const value = firstEnv(names);
  if (!value) throw new Error(`missing env ${names.join(' or ')} (${purpose}); set it in the repo root .env`);
  return value;
}

/** Binds one provider's key into a call; a request for any other provider fails loud. */
function bindKey<R extends { providerId: string; apiKey: string }, T>(providerId: string, call: (req: R) => Promise<T>) {
  const apiKey = requireEnv(KEY_ENV[providerId] ?? [], `${providerId} API key`);
  return (req: Omit<R, 'apiKey'>) => {
    if (req.providerId !== providerId) throw new Error(`edge is bound to ${providerId}, got a ${req.providerId} request`);
    return call({ ...req, apiKey } as R);
  };
}

const LIVE_PROVIDER = 'anthropic';
/** The repo's pinned alignment venv (scripts/requirements-align.txt). */
const ALIGN_VENV_PYTHON = resolve(import.meta.dir, '../../.venv-align/bin/python');
const TTS_PROVIDER = 'google_gemini';

/** How each edge is built from env. Every edge a harness can declare has a row. */
const EDGE_FROM_ENV: { [K in EdgeName]: () => HarnessEdges[K] } = {
  llm: () => bindKey(LIVE_PROVIDER, callLlm),
  model: () => ({ providerId: LIVE_PROVIDER, modelId: Bun.env.LIVE_MODEL ?? 'claude-opus-5-5', effort: z.enum(EFFORTS).parse(Bun.env.LIVE_EFFORT ?? 'high') }),
  tts: () => bindKey(TTS_PROVIDER, callTtsWithTimestamps),
  align: () => {
    const python = Bun.env.ALIGN_PYTHON ?? ALIGN_VENV_PYTHON;
    if (!existsSync(python)) throw new Error(`no word-alignment python at ${python}; create it (README: "Word alignment") or set ALIGN_PYTHON`);
    return (audioPath) => alignWords(python, audioPath);
  },
  audit: () => auditTimeline,
  render: () => {
    const videoCodec = z.enum(Object.keys(VIDEO_CODEC_ARGS) as [VideoCodec, ...VideoCodec[]]).parse(Bun.env.VIDEO_CODEC ?? 'libx264');
    return (opts) => renderTimelineVideo({ ...opts, videoCodec: opts.videoCodec ?? videoCodec });
  },
  // One row per image provider whose key is set; none set fails loud (a request no configured provider can serve fails in the harness).
  imageGen: () => {
    const configured = IMAGE_PROVIDERS.filter((p) => hasProviderKey(p.id));
    if (configured.length === 0) throw new Error(`no image provider key set (any of: ${IMAGE_PROVIDERS.map((p) => (KEY_ENV[p.id] ?? []).join(' or ')).join(', ')})`);
    return Object.fromEntries(configured.map((p) => [p.id, bindKey(p.id, callImageGen)]));
  },
  assetRefs: () => {
    const store = localAssetStore(Bun.env.ASSETS_DIR ?? ASSETS_DIR);
    return (id) => readReadyAsset(store, id);
  },
};

export function edgesFromEnv<E extends EdgeName>(names: readonly E[]): Pick<HarnessEdges, E> {
  return Object.fromEntries(names.map((n) => [n, EDGE_FROM_ENV[n]()])) as Pick<HarnessEdges, E>;
}

// ── Live tests (checkpointed runs live in live-run.ts) ──

export const LIVE = Bun.env.LIVE === '1';
/** Real Opus runs at high effort plus rendering take minutes. */
export const LIVE_TIMEOUT_MS = 30 * 60_000;

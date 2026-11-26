/**
 * Render sandbox tool: bundles a scene (default export) against our lightweight Remotion shim,
 * mounts it in headless Chromium at exactly the requested size, and hands a live session to the
 * caller. Bundle or React runtime errors come back loudly as `{ ok: false }`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '../../../..');
const REACT_DIR = join(REPO_ROOT, 'frontend/web/node_modules');
/** Generous: under heavy machine load Chromium can take many seconds to open its debugging port. */
const CHROME_START_TIMEOUT_MS = 30_000;

export interface SandboxOptions {
  /** Scene source; its default export is the root component. */
  tsxSource: string;
  totalFrames: number;
  fps?: number;
  /** The composition is mounted at exactly this size (no scaling): it is the video frame. */
  width: number;
  height: number;
  /** Extra files written next to scene.tsx (e.g. a timeline.json the scene imports). */
  files?: Record<string, string>;
  /** Extra <head> markup (e.g. @font-face rules). */
  headHtml?: string;
}

/** A live headless-Chromium page with the scene mounted. */
export interface SandboxSession {
  renderFrame(frame: number): Promise<void>;
  /** Base64 image of the frame; `scale` < 1 captures a downscaled frame (cheap motion probes). */
  screenshot(format: 'png' | 'jpeg', quality?: number, scale?: number): Promise<string>;
  /** Evaluates an expression in the page; a returned promise is awaited. */
  evaluate<T>(expression: string): Promise<T>;
}

export type SandboxOutcome<T> = { ok: true; value: T } | { ok: false; stage: 'bundle' | 'runtime'; error: string };

export async function withSandbox<T>(opts: SandboxOptions, use: (s: SandboxSession) => Promise<T>): Promise<SandboxOutcome<T>> {
  const fps = opts.fps ?? 30;
  const totalFrames = Math.max(1, opts.totalFrames);
  const { width, height } = opts;

  const workDir = mkdtempSync(join(tmpdir(), 'everyai-vis-sandbox-'));
  let chrome: ReturnType<typeof Bun.spawn> | null = null;
  let ws: WebSocket | null = null;

  try {
    for (const [name, content] of Object.entries(opts.files ?? {})) writeFileSync(join(workDir, name), content, 'utf8');
    const compPath = join(workDir, 'scene.tsx');
    writeFileSync(compPath, opts.tsxSource, 'utf8');

    const shimPath = join(workDir, 'remotion-shim.tsx');
    writeFileSync(
      shimPath,
      `import React, { createContext, useContext } from 'react';
const FrameCtx = createContext<{ frame: number; fps: number; width: number; height: number }>({ frame: 0, fps: ${fps}, width: ${width}, height: ${height} });
export const FrameProvider = FrameCtx.Provider;
export const useCurrentFrame = () => useContext(FrameCtx).frame;
export const useVideoConfig = () => { const c = useContext(FrameCtx); return { fps: c.fps, width: c.width, height: c.height, durationInFrames: ${totalFrames} }; };
export const AbsoluteFill: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }}>{children}</div>
);
export const Sequence: React.FC<{ from: number; durationInFrames: number; children?: React.ReactNode }> = ({ from, durationInFrames, children }) => {
  const ctx = useContext(FrameCtx);
  const local = ctx.frame - from;
  if (local < 0 || local >= durationInFrames) return null;
  return <FrameCtx.Provider value={{ ...ctx, frame: local }}>{children}</FrameCtx.Provider>;
};
export function interpolate(v: number, inp: number[], out: number[], opts?: { extrapolateLeft?: string; extrapolateRight?: string; easing?: (t: number) => number }): number {
  const clampL = opts?.extrapolateLeft === 'clamp';
  const clampR = opts?.extrapolateRight === 'clamp';
  const ease = opts?.easing ?? ((x: number) => x);
  if (v <= inp[0]!) return clampL ? out[0]! : out[0]! + ease((v - inp[0]!) / Math.max(1e-6, inp[1]! - inp[0]!)) * (out[1]! - out[0]!);
  const last = inp.length - 1;
  if (v >= inp[last]!) return clampR ? out[last]! : out[last]!;
  for (let i = 0; i < last; i++) {
    if (v >= inp[i]! && v <= inp[i + 1]!) {
      const t = ease((v - inp[i]!) / Math.max(1e-6, inp[i + 1]! - inp[i]!));
      return out[i]! + t * (out[i + 1]! - out[i]!);
    }
  }
  return out[last]!;
}
export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t * t * (3 - 2 * t),
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  exp: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => (t: number) => 1 - fn(1 - t),
  inOut: (fn: (t: number) => number) => (t: number) => (t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2),
  bezier: () => (t: number) => t * t * (3 - 2 * t),
};
export function random(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
export function spring(opts: { frame: number; fps: number; config?: { damping?: number; stiffness?: number } }): number {
  if (opts.frame <= 0) return 0;
  const t = opts.frame / opts.fps;
  const d = opts.config?.damping ?? 14;
  const w = Math.sqrt(opts.config?.stiffness ?? 120);
  const val = 1 - Math.exp(-(d / 2) * t) * Math.cos(w * t);
  return Math.max(0, Math.min(1.08, val));
}
`,
      'utf8',
    );

    const entryPath = join(workDir, 'entry.tsx');
    writeFileSync(
      entryPath,
      `import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FrameProvider } from './remotion-shim';
import Comp from './scene';

const root = createRoot(document.getElementById('root')!);
(window as any).__renderFrame = (frame: number) => {
  flushSync(() => {
    root.render(
      <div style={{ width: ${width}, height: ${height}, position: 'relative', overflow: 'hidden' }}>
        <FrameProvider value={{ frame, fps: ${fps}, width: ${width}, height: ${height} }}>
          <Comp />
        </FrameProvider>
      </div>
    );
  });
};
(window as any).__renderFrame(0);
(window as any).__ready = true;
`,
      'utf8',
    );

    let built: Awaited<ReturnType<typeof Bun.build>>;
    try {
      built = await Bun.build({
        entrypoints: [entryPath],
        target: 'browser',
        minify: true,
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [
          {
            name: 'sandbox-aliases',
            setup(build) {
              build.onResolve({ filter: /^remotion$/ }, () => ({ path: shimPath }));
              build.onResolve({ filter: /^react$/ }, () => ({ path: join(REACT_DIR, 'react/index.js') }));
              build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: join(REACT_DIR, 'react/jsx-runtime.js') }));
              build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({ path: join(REACT_DIR, 'react/jsx-dev-runtime.js') }));
              build.onResolve({ filter: /^react-dom$/ }, () => ({ path: join(REACT_DIR, 'react-dom/index.js') }));
              build.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: join(REACT_DIR, 'react-dom/client.js') }));
            },
          },
        ],
      });
    } catch (err) {
      const agg = err as { errors?: Array<{ message?: string }>; message?: string };
      const detail = Array.isArray(agg.errors) && agg.errors.length > 0
        ? agg.errors.map((e) => e.message ?? String(e)).join('\n')
        : err instanceof Error
          ? err.message
          : String(err);
      return { ok: false, stage: 'bundle', error: detail };
    }

    if (!built.success) {
      return {
        ok: false,
        stage: 'bundle',
        error: built.logs.map((l) => l.message).join('\n') || 'Unknown bundle error',
      };
    }

    writeFileSync(join(workDir, 'bundle.js'), await built.outputs[0]!.text(), 'utf8');
    const htmlPath = join(workDir, 'index.html');
    writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8">${opts.headHtml ?? ''}<style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#000;}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>`,
      'utf8',
    );

    // Each sandbox gets its own profile and lets Chromium pick a free debugging port (read back from
    // DevToolsActivePort). A shared profile or a guessed port let parallel render workers attach to
    // the SAME browser and interleave frames. Output is ignored: an undrained pipe can block Chromium.
    const profileDir = join(workDir, 'profile');
    chrome = Bun.spawn(
      [
        'chromium-browser',
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        `--user-data-dir=${profileDir}`,
        '--remote-debugging-port=0',
        `--window-size=${width},${height}`,
        `file://${htmlPath}`,
      ],
      // Chromium's own temp files go inside workDir so the cleanup below removes them too.
      { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, TMPDIR: workDir } },
    );

    let wsUrl = '';
    const deadline = Date.now() + CHROME_START_TIMEOUT_MS;
    while (!wsUrl && Date.now() < deadline) {
      try {
        const port = (await Bun.file(join(profileDir, 'DevToolsActivePort')).text()).split('\n')[0]!.trim();
        const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
          type: string;
          webSocketDebuggerUrl?: string;
        }[];
        wsUrl = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? '';
      } catch {}
      if (!wsUrl) await Bun.sleep(150);
    }
    if (!wsUrl) {
      return { ok: false, stage: 'runtime', error: `Headless Chromium CDP did not start within ${CHROME_START_TIMEOUT_MS} ms` };
    }

    ws = new WebSocket(wsUrl);
    await new Promise<void>((res, rej) => {
      ws!.onopen = () => res();
      ws!.onerror = (e) => rej(e);
    });

    let nid = 1;
    const pend = new Map<number, { res: (v: any) => void; rej: (e: any) => void }>();
    const runtimeErrors: string[] = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as { id?: number; method?: string; params?: any; result?: any; error?: any };
      if (m.method === 'Runtime.exceptionThrown') {
        const desc = m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text ?? 'JS Error';
        runtimeErrors.push(String(desc).slice(0, 400));
      }
      if (m.id && pend.has(m.id)) {
        const p = pend.get(m.id)!;
        pend.delete(m.id);
        if (m.error) p.rej(new Error(JSON.stringify(m.error)));
        else p.res(m.result);
      }
    };
    const cdp = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<any>((res, rej) => {
        const id = nid++;
        pend.set(id, { res, rej });
        ws!.send(JSON.stringify({ id, method, params }));
      });

    await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

    let ready = false;
    for (let i = 0; i < 40; i++) {
      const r = await cdp('Runtime.evaluate', { expression: 'Boolean(window.__ready)', returnByValue: true });
      if (r.result?.value === true) {
        ready = true;
        break;
      }
      if (runtimeErrors.length > 0) break;
      await Bun.sleep(100);
    }
    if (!ready || runtimeErrors.length > 0) {
      return {
        ok: false,
        stage: 'runtime',
        error: runtimeErrors.join('\n') || 'Component failed to mount (window.__ready !== true)',
      };
    }

    await cdp('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    const session: SandboxSession = {
      renderFrame: async (frame) => {
        await cdp('Runtime.evaluate', { expression: `window.__renderFrame(${frame})` });
        if (runtimeErrors.length > 0) throw new Error(runtimeErrors.join('\n'));
      },
      screenshot: async (format, quality, scale) =>
        (await cdp('Page.captureScreenshot', { format, quality, ...(scale !== undefined && { clip: { x: 0, y: 0, width, height, scale } }) })).data as string,
      evaluate: async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value,
    };
    try {
      return { ok: true, value: await use(session) };
    } catch (err) {
      return { ok: false, stage: 'runtime', error: (err as Error).message };
    }
  } finally {
    ws?.close();
    chrome?.kill();
    // Chromium keeps writing its profile while it shuts down; removing workDir before it exits leaks the profile.
    await chrome?.exited;
    rmSync(workDir, { recursive: true, force: true });
  }
}

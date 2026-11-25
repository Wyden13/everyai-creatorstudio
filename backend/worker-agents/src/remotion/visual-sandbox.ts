/**
 * Visual Render Sandbox Tool for Animation Agents:
 * Bundles an agent's Remotion TSX against our lightweight Remotion shim + pre-built
 * Vox / 3Blue1Brown theme-widgets library, executes it in headless Chromium, catches
 * any bundle or React runtime error loudly, and returns rendered PNG keyframes so a
 * multimodal Vision Critic can actually SEE what the agent built.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface RenderedKeyframe {
  frame: number;
  sec: number;
  pngBase64: string;
}

export type SandboxRenderResult =
  | { ok: true; frames: RenderedKeyframe[] }
  | { ok: false; stage: 'bundle' | 'runtime'; error: string };

/** Pure helper: detects whether TSX uses default export or a named PascalCase component export. */
export function detectComponentExport(tsxSource: string): { kind: 'default' } | { kind: 'named'; name: string } {
  if (/export\s+default\s+/.test(tsxSource)) return { kind: 'default' };
  const match = tsxSource.match(/export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)\b/);
  if (match?.[1]) return { kind: 'named', name: match[1] };
  return { kind: 'default' };
}

const REPO_ROOT = resolve(import.meta.dir, '../../../..');
const REACT_DIR = join(REPO_ROOT, 'frontend/web/node_modules');
const THEME_WIDGETS_PATH = join(import.meta.dir, 'theme-widgets.tsx');

export async function renderKeyframesSandbox(opts: {
  tsxSource: string;
  durationSec: number;
  fps?: number;
  sampleFractions?: readonly number[];
  width?: number;
  height?: number;
}): Promise<SandboxRenderResult> {
  const fps = opts.fps ?? 30;
  const totalFrames = Math.max(1, Math.round(opts.durationSec * fps));
  const fractions = opts.sampleFractions ?? [0.12, 0.38, 0.65, 0.88];
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const scale = width / 1920;

  const workDir = mkdtempSync(join(tmpdir(), 'everyai-vis-sandbox-'));
  let chrome: ReturnType<typeof Bun.spawn> | null = null;
  let ws: WebSocket | null = null;

  try {
    const compPath = join(workDir, 'scene.tsx');
    writeFileSync(compPath, opts.tsxSource, 'utf8');

    const shimPath = join(workDir, 'remotion-shim.tsx');
    writeFileSync(
      shimPath,
      `import React, { createContext, useContext } from 'react';
const FrameCtx = createContext<{ frame: number; fps: number; width: number; height: number }>({ frame: 0, fps: ${fps}, width: 1920, height: 1080 });
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
export function interpolate(v: number, inp: number[], out: number[], opts?: { extrapolateLeft?: string; extrapolateRight?: string }): number {
  const clampL = opts?.extrapolateLeft === 'clamp';
  const clampR = opts?.extrapolateRight === 'clamp';
  if (v <= inp[0]!) return clampL ? out[0]! : out[0]! + ((v - inp[0]!) / Math.max(1e-6, inp[1]! - inp[0]!)) * (out[1]! - out[0]!);
  const last = inp.length - 1;
  if (v >= inp[last]!) return clampR ? out[last]! : out[last]!;
  for (let i = 0; i < last; i++) {
    if (v >= inp[i]! && v <= inp[i + 1]!) {
      const t = (v - inp[i]!) / Math.max(1e-6, inp[i + 1]! - inp[i]!);
      return out[i]! + t * (out[i + 1]! - out[i]!);
    }
  }
  return out[last]!;
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

    const exp = detectComponentExport(opts.tsxSource);
    const importLine =
      exp.kind === 'default'
        ? `import Comp from './scene';`
        : `import { ${exp.name} as Comp } from './scene';`;

    const entryPath = join(workDir, 'entry.tsx');
    writeFileSync(
      entryPath,
      `import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FrameProvider } from './remotion-shim';
${importLine}

const root = createRoot(document.getElementById('root')!);
(window as any).__renderFrame = (frame: number) => {
  flushSync(() => {
    root.render(
      <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', transformOrigin: '0 0', transform: 'scale(${scale})' }}>
        <FrameProvider value={{ frame, fps: ${fps}, width: 1920, height: 1080 }}>
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

    const built = await Bun.build({
      entrypoints: [entryPath],
      target: 'browser',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'sandbox-aliases',
          setup(build) {
            build.onResolve({ filter: /^remotion$/ }, () => ({ path: shimPath }));
            build.onResolve({ filter: /^\.\/theme-widgets(\.tsx?)?$/ }, () => ({ path: THEME_WIDGETS_PATH }));
            build.onResolve({ filter: /^react$/ }, () => ({ path: join(REACT_DIR, 'react/index.js') }));
            build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: join(REACT_DIR, 'react/jsx-runtime.js') }));
            build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({ path: join(REACT_DIR, 'react/jsx-dev-runtime.js') }));
            build.onResolve({ filter: /^react-dom$/ }, () => ({ path: join(REACT_DIR, 'react-dom/index.js') }));
            build.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: join(REACT_DIR, 'react-dom/client.js') }));
          },
        },
      ],
    });

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
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#000;}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>`,
      'utf8',
    );

    const port = 9300 + Math.floor(Math.random() * 400);
    chrome = Bun.spawn(
      [
        'chromium-browser',
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        `--remote-debugging-port=${port}`,
        `--window-size=${width},${height}`,
        `file://${htmlPath}`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    let wsUrl = '';
    for (let i = 0; i < 40; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
          type: string;
          webSocketDebuggerUrl?: string;
        }[];
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page?.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await Bun.sleep(150);
    }
    if (!wsUrl) {
      return { ok: false, stage: 'runtime', error: 'Headless Chromium CDP failed to start' };
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

    const frames: RenderedKeyframe[] = [];
    for (const frac of fractions) {
      const frame = Math.min(totalFrames - 1, Math.max(0, Math.round(frac * totalFrames)));
      await cdp('Runtime.evaluate', { expression: `window.__renderFrame(${frame})` });
      const shot = await cdp('Page.captureScreenshot', { format: 'png' });
      frames.push({
        frame,
        sec: Number((frame / fps).toFixed(1)),
        pngBase64: shot.data as string,
      });
    }

    return { ok: true, frames };
  } finally {
    ws?.close();
    chrome?.kill();
    rmSync(workDir, { recursive: true, force: true });
  }
}

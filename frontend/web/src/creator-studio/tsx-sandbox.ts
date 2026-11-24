/**
 * Sandboxed TSX compiler & iframe document builder for Admin-approved custom widgets.
 * Enforces static blocklist checks BEFORE lazy-loading esbuild-wasm, and outputs a
 * strict-CSP srcDoc for <iframe sandbox="allow-scripts"> (NO allow-same-origin).
 */

const BLOCKED_TSX_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(window\.)?(parent|top|opener)\b/, reason: 'blocked cross-frame access' },
  { pattern: /\bdocument\.cookie\b/, reason: 'blocked cookie access' },
  { pattern: /\b(localStorage|sessionStorage|indexedDB)\b/, reason: 'blocked storage access' },
  { pattern: /\b(eval|Function)\s*\(/, reason: 'blocked dynamic code evaluation' },
  { pattern: /\bimport\s*\(/, reason: 'blocked dynamic import' },
];

export function auditSandboxedTsx(source: string): { ok: true } | { ok: false; reason: string } {
  if (source.trim().length < 10) {
    return { ok: false, reason: 'TSX source is empty' };
  }
  for (const rule of BLOCKED_TSX_PATTERNS) {
    if (rule.pattern.test(source)) {
      return { ok: false, reason: `Sandbox policy violation: ${rule.reason}` };
    }
  }
  return { ok: true };
}

let esbuildInitPromise: Promise<typeof import('esbuild-wasm')> | null = null;

async function getEsbuild(): Promise<typeof import('esbuild-wasm')> {
  if (!esbuildInitPromise) {
    esbuildInitPromise = (async () => {
      const esbuild = await import('esbuild-wasm');
      await esbuild.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.28.2/esbuild.wasm',
        worker: true,
      });
      return esbuild;
    })();
  }
  return esbuildInitPromise;
}

export async function compileSandboxedTsx(source: string): Promise<string> {
  const audit = auditSandboxedTsx(source);
  if (!audit.ok) throw new Error(audit.reason);
  const esbuild = await getEsbuild();
  const out = await esbuild.transform(source, {
    loader: 'tsx',
    jsx: 'transform',
    target: 'es2022',
  });
  return out.code;
}

/**
 * Builds an isolated HTML document with strict CSP and a typed postMessage data bridge.
 * Must always be hosted inside <iframe sandbox="allow-scripts"> without allow-same-origin.
 */
export function buildSandboxedIframeDoc(compiledJs: string): string {
  const safeJs = compiledJs.replace(/<\/script>/gi, '<\\/script>');
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta charset="utf-8" />',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\';" />',
    '<style>html,body{margin:0;padding:8px;background:#15161B;color:#ECECF1;font:13px system-ui,sans-serif;}</style>',
    '</head><body>',
    '<div id="widget-root"></div>',
    '<script>',
    'window.__WIDGET_DATA__ = {};',
    'window.addEventListener("message", (ev) => {',
    '  if (ev.data && ev.data.type === "creatorstudio:data") {',
    '    window.__WIDGET_DATA__ = ev.data.payload ?? {};',
    '    if (typeof window.__onWidgetData === "function") window.__onWidgetData(window.__WIDGET_DATA__);',
    '  }',
    '});',
    safeJs,
    '</script></body></html>',
  ].join('\n');
}

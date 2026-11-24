import { describe, expect, test } from 'bun:test';
import { auditSandboxedTsx, buildSandboxedIframeDoc } from './tsx-sandbox';

describe('Sandboxed TSX static security audit & CSP iframe', () => {
  const cases: [string, string, boolean][] = [
    ['allows clean widget TSX', 'export default function Widget() { return <div>42</div>; }', true],
    ['blocks window.parent access', 'window.parent.postMessage("steal", "*");', false],
    ['blocks document.cookie access', 'const c = document.cookie; console.log(c);', false],
    ['blocks localStorage access', 'localStorage.setItem("k", "v");', false],
    ['blocks eval()', 'eval("alert(1)");', false],
    ['blocks dynamic import()', 'const m = await import("evil");', false],
  ];

  for (const [name, src, expected] of cases) {
    test(name, () => {
      expect(auditSandboxedTsx(src).ok).toBe(expected);
    });
  }

  test('iframe document enforces strict CSP and escapes closing script tags', () => {
    const doc = buildSandboxedIframeDoc('console.log("</script><img onerror=1>");');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain('creatorstudio:data');
    expect(doc).not.toContain('</script><img');
  });
});

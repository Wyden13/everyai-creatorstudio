import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withSandbox } from './visual-sandbox';

/**
 * Parallel render workers each open a sandbox. They must never share a browser: a guessed debugging
 * port or a shared profile once let workers attach to the same page and interleave frames.
 */
describe.skipIf(!Bun.which('chromium-browser'))('render sandbox isolation (real headless Chromium)', () => {
  test(
    'parallel sandboxes each see only their own scene',
    async () => {
      const ids = Array.from({ length: 8 }, (_, i) => `scene-${i}`);
      const seen = await Promise.all(
        ids.map((id) =>
          withSandbox(
            {
              tsxSource: `import React from 'react';\nexport default function Scene() { return <div id="who">${id}</div>; }`,
              totalFrames: 1,
              width: 320,
              height: 180,
            },
            async (s) => {
              await s.renderFrame(0);
              return s.evaluate<string>(`document.getElementById('who').textContent`);
            },
          ),
        ),
      );
      expect(seen).toEqual(ids.map((id) => ({ ok: true, value: id })));
    },
    120_000,
  );

  // A sandbox once removed its work dir while Chromium was still exiting, leaking a profile per render.
  test(
    'sandboxes leave nothing behind in the temp dir',
    async () => {
      const tmp = mkdtempSync(join(tmpdir(), 'sandbox-leak-test-'));
      const before = process.env.TMPDIR;
      process.env.TMPDIR = tmp;
      try {
        const scene = { tsxSource: `export default function Scene() { return <div>x</div>; }`, totalFrames: 1, width: 320, height: 180 };
        const results = await Promise.all([1, 2, 3].map(() => withSandbox(scene, (s) => s.renderFrame(0))));
        expect(results.every((r) => r.ok)).toBe(true);
        expect(readdirSync(tmp)).toEqual([]);
      } finally {
        process.env.TMPDIR = before;
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    60_000,
  );
});

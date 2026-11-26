import { describe, expect, test } from 'bun:test';
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
});

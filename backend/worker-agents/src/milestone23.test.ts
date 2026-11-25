import { describe, expect, test } from 'bun:test';
import { extractTsxSource, VisionCritiqueSchema } from './agents/animation';
import { CAPTION_SAFE_BOTTOM_PX, THEME_WIDGET_CATALOG_DOCS } from './remotion/theme-catalog';
import { detectComponentExport } from './remotion/visual-sandbox';

describe('Milestone 23 — Pre-Built Theme Widgets, Visual Sandbox & Multimodal Vision Critic', () => {
  test('THEME_WIDGET_CATALOG_DOCS documents both Vox and 3Blue1Brown widgets and safe-zone', () => {
    expect(CAPTION_SAFE_BOTTOM_PX).toBe(140);
    expect(THEME_WIDGET_CATALOG_DOCS).toContain('VoxGeoMap');
    expect(THEME_WIDGET_CATALOG_DOCS).toContain('VoxDataChart');
    expect(THEME_WIDGET_CATALOG_DOCS).toContain('VoxTimeline');
    expect(THEME_WIDGET_CATALOG_DOCS).toContain('ThreeB1BPlane');
    expect(THEME_WIDGET_CATALOG_DOCS).toContain('ThreeB1BEquation');
  });

  test('detectComponentExport identifies both default and named PascalCase exports', () => {
    expect(detectComponentExport('export default function Rome() { return null; }')).toEqual({ kind: 'default' });
    expect(detectComponentExport('export const RomeInFiveActs = () => null;')).toEqual({
      kind: 'named',
      name: 'RomeInFiveActs',
    });
  });

  test('extractTsxSource strips markdown tsx fences cleanly', () => {
    const raw = '```tsx\nimport React from "react";\nexport default function Demo() { return <div />; }\n```';
    expect(extractTsxSource(raw)).toBe('import React from "react";\nexport default function Demo() { return <div />; }');
  });

  test('VisionCritiqueSchema validates multimodal critic payloads', () => {
    const ok = VisionCritiqueSchema.safeParse({
      approved: false,
      score: 5,
      summary: 'Chart title clipped behind map box.',
      issues: ['Territory vs. inequality overlaps bottom of map'],
      improvements: ['Give chart its own full-width beat'],
    });
    expect(ok.success).toBe(true);

    const bad = VisionCritiqueSchema.safeParse({ approved: true, score: 15, summary: 'Invalid score' });
    expect(bad.success).toBe(false);
  });
});

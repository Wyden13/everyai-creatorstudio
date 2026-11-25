import { beforeEach, describe, expect, test } from 'bun:test';
import { filterPaletteItems, type PaletteItem } from './palette';
import {
  addEdge,
  deleteEdge,
  deleteNode,
  get,
  initial,
  recentVersionsForArchitect,
  redoBoard,
  rollbackComponentVersion,
  set,
  snapshotComponentVersion,
  undoBoard,
} from './store';

beforeEach(() => {
  set(initial());
});

describe('Milestone 22 — Component Versioning, Undo/Redo, Edge Wiring & Command Palette', () => {
  test('snapshots component versions (v1, v2) and rolls back cleanly with Architect context', () => {
    const v1 = snapshotComponentVersion('animation', 'Before Vox style', { title: 'Animation (Vox)' }, 'Use Vox clean palette');
    expect(v1?.version).toBe(1);
    expect(get().nodes.find((n) => n.id === 'animation')?.title).toBe('Animation (Vox)');
    expect(get().nodePrompts['animation']).toBe('Use Vox clean palette');

    const v2 = snapshotComponentVersion('animation', 'Minimal pass', { title: 'Animation (Minimal)' }, 'Use minimal mono');
    expect(v2?.version).toBe(2);
    expect(recentVersionsForArchitect('animation')).toContain('v1(Before Vox style');
    expect(recentVersionsForArchitect('animation')).toContain('v2(Minimal pass');

    expect(rollbackComponentVersion('animation', 1)).toBe(true);
    expect(get().nodes.find((n) => n.id === 'animation')?.title).toBe('Animation');
  });

  test('undoBoard and redoBoard restore deleted nodes and re-apply cleanly', () => {
    const startCount = get().nodes.length;
    deleteNode('manim');
    expect(get().nodes.length).toBe(startCount - 1);
    expect(get().undoStack.length).toBe(1);

    expect(undoBoard()).toBe(true);
    expect(get().nodes.length).toBe(startCount);
    expect(get().redoStack.length).toBe(1);

    expect(redoBoard()).toBe(true);
    expect(get().nodes.length).toBe(startCount - 1);
  });

  test('addEdge and deleteEdge prevent self-loops/duplicates and integrate with undo/redo', () => {
    expect(addEdge('trend', 'trend')).toBe(false); // self-loop blocked
    expect(addEdge('trend', 'toptrends')).toBe(false); // duplicate blocked
    expect(addEdge('trend', 'screenplay')).toBe(true);
    expect(get().edges.some((e) => e.from === 'trend' && e.to === 'screenplay')).toBe(true);

    expect(deleteEdge('trend', 'screenplay')).toBe(true);
    expect(get().edges.some((e) => e.from === 'trend' && e.to === 'screenplay')).toBe(false);

    expect(undoBoard()).toBe(true);
    expect(get().edges.some((e) => e.from === 'trend' && e.to === 'screenplay')).toBe(true);
  });

  test('filterPaletteItems matches components by cmp_* ID, title, and actions', () => {
    const items: PaletteItem[] = [
      { id: '1', group: 'Component', label: 'Animation', hint: 'cmp_animation_animation', icon: 'animation', searchText: 'Animation animation cmp_animation_animation', run: () => {} },
      { id: '2', group: 'Action', label: 'Run Trend Scout', hint: 'Poll now', icon: 'play', searchText: 'run trend scout poll', run: () => {} },
    ];
    expect(filterPaletteItems(items, 'cmp_animation')).toHaveLength(1);
    expect(filterPaletteItems(items, 'scout')[0]?.id).toBe('2');
    expect(filterPaletteItems(items, '')).toHaveLength(2);
  });
});

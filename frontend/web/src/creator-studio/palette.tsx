/** Cmd/Ctrl+K Command Palette: jump to workspaces, components by cmp_* ID, views, and board actions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fitBoardNow } from './board';
import { Icon } from './icons';
import { kindIcon } from './nodes';
import { componentCode, get, redoBoard, runTrend, set, switchWs, undoBoard, useStudio } from './store';
import { Shape } from './ui';

export interface PaletteItem {
  id: string;
  group: 'Component' | 'Workspace' | 'Action' | 'View';
  label: string;
  hint: string;
  icon: string;
  searchText: string;
  run: () => void;
}

/** Pure builder + filter for Command Palette items (unit-testable). */
export function filterPaletteItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((it) => it.searchText.toLowerCase().includes(q));
}

export function CommandPalette() {
  const s = useStudio();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (s.paletteOpen) {
      setQuery('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [s.paletteOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    for (const n of s.nodes) {
      const code = componentCode(n);
      out.push({
        id: `node:${n.id}`,
        group: 'Component',
        label: n.title,
        hint: code,
        icon: kindIcon[n.kind],
        searchText: `${n.title} ${n.kind} ${code} ${n.sub}`,
        run: () => set({ view: 'board', selected: n.id, paletteOpen: false }),
      });
    }
    for (const w of s.workspaces) {
      out.push({
        id: `ws:${w.id}`,
        group: 'Workspace',
        label: w.name,
        hint: w.id === s.ws ? 'Current' : 'Switch workspace',
        icon: 'org',
        searchText: `workspace ${w.name} ${w.id}`,
        run: () => { switchWs(w.id); set({ paletteOpen: false }); },
      });
    }
    out.push(
      {
        id: 'act:scout',
        group: 'Action',
        label: 'Run Trend Scout',
        hint: 'Poll trends now',
        icon: 'play',
        searchText: 'run trend scout poll',
        run: () => {
          if (get().nodes.find((n) => n.id === 'trend')?.status === 'idle') runTrend();
          set({ paletteOpen: false });
        },
      },
      {
        id: 'act:fit',
        group: 'Action',
        label: 'Fit board to viewport',
        hint: 'Shift+1',
        icon: 'fit',
        searchText: 'fit board zoom reset center',
        run: () => { set({ view: 'board', paletteOpen: false }); fitBoardNow(); },
      },
      {
        id: 'act:undo',
        group: 'Action',
        label: 'Undo last board change',
        hint: 'Cmd/Ctrl+Z',
        icon: 'retry',
        searchText: 'undo revert board',
        run: () => { undoBoard(); set({ paletteOpen: false }); },
      },
      {
        id: 'act:redo',
        group: 'Action',
        label: 'Redo board change',
        hint: 'Cmd/Ctrl+Shift+Z',
        icon: 'retry',
        searchText: 'redo board',
        run: () => { redoBoard(); set({ paletteOpen: false }); },
      },
      {
        id: 'view:architect',
        group: 'View',
        label: 'Architect chats',
        hint: 'Create or edit components',
        icon: 'sparkle',
        searchText: 'architect chats ai builder',
        run: () => set({ view: 'architect', selected: null, paletteOpen: false }),
      },
      {
        id: 'view:publish',
        group: 'View',
        label: 'Publish queue',
        hint: 'Approve & schedule videos',
        icon: 'publish',
        searchText: 'publish queue videos',
        run: () => set({ view: 'publish', selected: null, paletteOpen: false }),
      },
      {
        id: 'view:org',
        group: 'View',
        label: 'Organization & Connectors',
        hint: 'API keys & team',
        icon: 'org',
        searchText: 'organization connectors vault keys',
        run: () => set({ view: 'org', selected: null, paletteOpen: false }),
      },
    );
    return out;
  }, [s.nodes, s.workspaces, s.ws]);

  const visible = useMemo(() => filterPaletteItems(items, query), [items, query]);
  if (!s.paletteOpen) return null;

  const exec = (item: PaletteItem | undefined) => {
    if (!item) return;
    item.run();
  };

  return (
    <div className="palette-backdrop" onPointerDown={() => set({ paletteOpen: false })}>
      <div className="palette-wrap" onPointerDown={(e) => e.stopPropagation()}>
        <Shape r={24} className="palette-shape" skin="glass thick palette-skin">
          <div className="palette-head">
            <Icon name="sparkle" size={16} />
            <input
              ref={inputRef}
              className="palette-in"
              value={query}
              placeholder="Jump to component (cmp_*), workspace, or action…"
              onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); set({ paletteOpen: false }); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(visible.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); exec(visible[idx]); }
              }}
            />
            <span className="kbd mono">Esc</span>
          </div>
          <div className="palette-list overlay-scroll">
            {visible.length === 0 ? (
              <div className="palette-empty">No matching components or actions.</div>
            ) : (
              visible.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  className={`palette-row ${i === idx ? 'on' : ''}`}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => exec(it)}
                >
                  <Icon name={it.icon} size={15} />
                  <span className="palette-lbl">{it.label}</span>
                  <span className="palette-grp">{it.group}</span>
                  <span className="palette-hint mono">{it.hint}</span>
                </button>
              ))
            )}
          </div>
        </Shape>
      </div>
    </div>
  );
}

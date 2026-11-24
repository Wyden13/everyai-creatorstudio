import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import type { Mount } from '@utils/types';
import './studio.css';
import { Architect } from './architect';
import { Board } from './board';
import { Icon } from './icons';
import { Inspector } from './inspector';
import { Org, Settings } from './org';
import { Publish } from './publish';
import { createWs, set, startSim, switchWs, useStudio, wsNodes, type View } from './store';
import { Shape } from './ui';
import { TopicChip } from './topicdrag';

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="10" cy="13" r="7.5" fill="var(--violet)" />
      <path d="M15.5 6.5a7.5 7.5 0 1 1 0 13" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  );
}

function Nav() {
  const s = useStudio();
  const list = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null);
  const [n, setN] = useState(0);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const ready = s.videos.filter((v) => v.state === 'ready').length;
  const active = s.view === 'board' ? `ws-${s.ws}` : s.view;
  const pages: { id: View; label: string; icon: string; count?: number }[] = [
    { id: 'publish', label: 'Publish', icon: 'publish', count: ready },
    { id: 'org', label: 'Organization', icon: 'org' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (el) setInd((o) => { if (o && o.y !== el.offsetTop) setN((k) => k + 1); return { y: el.offsetTop, h: el.offsetHeight }; });
  }, [active, s.workspaces.length, naming]);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (naming) nameRef.current?.focus(); }, [naming]);
  const once = useRef(false);
  useEffect(() => { if (naming) once.current = false; }, [naming]);
  /** Enter and the blur that follows both land here; only the first one creates. */
  const make = () => {
    if (once.current) return;
    once.current = true;
    if (name.trim()) createWs(name.trim());
    setNaming(false); setName('');
  };
  return (
    <Shape r={26} class="nav" skin="glass regular nav-skin">
      <div class="brand"><Mark /><span><b>EveryAI</b><small>CreatorStudio</small></span></div>
      <div class="nav-list" ref={list}>
        {ind && <span class={`nav-ind sv${n % 2}`} style={{ transform: `translateY(${ind.y}px)`, height: `${ind.h}px` }} />}
        <div class="nav-head">
          <span>Workspaces</span>
          <button type="button" class="iconbtn" aria-label="New workspace" title="New workspace" onClick={() => setNaming(true)}><Icon name="plus" size={15} /></button>
        </div>
        {s.workspaces.map((w, i) => {
          const waiting = wsNodes(s, w.id).filter((x) => x.status === 'approval').length;
          return (
            <button type="button" data-id={`ws-${w.id}`} class={`nav-item ${active === `ws-${w.id}` ? 'on' : ''}`} style={{ animation: i >= 3 ? 'row-in .25s var(--out) both' : undefined }} onClick={() => switchWs(w.id)}>
              <span class="nav-ws-ic"><i /></span>
              <span>{w.name}</span>
              {waiting ? <span class="count amber">{waiting}</span> : null}
            </button>
          );
        })}
        {naming && (
          <form class="nav-new" onSubmit={(e) => { e.preventDefault(); make(); }}>
            <input ref={nameRef} value={name} placeholder="Name this pipeline" onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onBlur={make} onKeyDown={(e) => { if (e.key === 'Escape') { setName(''); setNaming(false); } }} />
          </form>
        )}
        <div class="nav-gap" />
        {pages.map((it) => (
          <button type="button" data-id={it.id} class={`nav-item ${active === it.id ? 'on' : ''}`} onClick={() => set({ view: it.id, selected: null })}>
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
            {it.count ? <span class="count">{it.count}</span> : null}
          </button>
        ))}
      </div>
      <div class="nav-foot">
        <div class="presence">
          <span class="face you">A</span>
          <span class="row-t"><b>You</b><small>Admin</small></span>
        </div>
        <div class="presence">
          <span class="face wendy">W</span>
          <span class="row-t"><b>Wendy</b><small>{s.partner.on ? `On ${s.nodes.find((x) => x.id === s.partner.on)?.title}` : `In ${s.workspaces.find((w) => w.id === s.ws)?.name}`}</small></span>
        </div>
      </div>
    </Shape>
  );
}

function Pages() {
  const s = useStudio();
  const [shown, setShown] = useState<View | null>(s.view === 'board' ? null : s.view);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (s.view !== 'board') { setShown(s.view); setOut(false); return; }
    if (!shown) return;
    setOut(true);
    const t = setTimeout(() => { setShown(null); setOut(false); }, 200);
    return () => clearTimeout(t);
  }, [s.view]);
  if (!shown) return null;
  return (
    <div class={`sheet ${out ? 'out' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <Shape r={30} class="sheet-shape" skin="glass thick sheet-skin">
        <div class="sheet-swap ov-in" key={shown}>
          {shown === 'publish' && <Publish />}
          {shown === 'org' && <Org />}
          {shown === 'settings' && <Settings />}
        </div>
      </Shape>
    </div>
  );
}

function App({ preview }: { preview: boolean }) {
  const [drawerW, setDrawerW] = useState(440);
  useEffect(() => startSim(preview), []);
  return (
    <div class={`cs ${preview ? 'preview' : ''}`}>
      <Board preview={preview} drawerW={drawerW} />
      {!preview && (
        <>
          <Architect drawerW={drawerW} />
          <Inspector width={drawerW} onWidth={setDrawerW} />
          <Pages />
          <Nav />
          <TopicChip />
        </>
      )}
    </div>
  );
}

export const mount: Mount = (target, options = {}) => {
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;width:100%;height:100%;';
  target.appendChild(root);
  render(<App preview={options.preview === '1'} />, root);
  return { dispose() { render(null, root); root.remove(); } };
};

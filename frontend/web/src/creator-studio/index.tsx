import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
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
      <path d="M15.5 6.5a7.5 7.5 0 1 1 0 13" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
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
    <Shape r={26} className="nav" skin="glass regular nav-skin">
      <div className="brand"><Mark /><span><b>EveryAI</b><small>CreatorStudio</small></span></div>
      <div className="nav-list" ref={list}>
        {ind && <span className={`nav-ind sv${n % 2}`} style={{ transform: `translateY(${ind.y}px)`, height: `${ind.h}px` }} />}
        <div className="nav-head">
          <span>Workspaces</span>
          <button type="button" className="iconbtn" aria-label="New workspace" title="New workspace" onClick={() => setNaming(true)}><Icon name="plus" size={15} /></button>
        </div>
        {s.workspaces.map((w, i) => {
          const waiting = wsNodes(s, w.id).filter((x) => x.status === 'approval').length;
          return (
            <button type="button" data-id={`ws-${w.id}`} className={`nav-item ${active === `ws-${w.id}` ? 'on' : ''}`} style={{ animation: i >= 3 ? 'row-in .25s var(--out) both' : undefined }} onClick={() => switchWs(w.id)}>
              <span className="nav-ws-ic"><i /></span>
              <span>{w.name}</span>
              {waiting ? <span className="count amber">{waiting}</span> : null}
            </button>
          );
        })}
        {naming && (
          <form className="nav-new" onSubmit={(e) => { e.preventDefault(); make(); }}>
            <input ref={nameRef} value={name} placeholder="Name this pipeline" onChange={(e) => setName((e.target as HTMLInputElement).value)}
              onBlur={make} onKeyDown={(e) => { if (e.key === 'Escape') { setName(''); setNaming(false); } }} />
          </form>
        )}
        <div className="nav-gap" />
        {pages.map((it) => (
          <button type="button" data-id={it.id} className={`nav-item ${active === it.id ? 'on' : ''}`} onClick={() => set({ view: it.id, selected: null })}>
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
            {it.count ? <span className="count">{it.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="nav-foot">
        <div className="presence">
          <span className="face you">A</span>
          <span className="row-t"><b>You</b><small>Admin</small></span>
        </div>
        <div className="presence">
          <span className="face wendy">W</span>
          <span className="row-t"><b>Wendy</b><small>{s.partner.on ? `On ${s.nodes.find((x) => x.id === s.partner.on)?.title}` : `In ${s.workspaces.find((w) => w.id === s.ws)?.name}`}</small></span>
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
    <div className={`sheet ${out ? 'out' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <Shape r={30} className="sheet-shape" skin="glass thick sheet-skin">
        <div className="sheet-swap ov-in" key={shown}>
          {shown === 'publish' && <Publish />}
          {shown === 'org' && <Org />}
          {shown === 'settings' && <Settings />}
        </div>
      </Shape>
    </div>
  );
}

export function CreatorStudioApp({ preview = false }: { preview?: boolean }) {
  const [drawerW, setDrawerW] = useState(440);
  useEffect(() => startSim(preview), [preview]);
  return (
    <div className={`cs ${preview ? 'preview' : ''}`}>
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

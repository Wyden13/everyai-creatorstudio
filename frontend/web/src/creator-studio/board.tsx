/** The freeform board: pan, zoom, drag, resize, edges, the partner's cursor. */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from './icons';
import { kindIcon, NodeBody } from './nodes';
import { band, clamp, K, Loop, spring, step, type Spring } from './physics';
import { broadcastNodePosition, componentCode, deleteNode, duplicateNode, get, patchNode, runTrend, set, startFrom, useStudio, type BoardNode, type State } from './store';
import { Button, Shape, StatusMark, Tiles } from './ui';

export interface Cam { x: number; y: number; z: number }
const MIN = { w: 240, h: 150 };

// ── per-node feel: lean while dragged, settle with one wobble ──────────
interface Feel { rot: Spring; ox: Spring; oy: Spring; dw: Spring; dh: Spring; bw: boolean; bh: boolean; vx: number; held: boolean; el: HTMLElement | null }
const feel = new Map<string, Feel>();
const feelOf = (id: string) => {
  let f = feel.get(id);
  if (!f) feel.set(id, (f = { rot: spring(), ox: spring(), oy: spring(), dw: spring(), dh: spring(), bw: false, bh: false, vx: 0, held: false, el: null }));
  return f;
};
const feelLoop = new Loop((dt) => {
  let busy = false;
  feel.forEach((f, id) => {
    if (f.held) { f.vx *= 0.86; busy = true; }
    const target = f.held ? clamp(f.vx * 0.0032, -4, 4) : 0;
    busy = step(f.rot, target, K.wobble[0], K.wobble[1], dt) || busy;
    busy = step(f.ox, 0, K.settle[0], K.settle[1], dt) || busy;
    busy = step(f.oy, 0, K.settle[0], K.settle[1], dt) || busy;
    if (f.bw) { f.bw = step(f.dw, 0, K.wobble[0], K.wobble[1], dt); patchNode(id, { w: MIN.w + f.dw.x }); busy = busy || f.bw; }
    if (f.bh) { f.bh = step(f.dh, 0, K.wobble[0], K.wobble[1], dt); patchNode(id, { h: MIN.h + f.dh.x }); busy = busy || f.bh; }
    if (f.el) {
      f.el.style.setProperty('--rot', `${f.rot.x.toFixed(3)}deg`);
      f.el.style.setProperty('--ox', `${f.ox.x.toFixed(2)}px`);
      f.el.style.setProperty('--oy', `${f.oy.x.toFixed(2)}px`);
    }
  });
  return busy;
});

// ── edges ──────────────────────────────────────────────────────────────
/** Leave and enter on the sides that face each other, so a snake layout reads naturally. */
function edgePath(a: BoardNode, b: BoardNode) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  let p1: number[], p2: number[], dir: 'right' | 'left' | 'down' | 'up', c1: number[], c2: number[];
  if (gapX >= gapY) {
    const right = bx > ax;
    p1 = [right ? a.x + a.w : a.x, a.y + 30]; p2 = [right ? b.x : b.x + b.w, b.y + 30];
    const k = Math.max(40, Math.abs(p2[0] - p1[0]) / 2) * (right ? 1 : -1);
    c1 = [p1[0] + k, p1[1]]; c2 = [p2[0] - k, p2[1]]; dir = right ? 'right' : 'left';
  } else {
    const down = by > ay;
    p1 = [a.x + a.w / 2, down ? a.y + a.h : a.y]; p2 = [b.x + b.w / 2, down ? b.y : b.y + b.h];
    const k = Math.max(40, Math.abs(p2[1] - p1[1]) / 2) * (down ? 1 : -1);
    c1 = [p1[0], p1[1] + k]; c2 = [p2[0], p2[1] - k]; dir = down ? 'down' : 'up';
  }
  return { d: `M${p1[0]} ${p1[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`, p1, p2, dir };
}

const arrowAt = (p: number[], dir: string) =>
  dir === 'right' ? `M${p[0] - 7} ${p[1] - 5}l6 5-6 5` : dir === 'left' ? `M${p[0] + 7} ${p[1] - 5}l-6 5 6 5`
  : dir === 'down' ? `M${p[0] - 5} ${p[1] - 7}l5 6 5-6` : `M${p[0] - 5} ${p[1] + 7}l5-6 5 6`;

function Edges({ s }: { s: State }) {
  const all = s.ghost ? [...s.nodes, s.ghost] : s.nodes;
  const byId = new Map(all.map((n) => [n.id, n]));
  const list = s.ghost && s.ghostStage >= 3 ? [...s.edges, { from: s.ghost.note, to: s.ghost.id, ghost: true }] : s.edges;
  return (
    <svg className="edges" width="1" height="1" aria-hidden="true">
      {list.map((e) => {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return null;
        const { d, p1, p2, dir } = edgePath(a, b);
        const live = b.status === 'running';
        const hot = s.selected === a.id || s.selected === b.id;
        const ghost = 'ghost' in e;
        return (
          <g data-from={e.from} data-to={e.to} className={`edge ${live ? 'live' : ''} ${hot ? 'hot' : ''} ${ghost ? 'ghost' : ''}`} key={`${e.from}-${e.to}`}>
            <path className="e-line" d={d} pathLength={ghost ? 100 : undefined} />
            {live && s.prefs.pulses && [0, 0.55, 1.1].map((b2) => (
              <circle key={b2} className="pulse-dot" r="3.5"><animateMotion {...({ dur: '1.6s', begin: `${b2}s`, repeatCount: 'indefinite', path: d } as object)} /></circle>
            ))}
            <circle className="port" cx={p1[0]} cy={p1[1]} r="4" />
            <path className="arrow" d={arrowAt(p2, dir)} />
          </g>
        );
      })}
    </svg>
  );
}

/** Updates only the SVG edges connected to `nodeId` directly in the DOM (0 React re-renders). */
function updateConnectedEdges(nodeId: string, nextX: number, nextY: number) {
  const st = get();
  const byId = new Map(st.nodes.map((n) => [n.id, n.id === nodeId ? { ...n, x: nextX, y: nextY } : n]));
  if (st.ghost) byId.set(st.ghost.id, st.ghost);
  const groups = document.querySelectorAll<SVGGElement>(`svg.edges g[data-from="${nodeId}"], svg.edges g[data-to="${nodeId}"]`);
  groups.forEach((g) => {
    const a = byId.get(g.dataset.from ?? '');
    const b = byId.get(g.dataset.to ?? '');
    if (!a || !b) return;
    const { d, p1, p2, dir } = edgePath(a, b);
    g.querySelector<SVGPathElement>('path.e-line')?.setAttribute('d', d);
    const port = g.querySelector<SVGCircleElement>('circle.port');
    if (port) {
      port.setAttribute('cx', String(p1[0]));
      port.setAttribute('cy', String(p1[1]));
    }
    g.querySelector<SVGPathElement>('path.arrow')?.setAttribute('d', arrowAt(p2, dir));
    g.querySelectorAll('animateMotion').forEach((am) => am.setAttribute('path', d));
  });
}

// ── a node ─────────────────────────────────────────────────────────────
function NodeView({ n, s, cam, ghost, onContext }: { n: BoardNode; s: State; cam: Cam; ghost?: boolean; onContext?: (n: BoardNode, x: number, y: number) => void }) {
  const f = feelOf(n.id);
  const [held, setHeld] = useState(false);
  const selected = s.selected === n.id;
  const partner = s.prefs.cursors && s.partner.on === n.id;
  const dropT = !!s.drag && n.kind === 'screenplay';
  const ring = ghost ? null : dropT ? 'var(--violet)' : selected ? 'var(--violet)' : n.status === 'approval' ? 'var(--amber)' : n.status === 'failed' ? 'var(--coral)' : partner ? 'var(--ice)' : null;

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || ghost) return;
    e.stopPropagation();
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, x: n.x, y: n.y };
    let moved = false, lastX = e.clientX, lastT = performance.now(), curDx = 0, curDy = 0, rafId = 0;
    const flushDrag = () => {
      rafId = 0;
      if (f.el) {
        f.el.style.setProperty('--dx', `${curDx}px`);
        f.el.style.setProperty('--dy', `${curDy}px`);
      }
      updateConnectedEdges(n.id, start.x + curDx, start.y + curDy);
    };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / cam.z, dy = (ev.clientY - start.py) / cam.z;
      if (!moved && Math.hypot(dx, dy) * cam.z < 4) return;
      if (!moved) { moved = true; f.held = true; setHeld(true); }
      const now = performance.now();
      f.vx = f.vx * 0.5 + (((ev.clientX - lastX) / Math.max(1, now - lastT)) * 1000) * 0.5;
      lastX = ev.clientX; lastT = now;
      curDx = dx; curDy = dy;
      if (!rafId) rafId = requestAnimationFrame(flushDrag);
      feelLoop.kick();
    };
    const up = () => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      t.removeEventListener('pointercancel', up);
      if (rafId) cancelAnimationFrame(rafId);
      if (f.el) {
        f.el.style.removeProperty('--dx');
        f.el.style.removeProperty('--dy');
      }
      if (!moved) { set({ selected: n.id }); return; }
      f.held = false; setHeld(false);
      const rawX = start.x + curDx, rawY = start.y + curDy;
      if (get().prefs.snap) {
        const sx = Math.round(rawX / 20) * 20, sy = Math.round(rawY / 20) * 20;
        f.ox.x += rawX - sx; f.oy.x += rawY - sy;
        patchNode(n.id, { x: sx, y: sy });
        broadcastNodePosition({ id: n.id, x: sx, y: sy, w: n.w, h: n.h });
      } else {
        patchNode(n.id, { x: rawX, y: rawY });
        broadcastNodePosition({ id: n.id, x: rawX, y: rawY, w: n.w, h: n.h });
      }
      feelLoop.kick();
    };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  };

  const resize = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, w: n.w, h: n.h };
    f.held = true; setHeld(true);
    let nextW = n.w, nextH = n.h, rafId = 0;
    const flushResize = () => {
      rafId = 0;
      patchNode(n.id, { w: nextW, h: nextH });
    };
    const move = (ev: PointerEvent) => {
      const w = start.w + (ev.clientX - start.px) / cam.z, h = start.h + (ev.clientY - start.py) / cam.z;
      nextW = w < MIN.w ? MIN.w + band(w - MIN.w, 26) : w;
      nextH = h < MIN.h ? MIN.h + band(h - MIN.h, 26) : h;
      if (!rafId) rafId = requestAnimationFrame(flushResize);
    };
    const up = () => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      if (rafId) { cancelAnimationFrame(rafId); patchNode(n.id, { w: nextW, h: nextH }); }
      f.held = false; setHeld(false);
      const cur = get().nodes.find((x) => x.id === n.id)!;
      if (cur.w < MIN.w) { f.dw.x = cur.w - MIN.w; f.dw.v = 0; f.bw = true; }
      if (cur.h < MIN.h) { f.dh.x = cur.h - MIN.h; f.dh.v = 0; f.bh = true; }
      feelLoop.kick();
    };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
  };

  return (
    <div
      data-id={n.id}
      data-kind={n.kind}
      className={`node t-${n.type} ${held ? 'held' : ''} ${ghost ? `ghost g${s.ghostStage}` : ''} st-${n.status} ${selected ? 'sel' : ''} ${s.drag ? (n.kind === 'screenplay' ? `drop-ready ${s.drag.over ? 'drop-over' : ''}` : n.kind === 'toptrends' ? '' : 'dim') : ''}`}
      style={{ left: `${n.x}px`, top: `${n.y}px`, width: `${n.w}px`, height: `${n.h}px` }}
      ref={(el) => { f.el = el; }}
      onContextMenu={(e) => {
        if (ghost || !onContext) return;
        e.preventDefault();
        e.stopPropagation();
        onContext(n, e.clientX, e.clientY);
      }}
    >
      <Shape r={24} className="node-shape" skin="node-skin" ring={ring} breathe={(n.status === 'approval' && !selected) || (dropT && !s.drag?.over)} beam={n.status === 'running'} draw={ghost} onPointerDown={down}>
        <header className="nh">
          <span className="nh-ic"><Icon name={kindIcon[n.kind]} size={16} /></span>
          <span className="nh-t"><b>{n.title}</b><small>{n.sub}</small></span>
          {n.type === 'agent' && !ghost && <StatusMark s={n.status} />}
          {ghost && <span className="status ghosty"><span className="dot" />Draft</span>}
        </header>
        <NodeBody n={n} s={s} onOpen={(tab) => set({ selected: n.id, tab: tab ?? null })} />
        {!ghost && <span className="resize" onPointerDown={resize} aria-hidden="true" />}
      </Shape>
      {partner && !selected && <span className="partner-tag">Wendy</span>}
    </div>
  );
}

// ── the partner's cursor: drifts between nodes on an arc ──────────────
function Partner({ on }: { on: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on) return;
    let pos = { x: get().partner.x, y: get().partner.y }, raf = 0, timer = 0, alive = true;
    const hop = () => {
      const s = get();
      const pool = s.nodes.filter((n) => n.id !== s.partner.on);
      const n = pool[Math.floor(Math.random() * pool.length)];
      if (!n) { timer = window.setTimeout(hop, 3000); return; }
      const to = { x: n.x + n.w * (0.35 + Math.random() * 0.4), y: n.y + 40 + Math.random() * (n.h - 60) };
      const from = { ...pos };
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - Math.min(160, Math.hypot(to.x - from.x, to.y - from.y) * 0.25) };
      const dur = 1100 + Math.hypot(to.x - from.x, to.y - from.y) * 0.4;
      const t0 = performance.now();
      set((st) => ({ partner: { ...st.partner, on: null } }));
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, u = 1 - e;
        pos = { x: u * u * from.x + 2 * u * e * mid.x + e * e * to.x, y: u * u * from.y + 2 * u * e * mid.y + e * e * to.y };
        if (el.current) el.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        if (t < 1 && alive) raf = requestAnimationFrame(frame);
        else if (alive) {
          set({ partner: { x: pos.x, y: pos.y, on: Math.random() < 0.6 ? n.id : null } });
          timer = window.setTimeout(hop, 4200 + Math.random() * 3800);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    if (el.current) el.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    timer = window.setTimeout(hop, 1800);
    return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [on]);
  if (!on) return null;
  return (
    <div className="cursor" ref={el} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 1.5 15.5 8 9 9.5 6.5 16z" /></svg>
      <span>Wendy</span>
    </div>
  );
}

// ── an empty workspace: pick a starting pipeline ───────────────────────
function Starter() {
  return (
    <div className="starter" onPointerDown={(e) => e.stopPropagation()}>
      <Shape r={28} className="starter-shape" skin="glass regular starter-skin">
        <b className="rise">Start this workspace</b>
        <p className="rise prose" style={{ animationDelay: '30ms' }}>Pick a pipeline to begin from, or describe one to the Architect below.</p>
        <div className="rise" style={{ animationDelay: '60ms' }}>
          <Tiles cols={3} value={[]} onChange={(v) => startFrom(v[0] as never)} options={[
            { id: 'explainer', label: 'Explainer', hint: '16:9 + 9:16, 7 agents', icon: <Icon name="animation" size={18} /> },
            { id: 'shorts', label: 'Shorts', hint: '9:16 daily, 5 agents', icon: <Icon name="voice" size={18} /> },
            { id: 'blank', label: 'Blank', hint: 'Build it with the Architect', icon: <Icon name="sparkle" size={18} /> },
          ]} />
        </div>
      </Shape>
    </div>
  );
}

// ── the board ──────────────────────────────────────────────────────────
export function fitCam(nodes: BoardNode[], w: number, h: number, inset: { l: number; r: number; t: number; b: number }): Cam {
  if (!nodes.length) return { x: inset.l + (w - inset.l - inset.r) / 2, y: inset.t + (h - inset.t - inset.b) / 2, z: 1 };
  const x0 = Math.min(...nodes.map((n) => n.x)), y0 = Math.min(...nodes.map((n) => n.y));
  const x1 = Math.max(...nodes.map((n) => n.x + n.w)), y1 = Math.max(...nodes.map((n) => n.y + n.h));
  const aw = w - inset.l - inset.r, ah = h - inset.t - inset.b;
  const z = clamp(Math.min(aw / (x1 - x0), ah / (y1 - y0)), 0.3, 1);
  return { z, x: inset.l + (aw - (x1 - x0) * z) / 2 - x0 * z, y: inset.t + (ah - (y1 - y0) * z) / 2 - y0 * z };
}

export let glide: (to: (c: Cam) => Cam, ms?: number) => void = () => {};

export function Board({ preview, drawerW }: { preview: boolean; drawerW: number }) {
  const s = useStudio();
  const root = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, z: 0.6 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const [panning, setPanning] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ node: BoardNode; x: number; y: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [ctxMenu]);
  const inset = preview ? { l: 40, r: 40, t: 40, b: 40 } : { l: 268, r: 32, t: 84, b: 120 };

  const fit = () => {
    const r = root.current!.getBoundingClientRect();
    return fitCam(get().nodes, r.width, r.height, inset);
  };
  useLayoutEffect(() => { setCam(fit()); }, [s.ws]);
  // a starter pipeline just landed on an empty board: glide to it
  const count = useRef(s.nodes.length);
  useEffect(() => {
    if (count.current === 0 && s.nodes.length > 1) glide(() => fit(), 700);
    count.current = s.nodes.length;
  }, [s.nodes.length]);

  useEffect(() => {
    let raf = 0;
    glide = (to, ms = 650) => {
      cancelAnimationFrame(raf);
      const from = camRef.current, target = to(from), t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e });
        if (t < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    const el = root.current!;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.drawer, .architect, .nav, .overlay-scroll')) return;
      e.preventDefault();
      const c = camRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        const z = clamp(c.z * Math.exp(-e.deltaY * 0.01), 0.25, 1.8);
        setCam({ z, x: px - ((px - c.x) / c.z) * z, y: py - ((py - c.y) / c.z) * z });
      } else setCam({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea')) set({ selected: null }); };
    window.addEventListener('keydown', key);
    return () => { el.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key); };
  }, []);

  // keep the selected node clear of the drawer
  useEffect(() => {
    const n = s.nodes.find((x) => x.id === s.selected);
    if (!n || preview) return;
    const r = root.current!.getBoundingClientRect();
    const c = camRef.current, right = (n.x + n.w) * c.z + c.x, limit = r.width - drawerW - 40;
    const left = n.x * c.z + c.x;
    if (right > limit || left < inset.l) glide((cc) => ({ ...cc, x: cc.x + (limit - right) - Math.max(0, inset.l - (left + limit - right)) }), 520);
  }, [s.selected]);

  const panDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, ...camRef.current };
    let moved = false, nx = start.x, ny = start.y, rafId = 0;
    const flushPan = () => {
      rafId = 0;
      if (worldRef.current) worldRef.current.style.transform = `translate3d(${nx}px, ${ny}px, 0) scale(${start.z})`;
      if (root.current) root.current.style.backgroundPosition = `${nx}px ${ny}px`;
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < 4) return;
      if (!moved) { moved = true; setPanning(true); }
      nx = start.x + ev.clientX - start.px;
      ny = start.y + ev.clientY - start.py;
      if (!rafId) rafId = requestAnimationFrame(flushPan);
    };
    const up = () => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      if (rafId) cancelAnimationFrame(rafId);
      setPanning(false);
      if (!moved) set({ selected: null });
      else setCam({ z: start.z, x: nx, y: ny });
    };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
  };

  const zoomBy = (k: number) => {
    const r = root.current!.getBoundingClientRect(), px = r.width / 2, py = r.height / 2;
    glide((c) => { const z = clamp(c.z * k, 0.25, 1.8); return { z, x: px - ((px - c.x) / c.z) * z, y: py - ((py - c.y) / c.z) * z }; }, 260);
  };
  const g = 24 * cam.z;
  const running = s.nodes.filter((n) => n.status === 'running').length;
  const waiting = s.nodes.filter((n) => n.status === 'approval').length;

  return (
    <div className={`board ${panning ? 'panning' : ''}`} ref={root} onPointerDown={panDown}
      style={{ backgroundSize: `${g}px ${g}px`, backgroundPosition: `${cam.x}px ${cam.y}px` }}>
      <div className="ws-layer" key={s.ws}>
      <div className="world" ref={worldRef} style={{ transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.z})`, '--z': cam.z } as never}>
        <Edges s={s} />
        {s.nodes.map((n) => <NodeView key={n.id} n={n} s={s} cam={cam} onContext={(node, x, y) => setCtxMenu({ node, x, y })} />)}
        {s.ghost && <NodeView key={s.ghost.id} n={s.ghost} s={s} cam={cam} ghost />}
        <Partner on={s.prefs.cursors && s.nodes.length > 0} />
      </div>
      </div>
      {ctxMenu && (
        <div
          className="ctx-menu glass thick"
          style={{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="ctx-id mono">{componentCode(ctxMenu.node)}</div>
          <button type="button" className="ctx-item" onClick={() => {
            const code = componentCode(ctxMenu.node);
            navigator.clipboard?.writeText(code).catch(() => {});
            setCopiedId(code);
            setTimeout(() => setCopiedId(null), 1200);
            setCtxMenu(null);
          }}>
            <Icon name="copy" size={14} /><span>{copiedId === componentCode(ctxMenu.node) ? 'Copied!' : 'Copy component ID'}</span>
          </button>
          <button type="button" className="ctx-item" onClick={() => { set({ selected: ctxMenu.node.id }); setCtxMenu(null); }}>
            <Icon name="settings" size={14} /><span>Inspect</span>
          </button>
          <button type="button" className="ctx-item" onClick={() => {
            const code = componentCode(ctxMenu.node);
            set({ view: 'architect', selected: null, architectPrefill: `Edit component ${code} (${ctxMenu.node.title}): ` });
            setCtxMenu(null);
          }}>
            <Icon name="sparkle" size={14} /><span>Edit with Architect</span>
          </button>
          <button type="button" className="ctx-item" onClick={() => { duplicateNode(ctxMenu.node.id); setCtxMenu(null); }}>
            <Icon name="plus" size={14} /><span>Duplicate</span>
          </button>
          <button type="button" className="ctx-item danger" onClick={() => { deleteNode(ctxMenu.node.id); setCtxMenu(null); }}>
            <Icon name="close" size={14} /><span>Delete</span>
          </button>
        </div>
      )}
      {!preview && !s.nodes.length && !s.ghost && !s.blank.includes(s.ws) && <Starter key={`st-${s.ws}`} />}
      {!preview && (
        <>
          <div className="board-top" onPointerDown={(e) => e.stopPropagation()}>
            <div className="board-title">
              <b>{s.workspaces.find((w) => w.id === s.ws)?.name}</b>
              <span>{!s.nodes.length ? 'Empty workspace' : running ? `${running} running` : 'All quiet'}{waiting ? ` · ${waiting} waiting for you` : ''}</span>
            </div>
            <div className="board-actions">
              <div className="faces"><span className="face you">A</span><span className="face wendy">W</span></div>
              {s.nodes.some((n) => n.id === 'trend') && <Button kind="primary" icon="play" onClick={() => { if (get().nodes.find((n) => n.id === 'trend')?.status === 'idle') runTrend(); }}>Run scout</Button>}
            </div>
          </div>
          <div className="zoom glass thin" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="zbtn" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out"><Icon name="minus" size={16} /></button>
            <span className="znum num">{Math.round(cam.z * 100)}%</span>
            <button type="button" className="zbtn" onClick={() => zoomBy(1.2)} aria-label="Zoom in"><Icon name="plus" size={16} /></button>
            <button type="button" className="zbtn" onClick={() => glide(() => fit())} aria-label="Fit board"><Icon name="fit" size={16} /></button>
          </div>
        </>
      )}
    </div>
  );
}

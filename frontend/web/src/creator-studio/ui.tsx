/** Shared controls. Buttons and tiles follow Athas (flat fills, small radius); motion follows Ultra Reactivate. */
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { smoothRect } from './corners';
import { Icon } from './icons';
import type { Status } from './store';

// ── Shape: a continuous-corner surface ──────────────────────────────────
/** The clip, the ring and the beam all share one path, so light follows the real edge. */
export function Shape(p: {
  r?: number; className?: string; skin?: string; style?: CSSProperties; children?: ReactNode;
  ring?: string | null; beam?: boolean; breathe?: boolean; draw?: boolean;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void; onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void; elRef?: (el: HTMLDivElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    setBox({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);
  const r = p.r ?? 22;
  const d = box.w ? smoothRect(box.w, box.h, r) : '';
  const ringD = box.w ? smoothRect(box.w, box.h, r, 0.6, 0.75) : '';
  return (
    <div ref={(el) => { (ref as { current: HTMLDivElement | null }).current = el; p.elRef?.(el); }} className={`shape ${p.className ?? ''}`} style={p.style} onPointerDown={p.onPointerDown} onClick={p.onClick}>
      <div className={`skin ${p.skin ?? ''}`} style={d ? { clipPath: `path('${d}')` } : { borderRadius: `${r}px` }}>{p.children}</div>
      {d && (
        <svg className="edge-svg" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
          <path className="rim" d={ringD} />
          {p.draw && <path className="draw" d={ringD} pathLength={100} />}
          {p.ring && <path className={`ring ${p.breathe ? 'breathe' : ''}`} d={ringD} style={{ stroke: p.ring }} />}
          {p.beam && (
            <g className="beam">
              <path className="beam-glow" d={ringD} pathLength={100} />
              <path className="beam-tail" d={ringD} pathLength={100} />
              <path className="beam-head" d={ringD} pathLength={100} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

// ── Button ──────────────────────────────────────────────────────────────
export function Button(p: {
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber'; size?: 'sm' | 'md'; icon?: string; children?: ReactNode;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void; busy?: boolean; done?: boolean; disabled?: boolean; className?: string; title?: string; wide?: boolean;
}) {
  const [pulse, setPulse] = useState(0);
  const was = useRef(p.done);
  useEffect(() => { if (p.done && !was.current) setPulse((n) => n + 1); was.current = p.done; }, [p.done]);
  return (
    <button
      type="button" title={p.title} disabled={p.disabled}
      className={`btn ${p.kind ?? 'secondary'} ${p.size ?? 'md'} ${p.wide ? 'wide' : ''} ${pulse ? `pulse${pulse % 2}` : ''} ${p.className ?? ''}`}
      onClick={p.onClick} onPointerDown={(e) => e.stopPropagation()}
    >
      {(p.icon || p.busy || p.done) && (
        <span className="btn-ic">
          <span className={`swap ${p.busy || p.done ? 'off' : ''}`}>{p.icon && <Icon name={p.icon} size={p.size === 'sm' ? 15 : 16} />}</span>
          <span className={`swap ${p.busy || p.done ? '' : 'off'}`}><SpinCheck done={!!p.done} size={p.size === 'sm' ? 15 : 16} /></span>
        </span>
      )}
      {p.children && <span className="btn-label">{p.children}</span>}
    </button>
  );
}

/** A spinner whose arc closes and becomes a tick (after Ultra Reactivate's SpinCheck). */
export function SpinCheck({ done, size = 16 }: { done: boolean; size?: number }) {
  return (
    <svg className={`spincheck ${done ? 'done' : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle className="sc-arc" cx="12" cy="12" r="8" pathLength={100} />
      <path className="sc-tick" d="M7 12.5l3.5 3.5L17 9" pathLength={100} />
    </svg>
  );
}

// ── Segmented (Athas tabs, with a measured shared indicator) ─────────────
export function Segmented<T extends string>(p: { value: T; options: { id: T; label: string; icon?: string; count?: number }[]; onChange: (v: T) => void; className?: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [stretch, setStretch] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const el = row.current?.querySelector<HTMLElement>(`[data-id="${p.value}"]`);
      if (el) setInd((old) => { if (old && old.x !== el.offsetLeft) setStretch((n) => n + 1); return { x: el.offsetLeft, w: el.offsetWidth }; });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row.current!);
    return () => ro.disconnect();
  }, [p.value, p.options.length]);
  return (
    <div className={`seg ${p.className ?? ''}`} ref={row} role="tablist">
      {ind && <span className={`seg-ind st${stretch % 2}`} style={{ transform: `translateX(${ind.x}px)`, width: `${ind.w}px` }} />}
      {p.options.map((o) => (
        <button type="button" role="tab" aria-selected={o.id === p.value} data-id={o.id} className={`seg-item ${o.id === p.value ? 'on' : ''}`} onClick={() => p.onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
          {o.count ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── Select (dropdown from its trigger, 0.95 → 1, rows 30ms apart) ────────
export function Select(p: { value: string; options: { id: string; label: string; hint?: string }[]; onChange: (v: string) => void; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = () => { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 160); };
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const cur = p.options.find((o) => o.id === p.value);
  return (
    <div className="select" ref={root}>
      <button type="button" className={`select-trigger ${open && !closing ? 'open' : ''}`} onClick={() => (open ? close() : setOpen(true))}>
        <span>{cur?.label}</span>
        <Icon name="chevron" size={15} className="chev" />
      </button>
      {open && (
        <div className={`menu ${p.up ? 'up' : ''} ${closing ? 'closing' : ''}`} role="listbox">
          {p.options.map((o, i) => (
            <button type="button" role="option" aria-selected={o.id === p.value} className={`menu-row ${o.id === p.value ? 'on' : ''}`} style={{ animationDelay: `${40 + i * 30}ms` }} onClick={() => { p.onChange(o.id); close(); }}>
              <span className="menu-label">{o.label}{o.hint && <small>{o.hint}</small>}</span>
              {o.id === p.value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toggle (knob stretches 12% as it travels, lands with a squash) ───────
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const [n, setN] = useState(0);
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''} m${n % 2} ${n ? 'moved' : ''}`} onClick={() => { setN((x) => x + 1); onChange(!on); }}>
      <span className="knob" />
    </button>
  );
}

// ── Tiles: square multi/single selectors (Athas) ─────────────────────────
export function Tiles(p: { options: { id: string; label: string; icon?: ReactNode; hint?: string }[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; cols?: number; small?: boolean }) {
  return (
    <div className={`tiles ${p.small ? 'small' : ''}`} style={{ gridTemplateColumns: `repeat(${p.cols ?? p.options.length}, minmax(0, 1fr))` }}>
      {p.options.map((o) => {
        const on = p.value.includes(o.id);
        return (
          <button type="button" aria-pressed={on} className={`tile ${on ? 'on' : ''}`} onClick={() => p.onChange(p.multi ? (on ? p.value.filter((v) => v !== o.id) : [...p.value, o.id]) : [o.id])}>
            {o.icon && <span className="tile-ic">{o.icon}</span>}
            <span className="tile-label">{o.label}</span>
            {o.hint && <span className="tile-hint">{o.hint}</span>}
            {p.multi && <span className="tile-check"><Icon name="check" size={11} /></span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Status: a dot and a word ─────────────────────────────────────────────
export const statusLabel: Record<Status, string> = { idle: 'Idle', running: 'Running', approval: 'Needs approval', failed: 'Failed' };
export function StatusMark({ s }: { s: Status }) {
  return (
    <span className={`status ${s}`}>
      <span className="dot" />
      <Swap k={s}>{statusLabel[s]}</Swap>
    </span>
  );
}

/** Overlap swap: the old content leaves (190ms) while the new arrives (240ms) in the same cell. */
export function Swap({ k, children, className: cls }: { k: string | number; children: ReactNode; className?: string }) {
  const [gone, setGone] = useState<{ k: string | number; children: ReactNode }[]>([]);
  const cur = useRef({ k, children });
  const first = useRef(true);
  useEffect(() => {
    if (cur.current.k !== k) {
      const old = cur.current;
      setGone((g) => [...g.filter((x) => x.k !== k), old]);
      setTimeout(() => setGone((g) => g.filter((x) => x !== old)), 200);
      first.current = false;
    }
    cur.current = { k, children };
  });
  return (
    <span className={`swapcell ${cls ?? ''}`}>
      {gone.filter((g) => g.k !== k).map((c) => <span key={c.k} className="ov-out">{c.children}</span>)}
      <span key={k} className={first.current ? '' : 'ov-in'}>{children}</span>
    </span>
  );
}

export function Field(p: { label?: string; value: string; onChange?: (v: string) => void; area?: boolean; rows?: number; mono?: boolean; placeholder?: string; count?: number; readOnly?: boolean }) {
  return (
    <label className="field">
      {p.label && <span className="field-label">{p.label}{p.count ? <span className="field-count">{p.value.length}/{p.count}</span> : null}</span>}
      {p.area ? (
        <textarea className={`input ${p.mono ? 'mono' : ''}`} value={p.value} rows={p.rows} placeholder={p.placeholder} readOnly={p.readOnly}
          onChange={(e) => p.onChange?.(e.target.value)} />
      ) : (
        <input className={`input ${p.mono ? 'mono' : ''}`} value={p.value} placeholder={p.placeholder} readOnly={p.readOnly}
          onChange={(e) => p.onChange?.(e.target.value)} />
      )}
    </label>
  );
}

/** History tabs: every script, voiceover, animation and published video, newest first. */
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Brand, Icon } from './icons';
import { Frame, waveFor } from './nodes';
import type { Production, State } from './store';
import { Segmented, Swap } from './ui';

const byDate = (s: State) => [...s.history].sort((a, b) => b.t - a.t);
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n) % 60).padStart(2, '0')}`;
const brands: Record<string, string> = { yt: 'siYoutube', shorts: 'siYoutubeshorts', tiktok: 'siTiktok', reels: 'siInstagram' };
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

/** A row that unfolds. The fold opens first; its contents settle 80ms later (Overlap). */
function Disclosure({ head, children, i, open, onToggle }: { head: ReactNode; children: ReactNode; i: number; open: boolean; onToggle: () => void }) {
  return (
    <div className={`disc ${open ? 'open' : ''}`} style={{ animationDelay: `${60 + i * 30}ms` }}>
      <button type="button" className="disc-head" aria-expanded={open} onClick={onToggle}>
        {head}
        <Icon name="chevron" size={15} className="disc-chev" />
      </button>
      <div className="disc-fold"><div className="disc-inner">{open && <div className="disc-body">{children}</div>}</div></div>
    </div>
  );
}

function useOne() {
  const [open, setOpen] = useState<string | null>(null);
  return { open, toggle: (k: string) => setOpen((o) => (o === k ? null : k)) };
}

const outcome = (h: Production) =>
  h.script === 'rejected' ? <span className="hmark coral">Rejected</span>
  : h.video === 'published' ? <span className="hmark mint">Published</span>
  : h.video === 'ready' ? <span className="hmark amber">Awaiting sign-off</span>
  : h.video === 'scheduled' ? <span className="hmark ice">Scheduled</span>
  : <span className="hmark">In production</span>;

export function ScriptHistory({ s }: { s: State }) {
  const { open, toggle } = useOne();
  const list = byDate(s);
  return (
    <div className="hist">
      <p className="prose dim hist-note">{list.length} scripts, newest first.</p>
      {list.map((h, i) => (
        <Disclosure i={i} open={open === h.vid + h.topic} onToggle={() => toggle(h.vid + h.topic)} head={
          <span className="hh">
            <span className="hh-t"><b>{h.title}</b><small>{h.date} · {h.scenes.length} scenes · {h.secs} s</small></span>
            {outcome(h)}
          </span>
        }>
          <p className="hook big">“{h.hook}”</p>
          {(() => { let acc = 0; return h.scenes.map((sc) => { const st = acc; acc += sc.secs; return (
            <div className="hscene">
              <span className="num dim">{clock(st)}</span>
              <div><p>{sc.narration}</p><small><span className={`swatch p-${sc.primitive}`} />{sc.visual}</small></div>
            </div>
          ); }); })()}
        </Disclosure>
      ))}
    </div>
  );
}

/** Plays a take: the waveform fills and the transcript lights word by word. */
function Take({ h }: { h: Production }) {
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const f = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setP((x) => { const n = x + dt / h.secs; if (n >= 1) { setPlaying(false); return 1; } return n; });
      raf.current = requestAnimationFrame(f);
    };
    raf.current = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  const words = h.scenes.map((x) => x.narration).join(' ').split(' ');
  const at = Math.floor(p * words.length);
  const wave = waveFor(h.t, 64);
  return (
    <div className="take">
      <div className="take-row">
        <button type="button" className="iconbtn solid" aria-label={playing ? 'Pause' : 'Play'} onClick={() => { if (p >= 1) setP(0); setPlaying(!playing); }}>
          <Swap k={playing ? 'p' : 'l'}><Icon name={playing ? 'pause' : 'play'} size={15} /></Swap>
        </button>
        <div className="take-wave" onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setP(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
          {wave.map((v, i) => <span className={i / wave.length < p ? 'on' : ''} style={{ height: `${v * 100}%` }} />)}
        </div>
        <span className="num dim">{clock(p * h.secs)} / {clock(h.secs)}</span>
      </div>
      <p className="transcript">{words.map((w, i) => <span className={i < at ? 'said' : i === at && p > 0 ? 'now' : ''}>{w} </span>)}</p>
    </div>
  );
}

export function VoiceHistory({ s }: { s: State }) {
  const { open, toggle } = useOne();
  const list = byDate(s).filter((h) => h.script === 'approved' && h.video !== 'none');
  return (
    <div className="hist">
      <p className="prose dim hist-note">{list.length} voiceovers, newest first.</p>
      {list.map((h, i) => (
        <Disclosure i={i} open={open === h.vid} onToggle={() => toggle(h.vid)} head={
          <span className="hh">
            <span className="num vid">{h.vid}</span>
            <span className="hh-t"><b>{h.title}</b><small>{h.date} · {h.voice}</small></span>
            <span className="num dim">{clock(h.secs)}</span>
          </span>
        }>
          <Take h={h} />
        </Disclosure>
      ))}
    </div>
  );
}

/** Cards that expand into a playing video. The grid re-flows with a FLIP so every card glides to its new place. */
export function AnimationHistory({ s }: { s: State }) {
  const list = byDate(s).filter((h) => ['rendered', 'ready', 'scheduled', 'published'].includes(h.video));
  const [open, setOpen] = useState<string | null>(null);
  const [fmt, setFmt] = useState<'wide' | 'tall'>('wide');
  const grid = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, DOMRect>());
  const toggle = (vid: string) => {
    grid.current?.querySelectorAll<HTMLElement>('[data-vid]').forEach((el) => before.current.set(el.dataset.vid!, el.getBoundingClientRect()));
    setOpen((o) => (o === vid ? null : vid));
    setFmt('wide');
  };
  useLayoutEffect(() => {
    grid.current?.querySelectorAll<HTMLElement>('[data-vid]').forEach((el) => {
      const a = before.current.get(el.dataset.vid!);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy && a.width === b.width) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)`, width: `${a.width}px` }, { transform: 'none', width: `${b.width}px` }], { duration: 320, easing: 'cubic-bezier(.65,0,.35,1)' });
    });
    before.current.clear();
  }, [open]);
  return (
    <div className="hist">
      <p className="prose dim hist-note">{list.length} animations. Click one to play it.</p>
      <div className="agrid" ref={grid}>
        {list.map((h, i) => {
          const on = open === h.vid;
          return (
            <div data-vid={h.vid} className={`acard ${on ? 'on' : ''}`} style={{ animationDelay: `${60 + i * 30}ms` }}>
              <button type="button" className="acard-hit" onClick={() => toggle(h.vid)} aria-expanded={on}>
                <div className={`acard-media ${on && fmt === 'tall' ? 'tall' : ''}`}>
                  <Frame key={`${h.vid}-${on}-${fmt}`} hue={h.hue} title={h.title} small={!on} tall={on && fmt === 'tall'} playing={on} />
                  {!on && <span className="acard-play"><Icon name="play" size={14} /></span>}
                </div>
                <span className="acard-t"><span className="num dim">{h.vid}</span><b>{h.title}</b></span>
              </button>
              {on && (
                <div className="acard-bar ov-in">
                  <Segmented value={fmt} onChange={setFmt} options={[{ id: 'wide', label: '16:9' }, { id: 'tall', label: '9:16' }]} />
                  <span className="dim">{h.date} · {clock(h.secs)} · 4 scenes</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PublishHistory({ s }: { s: State }) {
  const { open, toggle } = useOne();
  const list = byDate(s).filter((h) => h.video === 'published');
  const total = list.reduce((a, b) => a + b.views, 0);
  return (
    <div className="hist">
      <p className="prose dim hist-note">{list.length} videos published · {fmtK(total)} views.</p>
      {list.map((h, i) => (
        <Disclosure i={i} open={open === h.vid} onToggle={() => toggle(h.vid)} head={
          <span className="hh">
            <span className="hthumb"><Frame hue={h.hue} title={h.title} small /></span>
            <span className="hh-t"><b>{h.title}</b><small><span className="num">{h.vid}</span> · {h.date}</small></span>
            <span className="plats">{h.platforms.map((p) => <Brand name={brands[p]} size={13} />)}</span>
            <span className="num">{fmtK(h.views)}</span>
          </span>
        }>
          <div className="pstats">
            {h.platforms.map((p, j) => {
              const share = [0.52, 0.27, 0.14, 0.07][j] ?? 0.05;
              return (
                <div className="pstat">
                  <span className="pstat-l"><Brand name={brands[p]} size={14} />{{ yt: 'YouTube', shorts: 'Shorts', tiktok: 'TikTok', reels: 'Reels' }[p]}</span>
                  <span className="num">{fmtK(Math.round(h.views * share))} views</span>
                  <div className="pbar"><span style={{ transform: `scaleX(${0.35 + share})` }} /></div>
                  <span className="num dim">{Math.round(38 + share * 60)}% kept</span>
                </div>
              );
            })}
            {!h.platforms.length && <p className="prose dim">Published just now. Stats arrive within the hour.</p>}
          </div>
        </Disclosure>
      ))}
    </div>
  );
}

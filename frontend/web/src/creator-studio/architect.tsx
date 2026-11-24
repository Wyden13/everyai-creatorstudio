/** The Architect: natural language in, a new agent or widget wired onto the board out. All simulated. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { glide } from './board';
import { Icon } from './icons';
import { typeLabel } from './nodes';
import { get, set, useStudio, type BoardNode, type CType, type Kind } from './store';
import { Button, Shape, SpinCheck } from './ui';

const suggestions = [
  { text: 'Track my ElevenLabs credits next to the voiceover', icon: 'credits', type: 'tracker' },
  { text: 'Tell me if an upload to any platform fails', icon: 'pulse', type: 'status' },
  { text: 'Add a research sub-agent that deepens the winning topic', icon: 'research', type: 'agent' },
] as const;

interface Plan { kind: Kind; type: CType; title: string; sub: string; up: string; w: number; h: number; steps: string[] }
const choose = (t: CType) => `Choosing a component: ${typeLabel[t]}`;
function plan(q: string): Plan {
  const t = q.toLowerCase();
  if (/credit|eleven|quota|usage|cost|spend/.test(t)) return { kind: 'credits', type: 'tracker', title: 'ElevenLabs credits', sub: 'Tracker · ElevenLabs', up: 'voice', w: 260, h: 230, steps: ['Reading the board', choose('tracker'), 'create_board_widget', 'Wiring to Voiceover'] };
  if (/fail|status|health|watch|alert|upload/.test(t)) return { kind: 'uploads', type: 'status', title: 'Upload health', sub: 'Status · YouTube, TikTok, Reels', up: 'publisher', w: 280, h: 170, steps: ['Reading the board', choose('status'), 'create_board_widget', 'Wiring to Publisher'] };
  if (/thumb/.test(t)) return { kind: 'thumbs', type: 'agent', title: 'Thumbnail tester', sub: 'Claude Sonnet 4.5 · A/B', up: 'publisher', w: 280, h: 210, steps: ['Reading the board', choose('agent'), 'create_agent_worker', 'Wiring to Publisher'] };
  return { kind: 'research', type: 'agent', title: /research|deep|source/.test(t) ? 'Deep research' : q.split(' ').slice(0, 3).join(' '), sub: 'Exa + Tavily · sub-agent', up: 'trend', w: 280, h: 200, steps: ['Reading the board', choose('agent'), 'create_agent_worker', 'Wiring to Trend Scout'] };
}

/** Upstream by kind, so the Architect works in any workspace. Empty board: start at the origin. */
const upstream = (p: Plan) => get().nodes.find((n) => n.kind === p.up) ?? null;
function place(p: Plan): { x: number; y: number } {
  const nodes = get().nodes, u = upstream(p);
  if (!u) return { x: 0, y: 0 };
  const hits = (x: number, y: number) => nodes.some((n) => x < n.x + n.w + 40 && x + p.w + 40 > n.x && y < n.y + n.h + 40 && y + p.h + 40 > n.y);
  const c = [{ x: u.x, y: u.y + u.h + 90 }, { x: u.x, y: u.y - p.h - 90 }, { x: u.x + 40, y: u.y + u.h + 300 }, { x: u.x, y: u.y + u.h + 520 }];
  return c.find((q) => !hits(q.x, q.y)) ?? c[c.length - 1];
}

type Phase = 'idle' | 'building' | 'ready';

export function Architect({ drawerW }: { drawerW: number }) {
  const s = useStudio();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const [doneN, setDoneN] = useState(0);
  const [p, setP] = useState<Plan | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea');
      if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); }
      if (e.key === 'Escape' && phase === 'idle') input.current?.blur();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const go = (text: string) => {
    if (!text.trim()) return;
    input.current?.blur();
    const pl = plan(text);
    const at = place(pl);
    const ghost: BoardNode = { id: `a${Date.now()}`, kind: pl.kind, title: pl.title, sub: pl.sub, x: at.x, y: at.y, w: pl.w, h: pl.h, status: 'idle', progress: 0, note: upstream(pl)?.id ?? '', type: pl.type, widget: pl.type === 'tracker' || pl.type === 'aggregator' };
    if (!upstream(pl)) pl.steps = [...pl.steps.slice(0, 3), 'Placing it on the board'];
    setP(pl); setSteps(pl.steps); setDoneN(0); setPhase('building'); setQ(text);
    set({ ghost, ghostStage: 0, selected: null });
    // bring the draft into view
    const board = document.querySelector('.board')!.getBoundingClientRect();
    glide((c) => {
      const cx = (at.x + pl.w / 2) * c.z + c.x, cy = (at.y + pl.h / 2) * c.z + c.y;
      const tx = Math.min(Math.max(cx, 300), board.width - 80 - pl.w * c.z / 2), ty = Math.min(Math.max(cy, 140), board.height - 200 - pl.h * c.z / 2);
      return { ...c, x: c.x + (tx - cx), y: c.y + (ty - cy) };
    });
    pl.steps.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => {
        setDoneN(i + 1);
        set({ ghostStage: i + 1 });
        if (i === pl.steps.length - 1) setPhase('ready');
      }, 900 + i * 850));
    });
  };

  const discard = () => { set({ ghost: null, ghostStage: 0 }); setPhase('idle'); setQ(''); setP(null); };
  const add = () => {
    const g = get().ghost;
    if (!g || !p) return;
    set((st) => ({ nodes: [...st.nodes, { ...g, note: g.type === 'agent' ? 'New · never run' : g.type === 'status' ? 'Watching 3 platforms' : '' }], edges: g.note ? [...st.edges, { from: g.note, to: g.id }] : st.edges, ghost: null, ghostStage: 0 }));
    requestAnimationFrame(() => {
      const el = document.querySelector(`.node[data-id="${g.id}"]`);
      el?.classList.add('born');
      setTimeout(() => el?.classList.remove('born'), 900);
    });
    setPhase('idle'); setQ(''); setP(null);
  };

  const open = focus && phase === 'idle';
  return (
    <div class={`architect ${phase} ${open ? 'open' : ''}`} style={{ '--dw': `${s.selected ? drawerW : 0}px` } as never} onPointerDown={(e) => e.stopPropagation()}>
      {open && (
        <Shape r={22} class="arch-sugg" skin="glass regular">
          <div class="sugg-label">Try</div>
          {suggestions.map((x, i) => (
            <button type="button" class="sugg" style={{ animationDelay: `${60 + i * 30}ms` }} onPointerDown={(e) => { e.preventDefault(); go(x.text); }}>
              <Icon name={x.icon} size={16} /><span class="grow">{x.text}</span><span class="sugg-type">{typeLabel[x.type]}</span>
            </button>
          ))}
        </Shape>
      )}
      <Shape r={22} class="arch-bar" skin="glass regular" ring={focus || phase !== 'idle' ? 'var(--violet)' : null} beam={phase === 'building'}>
        {phase === 'idle' && (
          <form class="arch-form" onSubmit={(e) => { e.preventDefault(); go(q); }}>
            <Icon name="sparkle" size={18} class="arch-spark" />
            <input ref={input} value={q} placeholder="Ask the Architect to add an agent or widget…" onInput={(e) => setQ((e.target as HTMLInputElement).value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
            {q ? <Button kind="primary" size="sm" icon="send" onClick={() => go(q)}>Build</Button> : <kbd>/</kbd>}
          </form>
        )}
        {phase !== 'idle' && p && (
          <div class="arch-work">
            <div class="arch-q"><Icon name="sparkle" size={16} class="arch-spark" /><span>{q}</span></div>
            <ol class="arch-steps">
              {steps.map((st, i) => (
                <li class={i < doneN ? 'done' : i === doneN ? 'now' : ''} style={{ animationDelay: `${i * 30}ms` }}>
                  <span class="st-ic">{i <= doneN ? <SpinCheck done={i < doneN} size={14} /> : <span class="st-dot" />}</span>
                  <span class={st.includes('_') ? 'mono' : ''}>{st}</span>
                </li>
              ))}
            </ol>
            {phase === 'ready' && (
              <div class="arch-ready">
                <span><b>{p.title}</b> is ready. {p.type === 'agent' ? 'It will run on the server once approved.' : `A ${typeLabel[p.type].toLowerCase()} component. It reads from the org key vault, so an Admin approves it first.`}</span>
                <div class="nacts">
                  <Button onClick={discard}>Discard</Button>
                  <Button kind="primary" icon="check" onClick={add}>Approve and add</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Shape>
    </div>
  );
}

/** Drag a trend out of the aggregator and drop it on Screenplay. The chip follows the pointer 1:1, leans into its travel,
 *  shrinks into the node on a drop, and flies home if dropped anywhere else. */
import { Icon } from './icons';
import { dropTopic, get, set, useStudio } from './store';

const target = () => {
  const s = get();
  const sp = s.nodes.find((n) => n.kind === 'screenplay');
  return sp ? document.querySelector<HTMLElement>(`.node[data-id="${sp.id}"]`) : null;
};

export function startTopicDrag(e: PointerEvent, topic: string) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const row = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const root = (e.currentTarget as HTMLElement).closest('.cs')!.getBoundingClientRect();
  const off = { x: e.clientX - row.left, y: e.clientY - row.top };
  const home = { x: row.left - root.left, y: row.top - root.top };
  const start = { x: e.clientX, y: e.clientY };
  let started = false, lastX = e.clientX, lean = 0;
  const move = (ev: PointerEvent) => {
    if (!started && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
    started = true;
    lean = lean * 0.6 + Math.max(-6, Math.min(6, (ev.clientX - lastX) * 0.35)) * 0.4;
    lastX = ev.clientX;
    const t = target()?.getBoundingClientRect();
    const over = !!t && ev.clientX > t.left && ev.clientX < t.right && ev.clientY > t.top && ev.clientY < t.bottom;
    set({ drag: { topic, x: ev.clientX - root.left - off.x, y: ev.clientY - root.top - off.y, w: Math.min(row.width, 300), lean, over, phase: 'drag' } });
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const d = get().drag;
    if (!started || !d) { set({ drag: null }); return; }
    const t = target();
    if (d.over && t) {
      const r = t.getBoundingClientRect();
      set({ drag: { ...d, phase: 'drop', lean: 0, x: r.left - root.left + r.width / 2 - d.w / 2, y: r.top - root.top + r.height / 2 - 20 } });
      setTimeout(() => { set({ drag: null }); dropTopic(topic, get().nodes.find((n) => n.kind === 'screenplay')!.id); }, 240);
    } else {
      set({ drag: { ...d, phase: 'return', lean: 0, x: home.x, y: home.y } });
      setTimeout(() => set({ drag: null }), 200);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/** The floating chip. Lives above everything while a topic is in the air. */
export function TopicChip() {
  const { drag } = useStudio();
  if (!drag) return null;
  const v = get().topics.find((t) => t.name === drag.topic)?.velocity ?? 0;
  return (
    <div class={`topic-chip ${drag.phase} ${drag.over ? 'over' : ''}`} style={{ width: `${drag.w}px`, transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.lean}deg)` }}>
      <Icon name="trend" size={15} />
      <span class="tname">{drag.topic}</span>
      <span class="num">{v.toFixed(2)}</span>
    </div>
  );
}

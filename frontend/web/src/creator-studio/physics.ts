/** Springs, rubber band and a self-stopping loop. Trimmed from Wubble's core/physics.ts. */
export interface Spring { x: number; v: number }
export const spring = (x = 0): Spring => ({ x, v: 0 });
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const band = (d: number, k: number) => Math.sign(d) * k * (1 - 1 / (Math.abs(d) / k + 1));

/** One semi-implicit Euler step. Returns true while still moving. */
export function step(s: Spring, target: number, k: number, c: number, dt: number): boolean {
  s.v += (-k * (s.x - target) - c * s.v) * dt;
  s.x += s.v * dt;
  if (Math.abs(s.v) < 0.02 && Math.abs(s.x - target) < 0.02) { s.x = target; s.v = 0; return false; }
  return true;
}

export const K = { follow: [300, 15], settle: [380, 30], wobble: [520, 16] } as const;

/** rAF loop that runs only while `frame` returns true. dt capped at 32ms; pauses while hidden. */
export class Loop {
  private raf = 0;
  private last = 0;
  constructor(private frame: (dt: number) => boolean) {}
  kick = () => {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  };
  private tick = (now: number) => {
    const dt = Math.min(0.032, (now - this.last) / 1000);
    this.last = now;
    if (document.hidden) { this.raf = 0; document.addEventListener('visibilitychange', this.kick, { once: true }); return; }
    this.raf = this.frame(dt) ? requestAnimationFrame(this.tick) : 0;
  };
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; document.removeEventListener('visibilitychange', this.kick); }
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stroke icons on a 24 grid, drawn for this idea. */
import type { CSSProperties } from 'react';
import * as si from 'simple-icons';

const P: Record<string, string> = {
  board: 'M4 5.5h6v5H4zM14 13.5h6v5h-6zM10 8h2.5a1.5 1.5 0 0 1 1.5 1.5v6',
  publish: 'M12 15V4.5M7.5 9 12 4.5 16.5 9M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14',
  org: 'M4 20V8l8-4 8 4v12M9 20v-5h6v5M4 20h16',
  settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6ZM12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6',
  trend: 'M4 17l5-5 3.5 3.5L20 8M15 8h5v5',
  screenplay: 'M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5ZM13.5 3.5V8H18M9 12h6M9 15.5h4',
  voice: 'M4 12h1.5M8 8.5v7M11.5 5v14M15 9v6M18.5 11v2',
  animation: 'M5 5.5h14v13H5zM10 9.5v5l4.2-2.5z',
  manim: 'M17 5H7l6 7-6 7h10',
  compiler: 'M12 4 20 8.5l-8 4.5-8-4.5zM4 12.5l8 4.5 8-4.5M4 16.5 12 21l8-4.5',
  publisher: 'M5 12.5 10 17.5 19.5 7',
  credits: 'M4.5 16a7.5 7.5 0 1 1 15 0M12 16l3.5-4.5',
  analytics: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
  research: 'M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM15 15l5 5',
  thumbs: 'M4.5 6h15v12h-15zM4.5 15l4.5-4 3.5 3 2.5-2 4.5 4',
  sparkle: 'M12 3.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5ZM18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15',
  check: 'M5 12.5 10 17.5 19.5 7',
  chevron: 'M7 10l5 5 5-5',
  right: 'M10 7l5 5-5 5',
  play: 'M8 5.5v13L18.5 12z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  stop: 'M7 7h10v10H7z',
  retry: 'M19 12a7 7 0 1 1-2.05-4.95M19 4.5V9h-4.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  copy: 'M8.5 8.5h11v11h-11zM15.5 8.5V4.5h-11v11h4',
  key: 'M14.5 4a5.5 5.5 0 1 1-4.6 8.5L4 18.5V21h3v-2h2v-2h2l1.4-1.4A5.5 5.5 0 0 1 14.5 4ZM16 8.5h.01',
  user: 'M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8v4.5l3 2',
  send: 'M12 19V5M6 11l6-6 6 6',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  bolt: 'M13 3.5 5.5 13.5H12L11 20.5l7.5-10H12z',
  shield: 'M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z',
  card: 'M3.5 6.5h17v11h-17zM3.5 10h17',
  wave: 'M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
  mail: 'M4 6.5h16v11H4zM4 7l8 6 8-6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  pulse: 'M3 12h4l2.5-6 5 12 2.5-6H21',
  coins: 'M12 3.5v17M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.7 4.5 3.2 4.5 1.5 4.5 3.3-2 3-4.5 3-4.5-1.3-4.5-3',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5L19 18H5zM10 20.5h4',
};

export function Icon({ name, size = 18, className: cls, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const thick = name === 'grip' || name === 'more' || name === 'research' || name === 'list' ? 2.2 : 1.7;
  return (
    <svg className={`ic ${cls ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'grip' || name === 'more' ? 3 : thick} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name] ?? P.more} />
    </svg>
  );
}

/** Real brand marks from simple-icons, in currentColor or their own colour. */
export function Brand({ name, size = 18, color }: { name: string; size?: number; color?: boolean }) {
  const icon = (si as unknown as Record<string, { path: string; hex: string }>)[name];
  if (!icon) return <Icon name="bolt" size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color ? `#${icon.hex}` : 'currentColor'} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

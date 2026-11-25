/**
 * Pre-built, layout-safe Theme Widget Library for EveryAI CreatorStudio's two strict themes:
 *   1. "vox"  — Warm parchment editorial motion graphics (real SVG GeoMap coastlines, labeled charts,
 *               yellow highlighter typography, archival paper-cutout frames, safe-zone timeline).
 *   2. "3b1b" — 3Blue1Brown mathematical explainer style (deep slate grid, animated coordinate planes,
 *               vector arrows, curves, color-coded equations, theorem callout cards).
 *
 * All layout components respect CAPTION_SAFE_BOTTOM_PX (140px) so burned-in ASS subtitles never collide.
 */
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type StudioTheme = 'vox' | '3b1b';
export const CAPTION_SAFE_BOTTOM_PX = 140;

// ── VOX THEME WIDGETS ───────────────────────────────────────────────────────

export const VoxBackdrop: React.FC<{
  bg?: string;
  children?: React.ReactNode;
}> = ({ bg = '#F4ECD8', children }) => (
  <AbsoluteFill
    style={{
      background: bg,
      fontFamily: 'Georgia, "Times New Roman", serif',
      color: '#1E1D1B',
      overflow: 'hidden',
    }}
  >
    {/* Subtle editorial halftone paper grain + warm vignette */}
    <AbsoluteFill
      style={{
        opacity: 0.1,
        backgroundImage: 'radial-gradient(#2A241B 1px, transparent 1px)',
        backgroundSize: '5px 5px',
        pointerEvents: 'none',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at center, transparent 62%, rgba(42,32,18,0.12) 100%)',
        pointerEvents: 'none',
      }}
    />
    {children}
  </AbsoluteFill>
);

export const VoxHighlighterHeadline: React.FC<{
  kicker?: string;
  words: readonly string[];
  highlightIndices?: readonly number[];
  accent?: string;
  highlightColor?: string;
  fontSize?: number;
  startFrame?: number;
}> = ({
  kicker,
  words,
  highlightIndices = [],
  accent = '#B8332A',
  highlightColor = '#F5D33A',
  fontSize = 68,
  startFrame = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {kicker && (
        <div
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: 3.5,
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {kicker}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', lineHeight: 1.08 }}>
        {words.map((w, i) => {
          const p = spring({ frame: frame - (startFrame + i * 5), fps, config: { damping: 14, stiffness: 130 } });
          const hi = highlightIndices.includes(i);
          return (
            <span
              key={`${w}-${i}`}
              style={{
                position: 'relative',
                display: 'inline-block',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 900,
                fontSize,
                letterSpacing: -1,
                opacity: Math.min(1, p),
                transform: `translateY(${(1 - Math.min(1, p)) * 28}px)`,
              }}
            >
              {hi && (
                <span
                  style={{
                    position: 'absolute',
                    left: -6,
                    right: -6,
                    bottom: 6,
                    height: '42%',
                    background: highlightColor,
                    transformOrigin: 'left center',
                    transform: `scaleX(${Math.min(1, p)})`,
                    zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, color: hi ? '#1E1D1B' : '#1E1D1B' }}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export interface GeoPin {
  x: number; // 0..1000 SVG map space
  y: number; // 0..600 SVG map space
  label: string;
  sublabel?: string;
}

export interface GeoArrow {
  from: [number, number];
  to: [number, number];
  color?: string;
}

/**
 * Accurate stylized Mediterranean & Europe SVG landmass polygons (1000x600 viewBox)
 * so the LLM never draws a brown oval for Rome / Europe / Carthage / Constantinople.
 */
const MEDITERRANEAN_LANDMASSES = [
  // Iberia + Gaul + Central Europe + Balkans
  'M 60 280 L 110 210 L 185 215 L 220 155 L 275 110 L 365 95 L 470 80 L 580 105 L 680 120 L 760 175 L 710 230 L 660 235 L 620 295 L 580 340 L 545 315 L 525 255 L 470 215 L 420 205 L 365 210 L 320 245 L 255 245 L 200 285 L 145 345 L 70 330 Z',
  // Italian Peninsula (the boot!)
  'M 415 205 L 455 210 L 490 265 L 525 320 L 548 345 L 535 362 L 515 345 L 500 375 L 482 372 L 486 340 L 455 295 L 425 255 Z',
  // Sicily
  'M 455 385 L 495 382 L 482 412 L 452 402 Z',
  // Sardinia & Corsica
  'M 392 285 L 410 285 L 408 320 L 390 318 Z M 388 330 L 412 328 L 410 378 L 386 374 Z',
  // Britain
  'M 215 40 L 255 35 L 272 105 L 225 112 L 205 85 Z',
  // Anatolia / Asia Minor + Levant
  'M 685 245 L 870 235 L 945 275 L 930 345 L 880 355 L 875 435 L 835 450 L 820 360 L 735 350 L 675 310 Z',
  // North Africa (Mauretania -> Carthage -> Libya -> Egypt)
  'M 45 375 L 165 365 L 285 375 L 385 385 L 430 415 L 470 465 L 560 475 L 655 460 L 755 470 L 845 465 L 920 495 L 940 580 L 45 580 Z',
];

export const VoxGeoMap: React.FC<{
  title?: string;
  /** Territory control regions: subset of ['rome', 'italy', 'carthage', 'greece', 'gaul', 'east', 'west'] */
  territories?: readonly string[];
  pins?: readonly GeoPin[];
  arrows?: readonly GeoArrow[];
  splitEastWest?: boolean;
  accent?: string;
  eastAccent?: string;
  focus?: { x: number; y: number; zoom: number };
  width?: number;
  height?: number;
}> = ({
  title,
  territories = ['italy'],
  pins = [],
  arrows = [],
  splitEastWest = false,
  accent = '#B8332A',
  eastAccent = '#6C3FA0',
  focus = { x: 500, y: 300, zoom: 1 },
  width = 860,
  height = 520,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomP = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 80 } });
  const curZoom = interpolate(zoomP, [0, 1], [1, focus.zoom], { extrapolateRight: 'clamp' });
  const tx = (500 - focus.x) * (curZoom - 1);
  const ty = (300 - focus.y) * (curZoom - 1);

  const TERRITORY_SHAPES: Record<string, { d: string; color: string }> = {
    rome: { d: 'M 435 255 L 468 265 L 475 298 L 442 295 Z', color: accent },
    italy: { d: 'M 415 205 L 455 210 L 490 265 L 525 320 L 548 345 L 535 362 L 500 375 L 482 372 L 455 295 L 425 255 Z', color: accent },
    carthage: { d: 'M 330 385 L 430 410 L 455 460 L 350 455 Z', color: accent },
    gaul: { d: 'M 225 155 L 360 140 L 380 225 L 255 245 Z', color: accent },
    greece: { d: 'M 545 250 L 635 245 L 620 335 L 555 325 Z', color: splitEastWest ? eastAccent : accent },
    west: { d: 'M 105 215 L 220 155 L 380 140 L 465 215 L 525 345 L 435 425 L 145 380 L 75 325 Z', color: accent },
    east: { d: 'M 555 235 L 685 240 L 885 240 L 895 455 L 700 475 L 555 340 Z', color: splitEastWest ? eastAccent : accent },
  };

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        background: '#1E2A36',
        border: '2px solid rgba(30,29,27,0.18)',
        boxShadow: '0 22px 48px rgba(24,18,12,0.22)',
      }}
    >
      <svg width={width} height={height} viewBox="0 0 1000 600" style={{ display: 'block' }}>
        <g transform={`translate(${tx}, ${ty}) scale(${curZoom})`} style={{ transformOrigin: '500px 300px' }}>
          {/* Sea graticule grid */}
          {[150, 300, 450].map((y) => (
            <line key={`lat-${y}`} x1={0} y1={y} x2={1000} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {[200, 400, 600, 800].map((x) => (
            <line key={`lon-${x}`} x1={x} y1={0} x2={x} y2={600} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {/* Accurate landmass polygons */}
          {MEDITERRANEAN_LANDMASSES.map((d, i) => (
            <path key={i} d={d} fill="#DDD3BC" stroke="#9B8E74" strokeWidth={2} />
          ))}
          {/* Animated territory fills */}
          {territories.map((key, idx) => {
            const shape = TERRITORY_SHAPES[key];
            if (!shape) return null;
            const op = spring({ frame: frame - (14 + idx * 12), fps, config: { damping: 16 } });
            return <path key={key} d={shape.d} fill={shape.color} fillOpacity={0.58 * Math.min(1, op)} stroke={shape.color} strokeWidth={2} />;
          })}
          {/* Optional Diocletian East/West split line */}
          {splitEastWest && (
            <line
              x1={560}
              y1={80}
              x2={560}
              y2={540}
              stroke="#F5D33A"
              strokeWidth={4}
              strokeDasharray="12 8"
              opacity={Math.min(1, spring({ frame: frame - 24, fps, config: { damping: 14 } }))}
            />
          )}
          {/* Animated curved route / invasion arrows */}
          {arrows.map((ar, idx) => {
            const p = Math.min(1, spring({ frame: frame - (22 + idx * 14), fps, config: { damping: 16 } }));
            const mx = (ar.from[0] + ar.to[0]) / 2;
            const my = Math.min(ar.from[1], ar.to[1]) - 55;
            const d = `M ${ar.from[0]} ${ar.from[1]} Q ${mx} ${my} ${ar.to[0]} ${ar.to[1]}`;
            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={ar.color ?? '#F5D33A'}
                strokeWidth={4}
                strokeDasharray="10 6"
                opacity={p}
              />
            );
          })}
          {/* Callout pins */}
          {pins.map((pin, idx) => {
            const p = Math.min(1, spring({ frame: frame - (18 + idx * 10), fps, config: { damping: 14 } }));
            return (
              <g key={`${pin.label}-${idx}`} transform={`translate(${pin.x}, ${pin.y}) scale(${p})`}>
                <circle r={9} fill="#F5D33A" stroke="#1E1D1B" strokeWidth={3} />
                <rect x={14} y={-18} width={Math.max(105, pin.label.length * 12 + 24)} height={34} rx={6} fill="#1E1D1B" fillOpacity={0.88} />
                <text x={24} y={5} fill="#FFFDF7" fontFamily="Helvetica, Arial, sans-serif" fontSize={18} fontWeight={800}>
                  {pin.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {title && (
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 16,
            padding: '6px 14px',
            borderRadius: 6,
            background: 'rgba(20,24,30,0.88)',
            color: '#F5D33A',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
      )}
    </div>
  );
};

export const VoxDataChart: React.FC<{
  title: string;
  unit?: string;
  labels: readonly string[];
  values: readonly number[];
  kind?: 'bar' | 'line';
  accent?: string;
  highlightLast?: boolean;
  width?: number;
  height?: number;
}> = ({
  title,
  unit = '',
  labels,
  values,
  kind = 'bar',
  accent = '#B8332A',
  highlightLast = true,
  width = 780,
  height = 380,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxVal = Math.max(1, ...values);
  const padL = 68;
  const padR = 28;
  const padT = 56;
  const padB = 54;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        background: '#FFFDF7',
        border: '1.5px solid rgba(30,29,27,0.14)',
        boxShadow: '0 14px 36px rgba(24,18,12,0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 16,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 20,
          color: '#1E1D1B',
        }}
      >
        {title} {unit ? <span style={{ color: '#6E665A', fontWeight: 600 }}>({unit})</span> : null}
      </div>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Horizontal gridlines + Y ticks */}
        {[0, 0.5, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(30,29,27,0.12)" strokeWidth={1} />
              <text x={padL - 10} y={y + 5} textAnchor="end" fill="#6E665A" fontFamily="Helvetica, Arial, sans-serif" fontSize={14} fontWeight={600}>
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}
        {/* Bars or Line */}
        {kind === 'bar'
          ? values.map((v, i) => {
              const p = Math.min(1, spring({ frame: frame - (10 + i * 6), fps, config: { damping: 15 } }));
              const slotW = plotW / Math.max(1, values.length);
              const bw = slotW * 0.62;
              const x = padL + i * slotW + (slotW - bw) / 2;
              const bh = (v / maxVal) * plotH * p;
              const y = padT + plotH - bh;
              const isLast = highlightLast && i === values.length - 1;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={bw} height={bh} rx={5} fill={isLast ? '#F5D33A' : accent} stroke={isLast ? '#1E1D1B' : 'none'} strokeWidth={1.5} />
                  <text x={x + bw / 2} y={padT + plotH + 26} textAnchor="middle" fill="#4A453E" fontFamily="Helvetica, Arial, sans-serif" fontSize={14} fontWeight={700}>
                    {labels[i] ?? ''}
                  </text>
                </g>
              );
            })
          : (() => {
              const pts = values.map((v, i) => {
                const x = padL + (i / Math.max(1, values.length - 1)) * plotW;
                const y = padT + plotH - (v / maxVal) * plotH;
                return [x, y] as const;
              });
              const p = Math.min(1, spring({ frame: frame - 8, fps, config: { damping: 20, stiffness: 60 } }));
              const visibleCount = Math.max(1, Math.round(pts.length * p));
              const d = pts
                .slice(0, visibleCount)
                .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`)
                .join(' ');
              return (
                <g>
                  <path d={d} fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map(([x, y], i) => (
                    <g key={i}>
                      {i < visibleCount && <circle cx={x} cy={y} r={6} fill="#F5D33A" stroke="#1E1D1B" strokeWidth={2.5} />}
                      <text x={x} y={padT + plotH + 26} textAnchor="middle" fill="#4A453E" fontFamily="Helvetica, Arial, sans-serif" fontSize={14} fontWeight={700}>
                        {labels[i] ?? ''}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}
      </svg>
    </div>
  );
};

export const VoxStatCard: React.FC<{
  label: string;
  value: string;
  delta?: string;
  accent?: string;
  delayFrames?: number;
  width?: number;
}> = ({ label, value, delta, accent = '#B8332A', delayFrames = 14, width = 420 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(1, spring({ frame: frame - delayFrames, fps, config: { damping: 15 } }));
  return (
    <div
      style={{
        width,
        boxSizing: 'border-box',
        padding: '18px 24px',
        borderRadius: 12,
        background: '#FFFDF7',
        border: '1px solid rgba(30,29,27,0.12)',
        borderLeft: `8px solid ${accent}`,
        boxShadow: '0 10px 26px rgba(24,18,12,0.1)',
        opacity: p,
        transform: `translateX(${(1 - p) * -32}px)`,
      }}
    >
      <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 15, fontWeight: 800, letterSpacing: 2, color: '#6E665A', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 900, color: '#1E1D1B', marginTop: 4 }}>{value}</div>
      {delta && <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 16, fontWeight: 600, color: accent, marginTop: 2 }}>{delta}</div>}
    </div>
  );
};

/** Safe-zone timeline pinned cleanly at top-right so it NEVER collides with burned-in subtitles at bottom. */
export const VoxTimeline: React.FC<{
  startLabel: string;
  endLabel: string;
  currentLabel: string;
  progress: number; // 0..1
  accent?: string;
}> = ({ startLabel, endLabel, currentLabel, progress, accent = '#B8332A' }) => {
  const pct = Math.max(0, Math.min(100, progress * 100));
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        top: 44,
        width: 440,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 14, fontWeight: 700, color: '#5A5247' }}>
        <span>{startLabel}</span>
        <span style={{ background: '#F5D33A', color: '#1E1D1B', padding: '3px 12px', borderRadius: 4, fontWeight: 900, fontSize: 16 }}>{currentLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(30,29,27,0.18)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
};

// ── 3BLUE1BROWN THEME WIDGETS ───────────────────────────────────────────────

export const ThreeB1BBackdrop: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: '#0F111A',
      color: '#ECEFF4',
      fontFamily: '"Computer Modern", Georgia, serif',
      overflow: 'hidden',
    }}
  >
    <AbsoluteFill
      style={{
        opacity: 0.14,
        backgroundImage:
          'linear-gradient(to right, #58C4DD 1px, transparent 1px), linear-gradient(to bottom, #58C4DD 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        pointerEvents: 'none',
      }}
    />
    {children}
  </AbsoluteFill>
);

export const ThreeB1BPlane: React.FC<{
  vectors?: readonly { x: number; y: number; color?: string; label?: string }[];
  width?: number;
  height?: number;
}> = ({ vectors = [], width = 760, height = 500 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const unit = 56;
  return (
    <svg width={width} height={height} style={{ background: 'rgba(15,17,26,0.75)', borderRadius: 16, border: '1px solid rgba(88,196,221,0.28)' }}>
      <line x1={24} y1={cy} x2={width - 24} y2={cy} stroke="#58C4DD" strokeWidth={2} />
      <line x1={cx} y1={24} x2={cx} y2={height - 24} stroke="#58C4DD" strokeWidth={2} />
      {vectors.map((v, i) => {
        const p = Math.min(1, spring({ frame: frame - (10 + i * 12), fps, config: { damping: 14 } }));
        const x2 = cx + v.x * unit * p;
        const y2 = cy - v.y * unit * p;
        const col = v.color ?? '#FFFF00';
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={col} strokeWidth={4} strokeLinecap="round" />
            <circle cx={x2} cy={y2} r={6} fill={col} />
            {v.label && (
              <text x={x2 + 12} y={y2 - 8} fill={col} fontSize={22} fontStyle="italic" fontWeight={700}>
                {v.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export const ThreeB1BEquation: React.FC<{
  terms: readonly { text: string; color?: string }[];
  fontSize?: number;
}> = ({ terms, fontSize = 54 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline', fontSize, fontStyle: 'italic' }}>
      {terms.map((t, i) => {
        const p = Math.min(1, spring({ frame: frame - i * 8, fps, config: { damping: 16 } }));
        return (
          <span key={i} style={{ color: t.color ?? '#ECEFF4', opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
            {t.text}
          </span>
        );
      })}
    </div>
  );
};

/** Concise reference injected into the Animation Agent prompt so it uses pre-built widgets cleanly. */
export const THEME_WIDGET_CATALOG_DOCS = `
Pre-built Theme Widgets available via: import { ... } from './theme-widgets';
ALL layouts MUST keep bottom >= 140px clear for burned-in subtitles (CAPTION_SAFE_BOTTOM_PX = 140).

[VOX THEME]
- <VoxBackdrop bg="#F4ECD8"> — warm parchment paper grain & subtle vignette.
- <VoxHighlighterHeadline kicker="ACT I" words={['ROME','753','BCE']} highlightIndices={[1]} accent="#B8332A" fontSize={64} />
- <VoxGeoMap title="MEDITERRANEAN" territories={['italy','carthage','gaul','greece','west','east']} pins={[{x:455,y:285,label:'Rome'},{x:405,y:415,label:'Carthage'},{x:685,y:255,label:'Constantinople'}]} arrows={[{from:[300,190],to:[455,285]}]} splitEastWest={false} focus={{x:500,y:300,zoom:1.15}} width={860} height={520} />
  (Uses real accurate Mediterranean/Europe SVG coastlines in 1000x600 space! Key coordinates: Rome=[455,285], Carthage=[405,415], Gaul=[300,190], Greece=[585,305], Constantinople=[685,255], Egypt=[780,490], Britain=[240,85].)
- <VoxDataChart title="..." unit="%" labels={['...']} values={[10,40,90]} kind="bar"|"line" accent="#B8332A" width={780} height={380} />
- <VoxStatCard label="SENATE" value="300" delta="members" accent="#B8332A" width={420} />
- <VoxTimeline startLabel="753 BCE" endLabel="476 CE" currentLabel="44 BCE" progress={0.58} accent="#B8332A" /> (Pinned top-right, never overlaps subtitles!)

[3BLUE1BROWN THEME]
- <ThreeB1BBackdrop> — deep slate #0F111A + subtle #58C4DD coordinate grid.
- <ThreeB1BPlane vectors={[{x:3,y:2,color:'#FFFF00',label:'v'}]} width={760} height={500} />
- <ThreeB1BEquation terms={[{text:'e^{iπ}',color:'#58C4DD'},{text:'+ 1 = 0',color:'#ECEFF4'}]} fontSize={54} />
`.trim();

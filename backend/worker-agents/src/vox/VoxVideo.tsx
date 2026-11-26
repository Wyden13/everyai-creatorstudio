/**
 * The Vox widget library + root composition. Hand-written once, traced from reference Vox
 * explainers; the LLM never edits this file, it only fills a Beat Sheet.
 *
 * Grammar (from the traces, plus the owner's "animation at all times"):
 *  - One paper world, full-bleed. No cards, chips, panels or dark boxes.
 *  - One idea per beat. Beats never hard-cut: they join through a transition (motion.ts
 *    TRANSITION_RULES, TRANSITION_LOOKS here); same-world beats glide on one camera.
 *  - Every element lands on the frame its cue phrase is spoken; type builds word by word as it
 *    is spoken. After landing, the shot keeps moving (camera push, drawing, counting, regrouping).
 *  - Text lives only in its layout zone (tokens.ts LAYOUTS). Every text node is tagged for the DOM audit.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { findPhrase, tokenize, type Shot } from './beat-sheet';
import { UNITS, figureParts, formatFigure, formatYear, unitCounts, type NumberUnit } from './format';
import { shownValue } from './inflation';
import { CHAIN, GLYPH_EM, SPLIT, capsLines, chainLayout, splitLayout, spread, stackLines } from './diagram';
import { chatLayout, chatTitle, checklistLayout, rankFigure, rankOrder, rankSlots, rankingLayout, versusLayout, versusVerdict } from './rows';
import { EASE, backOut, cameraAt, landing, landingFrames, layersAt, progress, punchFlash, punchWord, pushScale, shakeAt, shuffled, unitSlots, type Layer } from './motion';
import type { MotionFeel, TimedBeat, Timeline } from './timeline';
import { COLOR, CUE_LAG_MS, FONT, FPS, LABEL_FONT_PX, LAYOUTS, MOTION, PIN, arrowPoint, labelRect, penArrow, toScreen, type CueRole, type Grade, type Layout, type Rect, type Tone, type TransitionKind } from './tokens';

export interface VoxAssets {
  paper: string;
  grain: string;
}

type ShotOf<K extends Shot['kind']> = Extract<Shot, { kind: K }>;
interface ShotProps<K extends Shot['kind']> {
  beat: TimedBeat & { shot: ShotOf<K> };
  frame: number;
  timeline: Timeline;
  L: Layout;
}
type Point = readonly [number, number];
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ── Timing helpers (shared by every widget) ────────────────────────────────

/** Frame an element lands on: its cue phrase (+ role lag), or the beat start if it has none. */
function cueFrame(beat: TimedBeat, phrase: string | undefined, role: CueRole): number {
  const lag = Math.round((CUE_LAG_MS[role] / 1000) * FPS);
  return phrase === undefined ? beat.from + 2 : (beat.cues[phrase] ?? beat.from) + lag;
}

/** Entrance progress in the register's feel, or 1 when the element was already on screen in this world. */
const entrance = (beat: TimedBeat, key: string, frame: number, start: number, dur: number) =>
  beat.carried.includes(key) ? 1 : landing(beat.feel, frame, start, dur);

/**
 * The grade's paint (timeline.grade) as CSS variables, set once on the root: shared styles (caps,
 * halos, highlighter, pen) read them, so no widget branches on the register. Hex data tones come
 * from timeline.grade.tone (they are interpolated); maps are pictures and keep COLOR.
 */
const PAINT = {
  field: 'var(--vox-field)',
  ink: 'var(--vox-ink)',
  inkSoft: 'var(--vox-ink-soft)',
  inkMuted: 'var(--vox-ink-muted)',
  accent: 'var(--vox-accent)',
  ochre: 'var(--vox-ochre)',
  highlight: 'var(--vox-highlight)',
  blend: 'var(--vox-blend)' as React.CSSProperties['mixBlendMode'],
} as const;

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);

/**
 * The shot's camera: a continuous push (tokens.ts PUSH) about `origin` (default: the stage
 * centre), so a shot never freezes once everything has landed. Titles stay outside it. Maps
 * have their own camera and never use this.
 */
const Camera: React.FC<{ beat: TimedBeat; frame: number; L: Layout; origin?: Point; children: React.ReactNode }> = ({ beat, frame, L, origin, children }) => {
  const scale = pushScale(beat.shot.kind as Exclude<Shot['kind'], 'map'>, beat.push, frame, beat.feel.push);
  const [sx, sy] = shakeAt(beat.feel, Object.values(beat.cues), frame);
  const [ox, oy] = origin ?? [L.zone.stage.x + L.zone.stage.w / 2, L.zone.stage.y + L.zone.stage.h / 2];
  const shake = sx === 0 && sy === 0 ? '' : `translate(${sx}px, ${sy}px) `;
  return <div style={{ position: 'absolute', inset: 0, transformOrigin: `${ox}px ${oy}px`, transform: `${shake}scale(${scale})` }}>{children}</div>;
};

/**
 * Text node tagged for the layout audit. Only tagged while at least partly visible, so the
 * audit inspects what a viewer can actually read.
 */
const Text: React.FC<{ beat: TimedBeat; role: string; visible: number; style: React.CSSProperties; children: React.ReactNode }> = ({
  beat,
  role,
  visible,
  style,
  children,
}) => (
  <div
    {...(visible > 0.3 ? { 'data-vox-text': '', 'data-vox-beat': beat.id, 'data-vox-role': role } : {})}
    style={{ position: 'absolute', opacity: visible, whiteSpace: 'nowrap', ...style }}
  >
    {children}
  </div>
);

/** Soft paper-coloured halo that keeps small text legible over map fills (no boxes). */
const halo = (c: string) => `0 0 8px ${c}, 0 0 4px ${c}, 0 0 2px ${c}`;
/** Map labels keep the map's own paper (a map is a picture and keeps COLOR). */
const PAPER_HALO = halo(PAINT.field);

const zoneStyle = (z: Rect): React.CSSProperties => ({ left: z.x, top: z.y, width: z.w, height: z.h });

const CAPS: React.CSSProperties = { fontFamily: FONT.sans, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: PAINT.inkSoft };
/** Caps labels wrap only where the layout gives them a second line (diagram.ts capsLines counts them the same way). */
const wrap = (L: Layout): React.CSSProperties['whiteSpace'] => (L.labelLines > 1 ? 'normal' : 'nowrap');
/** A text role's size and line height as CSS. */
const typeOf = ({ px, line }: { px: number; line: number }): React.CSSProperties => ({ fontSize: px, lineHeight: `${line}px` });

/** A pen rule's length: draws to `base` px from `start`, then keeps extending slowly, never past `max`. */
const ruleWidth = (frame: number, start: number, base: number, max: number) =>
  Math.min(max, base * progress(frame, start, MOTION.ruleDraw, EASE.inOut) + (MOTION.ruleGrowPerSec * Math.max(0, frame - start - MOTION.ruleDraw)) / FPS);

/** Open pen chevron with its tip at `tip`, pointing along `angle` (radians). */
const Chevron: React.FC<{ tip: Point; angle: number; color: string }> = ({ tip: [x, y], angle, color }) => {
  const arm = (s: number) => `${x - Math.cos(angle + s) * 22},${y - Math.sin(angle + s) * 22}`;
  return <path d={`M ${arm(0.45)} L ${x},${y} L ${arm(-0.45)}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />;
};

/** A ring rippling out of a living point (a drawing line's head, a chain's newest node) since frame `since`. */
const Ripple: React.FC<{ at: Point; r: number; color: string; frame: number; since: number }> = ({ at, r, color, frame, since }) => {
  const q = (((frame - since) / FPS) * 1.2) % 1;
  return <circle cx={at[0]} cy={at[1]} r={r + 16 * q} fill="none" stroke={color} strokeWidth={3} opacity={0.45 * (1 - q)} />;
};

const TitleBlock: React.FC<{ beat: TimedBeat; frame: number; text: string; sub?: string; serif?: boolean; L: Layout }> = ({ beat, frame, text, sub, serif, L }) => {
  const p = entrance(beat, `title:${text}`, frame, beat.from, MOTION.enter);
  const z = L.zone.title;
  return (
    <>
      <Text
        beat={beat}
        role="title"
        visible={p}
        style={{
          left: z.x,
          width: z.w,
          top: z.y + (sub ? 8 : 30) + (1 - p) * 10,
          textAlign: 'center',
          ...(serif
            ? { fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 60, color: PAINT.ink, lineHeight: '72px' }
            : { ...CAPS, ...typeOf(L.type.kicker), whiteSpace: wrap(L), color: PAINT.ink }),
        }}
      >
        {text}
      </Text>
      {sub && (
        <Text beat={beat} role="title-sub" visible={p} style={{ left: z.x, width: z.w, top: z.y + 88, textAlign: 'center', ...CAPS, ...typeOf(L.type.sub), whiteSpace: wrap(L), color: PAINT.ochre }}>
          {sub}
        </Text>
      )}
    </>
  );
};

/** Where a highlight phrase sits across a block of text lines (global word indices). */
function highlightSpan(lines: readonly string[], highlight: string): { start: number; len: number } {
  const toks = lines.flatMap(wordsOf).map((w) => tokenize(w).join(''));
  return { start: findPhrase(toks, highlight), len: tokenize(highlight).length };
}

/**
 * Kinetic type: one line of words, each rising into place on the frame it lands (`lands`, global
 * word indices, see motion.ts landingFrames), with a highlighter stroke that wipes left→right
 * behind the highlighted words (a highlight may span lines). Multiply blend: yellow reads as ink.
 */
const Words: React.FC<{ text: string; offset: number; span: { start: number; len: number }; sweep: number; lands: readonly number[]; frame: number; feel: MotionFeel }> = ({
  text,
  offset,
  span,
  sweep,
  lands,
  frame,
  feel,
}) => {
  const words = wordsOf(text);
  return (
    <>
      {words.map((w, i) => {
        const k = offset + i - span.start;
        const on = span.start >= 0 && k >= 0 && k < span.len;
        const local = on ? Math.min(1, Math.max(0, sweep * span.len - k)) : 0;
        const p = landing(feel, frame, lands[offset + i]!, MOTION.wordPop);
        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              marginRight: i < words.length - 1 ? '0.26em' : 0,
              opacity: p,
              transform: `translateY(${(1 - p) * 0.32}em) scale(${0.9 + 0.1 * p})`,
              transformOrigin: 'left bottom',
            }}
          >
            {on && (
              <span
                style={{
                  position: 'absolute',
                  left: '-0.08em',
                  right: k < span.len - 1 && i < words.length - 1 ? '-0.3em' : '-0.08em',
                  top: '0.22em',
                  bottom: '0.06em',
                  background: PAINT.highlight,
                  mixBlendMode: PAINT.blend,
                  transformOrigin: 'left center',
                  transform: `scaleX(${local}) skewX(-4deg)`,
                  borderRadius: '2px 6px 3px 5px',
                }}
              />
            )}
            <span style={{ position: 'relative' }}>{w}</span>
          </span>
        );
      })}
    </>
  );
};

// ── Shots ───────────────────────────────────────────────────────────────────

const Headline: React.FC<ShotProps<'headline'>> = ({ beat, frame, L }) => {
  const { lines, highlight } = beat.shot;
  const stage = L.zone.stage;
  const sweep = progress(frame, cueFrame(beat, highlight, 'highlight'), MOTION.highlightWipe * tokenize(highlight).length, EASE.linear);
  const span = highlightSpan(lines, highlight);
  const lands = landingFrames(lines.flatMap(wordsOf), beat.spoken, beat.from + 2);
  // Global word index where each line starts.
  const offsets = lines.map((_, i) => lines.slice(0, i).flatMap(wordsOf).length);
  // Fit the longest line to the stage width (heavy gothic ≈ 0.58 em per character).
  const fontSize = Math.min(L.type.headline, Math.floor(stage.w / (Math.max(...lines.map((l) => l.length)) * 0.58)));
  const lineH = Math.round(fontSize * 1.2);
  const top = stage.y + stage.h / 2 - (lines.length * lineH) / 2;
  return (
    <Camera beat={beat} frame={frame} L={L}>
      {lines.map((line, i) => (
        <Text
          key={i}
          beat={beat}
          role={`headline-${i}`}
          visible={frame >= lands[offsets[i]!]! ? 1 : 0}
          style={{ left: stage.x, width: stage.w, top: top + i * lineH, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize, lineHeight: `${lineH}px`, letterSpacing: '-0.015em', color: PAINT.ink }}
        >
          <Words text={line} offset={offsets[i]!} span={span} sweep={sweep} lands={lands} frame={frame} feel={beat.feel} />
        </Text>
      ))}
    </Camera>
  );
};

const Chapter: React.FC<ShotProps<'chapter'>> = ({ beat, frame, L }) => {
  const { title } = beat.shot;
  const lands = landingFrames(wordsOf(title), beat.spoken, beat.from + 2);
  const ruleStart = beat.from + 8;
  // The pen rule draws, then keeps extending slowly for as long as the card is up.
  const ruleW = ruleWidth(frame, ruleStart, 440, L.zone.stage.w * 0.8);
  const { stage } = L.zone;
  const mid = stage.y + stage.h / 2;
  return (
    <Camera beat={beat} frame={frame} L={L}>
      <Text
        beat={beat}
        role="chapter"
        visible={frame >= lands[0]! ? 1 : 0}
        style={{ left: stage.x, width: stage.w, top: mid - L.type.chapter * 0.6, textAlign: 'center', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: L.type.chapter, lineHeight: `${Math.round(L.type.chapter * 1.16)}px`, color: PAINT.ink }}
      >
        <Words text={title} offset={0} span={{ start: -1, len: 0 }} sweep={0} lands={lands} frame={frame} feel={beat.feel} />
      </Text>
      <div style={{ position: 'absolute', left: L.width / 2 - ruleW / 2, width: ruleW, top: mid + L.type.chapter * 0.75, height: 5, background: PAINT.accent, opacity: 0.85, borderRadius: 3 }} />
    </Camera>
  );
};

/** Imperfect hand-drawn loop (pen overshoots its start) with radii rx, ry, as a path around (0,0); the map's circle and the versus winner's ring. */
function penLoop(rx: number, ry: number): string {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const a = -2.3 + (i / 40) * Math.PI * 2.18;
    const r = 1 + 0.06 * Math.sin(i * 0.9) + 0.04 * (i / 40);
    return `${(Math.cos(a) * r * rx).toFixed(3)} ${(Math.sin(a) * r * ry).toFixed(3)}`;
  });
  return `M ${pts.join(' L ')}`;
}
const PEN_CIRCLE = penLoop(1, 0.86);

const MapShot: React.FC<ShotProps<'map'>> = ({ beat, frame, timeline, L }) => {
  const map = timeline.geo!.maps[beat.map!]!;
  const { base } = map;
  const shot = beat.shot;
  const view = cameraAt(beat.camera!, beat.from, frame);
  const k = L.width / view[2];
  const worldTransform = `translate(${L.width / 2 - k * view[0]} ${L.height / 2 - k * view[1]}) scale(${k})`;
  const screen = (place: string) => toScreen(view, map.places[place]!.at, L);
  // Every label lands on its cue; a pin's name lands as its pin does.
  const named = [
    ...shot.labels.map((l) => ({ place: l.place, key: `label:${l.place}`, start: cueFrame(beat, l.at, 'label') })),
    ...(shot.pins ?? []).map((p) => ({ place: p.place, key: `pin:${p.place}`, start: cueFrame(beat, p.at, 'label') + MOTION.pinDrop })),
  ];
  const hatch = `hatch-${beat.id}`;

  return (
    <>
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {shot.layers.map((l) => {
            const key = `layer:${l.layer}:${l.tone}`;
            const p = entrance(beat, key, frame, cueFrame(beat, l.at, 'layer'), MOTION.layerBleed);
            const [ox, oy] = map.fills[l.layer]!.origin;
            return (
              <clipPath key={key} id={`clip-${beat.id}-${l.layer}`}>
                <circle cx={ox} cy={oy} r={1 + 1500 * EASE.inOut(p)} />
              </clipPath>
            );
          })}
          {/* Disputed areas: a hatch at constant screen spacing, never a tone. */}
          <pattern id={hatch} patternUnits="userSpaceOnUse" width={9} height={9} patternTransform={`scale(${1 / k}) rotate(45)`}>
            <line x1={0} y1={0} x2={0} y2={9} stroke={COLOR.coast} strokeWidth={2} strokeOpacity={0.5} />
          </pattern>
        </defs>
        <rect width={L.width} height={L.height} fill={COLOR.sea} />
        <g transform={worldTransform}>
          <path d={base.land} fill="none" stroke={COLOR.seaDeep} strokeWidth={14 / k} strokeOpacity={0.7} strokeLinejoin="round" />
          <path d={base.land} fill={COLOR.land} stroke={COLOR.coast} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {(beat.fading ?? []).map((f) => {
            const p = progress(frame, cueFrame(beat, f.at, 'layer'), MOTION.layerBleed);
            return map.fills[f.layer]!.kind === 'area' ? (
              <path key={`fading-${f.layer}-${f.tone}`} d={map.fills[f.layer]!.d} fill={COLOR.tone[f.tone]} fillOpacity={0.8 * (1 - p)} style={{ mixBlendMode: 'multiply' }} />
            ) : null;
          })}
          {shot.layers.map((l) => {
            const fill = map.fills[l.layer]!;
            const color = COLOR.tone[l.tone];
            return fill.kind === 'area' ? (
              <path
                key={l.layer + l.tone}
                d={fill.d}
                clipPath={`url(#clip-${beat.id}-${l.layer})`}
                fill={color}
                fillOpacity={0.8}
                stroke={color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ mixBlendMode: 'multiply' }}
              />
            ) : (
              <path
                key={l.layer + l.tone}
                d={fill.d}
                clipPath={`url(#clip-${beat.id}-${l.layer})`}
                fill="none"
                stroke={COLOR.tone.ink}
                strokeOpacity={0.45}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {base.lakes && <path d={base.lakes} fill={COLOR.sea} stroke={COLOR.coast} strokeWidth={0.8} strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />}
          {base.rivers && <path d={base.rivers} fill="none" stroke={COLOR.seaDeep} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />}
          {base.disputed && (
            <>
              <path d={base.disputed} fill={COLOR.land} />
              <path d={base.disputed} fill={`url(#${hatch})`} stroke={COLOR.coast} strokeWidth={1} strokeOpacity={0.7} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            </>
          )}
          {base.admin1 && <path d={base.admin1} fill="none" stroke={COLOR.coast} strokeOpacity={0.35} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />}
          {base.borders && <path d={base.borders} fill="none" stroke={COLOR.coast} strokeOpacity={0.65} strokeWidth={1.1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        </g>
        {shot.arrow &&
          (() => {
            const arrow = penArrow(screen(shot.arrow.from), screen(shot.arrow.to));
            const [x1, y1] = arrow.to;
            const p = progress(frame, cueFrame(beat, shot.arrow.at, 'annotate'), MOTION.arrowDraw, EASE.inOut);
            return (
              <g opacity={p > 0 ? 0.9 : 0}>
                <path d={`M ${arrow.from.join(' ')} Q ${arrow.ctrl.join(' ')} ${x1} ${y1}`} fill="none" stroke={COLOR.penRed} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
                {p > 0.96 && <Chevron tip={arrow.to} angle={Math.atan2(y1 - arrow.ctrl[1], x1 - arrow.ctrl[0])} color={COLOR.penRed} />}
              </g>
            );
          })()}
        {(shot.armies ?? []).map((army) => {
          // An army advances along its route behind a solid head, then its march pattern keeps flowing.
          const arrow = penArrow(screen(army.from), screen(army.to));
          const start = cueFrame(beat, army.at, 'annotate');
          const p = progress(frame, start, MOTION.armyAdvance, EASE.inOut);
          const tip = arrowPoint(arrow, p);
          const back = arrowPoint(arrow, Math.max(0, p - 0.03));
          const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
          const corner = (s: number, r: number) => `${tip[0] - Math.cos(ang + s) * r},${tip[1] - Math.sin(ang + s) * r}`;
          const d = `M ${arrow.from.join(' ')} Q ${arrow.ctrl.join(' ')} ${arrow.to.join(' ')}`;
          const color = COLOR.tone[army.tone];
          return (
            <g key={`army-${army.from}-${army.to}`} opacity={p > 0 ? 1 : 0} style={{ mixBlendMode: 'multiply' }}>
              <path d={d} fill="none" stroke={color} strokeOpacity={0.85} strokeWidth={18} strokeLinecap="butt" pathLength={1} strokeDasharray={`${Math.max(0, p - 0.04)} 2`} />
              {p >= 1 && <path d={d} fill="none" stroke={COLOR.paper} strokeOpacity={0.5} strokeWidth={4} strokeDasharray="10 22" strokeDashoffset={(-(frame - start - MOTION.armyAdvance) / FPS) * MOTION.armyMarchPerSec} />}
              <path d={`M ${tip[0]},${tip[1]} L ${corner(0.5, 44)} L ${corner(-0.5, 44)} Z`} fill={color} fillOpacity={0.92} />
            </g>
          );
        })}
        {shot.circle &&
          (() => {
            const [x, y] = screen(shot.circle.place);
            const p = progress(frame, cueFrame(beat, shot.circle.at, 'annotate'), MOTION.penDraw, EASE.inOut);
            return (
              <path
                d={PEN_CIRCLE}
                transform={`translate(${x} ${y}) scale(58)`}
                fill="none"
                stroke={COLOR.penRed}
                strokeWidth={6 / 58}
                strokeLinecap="round"
                opacity={p > 0 ? 0.88 : 0}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - p}
              />
            );
          })()}
        {shot.labels.map(({ place, at }) => {
          const [x, y] = screen(place);
          const p = entrance(beat, `label:${place}`, frame, cueFrame(beat, at, 'label'), MOTION.labelFade);
          return <circle key={place} cx={x} cy={y} r={7 * p} fill={COLOR.ink} stroke={COLOR.land} strokeWidth={2.5} />;
        })}
        {(shot.pins ?? []).map(({ place, at }) => {
          // A pin falls onto its place and bounces (back-eased); its shadow grows as it lands.
          const [x, y] = screen(place);
          const p = beat.carried.includes(`pin:${place}`) ? 1 : progress(frame, cueFrame(beat, at, 'label'), MOTION.pinDrop, backOut(1.6));
          const { head: r, height: h, fall } = PIN;
          const c = h - r;
          return (
            <g key={`pin-${place}`} opacity={p > 0 ? 1 : 0}>
              <ellipse cx={x} cy={y} rx={10 * Math.min(1, p)} ry={4 * Math.min(1, p)} fill={COLOR.ink} fillOpacity={0.25} />
              <g transform={`translate(${x} ${y - (1 - p) * fall})`}>
                <path d={`M 0 0 C -4 -10 -${r} -${c - 8} -${r} -${c} A ${r} ${r} 0 1 1 ${r} -${c} C ${r} -${c - 8} 4 -10 0 0 Z`} fill={COLOR.penRed} stroke={COLOR.ink} strokeOpacity={0.35} strokeWidth={1.5} />
                <circle cx={0} cy={-c} r={r * 0.38} fill={COLOR.paper} />
              </g>
            </g>
          );
        })}
      </svg>
      {shot.title && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: L.zone.title.y + L.zone.title.h + 80, background: `linear-gradient(${timeline.grade.field}F5 0%, ${timeline.grade.field}E0 45%, ${timeline.grade.field}00 100%)` }} />}
      {named.map(({ place, key, start }) => {
        const p = entrance(beat, key, frame, start, MOTION.labelFade);
        const name = map.places[place]!.name;
        const r = labelRect(name, screen(place), beat.labelSides?.[place] ?? 'right');
        return (
          <Text
            key={key}
            beat={beat}
            role={`label:${place}`}
            visible={p}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h, lineHeight: `${r.h}px`, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 700, fontSize: LABEL_FONT_PX, color: COLOR.ink, textShadow: PAPER_HALO }}
          >
            {name}
          </Text>
        );
      })}
      {shot.title && <TitleBlock beat={beat} frame={frame} text={shot.title.text} sub={shot.title.sub} serif L={L} />}
    </>
  );
};

/**
 * Where the proportion bars sit between two compared figures, per comparison layout, and the
 * seam (px) the stacked halves leave open for them.
 */
const BARS: Record<Layout['compare'], (stage: Rect) => { x: number; y: number; len: number; thick: number; gap: number; seam: number }> = {
  // Side by side: the bars run along the bottom of the stage, under both figures.
  row: (stage) => ({ x: stage.x + stage.w * 0.2, y: stage.y + stage.h - 76, len: stage.w * 0.6, thick: 14, gap: 10, seam: 0 }),
  // Stacked (phone): the bars sit in the seam between the two figures, full stage width.
  column: (stage) => ({ x: stage.x, y: stage.y + stage.h / 2 - 19, len: stage.w, thick: 14, gap: 10, seam: 56 }),
};

/** The main figure's box and the comparison's box at split progress k (the main figure slides from the centre to make room). */
const HALVES: Record<Layout['compare'], (stage: Rect, k: number, seam: number) => [Rect, Rect]> = {
  row: (stage, k) => [
    { x: stage.x, y: stage.y, w: stage.w - (stage.w / 2) * k, h: stage.h },
    { x: stage.x + stage.w / 2, y: stage.y, w: stage.w / 2, h: stage.h },
  ],
  column: (stage, k, seam) => [
    { x: stage.x, y: stage.y, w: stage.w, h: stage.h - ((stage.h + seam) / 2) * k },
    { x: stage.x, y: stage.y + (stage.h + seam) / 2, w: stage.w, h: (stage.h - seam) / 2 },
  ],
};

const NumberShot: React.FC<ShotProps<'number'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const { stage } = L.zone;
  const fs = L.figureStack;
  const main = cueFrame(beat, s.at, 'number');
  const compareAt = s.compare ? cueFrame(beat, s.compare.at, 'number') : null;
  const split = compareAt === null ? 0 : progress(frame, compareAt - 8, 12, EASE.inOut);
  // Figures as shown (inflation-adjusted where asked); bars and weighing compare them in the
  // dimension's base unit (square miles against square kilometers), never for signed units.
  const shown = shownValue(s);
  const cmp = s.compare && { ...s.compare, unit: s.compare.unit ?? s.unit };
  const cmpShown = cmp ? shownValue(cmp) : null;
  const base = (value: number, unit: NumberUnit) => value * (UNITS[unit].toBase ?? 1);
  const compareValue = cmp && cmpShown !== null && !UNITS[s.unit].signed ? base(cmpShown, cmp.unit) : null;
  const biggest = Math.max(base(shown, s.unit), compareValue ?? 0);
  // Once both have counted, each figure settles to a size that shows its share of the larger one.
  const weigh = compareAt === null || compareValue === null ? 0 : progress(frame, compareAt + MOTION.numberCount - 8, MOTION.barGrow, EASE.inOut);
  const bars = BARS[L.compare](stage);
  const [mainBox, compareBox] = HALVES[L.compare](stage, split, bars.seam);
  /** The lines under a figure in a box, and the figure size that fills the box: capped by the type scale, its widest reading and the box height. */
  const fit = (box: Rect, value: number, unit: NumberUnit, label: string) => {
    const below = fs.labelAt + capsLines(label, fs.label.px, box.w, L) * fs.label.line + fs.slack;
    return { below, size: Math.min(L.type.figure, Math.floor(box.w / (figureParts(value, unit).main.length * GLYPH_EM.heavy)), Math.floor((box.h - below) / 1.1)) };
  };
  // Compared figures share one size (the weighing compares them); the main one shrinks to it as the comparison arrives.
  const alone = fit(HALVES[L.compare](stage, 0, bars.seam)[0], shown, s.unit, s.label).size;
  const settled = cmp && cmpShown !== null
    ? Math.min(fit(HALVES[L.compare](stage, 1, bars.seam)[0], shown, s.unit, s.label).size, fit(compareBox, cmpShown, cmp.unit, cmp.label).size)
    : alone;
  /**
   * A figure lands on its spoken word; a counting figure is already up and counts toward it from
   * `from`. A figure that swaps in whole (a year) is pre-rolled: its label and a pen rule under
   * its slot arrive at `from`, so the stage is never empty while the year waits for its word.
   */
  const figure = (value: number, unit: NumberUnit, from: number, start: number, role: string, box: Rect, size: number, color: string, label: string, inYear?: number) => {
    const counts = unitCounts(unit);
    const p = landing(beat.feel, frame, counts ? from : start, MOTION.enter);
    const countEnd = Math.min(Math.max(start, from + MOTION.numberCount), beat.to - MOTION.settleTail);
    const count = counts ? progress(frame, from, countEnd - from) : 1;
    // Odometer: the count advances in ticks, and each new tick drops into place.
    const ticks = (MOTION.numberTicksPerSec * MOTION.numberCount) / FPS;
    const stepped = count < 1 ? Math.floor(count * ticks) / ticks : 1;
    const tick = count < 1 ? (count * ticks) % 1 : 1;
    const parts = figureParts(value * stepped, unit, value, inYear);
    const blockH = size * 1.1 + fit(box, value, unit, label).below;
    const top = box.y + (box.h - blockH) / 2;
    const scale = weigh === 0 ? 1 : 1 - (1 - Math.max(fs.weighMin, Math.sqrt(base(value, unit) / biggest))) * weigh;
    const rule = ruleWidth(frame, from, box.w * 0.3, box.w * 0.6);
    // The unit clears the figure's glyph box (≈1.21 em) even while the figure slides in (12 px).
    return (
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${box.x + box.w / 2}px ${top + blockH / 2}px`, transform: `scale(${scale})` }}>
        <Text beat={beat} role={`${role}-figure`} visible={p} style={{ left: box.x, width: box.w, top: top + (1 - p) * 12 - (1 - EASE.out(tick)) * size * 0.06, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize: size, lineHeight: `${Math.round(size * 1.1)}px`, letterSpacing: '-0.03em', color, fontVariantNumeric: 'tabular-nums' }}>
          {parts.main}
        </Text>
        {!counts && (
          <div style={{ position: 'absolute', left: box.x + box.w / 2 - rule / 2, width: rule, top: top + size * 1.1 + 8, height: 5, background: PAINT.accent, opacity: 0.85, borderRadius: 3 }} />
        )}
        {parts.unit && (
          <Text beat={beat} role={`${role}-unit`} visible={p} style={{ left: box.x, width: box.w, top: top + size * 1.1 + fs.unitAt, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 800, ...typeOf(fs.unit), color }}>
            {parts.unit}
          </Text>
        )}
        <Text beat={beat} role={`${role}-label`} visible={landing(beat.feel, frame, from + 6, MOTION.enter)} style={{ left: box.x, width: box.w, top: top + size * 1.1 + (parts.unit ? fs.labelAt : fs.bareLabelAt), textAlign: 'center', ...CAPS, ...typeOf(fs.label), whiteSpace: wrap(L) }}>
          {label}
        </Text>
      </div>
    );
  };
  const bar = (value: number, start: number, row: number, color: string) => (
    <div style={{ position: 'absolute', left: bars.x, top: bars.y + row * (bars.thick + bars.gap), height: bars.thick, width: (bars.len * value * progress(frame, start, MOTION.barGrow, EASE.inOut)) / biggest, background: color, borderRadius: bars.thick / 2, mixBlendMode: PAINT.blend }} />
  );
  return (
    <Camera beat={beat} frame={frame} L={L}>
      {figure(shown, s.unit, beat.from + 2, main, 'main', mainBox, alone + (settled - alone) * split, PAINT.ink, s.label, s.inflation?.to)}
      {cmp && cmpShown !== null && split > 0 && figure(cmpShown, cmp.unit, compareAt!, compareAt!, 'compare', compareBox, settled, T.red, cmp.label, cmp.inflation?.to)}
      {compareValue !== null && bar(base(shown, s.unit), compareAt! - 8, 0, T.ink)}
      {compareValue !== null && bar(compareValue, compareAt!, 1, T.red)}
    </Camera>
  );
};

interface PictogramGrid {
  cols: number;
  cell: number;
  /** Grid top-left. */
  gx: number;
  gy: number;
  /** Per legend entry (each group, then the "1 icon = …" key): its box, and how the count and label sit in it. */
  legend: (gi: number) => React.CSSProperties;
  entry: React.CSSProperties;
}

/**
 * Pictogram grid + legend per comparison layout. Side by side, a ten-wide grid sits left of a
 * legend column; stacked (phone), the legend lists one group per row under the grid and the
 * grid takes the column count whose squares are biggest in the space left. Add a layout as a row.
 */
const PICTOGRAM_GRIDS: Record<Layout['compare'], (L: Layout, total: number, entries: readonly LegendEntry[]) => PictogramGrid> = {
  row: (L, total) => {
    const { stage } = L.zone;
    const cols = Math.min(10, total);
    const rows = Math.ceil(total / cols);
    const cell = Math.floor(Math.min(88, (stage.w * 0.5) / cols, (stage.h * 0.9) / rows));
    const gx = stage.x + 164;
    return { cols, cell, gx, gy: stage.y + (stage.h - rows * cell) / 2, legend: (gi) => ({ left: gx + cols * cell + 90, top: stage.y + 170 + gi * 130 }), entry: {} };
  },
  column: (L, total, entries) => {
    const { stage } = L.zone;
    const { count, label } = L.legend;
    // The count column fits the longest count ("25,000" with a per).
    const countW = Math.max(L.legend.countW, Math.ceil(Math.max(...entries.map((g) => g.count.length)) * GLYPH_EM.heavy * count.px));
    const [gap, legendGap] = [12, 36];
    // The per key has no count: its label spans the whole row.
    const labelW = (g: LegendEntry) => (g.count ? stage.w - countW - 28 : stage.w);
    const rowH = (g: LegendEntry) => Math.max(g.count ? count.line : 0, capsLines(g.label, label.px, labelW(g), L) * label.line);
    const legendH = entries.reduce((h, g) => h + rowH(g) + gap, -gap);
    const area = { w: stage.w, h: stage.h - legendH - legendGap };
    const cellFor = (cols: number) => Math.floor(Math.min(area.w / cols, area.h / Math.ceil(total / cols)));
    // Ties go to more columns: the grid spans the stage width instead of a narrow block.
    const cols = Array.from({ length: total }, (_, i) => i + 1).reduce((best, c) => (cellFor(c) >= cellFor(best) ? c : best), 1);
    const [cell, rows] = [cellFor(cols), Math.ceil(total / cols)];
    const gy = stage.y + (area.h - rows * cell) / 2;
    const tops = entries.reduce<number[]>((acc, g, i) => [...acc, i ? acc[i - 1]! + rowH(entries[i - 1]!) + gap : gy + rows * cell + legendGap], []);
    return {
      cols,
      cell,
      gx: stage.x + (stage.w - cols * cell) / 2,
      gy,
      legend: (gi) => ({ left: stage.x, width: stage.w, top: tops[gi]!, display: 'flex', alignItems: 'center', gap: 28 }),
      entry: { width: countW, flex: 'none', textAlign: 'right' },
    };
  },
};

/** One legend row: a group's count and label, or the per key (no count). */
interface LegendEntry {
  count: string;
  label: string;
}

const PictogramShot: React.FC<ShotProps<'pictogram'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const { stage } = L.zone;
  const counted = (n: number) => (s.per ? formatFigure(n * s.per.value, 'count') : String(n));
  const key = s.per && { count: '', label: `1 ${s.icon ? 'icon' : 'square'} = ${formatFigure(s.per.value, s.per.unit)}` };
  const entries: LegendEntry[] = [...s.groups.map((g) => ({ count: counted(g.count), label: g.label })), ...(key ? [key] : [])];
  const { cols, cell, gx, gy, legend, entry } = PICTOGRAM_GRIDS[L.compare](L, s.total, entries);
  const size = cell - Math.max(6, Math.round(cell * 0.18));
  const slotXY = (slot: number): Point => [gx + (slot % cols) * cell, gy + Math.floor(slot / cols) * cell];
  // Owning group per square (undefined: in no group), one entry per square.
  const grouped = s.groups.flatMap((g, gi) => Array.from({ length: g.count }, () => gi));
  const owners = Array.from({ length: s.total }, (_, i): number | undefined => grouped[i]);
  // Squares fly into a scattered order, then regroup on each group's cue (motion.ts unitSlots).
  const scatter = shuffled(s.total, beat.id);
  const stages = Array.from({ length: s.groups.length + 1 }, (_, k) => unitSlots(owners, scatter, k));
  const regroup = s.groups.map((g) => progress(frame, cueFrame(beat, g.at, 'pictogram'), MOTION.unitRegroup, EASE.inOut));
  // A cell draws its group's icon (or the shot's) from the start; no icon: a square.
  const iconOf = (gi: number | undefined) => {
    const id = (gi === undefined ? undefined : s.groups[gi]!.icon) ?? s.icon;
    return id && timeline.icons[id];
  };
  return (
    <>
      <TitleBlock beat={beat} frame={frame} text={s.title} L={L} />
      <Camera beat={beat} frame={frame} L={L}>
        {Array.from({ length: s.total }, (_, i) => {
          const home = slotXY(stages[0]![i]!);
          const fly = landing(beat.feel, frame, beat.from + 2 + (stages[0]![i]! / s.total) * MOTION.unitSweep, MOTION.unitFly);
          const angle = scatter[i]! * 2.39996;
          const start: Point = [home[0] + Math.cos(angle) * stage.w * 0.4, home[1] + Math.sin(angle) * stage.h * 0.4];
          const [x, y] = regroup.reduce<Point>((at, p, k) => lerp(at, slotXY(stages[k + 1]![i]!), p), lerp(start, home, fly));
          const gi = owners[i];
          const color = gi === undefined ? T.muted : interpolateColor(T.muted, T[s.groups[gi]!.tone], regroup[gi]!);
          const icon = iconOf(gi);
          return icon ? (
            <svg key={i} viewBox={icon.viewBox} style={{ position: 'absolute', left: x, top: y, width: size, height: size, opacity: fly, mixBlendMode: PAINT.blend }}>
              <path d={icon.d} fill={color} />
            </svg>
          ) : (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, background: color, opacity: fly, borderRadius: 3, mixBlendMode: PAINT.blend }} />
          );
        })}
        {s.groups.map((g, gi) => (
          <Text key={gi} beat={beat} role={`group-${gi}`} visible={landing(beat.feel, frame, cueFrame(beat, g.at, 'label'), MOTION.labelFade)} style={{ ...legend(gi), fontFamily: FONT.sans, color: T[g.tone] }}>
            <div style={{ ...entry, fontWeight: 900, ...typeOf(L.legend.count) }}>{entries[gi]!.count}</div>
            <div style={{ ...CAPS, ...typeOf(L.legend.label), whiteSpace: wrap(L), color: T[g.tone] }}>{g.label}</div>
          </Text>
        ))}
        {key && (
          <Text beat={beat} role="per" visible={landing(beat.feel, frame, beat.from + 2 + MOTION.unitSweep, MOTION.labelFade)} style={{ ...legend(s.groups.length), fontFamily: FONT.sans, color: T.muted }}>
            <div style={{ ...CAPS, ...typeOf(L.legend.label), whiteSpace: wrap(L), color: PAINT.ink }}>{key.label}</div>
          </Text>
        )}
      </Camera>
    </>
  );
};

function interpolateColor(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join(',')})`;
}

interface RulerGeometry {
  /** Ruler start and end (screen px). */
  a: Point;
  b: Point;
  /** Boxes for the start/end year labels. */
  ends: [React.CSSProperties, React.CSSProperties];
  /** Per mark: its label box and where its leader line ends. */
  labels: { box: React.CSSProperties; leader: Point }[];
  /** Mark head size (px). */
  headPx: number;
}

/** A timeline mark as the ruler places it: 0→1 along the ruler, and its label stack's text. */
interface RulerMark {
  t: number;
  year: number;
  label: string;
}

/**
 * Ruler + label geometry per orientation. Labels are spread along the ruler so neighbours never
 * overlap, whatever the years. Add an orientation as a row here.
 */
const RULERS: Record<Layout['ruler'], (L: Layout, marks: readonly RulerMark[]) => RulerGeometry> = {
  // Horizontal: labels alternate above/below; each side is spread along x.
  row: (L, marks) => {
    const { stage, safe } = L.zone;
    const [x0, x1, y] = [stage.x + stage.w * 0.072, stage.x + stage.w * 0.928, stage.y + stage.h * 0.594];
    const w = Math.min(400, stage.w / 2.2);
    const [lo, hi] = [safe.x + w / 2, safe.x + safe.w - w / 2];
    const clampX = (cx: number) => Math.min(Math.max(cx, lo), hi) - w / 2;
    const side = (above: boolean) => marks.map(({ t }, i) => ({ i, x: lerp([x0, y], [x1, y], t)[0] })).filter(({ i }) => (i % 2 === 0) === above);
    const cx = new Map([true, false].flatMap((above) => {
      const onSide = side(above);
      const xs = spread(onSide.map((m) => m.x), w, lo, hi);
      return onSide.map((m, k) => [m.i, xs[k]!] as const);
    }));
    return {
      a: [x0, y],
      b: [x1, y],
      ends: [{ left: clampX(x0), width: w, top: y + 28, textAlign: 'left' }, { left: clampX(x1), width: w, top: y + 28, textAlign: 'right' }],
      labels: marks.map((_, i) => {
        const above = i % 2 === 0;
        const x = cx.get(i)!;
        return { box: { left: x - w / 2, width: w, top: above ? y - 190 : y + 84, textAlign: 'center' }, leader: [x, above ? y - 70 : y + 70] };
      }),
      headPx: L.type.mark,
    };
  },
  /**
   * Vertical (phone): the ruler runs the stage height down its left edge, its end years above
   * and below it, and the marks' label stacks fill the width right of it, spread along y. Marks
   * shrink together until every stack fits the ruler's span.
   */
  column: (L, marks) => {
    const { stage } = L.zone;
    const end = L.type.end;
    const x = stage.x + 24;
    const left = x + 56;
    const labelW = stage.x + stage.w - left;
    const [y0, y1] = [stage.y + end.line + 16, stage.y + stage.h - end.line - 16];
    const gap = 20;
    const n = marks.length;
    // Sub lines counted at the largest head size (an upper bound), so the stacks always fit the span.
    const subLines = Math.max(...marks.map((m) => capsLines(m.label, L.type.mark * L.markStack.subPx, labelW, L)));
    const longest = Math.max(...marks.map((m) => formatYear(m.year).length));
    const headPx = Math.min(L.type.mark, Math.floor(labelW / (longest * GLYPH_EM.heavy)), Math.floor((y1 - y0 - (n - 1) * gap) / n / (L.markStack.head + subLines * L.markStack.sub)));
    const lines = stackLines(headPx, L.markStack);
    const h = lines.head + subLines * lines.sub;
    const ys = spread(marks.map(({ t }) => y0 + (y1 - y0) * t), h + gap, y0 + h / 2, y1 - h / 2);
    return {
      a: [x, y0],
      b: [x, y1],
      ends: [{ left: stage.x, width: stage.w, top: y0 - end.line - 10, textAlign: 'left' }, { left: stage.x, width: stage.w, top: y1 + 10, textAlign: 'left' }],
      labels: ys.map((cy) => ({ box: { left, width: labelW, top: cy - h / 2, textAlign: 'left' }, leader: [left - 16, cy] })),
      headPx,
    };
  },
};

const TimelineShot: React.FC<ShotProps<'timeline'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const t = (year: number) => (year - s.from) / (s.to - s.from);
  const { a, b, ends, labels, headPx } = RULERS[L.ruler](L, s.marks.map((m) => ({ t: t(m.year), year: m.year, label: m.label })));
  const at = (year: number) => lerp(a, b, t(year));
  const ruler = beat.carried.length > 0 ? 1 : progress(frame, beat.from, 20, EASE.inOut);
  const drawn = lerp(a, b, ruler);
  const revealed = s.marks.map((m) => entrance(beat, `mark:${m.year}`, frame, cueFrame(beat, m.at, 'mark'), MOTION.enter));
  const lastIdx = revealed.reduce((acc, p, i) => (p > 0 ? i : acc), -1);
  const prevIdx = revealed.reduce((acc, p, i) => (p >= 1 && i !== lastIdx ? i : acc), -1);
  const anchor = prevIdx < 0 ? lastIdx : prevIdx;
  const head = lastIdx < 0 ? a : at(s.marks[anchor]!.year + (s.marks[lastIdx]!.year - s.marks[anchor]!.year) * EASE.inOut(revealed[lastIdx]!));
  const lines = stackLines(headPx, L.markStack);
  return (
    <Camera beat={beat} frame={frame} L={L}>
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
        <line x1={a[0]} y1={a[1]} x2={drawn[0]} y2={drawn[1]} stroke={PAINT.ink} strokeOpacity={0.8} strokeWidth={4} />
        <line x1={a[0]} y1={a[1]} x2={head[0]} y2={head[1]} stroke={T.red} strokeWidth={8} />
        {s.marks.map((m, i) => {
          const p = revealed[i]!;
          const [x, y] = at(m.year);
          const tip = lerp([x, y], labels[i]!.leader, p);
          return (
            <g key={m.year} opacity={p > 0 ? 1 : 0}>
              <line x1={x} y1={y} x2={tip[0]} y2={tip[1]} stroke={PAINT.ink} strokeOpacity={0.5} strokeWidth={3} />
              <circle cx={x} cy={y} r={8.5} fill={PAINT.field} stroke={T.red} strokeWidth={5} opacity={p} />
            </g>
          );
        })}
      </svg>
      {/* An end year a mark already names is not repeated. */}
      {[s.from, s.to].map((yr, i) =>
        s.marks.some((m) => m.year === yr) ? null : (
          <Text key={yr} beat={beat} role={`end-${i}`} visible={ruler} style={{ ...ends[i], ...CAPS, ...typeOf(L.type.end), color: PAINT.inkMuted }}>
            {formatYear(yr)}
          </Text>
        ),
      )}
      {s.marks.map((m, i) => (
        <Text key={m.year} beat={beat} role={`mark-${m.year}`} visible={revealed[i]!} style={{ ...labels[i]!.box, fontFamily: FONT.sans }}>
          <div style={{ fontWeight: 900, fontSize: headPx, lineHeight: `${lines.head}px`, color: PAINT.ink }}>{formatYear(m.year)}</div>
          <div style={{ ...CAPS, fontSize: lines.subPx, lineHeight: `${lines.sub}px`, whiteSpace: wrap(L) }}>{m.label}</div>
        </Text>
      ))}
    </Camera>
  );
};

const QuoteShot: React.FC<ShotProps<'quote'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const { stage } = L.zone;
  const inset = Math.min(204, stage.w * 0.04);
  const box = { x: stage.x + inset, w: stage.w - inset * 2, y: stage.y + stage.h * 0.2 };
  const p = landing(beat.feel, frame, beat.from, MOTION.enter + 3);
  const sweep = progress(frame, cueFrame(beat, s.highlight, 'highlight'), MOTION.highlightWipe * tokenize(s.highlight).length, EASE.linear);
  const lands = landingFrames(wordsOf(s.text), beat.spoken, beat.from + 4);
  return (
    <Camera beat={beat} frame={frame} L={L}>
      <div style={{ position: 'absolute', left: box.x - 20, top: box.y - 150, fontFamily: FONT.serif, fontSize: 260, lineHeight: '260px', color: T.ochre, opacity: 0.55 * p }}>“</div>
      <Text beat={beat} role="quote" visible={frame >= lands[0]! ? 1 : 0} style={{ left: box.x, width: box.w, top: box.y, whiteSpace: 'normal', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 600, fontSize: L.type.quote, lineHeight: `${Math.round(L.type.quote * 1.32)}px`, color: PAINT.ink }}>
        <Words text={s.text} offset={0} span={highlightSpan([s.text], s.highlight)} sweep={sweep} lands={lands} frame={frame} feel={beat.feel} />
      </Text>
      <Text beat={beat} role="quote-by" visible={landing(beat.feel, frame, beat.from + 10, MOTION.enter)} style={{ left: box.x, width: box.w, top: stage.y + stage.h - 116, ...CAPS, ...typeOf(L.type.by), whiteSpace: wrap(L) }}>
        — {s.by}
      </Text>
    </Camera>
  );
};

/** Point at arc-length fraction f∈[0,1] along a polyline. */
function along(points: readonly Point[], f: number): Point {
  const seg = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  let rest = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i]! || i === seg.length - 1) return lerp(points[i]!, points[i + 1]!, seg[i]! > 0 ? Math.min(1, rest / seg[i]!) : 1);
    rest -= seg[i]!;
  }
  return points[0]!;
}

const LineShot: React.FC<ShotProps<'line'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const { stage } = L.zone;
  const [px0, px1, py0, py1] = [stage.x + stage.w * 0.12, stage.x + stage.w * 0.87, stage.y + stage.h * 0.15, stage.y + stage.h * 0.87];
  const ys = s.points.map((p) => p.y);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(...ys) * 1.08;
  const pts = s.points.map((_, i): Point => [px0 + (i / (s.points.length - 1)) * (px1 - px0), py1 - ((ys[i]! - lo) / (hi - lo)) * (py1 - py0)]);
  const d = (part: readonly Point[]) => part.map((q, j) => `${j ? 'L' : 'M'} ${q.join(' ')}`).join(' ');
  // The axis draws from the beat start and the line starts drawing as soon as the axis is built
  // (or on its cue, if that comes first), then keeps drawing for the whole beat: never an empty stage.
  const axis = progress(frame, beat.from, MOTION.ruleDraw, EASE.inOut);
  const start = Math.min(cueFrame(beat, s.at, 'line'), beat.from + MOTION.ruleDraw);
  const p = progress(frame, start, Math.max(MOTION.lineDraw, beat.to - MOTION.settleTail - start), EASE.linear);
  const alert = s.alertFrom ?? s.points.length - 1;
  const split = alert / (s.points.length - 1);
  const pa = Math.min(1, p / Math.max(1e-6, split));
  const pb = split >= 1 ? 0 : Math.max(0, (p - split) / (1 - split));
  const [calm, alarm] = [pts.slice(0, alert + 1), pts.slice(alert)];
  const head = pb > 0 ? along(alarm, pb) : along(calm, pa);
  const headColor = pb > 0 ? T.red : PAINT.ink;
  const { x: xType, end, xLabels } = L.chart;
  const step = Math.ceil(s.points.length / xLabels);
  // An x label gets the room between labels, kept inside the safe area.
  const xW = Math.min(L.zone.safe.w, (px1 - px0) / Math.max(1, xLabels - 1));
  const xLeft = (x: number) => Math.min(Math.max(x - xW / 2, L.zone.safe.x), L.zone.safe.x + L.zone.safe.w - xW);
  const last = pts[pts.length - 1]!;
  const endText = s.points[s.points.length - 1]!.y.toLocaleString('en-US');
  const endW = Math.max(200, Math.ceil(endText.length * GLYPH_EM.heavy * end.px) + 16);
  const pushedLeft = last[0] + 24 + endW > L.zone.safe.x + L.zone.safe.w;
  return (
    <>
      <TitleBlock beat={beat} frame={frame} text={s.title} L={L} />
      {/* The camera tracks the drawing head. */}
      <Camera beat={beat} frame={frame} L={L} origin={head}>
        <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
          <line x1={px0} x2={px0 + (px1 - px0) * axis} y1={py1} y2={py1} stroke={PAINT.ink} strokeOpacity={0.5} strokeWidth={2} />
          <path d={d(calm)} fill="none" stroke={PAINT.ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pa} />
          {alert < s.points.length - 1 && (
            <path d={d(alarm)} fill="none" stroke={T.red} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pb} />
          )}
          {p > 0 && (
            <>
              <Ripple at={head} r={10} color={headColor} frame={frame} since={start} />
              <circle cx={head[0]} cy={head[1]} r={10} fill={headColor} stroke={PAINT.field} strokeWidth={3} />
            </>
          )}
        </svg>
        {s.points.map((point, i) =>
          // Every step-th label, and always the last (a step label too close to it gives way).
          i === s.points.length - 1 || (i % step === 0 && s.points.length - 1 - i >= step / 2) ? (
            <Text key={i} beat={beat} role={`x-${i}`} visible={landing(beat.feel, frame, beat.from + (MOTION.ruleDraw * i) / (s.points.length - 1), MOTION.enter)} style={{ left: xLeft(pts[i]![0]), width: xW, top: py1 + 18, textAlign: 'center', ...CAPS, ...typeOf(xType), letterSpacing: '0.1em', color: PAINT.inkMuted }}>
              {point.x}
            </Text>
          ) : null,
        )}
        {/* Beside the head, or above it when pushed left by the safe edge (so it never sits on the line). */}
        <Text beat={beat} role="end-value" visible={p >= 1 ? 1 : 0} style={{ left: Math.min(last[0] + 24, L.zone.safe.x + L.zone.safe.w - endW), top: last[1] - (pushedLeft ? end.line + 30 : end.line / 2), width: endW, textAlign: 'right', fontFamily: FONT.sans, fontWeight: 900, ...typeOf(end), color: alert < s.points.length - 1 ? T.red : PAINT.ink }}>
          {endText}
        </Text>
      </Camera>
    </>
  );
};

const SplitShot: React.FC<ShotProps<'split'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const g = splitLayout(L, s.parts.map((p) => p.label));
  // The whole grows in from the beat start; on its cue a pen tear draws across it, then the parts
  // pull apart and keep drifting apart (over the push span, so a continuing split never jumps).
  // A split continuing its world starts already torn.
  const grow = entrance(beat, `title:${s.whole}`, frame, beat.from, MOTION.ruleDraw);
  const torn = beat.carried.includes(`title:${s.whole}`);
  const tearAt = cueFrame(beat, s.at, 'annotate');
  const tear = torn ? 1 : progress(frame, tearAt, MOTION.penDraw, EASE.inOut);
  const apart = torn ? 1 : progress(frame, tearAt + MOTION.penDraw, MOTION.splitApart, EASE.inOut);
  const gap = (SPLIT.gap + SPLIT.drift * progress(frame, beat.push.from, beat.push.to - beat.push.from, EASE.linear)) * apart;
  const shift = (k: number): Point => (g.axis === 'x' ? [k * gap, 0] : [0, k * gap]);
  const lands = s.parts.map((p) => Math.max(cueFrame(beat, p.at, 'label'), tearAt + MOTION.penDraw));
  const shown = s.parts.map((p, i) => entrance(beat, `part:${p.label}:${p.tone}`, frame, lands[i]!, MOTION.splitApart));
  const pts = (poly: readonly Point[]) => poly.map((q) => q.join(',')).join(' ');
  const { slab } = g;
  const [cx, cy] = [slab.x + slab.w / 2, slab.y + slab.h / 2];
  const fill = { fillOpacity: 0.85, stroke: COLOR.coast, strokeWidth: 2, style: { mixBlendMode: PAINT.blend } };
  return (
    <>
      <TitleBlock beat={beat} frame={frame} text={s.whole} L={L} />
      <Camera beat={beat} frame={frame} L={L}>
        <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
          {apart > 0 ? (
            g.parts.map((part, i) => {
              const [dx, dy] = shift(part.shift);
              return <polygon key={i} points={pts(part.poly)} transform={`translate(${dx} ${dy})`} fill={interpolateColor(T.muted, T[s.parts[i]!.tone], shown[i]!)} {...fill} />;
            })
          ) : (
            <rect
              x={slab.x}
              y={slab.y}
              width={slab.w}
              height={slab.h}
              fill={T.muted}
              transform={`translate(${cx} ${cy}) scale(${g.axis === 'x' ? `${grow} 1` : `1 ${grow}`}) translate(${-cx} ${-cy})`}
              {...fill}
            />
          )}
          {g.cracks.map((c, k) => (
            <polyline key={k} points={pts(c)} fill="none" stroke={PAINT.accent} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={tear > 0 ? 1 - apart : 0} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - tear} />
          ))}
        </svg>
        {s.parts.map((p, i) => {
          const r = g.parts[i]!.label;
          const [dx, dy] = shift(g.parts[i]!.shift);
          return (
            <Text key={i} beat={beat} role={`part-${i}`} visible={shown[i]!} style={{ left: r.x + dx, top: r.y + dy + (1 - shown[i]!) * 10, width: r.w, height: r.h, lineHeight: `${r.h}px`, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize: g.labelPx, textTransform: 'uppercase', letterSpacing: '0.08em', color: PAINT.ink, textShadow: halo(PAINT.field) }}>
              {p.label}
            </Text>
          );
        })}
      </Camera>
    </>
  );
};

const ChainShot: React.FC<ShotProps<'chain'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  // A chain continuing its world (rule chain_grows) carries its first nodes: they slide from the
  // previous layout to this one while the new links build on their cues.
  const grownFrom = beat.carried.filter((k) => k.startsWith('node:')).length;
  const to = chainLayout(L, s.nodes);
  const from = grownFrom > 0 ? chainLayout(L, s.nodes.slice(0, grownFrom)) : to;
  const m = progress(frame, beat.from, MOTION.cameraMove, EASE.inOut);
  const morph = (i: number) => (i < grownFrom ? m : 1);
  const point = (i: number) => lerp(from.points[i] ?? to.points[i]!, to.points[i]!, morph(i));
  const box = (i: number): Rect => {
    const [a, b, t] = [from.labels[i] ?? to.labels[i]!, to.labels[i]!, morph(i)];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
  };
  const headPx = from.headPx + (to.headPx - from.headPx) * (grownFrom > 0 ? m : 1);
  const lines = stackLines(headPx, L.markStack);
  // Each node lands on its cue; an uncued node follows its predecessor by one link. New nodes of a
  // growing chain wait until the carried ones have slid aside (their slots are only free then).
  const earliest = (i: number) => (grownFrom > 0 && i >= grownFrom ? beat.from + MOTION.cameraMove : beat.from + 2);
  const lands = s.nodes.reduce<number[]>((acc, n, i) => [...acc, Math.max(earliest(i), n.at ? cueFrame(beat, n.at, 'mark') : i ? acc[i - 1]! + MOTION.linkDraw : 0, acc[i - 1] ?? 0)], []);
  const shown = s.nodes.map((n, i) => entrance(beat, `node:${i}:${n.label}`, frame, lands[i]!, MOTION.enter));
  const newest = shown.reduce((acc, p, i) => (p > 0 ? i : acc), -1);
  const guide = progress(frame, beat.from, MOTION.ruleDraw, EASE.inOut);
  const [first, last] = [point(0), point(s.nodes.length - 1)];
  const tone = (i: number) => T[s.nodes[i]!.tone ?? 'ink'];
  return (
    <>
      {s.title && <TitleBlock beat={beat} frame={frame} text={s.title} L={L} />}
      <Camera beat={beat} frame={frame} L={L}>
        <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
          {/* Pre-roll: a faint guide through every slot draws from the beat start. */}
          <line x1={first[0]} y1={first[1]} x2={first[0] + (last[0] - first[0]) * guide} y2={first[1] + (last[1] - first[1]) * guide} stroke={PAINT.inkMuted} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" />
          {s.nodes.slice(1).map((n, k) => {
            const i = k + 1;
            const [a, b] = [point(i - 1), point(i)];
            const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const u: Point = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
            const [p0, p1]: Point[] = [[a[0] + u[0] * CHAIN.inset, a[1] + u[1] * CHAIN.inset], [b[0] - u[0] * CHAIN.inset, b[1] - u[1] * CHAIN.inset]];
            const p = beat.carried.includes(`node:${i}:${n.label}`) ? 1 : progress(frame, lands[i]! - MOTION.linkDraw, MOTION.linkDraw, EASE.inOut);
            const tip = lerp(p0, p1, p);
            return (
              <g key={i} opacity={p > 0 ? 1 : 0}>
                <line x1={p0[0]} y1={p0[1]} x2={tip[0]} y2={tip[1]} stroke={PAINT.inkSoft} strokeWidth={6} strokeLinecap="round" />
                {p > 0.96 && <Chevron tip={p1} angle={Math.atan2(u[1], u[0])} color={PAINT.inkSoft} />}
              </g>
            );
          })}
          {newest >= 0 && <Ripple at={point(newest)} r={CHAIN.node} color={tone(newest)} frame={frame} since={lands[newest]!} />}
          {s.nodes.map((_, i) => {
            const [x, y] = point(i);
            return <circle key={i} cx={x} cy={y} r={CHAIN.node * shown[i]!} fill={PAINT.field} stroke={tone(i)} strokeWidth={6} />;
          })}
        </svg>
        {s.nodes.map((n, i) => {
          const r = box(i);
          return (
            <Text key={i} beat={beat} role={`node-${i}`} visible={shown[i]!} style={{ left: r.x, top: r.y + (1 - shown[i]!) * 12, width: r.w, textAlign: L.ruler === 'row' ? 'center' : 'left', fontFamily: FONT.sans }}>
              <div style={{ fontWeight: 900, fontSize: headPx, lineHeight: `${lines.head}px`, color: PAINT.ink }}>{n.label}</div>
              {n.sub && <div style={{ ...CAPS, fontSize: lines.subPx, lineHeight: `${lines.sub}px`, whiteSpace: wrap(L) }}>{n.sub}</div>}
            </Text>
          );
        })}
      </Camera>
    </>
  );
};

// ── Punch, ranking, versus, checklist, chat ─────────────────────────────────

/** A punch's full-bleed field and its type colour, from the grade. Add a field as a row here and in PUNCH_FIELDS. */
const PUNCH_PAINT: Record<ShotOf<'punch'>['field'], (g: Grade) => { bg: string; fg: string }> = {
  ink: () => ({ bg: COLOR.ink, fg: COLOR.paper }),
  red: (g) => ({ bg: g.tone.red, fg: COLOR.paper }),
  yellow: (g) => ({ bg: g.highlight, fg: COLOR.ink }),
  paper: (g) => ({ bg: g.field, fg: g.ink }),
};
/** A punch line's height per px of type: the font's full line box, so stacked words never touch. */
const PUNCH_LINE = 1.22;

/**
 * One to three huge words on a full-bleed field, each landing on its phrase in the register's
 * punch feel (scale settling to 1 over its frames, spring, flash; deadpan cuts flat). A pen
 * rule draws under the words from the beat start, so the field is never still while it waits.
 */
const PunchShot: React.FC<ShotProps<'punch'>> = ({ beat, frame, timeline, L }) => {
  const s = beat.shot;
  const { stage } = L.zone;
  const { bg, fg } = PUNCH_PAINT[s.field](timeline.grade);
  const longest = Math.max(...s.words.map((w) => w.text.length));
  const px = Math.min(L.type.punch, Math.floor(stage.w / (longest * GLYPH_EM.caps)), Math.floor((stage.h - 40) / (s.words.length * PUNCH_LINE)));
  const line = Math.round(px * PUNCH_LINE);
  const top = stage.y + (stage.h - 40 - s.words.length * line) / 2;
  const lands = s.words.map((w) => cueFrame(beat, w.at, 'punch'));
  const flashing = punchFlash(beat.feel, frame, lands);
  const pre = Math.max(MOTION.ruleDraw, lands[0]! - beat.from - 2);
  const rule = Math.min(stage.w * 0.8, stage.w * 0.5 * progress(frame, beat.from + 2, pre, EASE.inOut) + (MOTION.ruleGrowPerSec * Math.max(0, frame - beat.from - 2 - pre)) / FPS);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: bg }} />
      <Camera beat={beat} frame={frame} L={L}>
        {s.words.map((w, i) => {
          const { p, scale } = punchWord(beat.feel, frame, lands[i]!);
          return (
            <Text
              key={i}
              beat={beat}
              role={`punch-${i}`}
              visible={Math.min(1, p)}
              style={{ left: stage.x, width: stage.w, top: top + i * line, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize: px, lineHeight: `${line}px`, textTransform: 'uppercase', letterSpacing: '-0.01em', color: fg, transform: `scale(${scale})` }}
            >
              {w.text}
            </Text>
          );
        })}
        <div style={{ position: 'absolute', left: L.width / 2 - rule / 2, width: rule, top: top + s.words.length * line + 16, height: 10, background: fg, opacity: 0.85, borderRadius: 5 }} />
      </Camera>
      {flashing > 0 && <div style={{ position: 'absolute', inset: 0, background: COLOR.flash, opacity: flashing }} />}
    </>
  );
};

/** Frames a value counts for after landing at `land`: done before its beat's resting frame. */
const countFrames = (beat: TimedBeat, land: number) => Math.max(1, Math.min(MOTION.numberCount, beat.to - MOTION.settleTail - land));

/**
 * A highlighter stroke wiping left→right behind a line of text in `box` (`w`: the text's
 * estimated width, placed by `align`); drawn beside the audited text node, never inside it.
 */
const Highlighter: React.FC<{ box: Rect; w: number; align: 'left' | 'center'; sweep: number }> = ({ box, w, align, sweep }) =>
  sweep > 0 ? (
    <div style={{ position: 'absolute', left: (align === 'center' ? box.x + (box.w - w) / 2 : box.x) - 6, top: box.y + box.h * 0.25, height: box.h * 0.68, width: w + 12, background: PAINT.highlight, mixBlendMode: PAINT.blend, transformOrigin: 'left center', transform: `scaleX(${sweep}) skewX(-4deg)`, borderRadius: '2px 6px 3px 5px' }} />
  ) : null;

/** Box style of a slot-relative rect in the slot whose top is `top`. */
const inSlot = (r: Rect, top: number): React.CSSProperties => zoneStyle({ ...r, y: top + r.y });

/**
 * A leaderboard: rails draw from the beat start; each item lands on its phrase (rank numeral,
 * label, a bar growing to its share of the largest, a counting value) in its slot among the
 * items already on screen, and the rows slide to re-sort. Ranks come from rankOrder (code);
 * #1 is red, with a highlighter under its label and a rippling bar head.
 */
const RankingShot: React.FC<ShotProps<'ranking'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const values = s.items.map((i) => i.value);
  const max = Math.max(...values);
  const g = rankingLayout(L, s.items, s.unit);
  const ranks = rankOrder(values, s.better);
  const lands = s.items.map((i) => cueFrame(beat, i.at, 'rank'));
  const arrival = s.items.map((_, i) => i).sort((a, b) => lands[a]! - lands[b]! || a - b);
  const slots = arrival.map((_, k) => rankSlots(ranks, arrival, k + 1));
  const slotTop = (slot: number) => g.top + slot * g.slot;
  const rails = progress(frame, beat.from + 2, Math.max(MOTION.ruleDraw, lands[arrival[0]!]! - beat.from - 2), EASE.inOut);
  // A rail gives way once a row's bar fills its slot.
  const railLeft = (k: number) => (k < arrival.length ? 1 - progress(frame, lands[arrival[k]!]!, MOTION.barGrow) : 1);
  const r = L.rank;
  return (
    <>
      <TitleBlock beat={beat} frame={frame} text={s.title} L={L} />
      <Camera beat={beat} frame={frame} L={L}>
        <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
          {s.items.map((_, k) => {
            const y = slotTop(k) + g.bar.y + g.bar.h / 2;
            return <line key={k} x1={g.bar.x} x2={g.bar.x + g.bar.w * rails} y1={y} y2={y} stroke={PAINT.inkMuted} strokeOpacity={0.45 * railLeft(k)} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" />;
          })}
        </svg>
        {g.head && (
          <Text beat={beat} role="rank-unit" visible={rails} style={{ ...zoneStyle(g.head.box), textAlign: 'right', ...CAPS, ...typeOf(r.label), color: PAINT.inkMuted }}>
            {g.head.text}
          </Text>
        )}
        {s.items.map((item, i) => {
          const order = arrival.indexOf(i);
          // The row lands in its slot, then makes room each time a later item arrives: it slides to its new slot just before that item lands.
          const y = arrival.slice(order + 1).reduce((acc, j, k) => acc + (slotTop(slots[order + 1 + k]![i]!) - acc) * progress(frame, lands[j]! - MOTION.rankShift, MOTION.rankShift, EASE.inOut), slotTop(slots[order]![i]!));
          const p = landing(beat.feel, frame, lands[i]!, MOTION.enter);
          const grow = progress(frame, lands[i]!, MOTION.barGrow, EASE.inOut);
          const len = (g.bar.w * item.value * grow) / max;
          const count = progress(frame, lands[i]!, countFrames(beat, lands[i]!));
          const first = ranks[i] === 0;
          const sweep = first ? progress(frame, lands[i]! + MOTION.barGrow, MOTION.highlightWipe * 2, EASE.linear) : 0;
          return (
            <React.Fragment key={i}>
              <Text beat={beat} role={`rank-${i}`} visible={p} style={{ ...inSlot(g.numeral, y), fontFamily: FONT.sans, fontWeight: 900, ...typeOf(r.numeral), color: first ? T.red : PAINT.ink, transform: `translateX(${(1 - Math.min(1, p)) * -24}px)` }}>
                {ranks[i]! + 1}
              </Text>
              <Highlighter box={{ ...g.label, y: y + g.label.y }} w={item.label.length * GLYPH_EM.caps * r.label.px} align="left" sweep={sweep} />
              <Text beat={beat} role={`rank-label-${i}`} visible={p} style={{ ...inSlot(g.label, y), ...CAPS, ...typeOf(r.label), color: PAINT.ink }}>
                {item.label}
              </Text>
              <div style={{ position: 'absolute', left: g.bar.x, top: y + g.bar.y, width: len, height: g.bar.h, background: first ? T.red : T.muted, borderRadius: g.bar.h / 2, mixBlendMode: PAINT.blend }} />
              {first && grow >= 1 && (
                <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
                  <Ripple at={[g.bar.x + len, y + g.bar.y + g.bar.h / 2]} r={g.bar.h / 2} color={T.red} frame={frame} since={lands[i]! + MOTION.barGrow} />
                </svg>
              )}
              <Text beat={beat} role={`rank-value-${i}`} visible={p} style={{ left: g.bar.x + len + 16, top: y + g.value.y, width: g.value.w, fontFamily: FONT.sans, fontWeight: 900, ...typeOf(r.value), color: first ? T.red : PAINT.ink, fontVariantNumeric: 'tabular-nums' }}>
                {rankFigure(item.value * count, s.unit, values)}
              </Text>
            </React.Fragment>
          );
        })}
      </Camera>
    </>
  );
};

/**
 * X vs Y: both names land, the VS badge slams in, then each row lands on its phrase with both
 * values counting up; once counted, code's winner (versusVerdict) gets a pen circle and the
 * loser fades back. After the last row, the side that won more rows gets the highlighter.
 */
const VersusShot: React.FC<ShotProps<'versus'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const v = L.versus;
  const g = versusLayout(L, s.rows);
  const verdict = versusVerdict(s.rows);
  const sides = ['left', 'right'] as const;
  const names = s.sides.map((side, k) => entrance(beat, `side:${side.label}`, frame, beat.from + 2 + k * 6, MOTION.enter));
  const slam = landing(beat.feel, frame, beat.from + 14, MOTION.vsSlam);
  const lands = s.rows.map((row) => cueFrame(beat, row.at, 'versus'));
  const counted = lands.map((f) => f + countFrames(beat, f));
  const sweep = verdict.winner ? progress(frame, counted.at(-1)! + 6, MOTION.highlightWipe * 3, EASE.linear) : 0;
  const shown = (value: number, unit: NumberUnit, k: number) => formatFigure(unitCounts(unit) ? value * k : value, unit, value);
  return (
    <Camera beat={beat} frame={frame} L={L}>
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={g.badge[0]} cy={g.badge[1]} r={(v.badge / 2) * Math.max(0, slam)} fill={PAINT.accent} />
        {s.rows.map((row, i) => {
          const side = verdict.rows[i];
          if (!side) return null;
          const k = sides.indexOf(side);
          const box = g.rows[i]!.values[k]!;
          const w = Math.min(box.w, formatFigure(row[side], row.unit).length * GLYPH_EM.heavy * g.rows[i]!.value.px);
          const cx = g.align.values[k] === 'right' ? box.x + box.w - w / 2 : box.x + w / 2;
          const p = progress(frame, counted[i]!, MOTION.penDraw, EASE.inOut);
          return (
            <path key={i} d={penLoop(w / 2 + 22, box.h / 2 + 8)} transform={`translate(${cx} ${box.y + box.h / 2})`} fill="none" stroke={PAINT.accent} strokeWidth={5} strokeLinecap="round" opacity={p > 0 ? 0.9 : 0} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
          );
        })}
      </svg>
      {s.sides.map((side, k) => (
        <React.Fragment key={k}>
          <Highlighter box={g.sides[k]!} w={side.label.length * GLYPH_EM.heavy * v.side.px} align={g.align.label} sweep={verdict.winner === sides[k] ? sweep : 0} />
          <Text beat={beat} role={`side-${k}`} visible={names[k]!} style={{ ...zoneStyle(g.sides[k]!), textAlign: g.align.label, fontFamily: FONT.sans, fontWeight: 900, ...typeOf(v.side), color: T[side.tone] }}>
            {side.label}
          </Text>
        </React.Fragment>
      ))}
      <Text beat={beat} role="vs" visible={Math.min(1, slam)} style={{ left: g.badge[0] - v.badge / 2, width: v.badge, top: g.badge[1] - v.badge * 0.3, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize: Math.round(v.badge * 0.45), lineHeight: `${Math.round(v.badge * 0.6)}px`, color: COLOR.paper, transform: `scale(${2 - Math.min(1, slam)})` }}>
        VS
      </Text>
      {s.rows.map((row, i) => {
        const p = landing(beat.feel, frame, lands[i]!, MOTION.enter);
        const count = progress(frame, lands[i]!, countFrames(beat, lands[i]!));
        const dim = verdict.rows[i] ? progress(frame, counted[i]!, MOTION.penDraw) : 0;
        const r = g.rows[i]!;
        return (
          <React.Fragment key={i}>
            {r.labels.map((box, h) => (
              <Text key={`l${h}`} beat={beat} role={`row-label-${i}-${h}`} visible={p} style={{ ...zoneStyle(box), textAlign: g.align.label, fontFamily: FONT.sans, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', ...typeOf(v.label), color: PAINT.inkSoft }}>
                {row.label}
              </Text>
            ))}
            {sides.map((side, k) => (
              <Text key={side} beat={beat} role={`row-value-${i}-${k}`} visible={p * (verdict.rows[i] && verdict.rows[i] !== side ? 1 - (1 - MOTION.loserDim) * dim : 1)} style={{ ...zoneStyle(r.values[k]!), textAlign: g.align.values[k], fontFamily: FONT.sans, fontWeight: 900, ...typeOf(r.value), color: T[s.sides[k]!.tone], fontVariantNumeric: 'tabular-nums' }}>
                {shown(row[side], row.unit, count)}
              </Text>
            ))}
          </React.Fragment>
        );
      })}
    </Camera>
  );
};

/** Pen marks drawn in a checklist box, as paths in the box; add a mark as a row here and in the schema. */
const MARKS: Record<ShotOf<'checklist'>['items'][number]['mark'], { d: (b: Rect) => string; tone: Tone }> = {
  yes: { d: (b) => `M ${b.x + b.w * 0.18} ${b.y + b.h * 0.55} L ${b.x + b.w * 0.42} ${b.y + b.h * 0.8} L ${b.x + b.w * 0.88} ${b.y + b.h * 0.16}`, tone: 'teal' },
  no: { d: (b) => `M ${b.x + b.w * 0.2} ${b.y + b.h * 0.2} L ${b.x + b.w * 0.8} ${b.y + b.h * 0.8} M ${b.x + b.w * 0.8} ${b.y + b.h * 0.2} L ${b.x + b.w * 0.2} ${b.y + b.h * 0.8}`, tone: 'red' },
  maybe: { d: (b) => `M ${b.x + b.w * 0.16} ${b.y + b.h * 0.55} Q ${b.x + b.w * 0.33} ${b.y + b.h * 0.3} ${b.x + b.w * 0.5} ${b.y + b.h * 0.55} T ${b.x + b.w * 0.84} ${b.y + b.h * 0.55}`, tone: 'ochre' },
};

/**
 * Myth vs fact: the pen boxes draw from the beat start; each item slides in on its phrase and
 * the pen marks it (tick, cross + strike-through, squiggle); the newest mark ripples.
 */
const ChecklistShot: React.FC<ShotProps<'checklist'>> = ({ beat, frame, timeline, L }) => {
  const T = timeline.grade.tone;
  const s = beat.shot;
  const g = checklistLayout(L, s.items.map((i) => i.text));
  const lands = s.items.map((it) => cueFrame(beat, it.at, 'check'));
  const marked = lands.map((f) => f + 4);
  const newest = marked.filter((f) => f <= frame).length - 1;
  return (
    <>
      {s.title && <TitleBlock beat={beat} frame={frame} text={s.title} L={L} />}
      <Camera beat={beat} frame={frame} L={L}>
        <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }}>
          {g.rows.map((r, i) => {
            const item = s.items[i]!;
            const box = progress(frame, beat.from + 2 + i * 4, MOTION.penDraw, EASE.inOut);
            const mark = progress(frame, marked[i]!, MOTION.penDraw, EASE.inOut);
            const strike = item.mark === 'no' ? progress(frame, marked[i]! + MOTION.penDraw, MOTION.penDraw, EASE.inOut) : 0;
            const tone = T[MARKS[item.mark].tone];
            return (
              <g key={i}>
                <rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} rx={8} fill="none" stroke={PAINT.inkSoft} strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - box} />
                <path d={MARKS[item.mark].d(r.box)} fill="none" stroke={tone} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={mark > 0 ? 1 : 0} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - mark} />
                {strike > 0 &&
                  r.lines.map((l, k) => {
                    const y = r.text.y + (k + 0.55) * g.text.line;
                    return <line key={k} x1={r.text.x - 8} x2={r.text.x - 8 + (l.length * GLYPH_EM.textMean * g.text.px + 16) * strike} y1={y} y2={y} stroke={tone} strokeWidth={7} strokeLinecap="round" />;
                  })}
              </g>
            );
          })}
          {newest >= 0 && (
            <Ripple at={[g.rows[newest]!.box.x + g.rows[newest]!.box.w / 2, g.rows[newest]!.box.y + g.rows[newest]!.box.h / 2]} r={g.rows[newest]!.box.w / 2} color={T[MARKS[s.items[newest]!.mark].tone]} frame={frame} since={marked[newest]!} />
          )}
        </svg>
        {s.items.map((item, i) => {
          const r = g.rows[i]!;
          const p = landing(beat.feel, frame, lands[i]!, MOTION.enter);
          return (
            <Text key={i} beat={beat} role={`item-${i}`} visible={Math.min(1, p)} style={{ ...zoneStyle(r.text), transform: `translateX(${(1 - p) * 40}px)`, fontFamily: FONT.sans, fontWeight: 800, ...typeOf(g.text), color: item.mark === 'no' && frame >= marked[i]! + MOTION.penDraw ? PAINT.inkMuted : PAINT.ink }}>
              {r.lines.map((l, k) => (
                <div key={k}>{l}</div>
              ))}
            </Text>
          );
        })}
      </Camera>
    </>
  );
};

/** Each participant's bubble and avatar: fill and text colour (generic, no app's look). */
const CHAT_PAINT: Record<'a' | 'b', (T: Grade['tone']) => { bg: string; fg: string }> = {
  a: (T) => ({ bg: T.muted, fg: COLOR.ink }),
  b: (T) => ({ bg: T.teal, fg: COLOR.paper }),
};

/**
 * A generic two-person chat: typing dots on the sender's side, then the bubble pops in on its
 * phrase; the stack scrolls up as it outgrows the stage (bubbles fade out as they reach the
 * stage top) and the newest bubble floats.
 */
const ChatShot: React.FC<ShotProps<'chat'>> = ({ beat, frame, timeline, L }) => {
  const s = beat.shot;
  const { stage } = L.zone;
  const { text, pad, avatar } = L.chat;
  const g = chatLayout(L, s.messages);
  const lands = s.messages.map((m) => cueFrame(beat, m.at, 'message'));
  const typeFrom = lands.map((f, i) => Math.max(i ? lands[i - 1]! + MOTION.enter : beat.from + 2, f - MOTION.typing));
  const pop = lands.map((f) => landing(beat.feel, frame, f, MOTION.enter));
  const shown = pop.map((p) => Math.min(1, Math.max(0, p)));
  // The dots hold the slot until their bubble takes it over, so the stack never jumps.
  const typing = lands.map((f, i) => (frame < typeFrom[i]! ? 0 : frame < f ? progress(frame, typeFrom[i]!, 6) : 1 - shown[i]!));
  const space = g.bubbles.map((b, i) => shown[i]! * (b.h + g.gap) + typing[i]! * (g.dots.h + g.gap));
  const scroll = Math.max(0, space.reduce((a, b) => a + b, 0) - g.gap - stage.h);
  // Each bubble (or its dots) sits on the bottom of its growing slot, so nothing passes the stage bottom while it lands.
  const bottoms = space.map((_, i) => stage.y - scroll + space.slice(0, i + 1).reduce((a, b) => a + b, 0) - g.gap);
  const fade = (top: number) => Math.min(1, Math.max(0, (top - stage.y) / 40 + 1));
  const newest = lands.filter((f) => f <= frame).length - 1;
  const float = (i: number) => (i === newest ? MOTION.floatPx * Math.sin(((frame - lands[i]!) / FPS) * MOTION.floatPerSec * 2 * Math.PI) : 0);
  const avatarPx = Math.round(avatar * 0.58);
  return (
    <>
      <TitleBlock beat={beat} frame={frame} text={chatTitle(s.people)} L={L} />
      <Camera beat={beat} frame={frame} L={L}>
        {g.bubbles.map((b, i) => {
          const m = s.messages[i]!;
          const { bg, fg } = CHAT_PAINT[m.from](timeline.grade.tone);
          const top = bottoms[i]! - b.h + float(i);
          const dotsTop = bottoms[i]! - g.dots.h;
          const seen = fade(top) * shown[i]!;
          const dotsX = m.from === 'a' ? b.x : b.x + b.w - g.dots.w;
          const corner = m.from === 'a' ? '28px 28px 28px 6px' : '28px 28px 6px 28px';
          const tail = Math.max(seen, typing[i]! * fade(dotsTop));
          const bottom = bottoms[i]! + float(i);
          return (
            <React.Fragment key={i}>
              {typing[i]! > 0 && (
                <div style={{ position: 'absolute', left: dotsX, top: dotsTop, width: g.dots.w, height: g.dots.h, background: bg, borderRadius: corner, opacity: typing[i]! * fade(dotsTop), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  {[0, 1, 2].map((k) => (
                    <div key={k} style={{ width: 22, height: 22, borderRadius: 11, background: fg, opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(((frame - typeFrom[i]!) / FPS) * MOTION.typingPulse * 2 * Math.PI - k * 0.9)) }} />
                  ))}
                </div>
              )}
              {tail > 0 && (
                <Text beat={beat} role={`avatar-${i}`} visible={tail} style={{ left: g.avatarX[m.from], top: bottom - avatar, width: avatar, height: avatar, borderRadius: avatar / 2, background: bg, color: fg, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 900, fontSize: avatarPx, lineHeight: `${avatar}px`, textTransform: 'uppercase' }}>
                  {s.people[m.from].slice(0, 1)}
                </Text>
              )}
              {shown[i]! > 0 && (
                <Text
                  beat={beat}
                  role={`message-${i}`}
                  visible={seen}
                  style={{ left: b.x, top, width: b.w, height: b.h, padding: pad, boxSizing: 'border-box', background: bg, borderRadius: corner, fontFamily: FONT.sans, fontWeight: 600, ...typeOf(text), color: fg, transformOrigin: m.from === 'a' ? 'left bottom' : 'right bottom', transform: `scale(${0.6 + 0.4 * pop[i]!})` }}
                >
                  {b.lines.map((l, k) => (
                    <div key={k}>{l}</div>
                  ))}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </Camera>
    </>
  );
};

// ── Transitions + root ──────────────────────────────────────────────────────

/**
 * How each side of a transition looks at eased t∈[0,1]: a paper push slides the outgoing beat
 * off as the incoming one slides on; a highlighter wipe reveals the incoming beat behind a
 * yellow stroke. Glides have no window (the camera is already continuous). Add a transition
 * as a row here, in tokens.ts TRANSITIONS and in motion.ts TRANSITION_RULES.
 */
type Look = { out: (t: number, L: Layout) => React.CSSProperties; in: (t: number, L: Layout) => React.CSSProperties; edge?: (t: number, L: Layout) => React.CSSProperties };
/** Paper push along one axis: the outgoing beat slides off as the incoming one slides on. */
const slide = (axis: 'X' | 'Y'): Look => {
  const size = (L: Layout) => (axis === 'X' ? L.width : L.height);
  return { out: (t, L) => ({ transform: `translate${axis}(${-t * size(L)}px)` }), in: (t, L) => ({ transform: `translate${axis}(${(1 - t) * size(L)}px)` }) };
};
const TRANSITION_LOOKS: Record<TransitionKind, Look> = {
  glide: { out: () => ({}), in: () => ({}) },
  push: slide('X'),
  rise: slide('Y'),
  cut: { out: () => ({}), in: () => ({}) },
  zoom: { out: (t) => ({ transform: `scale(${1 + 0.25 * t})`, opacity: 1 - t }), in: (t) => ({ transform: `scale(${0.88 + 0.12 * t})`, opacity: t }) },
  dip: { out: (t) => ({ opacity: Math.max(0, 1 - 2 * t) }), in: (t) => ({ opacity: Math.max(0, 2 * t - 1) }) },
  wipe: {
    out: (t) => ({ clipPath: `inset(0 0 0 ${t * 100}%)` }),
    in: (t) => ({ clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` }),
    edge: (t, L) => ({ position: 'absolute', left: t * L.width - 30, width: 60, top: -60, bottom: -60, background: PAINT.highlight, mixBlendMode: PAINT.blend, opacity: 0.85, transform: 'skewX(-8deg)' }),
  },
};

/** Shot kind → widget. Add a shot as a row here AND in ShotSchema. */
const SHOTS: { [K in Shot['kind']]: React.FC<ShotProps<K>> } = {
  headline: Headline,
  chapter: Chapter,
  map: MapShot,
  number: NumberShot,
  pictogram: PictogramShot,
  timeline: TimelineShot,
  quote: QuoteShot,
  line: LineShot,
  split: SplitShot,
  chain: ChainShot,
  punch: PunchShot,
  ranking: RankingShot,
  versus: VersusShot,
  checklist: ChecklistShot,
  chat: ChatShot,
};

const BOIL_OFFSETS = [
  [0, 0],
  [-7, 5],
  [5, -6],
] as const;

const BeatLayer: React.FC<{ layer: Layer; frame: number; timeline: Timeline; L: Layout }> = ({ layer, frame, timeline, L }) => {
  const Widget = SHOTS[layer.beat.shot.kind] as React.FC<ShotProps<Shot['kind']>>;
  const look = layer.side === 'solo' ? {} : TRANSITION_LOOKS[layer.kind][layer.side](EASE.inOut(layer.t), L);
  return (
    <AbsoluteFill style={look}>
      <Widget beat={layer.beat} frame={frame} timeline={timeline} L={L} />
    </AbsoluteFill>
  );
};

export const VoxVideo: React.FC<{ timeline: Timeline; assets: VoxAssets }> = ({ timeline, assets }) => {
  const frame = useCurrentFrame();
  const L = LAYOUTS[timeline.aspect];
  const layers = layersAt(timeline.beats, frame);
  const incoming = layers.find((l) => l.side === 'in');
  const edge = incoming && incoming.side === 'in' ? TRANSITION_LOOKS[incoming.kind].edge?.(EASE.inOut(incoming.t), L) : undefined;
  const g = timeline.grade;
  const paint = {
    '--vox-field': g.field,
    '--vox-ink': g.ink,
    '--vox-ink-soft': g.inkSoft,
    '--vox-ink-muted': g.inkMuted,
    '--vox-accent': g.accent,
    '--vox-ochre': g.ochre,
    '--vox-highlight': g.highlight,
    '--vox-blend': g.blend,
  } as React.CSSProperties;
  const [bx, by] = BOIL_OFFSETS[Math.floor((frame * MOTION.boilPerSec) / FPS) % BOIL_OFFSETS.length]!;
  const texture = (src: string, blend?: React.CSSProperties['mixBlendMode'], opacity = 1) => (
    <img src={src} style={{ position: 'absolute', left: -12 + bx, top: -12 + by, width: L.width + 24, height: L.height + 24, objectFit: 'cover', mixBlendMode: blend, opacity, pointerEvents: 'none' }} />
  );
  return (
    <AbsoluteFill style={{ ...paint, background: g.field, overflow: 'hidden' }}>
      {texture(assets.paper, undefined, g.paper)}
      {g.tint && <div style={{ position: 'absolute', inset: 0, background: g.tint, mixBlendMode: 'multiply', pointerEvents: 'none' }} />}
      {layers.map((layer) => (
        <BeatLayer key={layer.beat.id} layer={layer} frame={frame} timeline={timeline} L={L} />
      ))}
      {edge && <div style={edge} />}
      {texture(assets.grain, g.grain.blend, g.grain.opacity)}
    </AbsoluteFill>
  );
};

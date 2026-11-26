/**
 * Compiled Timeline types: the data contract between the Bun-side compiler (timing.ts, geo.ts)
 * and the browser-side widgets (VoxVideo.tsx). Types only, so the browser bundle stays free of
 * Node imports.
 */
import type { Beat, Shot } from './beat-sheet';
import type { GeoSourceId, ProjectionId } from './geo-manifest';
import type { MapEra } from './places';
import type { IconId, IconPath } from './icon-manifest';
import type { Register } from './register';
import type { Aspect, Grade, LabelSide, Tone, TransitionKind, View } from './tokens';

/** Axis-aligned box in projected world px: [x0, y0, x1, y1]. */
export type WorldBox = readonly [number, number, number, number];

/**
 * One compiled map: a world's projection at one era/year, with only what its beats use. Paths
 * are in world px (1920x1080 space), clipped to the world's camera frames.
 */
export interface GeoMap {
  era: MapEra;
  projection: ProjectionId;
  /** Reconstructed (ancient or historical) borders: approximate by construction. */
  approximate: boolean;
  /** Historical (approximate Cliopatria borders) or ancient era-name year. */
  year?: number;
  base: { land: string; borders: string; admin1: string; disputed: string; lakes: string; rivers: string };
  /** Fill id (country, admin-1, polity or AWMC layer) → path, how it draws, and where it bleeds in from. */
  fills: Record<string, { d: string; kind: 'area' | 'lines'; origin: readonly [number, number] }>;
  /** Place id → world point and the name it shows on this map (era names applied). */
  places: Record<string, { at: readonly [number, number]; name: string }>;
}

export interface GeoScene {
  maps: Record<string, GeoMap>;
}

export interface Span {
  start_ms: number;
  end_ms: number;
}

/** One narration token and the frame it starts being spoken. */
export interface SpokenWord {
  token: string;
  frame: number;
}

/**
 * How motion feels in a register (register.ts): entrance duration scale, back-ease spring
 * (0 = none; 1.7 overshoots ~10%), camera push amplitude scale, and camera shake (px) on cue
 * landings (0 = none). `punch`: how a punch word lands: it starts at `scale` and settles to 1
 * over `frames` (0 = a flat cut; the duration scale and spring apply), with a full-bleed flash
 * of `flash` opacity decaying after it (0 = none).
 */
export interface MotionFeel {
  duration: number;
  spring: number;
  push: number;
  shake: number;
  punch: { scale: number; frames: number; flash: number };
}

export interface TimedBeat {
  id: string;
  act: Beat['act'];
  from: number;
  to: number;
  shot: Shot;
  /** Cue phrase (as written in the shot) → absolute frame its first word is spoken. */
  cues: Record<string, number>;
  /** The beat's narration tokens as spoken: kinetic type lands each on-screen word on its word. */
  spoken: SpokenWord[];
  /** Frames the camera push runs over: this beat, or its whole same-world run (no jump between them). */
  push: { from: number; to: number };
  /** The register's motion feel (per beat, so the compiler owns every motion decision). */
  feel: MotionFeel;
  /** How this beat takes over from the previous one: a window centred on the boundary (none on the first beat). */
  enter?: { kind: TransitionKind; from: number; to: number };
  /** Keys of elements already on screen in the previous beat of the same world (no re-entrance). */
  carried: string[];
  /** Map beats only: camera keyframes and resolved label sides. */
  camera?: { from: View; to: View };
  /** Map beats only: the compiled map (GeoScene.maps key) this beat draws. */
  map?: string;
  labelSides?: Partial<Record<string, LabelSide>>;
  /**
   * Previous same-world map layers that leave or change tone in this beat. Each fades out as its
   * replacement's cue lands (`at`), or at the beat start when it is simply removed.
   */
  fading?: { layer: string; tone: Tone; at?: string }[];
}

export interface Timeline {
  aspect: Aspect;
  register: Register;
  /** The register's grade of the paper look; the root composition paints with it. */
  grade: Grade;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  beats: TimedBeat[];
  geo: GeoScene | null;
  /** Datasets the maps of this video drew (geo-manifest GEO_SOURCES ids): the Publisher can offer credits. */
  sources: GeoSourceId[];
  /** Path data of every pictogram icon the sheet uses (only those, so the props stay small). */
  icons: Partial<Record<IconId, IconPath>>;
}


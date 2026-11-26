/**
 * Compiles a validated Beat Sheet + the FULL word-timestamp track into a frame-exact Timeline.
 * Nothing here is guessed by an LLM: beat ranges come from when each beat's first word is
 * spoken, and every element lands on the frame its cue phrase is spoken.
 */
import type { WordTimestamp } from '../providers';
import { overlapRatio } from './audit';
import { FORMATS, continues, findPhrase, shotPhrases, type BeatSheet, type Shot, type ShotKind } from './beat-sheet';
import { DEFAULT_WORLDVIEW, type Worldview } from './geo-manifest';
import ICON_PATHS from '../../assets/icons/icons.json';
import type { IconId, IconPath } from './icon-manifest';
import { speechUnits, tokenize } from './speech';
import { compileMaps, inside } from './geo';
import { resolveSheetRefs } from './places';
import { cameraAt, transitionFor, transitionWindow } from './motion';
import { punchlineBeats, resolveStyle } from './register';
import { chatTitle } from './rows';
import type { GeoMap, Span, TimedBeat, Timeline } from './timeline';
import { BEAT_LEAD_MS, FPS, LAYOUTS, PIN, TAIL_MS, arrowPoint, labelRect, penArrow, toScreen, type Layout, type LabelSide, type Rect, type View } from './tokens';

// ── Script ↔ audio alignment ────────────────────────────────────────────────

/**
 * Aligns the script's written words to timed words (TTS provider tokens or ASR output) with an
 * LCS over number-aware units (speechUnits) and returns one span per script token
 * (`script.flatMap(tokenize)`). A matched unit shares its audio span evenly across its script
 * tokens; unmatched tokens are interpolated between their matched neighbours. Throws if nothing
 * matches (audio is not this script).
 */
export function alignScript(script: readonly string[], words: readonly WordTimestamp[]): Span[] {
  const timed = words.flatMap((w) => tokenize(w.word).map(() => w));
  const a = speechUnits(script);
  const b = speechUnits(words.map((w) => w.word));
  const n = a.at(-1)?.to ?? 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i]!.key === b[j]!.key ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const matched: (Span | null)[] = new Array(n).fill(null);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i]!.key === b[j]!.key) {
      const { from, to } = a[i]!;
      const [t0, t1] = [timed[b[j]!.from]!.start_ms, timed[b[j]!.to - 1]!.end_ms];
      const slice = (t1 - t0) / (to - from);
      for (let k = from; k < to; k++) matched[k] = { start_ms: t0 + slice * (k - from), end_ms: t0 + slice * (k - from + 1) };
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const anchors = matched.flatMap((s, i) => (s ? [i] : []));
  if (anchors.length === 0) throw new Error('alignment failed: no script word matches the audio transcript');
  const audioEnd = words[words.length - 1]!.end_ms;
  return matched.map((s, i) => {
    if (s) return s;
    const prev = anchors.filter((a) => a < i).at(-1);
    const next = anchors.find((a) => a > i);
    const t0 = prev === undefined ? 0 : matched[prev]!.end_ms;
    const t1 = next === undefined ? audioEnd : matched[next]!.start_ms;
    const slots = (next ?? n) - (prev ?? -1);
    const k = i - (prev ?? -1);
    return { start_ms: t0 + ((t1 - t0) * (k - 1)) / slots, end_ms: t0 + ((t1 - t0) * k) / slots };
  });
}

/**
 * The script's own words (original spelling and punctuation) with aligned timings, for
 * captions: viewers read what was written, never ASR spellings like "C," for "CE".
 */
export function scriptWords(sheet: BeatSheet, words: readonly WordTimestamp[]): WordTimestamp[] {
  const written = sheet.beats.flatMap((b) => b.narration.split(/\s+/)).filter((w) => tokenize(w).length > 0);
  const spans = alignScript(written, words);
  let cursor = 0;
  return written.map((word) => {
    const n = tokenize(word).length;
    const first = spans[cursor]!;
    const last = spans[cursor + n - 1]!;
    cursor += n;
    return { word, start_ms: Math.round(first.start_ms), end_ms: Math.round(last.end_ms) };
  });
}

// ── Map label placement ─────────────────────────────────────────────────────

const SIDES: readonly LabelSide[] = ['right', 'left', 'above', 'below'];

/** Samples along each map arrow, as small obstacles a label must not cover; an army arrow is a thick stroke. */
const ARROW_SAMPLES = 24;
const ARROW_HIT_PX = { pen: 8, army: 24 } as const;

/**
 * Greedy placement against reserved zones, the pen and army arrows, pin heads and
 * already-placed labels; least-bad side wins. Pins are labelled like labels.
 */
function placeLabels(shot: Extract<Shot, { kind: 'map' }>, view: View, map: GeoMap, layout: Layout): Partial<Record<string, LabelSide>> {
  const { zone } = layout;
  const at = (place: string) => toScreen(view, map.places[place]!.at, layout);
  const routes = [...(shot.arrow ? [{ ...shot.arrow, hit: ARROW_HIT_PX.pen }] : []), ...(shot.armies ?? []).map((a) => ({ ...a, hit: ARROW_HIT_PX.army }))];
  const arrowHits: Rect[] = routes.flatMap(({ from, to, hit }) => {
    const arrow = penArrow(at(from), at(to));
    return Array.from({ length: ARROW_SAMPLES + 1 }, (_, i) => {
      const [x, y] = arrowPoint(arrow, i / ARROW_SAMPLES);
      return { x: x - hit / 2, y: y - hit / 2, w: hit, h: hit };
    });
  });
  const pinHeads: Rect[] = (shot.pins ?? []).map(({ place }) => {
    const [x, y] = at(place);
    return { x: x - PIN.head, y: y - PIN.height, w: 2 * PIN.head, h: PIN.height };
  });
  const obstacles: Rect[] = [zone.subtitles, ...(shot.title ? [zone.title] : []), ...arrowHits, ...pinHeads];
  const placed: Partial<Record<string, LabelSide>> = {};
  for (const { place } of [...shot.labels, ...(shot.pins ?? [])]) {
    const pt = at(place);
    const name = map.places[place]!.name;
    const cost = (side: LabelSide) => {
      const r = labelRect(name, pt, side);
      return (inside(r, zone.safe) ? 0 : 10) + obstacles.reduce((c, o) => c + overlapRatio(r, o), 0);
    };
    const side = SIDES.reduce((best, s) => (cost(s) < cost(best) ? s : best), SIDES[0]!);
    placed[place] = side;
    obstacles.push(labelRect(name, pt, side));
  }
  return placed;
}

// ── Timeline compilation ────────────────────────────────────────────────────

const msToFrame = (ms: number) => Math.max(0, Math.round((ms / 1000) * FPS));

/**
 * Stable keys of a shot's persistent elements, for same-world continuity: an element whose key
 * the previous beat of the world also had is already on screen (no re-entrance). Chain nodes key
 * on their index too, so a growing chain (rule chain_grows) carries exactly its previous nodes.
 */
const ELEMENT_KEYS: { [K in ShotKind]: (s: Extract<Shot, { kind: K }>) => string[] } = {
  headline: () => [],
  chapter: () => [],
  map: (s) => [...(s.title ? [`title:${s.title.text}`] : []), ...s.layers.map((l) => `layer:${l.layer}:${l.tone}`), ...s.labels.map((l) => `label:${l.place}`), ...(s.pins ?? []).map((p) => `pin:${p.place}`)],
  number: () => [],
  pictogram: (s) => [`title:${s.title}`],
  timeline: (s) => s.marks.map((m) => `mark:${m.year}`),
  quote: () => [],
  line: (s) => [`title:${s.title}`],
  split: (s) => [`title:${s.whole}`, ...s.parts.map((p) => `part:${p.label}:${p.tone}`)],
  chain: (s) => [...(s.title ? [`title:${s.title}`] : []), ...s.nodes.map((n, i) => `node:${i}:${n.label}`)],
  punch: () => [],
  ranking: (s) => [`title:${s.title}`],
  versus: (s) => s.sides.map((side) => `side:${side.label}`),
  checklist: (s) => (s.title ? [`title:${s.title}`] : []),
  chat: (s) => [`title:${chatTitle(s.people)}`],
};
const elementKeys = (shot: Shot) => (ELEMENT_KEYS[shot.kind] as (s: Shot) => string[])(shot);

/**
 * `worldview` is the org setting for disputed borders (geo-manifest WORLDVIEWS). The sheet's map
 * references are resolved again (idempotent on canonical ids), so a stored sheet with names
 * still compiles; an unresolvable one fails loud.
 */
export function compileTimeline(input: BeatSheet, words: readonly WordTimestamp[], opts: { worldview?: Worldview } = {}): Timeline {
  const { sheet, violations } = resolveSheetRefs(input);
  if (violations.length > 0) throw new Error(`map references do not resolve (run checkBeatSheet first):\n${violations.map((v) => `- ${v.beatId}: ${v.message}`).join('\n')}`);
  const beatTokens = sheet.beats.map((b) => tokenize(b.narration));
  const spans = alignScript(sheet.beats.flatMap((b) => b.narration.split(/\s+/)), words);
  let cursor = 0;
  const beatSpans = beatTokens.map((toks) => {
    const s = spans.slice(cursor, cursor + toks.length);
    cursor += toks.length;
    return s;
  });

  const lastEnd = spans[spans.length - 1]!.end_ms + TAIL_MS;
  const starts = beatSpans.map((s, i) => (i === 0 ? 0 : msToFrame(s[0]!.start_ms - BEAT_LEAD_MS)));
  const durationInFrames = msToFrame(lastEnd);
  const ends = starts.map((_, i) => starts[i + 1] ?? durationInFrames);
  const aspect = FORMATS[sheet.format].aspect;
  const style = resolveStyle(FORMATS[sheet.format], sheet.register);
  const punch = punchlineBeats(sheet.beats.map((b) => b.act), style.punchActs);
  const layout = LAYOUTS[aspect];
  const maps = compileMaps(sheet, layout, opts.worldview ?? DEFAULT_WORLDVIEW);
  const sameWorld = sheet.beats.map((beat, i) => continues(sheet.beats[i - 1], beat));
  // A same-world run shares one camera push, so nothing jumps where its beats meet.
  const runStart = sameWorld.reduce<number[]>((acc, same, i) => [...acc, same ? acc[i - 1]! : i], []);
  const runEnd = sameWorld.reduceRight<number[]>((acc, _, i) => [sameWorld[i + 1] ? acc[0]! : i, ...acc], []);

  const beats: TimedBeat[] = [];
  sheet.beats.forEach((beat, i) => {
    const toks = beatTokens[i]!;
    const cues = Object.fromEntries(
      shotPhrases(beat.shot).map((p) => {
        const idx = findPhrase(toks, p);
        if (idx < 0) throw new Error(`beat ${beat.id}: cue "${p}" not in narration (run checkBeatSheet first)`);
        return [p, Math.max(starts[i]!, msToFrame(beatSpans[i]![idx]!.start_ms))];
      }),
    );
    const prev = sheet.beats[i - 1];
    const prevKeys = sameWorld[i] ? new Set(elementKeys(prev!.shot)) : new Set<string>();
    const house = prev && transitionFor(prev.shot.kind, beat.shot.kind, sameWorld[i]!, aspect);
    // The register re-voices the house transition; only its punchline kind may cut, and never inside a same-world glide.
    const kind = house && (punch[i] && !sameWorld[i] && style.transitions.punchline ? style.transitions.punchline : (style.transitions.swap[house] ?? house));
    const timed: TimedBeat = {
      id: beat.id,
      act: beat.act,
      from: starts[i]!,
      to: ends[i]!,
      shot: beat.shot,
      cues,
      spoken: toks.map((token, j) => ({ token, frame: msToFrame(beatSpans[i]![j]!.start_ms) })),
      push: { from: starts[runStart[i]!]!, to: ends[runEnd[i]!]! },
      feel: style.motion,
      ...(kind && { enter: { kind, ...transitionWindow(kind, starts[i]!, ends[i - 1]! - starts[i - 1]!, ends[i]! - starts[i]!) } }),
      carried: elementKeys(beat.shot).filter((k) => prevKeys.has(k)),
    };
    const mapBeat = maps?.beats[i];
    if (beat.shot.kind !== 'map' || !maps || !mapBeat) {
      beats.push(timed);
      return;
    }
    const to = mapBeat.view;
    // Same world: start exactly where the previous camera ended (after its drift), so it glides.
    const before = beats[i - 1];
    const from = sameWorld[i] && before?.camera ? cameraAt(before.camera, before.from, before.to) : to;
    const layers = beat.shot.layers;
    const fading = (sameWorld[i] && prev!.shot.kind === 'map' ? prev!.shot.layers : [])
      .filter((p) => !layers.some((l) => l.layer === p.layer && l.tone === p.tone))
      .map((p) => ({ layer: p.layer, tone: p.tone, at: layers.find((l) => l.layer === p.layer)?.at }));
    beats.push({ ...timed, map: mapBeat.map, camera: { from, to }, labelSides: placeLabels(beat.shot, to, maps.scene.maps[mapBeat.map]!, layout), fading });
  });

  const iconIds = sheet.beats.flatMap(({ shot }) => (shot.kind === 'pictogram' ? [shot.icon, ...shot.groups.map((g) => g.icon)] : [])).filter((id): id is IconId => !!id);
  const icons = Object.fromEntries(iconIds.map((id) => [id, (ICON_PATHS as Record<IconId, IconPath>)[id]]));
  return { aspect, register: sheet.register, grade: style.grade, fps: FPS, width: layout.width, height: layout.height, durationInFrames, beats, geo: maps?.scene ?? null, sources: maps?.sources ?? [], icons };
}

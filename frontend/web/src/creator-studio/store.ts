/** A tiny store plus a simulated pipeline. Front end only: every run, log and number here is fake. */
import { useEffect, useState } from 'react';
import { createBackendRun, type SessionState } from './api';
import type { NodePositionUpdate, SyncState } from './sync';

export type Status = 'idle' | 'running' | 'approval' | 'failed';
export type ApprovalMode = 'gate' | 'auto';
export type PublishMode = 'gate' | 'scheduled' | 'auto';
/** Component types on the board. The Architect builds and configures any of them. */
export type CType = 'agent' | 'status' | 'tracker' | 'aggregator';
export type Kind = 'trend' | 'toptrends' | 'screenplay' | 'voice' | 'animation' | 'manim' | 'uploads' | 'compiler' | 'publisher'
  | 'credits' | 'analytics' | 'spend' | 'research' | 'thumbs';
export type View = 'board' | 'architect' | 'publish' | 'org' | 'settings';

export interface BoardNode {
  id: string; kind: Kind; type: CType; title: string; sub: string;
  x: number; y: number; w: number; h: number;
  status: Status; progress: number; note: string;
  /** Trackers and aggregators: show data, no agent status. */
  widget?: boolean;
}
export interface Edge { from: string; to: string }
export interface Scene { id: string; narration: string; visual: string; primitive: string; secs: number }
export interface Topic { name: string; velocity: number; novelty: number; spark: number[] }
export interface Workspace { id: string; name: string; nodes: BoardNode[]; edges: Edge[] }
export interface Video { id: string; title: string; topic: string; hue: number; state: 'ready' | 'scheduled' | 'published'; when: string }
/** One trip through the pipeline: a script, and the voice, animation and video made from it. */
export interface Production {
  vid: string; topic: string; title: string; hook: string; scenes: Scene[];
  date: string; t: number; hue: number; secs: number; words: number; voice: string;
  script: 'approved' | 'rejected';
  video: 'none' | 'voiced' | 'rendered' | 'ready' | 'scheduled' | 'published';
  platforms: string[]; views: number;
}
export interface Drag { topic: string; x: number; y: number; w: number; lean: number; over: boolean; phase: 'drag' | 'drop' | 'return' }

export interface State {
  view: View;
  /** The active workspace's board lives in nodes/edges; the others are stashed in workspaces. */
  ws: string;
  workspaces: Workspace[];
  nodes: BoardNode[];
  edges: Edge[];
  selected: string | null;
  tab: string | null;
  partner: { x: number; y: number; on: string | null };
  logs: Record<string, string[]>;
  keywords: string[];
  topics: Topic[];
  /** The script Screenplay is working on now. */
  draftTopic: string | null;
  /** Explicit Screenplay approval mode: pause at gate or advance straight to Voiceover. */
  screenplayMode: ApprovalMode;
  /** Explicit Publisher mode: human gate, scheduled queue, or auto-publish. */
  publishMode: PublishMode;
  hook: string;
  scenes: Scene[];
  queue: string[];
  history: Production[];
  beats: Record<string, boolean[]>;
  drag: Drag | null;
  ghost: BoardNode | null;
  ghostStage: number;
  videos: Video[];
  prefs: { snap: boolean; cursors: boolean; pulses: boolean; notifyApproval: boolean; notifyFail: boolean; calm: boolean };
  credits: { used: number; total: number };
  spend: { label: string; cost: number }[];
  income: number;
  /** Workspaces where you chose to start blank (hides the starter picker). */
  blank: string[];
  /** Explicit auth/session state hydrated from backend/core (/api/auth/me). */
  session: SessionState;
  /** Explicit Yjs WebSocket sync state. */
  syncState: SyncState;
}

const spark = () => Array.from({ length: 14 }, (_, i) => 0.25 + 0.5 * Math.random() * (i / 14) + 0.25 * (i / 14));
const isWidget = (t: CType) => t === 'tracker' || t === 'aggregator';

const N = (id: string, kind: Kind, type: CType, title: string, sub: string, x: number, y: number, w: number, h: number, status: Status, note = ''): BoardNode =>
  ({ id, kind, type, title, sub, x, y, w, h, status, progress: 0, note, widget: isWidget(type) });

function explainer(): { nodes: BoardNode[]; edges: Edge[] } {
  return {
    nodes: [
      N('trend', 'trend', 'agent', 'Trend Scout', 'SerpApi · every 30 min', 0, 0, 280, 230, 'idle', 'Last run 4 min ago'),
      N('toptrends', 'toptrends', 'aggregator', 'Today’s top trends', 'Aggregator · from Trend Scout', 340, 0, 280, 330, 'idle'),
      N('screenplay', 'screenplay', 'agent', 'Screenplay', 'Claude Sonnet 4.5', 680, 0, 280, 270, 'approval', 'Draft ready for review'),
      N('voice', 'voice', 'agent', 'Voiceover', 'ElevenLabs · with timestamps', 1020, 0, 280, 200, 'idle', 'Waiting for script'),
      N('animation', 'animation', 'agent', 'Animation', 'Remotion + Manim', 1360, 0, 280, 240, 'idle', 'Waiting for voice'),
      N('spend', 'spend', 'tracker', 'Spend today', 'Tracker · costs and income', 0, 400, 280, 230, 'idle'),
      N('analytics', 'analytics', 'tracker', 'YouTube, last 7 days', 'Tracker · channel stats', 340, 400, 280, 220, 'idle'),
      N('publisher', 'publisher', 'agent', 'Publisher', 'YouTube · TikTok · Reels', 680, 400, 280, 280, 'approval', '“How GPS knows the time” is ready'),
      N('compiler', 'compiler', 'agent', 'Compiler', '16:9 + 9:16 · captions', 1020, 400, 280, 200, 'idle', 'Idle'),
      N('manim', 'manim', 'status', 'Manim renderer', 'Status · math scenes', 1360, 400, 280, 180, 'failed', 'LaTeX missing in render image'),
    ],
    edges: [
      { from: 'trend', to: 'toptrends' },
      { from: 'toptrends', to: 'screenplay' },
      { from: 'screenplay', to: 'voice' },
      { from: 'voice', to: 'animation' },
      { from: 'animation', to: 'manim' },
      { from: 'animation', to: 'compiler' },
      { from: 'compiler', to: 'publisher' },
      { from: 'publisher', to: 'analytics' },
    ],
  };
}

/** Starter boards for new workspaces. Ids are prefixed so every workspace's nodes stay distinct. */
export function shortsBoard(px: string): { nodes: BoardNode[]; edges: Edge[] } {
  const nodes = [
    N(`${px}-trend`, 'trend', 'agent', 'Trend Scout', 'SerpApi · every 2 h', 0, 0, 280, 230, 'idle', 'Last run 1 h ago'),
    N(`${px}-toptrends`, 'toptrends', 'aggregator', 'Today’s top trends', 'Aggregator · from Trend Scout', 340, 0, 280, 330, 'idle'),
    N(`${px}-screenplay`, 'screenplay', 'agent', 'Screenplay', 'Claude Sonnet 4.5 · 30 s cap', 680, 0, 280, 270, 'idle', 'Approved yesterday'),
    N(`${px}-voice`, 'voice', 'agent', 'Voiceover', 'ElevenLabs Flash v2.5', 1020, 0, 280, 200, 'idle', '28.4 s · 71 words'),
    N(`${px}-compiler`, 'compiler', 'agent', 'Compiler', '9:16 only · captions', 1020, 400, 280, 200, 'idle', 'Ready'),
    N(`${px}-publisher`, 'publisher', 'agent', 'Publisher', 'Shorts · TikTok · Reels', 680, 400, 280, 280, 'idle', 'Posts daily at 18:00'),
  ];
  const ids = nodes.map((n) => n.id);
  return { nodes, edges: ids.slice(1).map((to, i) => ({ from: ids[i], to })) };
}
export function templateBoard(t: 'explainer' | 'shorts', px: string): { nodes: BoardNode[]; edges: Edge[] } {
  if (t === 'shorts') {
    const b = shortsBoard(px);
    return { nodes: b.nodes.map((n) => ({ ...n, note: n.widget ? '' : 'Never run' })), edges: b.edges };
  }
  const e = explainer();
  return {
    nodes: e.nodes.map((n) => ({ ...n, id: `${px}-${n.id}`, status: 'idle' as Status, note: n.widget ? '' : 'Never run' })),
    edges: e.edges.map((x) => ({ from: `${px}-${x.from}`, to: `${px}-${x.to}` })),
  };
}

// ── scripts ────────────────────────────────────────────────────────────
const sodium: Scene[] = [
  { id: 's1', secs: 8, narration: 'Lithium runs almost every battery you own. But it is scarce, and it is getting expensive.', visual: 'Price chart of lithium carbonate, 2015 to today, line draws left to right.', primitive: 'chart' },
  { id: 's2', secs: 11, narration: 'Sodium sits right below lithium on the periodic table, and there is a mountain of it in every ocean.', visual: 'Periodic table zooms to Li, slides down to Na. Callout: “1,000× more abundant”.', primitive: 'kinetic' },
  { id: 's3', secs: 12, narration: 'The trade-off is energy density. A sodium cell stores about a third less per kilo.', visual: 'Two cells side by side, bars fill to 160 and 250 Wh/kg.', primitive: 'equation' },
  { id: 's4', secs: 10, narration: 'For a city car or a home battery, that is a trade most people will never notice.', visual: 'Map of China, callouts on the first sodium-cell factories.', primitive: 'map' },
];
const hooks: Record<string, string> = {
  'Sodium batteries are coming': 'Your next car battery might be made from table salt.',
  'Heat pumps in cold countries': 'The coldest countries on Earth are the ones going all in on heat pumps.',
  'Why the Moon is drifting away': 'Every year the Moon slips 3.8 centimetres further away.',
  'AI chips and the power grid': 'One new data centre can use as much power as a small city.',
  'Lab-grown coffee': 'This coffee never touched a coffee plant.',
  'Cities that banned cars': 'Some cities took the cars out, and the shops got busier.',
  'How GPS knows the time': 'Your phone corrects for Einstein every single second.',
  'Why ocean shipping got slow': 'Container ships are deliberately going slower than in 2008.',
  'The math of a perfect shuffle': 'Seven riffle shuffles. Not six, not eight. Seven.',
  'Is cold fusion back?': 'A lab says it made fusion at room temperature. Again.',
  'Why your phone gets slower': 'Your phone is not getting slower. Your apps are getting heavier.',
  'How fog nets catch water': 'In the driest desert on Earth, villages drink from the fog.',
};
export function scriptFor(topic: string): { hook: string; scenes: Scene[] } {
  if (topic === 'Sodium batteries are coming') return { hook: hooks[topic], scenes: sodium };
  const t = topic.replace(/\?$/, '');
  return {
    hook: hooks[topic] ?? `${t}, in under a minute.`,
    scenes: [
      { id: 's1', secs: 9, narration: `${t}: here is the short version, and why it is suddenly everywhere.`, visual: 'Headline collage resolves into one sentence of kinetic type.', primitive: 'kinetic' },
      { id: 's2', secs: 11, narration: 'The numbers moved faster this year than in the decade before.', visual: 'Line chart, 2015 to today, the last segment steepens.', primitive: 'chart' },
      { id: 's3', secs: 12, narration: 'The mechanism is simpler than it sounds, once you see it drawn.', visual: 'Diagram builds part by part, labels arrive after shapes.', primitive: 'equation' },
      { id: 's4', secs: 9, narration: 'And this is where it is happening first.', visual: 'World map, three callouts pulse in order.', primitive: 'map' },
    ],
  };
}

const prod = (vid: string, topic: string, date: string, t: number, hue: number, script: Production['script'], video: Production['video'], platforms: string[], views: number): Production => {
  const s = scriptFor(topic);
  const secs = s.scenes.reduce((a, b) => a + b.secs, 0);
  return { vid, topic, title: topic, hook: s.hook, scenes: s.scenes, date, t, hue, secs, words: Math.round(secs * 2.4), voice: 'Ada · warm narrator', script, video, platforms, views };
};

export const initial = (): State => ({
  view: 'board',
  ...(() => { const e = explainer(); return { ws: 'explainers', nodes: e.nodes, edges: e.edges, workspaces: [{ id: 'explainers', name: 'Explainers', nodes: [], edges: [] }, { id: 'shorts', name: 'Shorts daily', ...shortsBoard('sd') }, { id: 'clips', name: 'Podcast clips', nodes: [], edges: [] }] }; })(),
  selected: null,
  tab: null,
  partner: { x: 820, y: 160, on: null },
  logs: {
    trend: ['09:12:04  polling 7 keywords', '09:12:06  google_trends → 212 rows', '09:12:07  google_news → 64 articles', '09:12:09  scored 31 topics', '09:12:09  sent top 6 to Today’s top trends'],
    toptrends: ['09:12:09  6 topics from Trend Scout', '09:12:09  1 already made (Cities that banned cars)'],
    screenplay: ['09:12:40  topic dropped: Sodium batteries are coming', '09:12:52  storyboard: 4 scenes, 41 s', '09:12:52  schema ok (zod)', '09:12:52  paused: waiting for approval'],
    voice: ['08:40:02  VID-0418 synthesised 38.2 s', '08:40:02  91 word timestamps'],
    animation: ['08:41:30  VID-0418 rendered 4 scenes (Remotion)', '08:41:14  scene 3 handed to Manim: failed'],
    manim: ['08:41:12  scene 3: equation morph', '08:41:14  error: latex: command not found', '08:41:14  exit 1'],
    compiler: ['08:44:51  VID-0418 1920×1080 done', '08:45:20  VID-0418 1080×1920 done', '08:45:22  captions burned'],
    publisher: ['08:45:30  queued VID-0418 “How GPS knows the time”', '08:45:31  waiting for sign-off'],
    analytics: ['live · polling /api/youtube/stats every 60 s'],
    spend: ['live · summing provider invoices every 10 min'],
  },
  keywords: ['Tech', 'AI', 'Batteries', 'Space', 'Climate', 'Cities', 'Math'],
  topics: [
    { name: 'Sodium batteries are coming', velocity: 0.91, novelty: 0.78, spark: spark() },
    { name: 'Heat pumps in cold countries', velocity: 0.83, novelty: 0.66, spark: spark() },
    { name: 'Why the Moon is drifting away', velocity: 0.77, novelty: 0.81, spark: spark() },
    { name: 'AI chips and the power grid', velocity: 0.71, novelty: 0.58, spark: spark() },
    { name: 'Lab-grown coffee', velocity: 0.62, novelty: 0.9, spark: spark() },
    { name: 'Cities that banned cars', velocity: 0.48, novelty: 0.4, spark: spark() },
  ],
  draftTopic: 'Sodium batteries are coming',
  screenplayMode: 'gate',
  publishMode: 'gate',
  hook: hooks['Sodium batteries are coming'],
  scenes: sodium,
  queue: [],
  history: [
    prod('VID-0418', 'How GPS knows the time', 'Today 08:12', 18, 262, 'approved', 'ready', [], 0),
    prod('VID-0417', 'Why ocean shipping got slow', 'Yesterday 17:20', 17, 205, 'approved', 'scheduled', ['yt', 'shorts'], 0),
    prod('VID-0416', 'The math of a perfect shuffle', 'Sat 22 Nov', 16, 32, 'approved', 'published', ['yt', 'shorts', 'tiktok'], 18_400),
    prod('VID-0415', 'Cities that banned cars', 'Wed 19 Nov', 15, 150, 'approved', 'published', ['yt', 'shorts', 'tiktok', 'reels'], 31_200),
    prod('—', 'Is cold fusion back?', 'Tue 18 Nov', 14.5, 0, 'rejected', 'none', [], 0),
    prod('VID-0414', 'Why your phone gets slower', 'Mon 17 Nov', 14, 340, 'approved', 'published', ['yt', 'shorts', 'tiktok'], 52_900),
    prod('VID-0413', 'How fog nets catch water', 'Fri 14 Nov', 13, 190, 'approved', 'published', ['yt', 'reels'], 12_100),
  ],
  beats: {
    manim: [...Array(20).fill(true), false, false, false, false],
    uploads: Array(24).fill(true),
  },
  drag: null,
  ghost: null,
  ghostStage: 0,
  videos: [
    { id: 'VID-0418', title: 'How GPS knows the time', topic: 'Relativity in your pocket', hue: 262, state: 'ready', when: 'Ready now' },
    { id: 'VID-0417', title: 'Why ocean shipping got slow', topic: 'Slow steaming', hue: 205, state: 'scheduled', when: 'Thu 09:00' },
    { id: 'VID-0416', title: 'The math of a perfect shuffle', topic: 'Seven riffles', hue: 32, state: 'published', when: '2 days ago' },
    { id: 'VID-0415', title: 'Cities that banned cars', topic: 'Car-free cores', hue: 150, state: 'published', when: 'Last week' },
  ],
  prefs: { snap: true, cursors: true, pulses: true, notifyApproval: true, notifyFail: true, calm: false },
  credits: { used: 412_300, total: 500_000 },
  spend: [{ label: 'Claude', cost: 4.12 }, { label: 'ElevenLabs', cost: 2.8 }, { label: 'Render', cost: 1.9 }, { label: 'SerpApi', cost: 0.6 }],
  income: 31.2,
  blank: [],
  session: { status: 'OfflineDemo', role: 'org:admin' },
  syncState: 'Disconnected',
});

let publishMoveFn: ((pos: NodePositionUpdate) => void) | null = null;
export function setMovePublisher(fn: ((pos: NodePositionUpdate) => void) | null) {
  publishMoveFn = fn;
}
export function broadcastNodePosition(pos: NodePositionUpdate) {
  publishMoveFn?.(pos);
}

// ── store ──────────────────────────────────────────────────────────────
let state = initial();
const subs = new Set<() => void>();
export const get = () => state;
export function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export function useStudio(): State {
  const [, setN] = useState(0);
  useEffect(() => { const f = () => setN((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
export function patchNode(id: string, p: Partial<BoardNode>) {
  set((s) => s.nodes.some((n) => n.id === id)
    ? { nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }
    : { workspaces: s.workspaces.map((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) })) });
}
/** A node wherever it lives, so runs keep going while you look at another workspace. */
export const node = (id: string | null) => state.nodes.find((n) => n.id === id) ?? state.workspaces.flatMap((w) => w.nodes).find((n) => n.id === id) ?? null;
const patchProd = (vid: string, p: Partial<Production>) => set((s) => ({ history: s.history.map((h) => (h.vid === vid ? { ...h, ...p } : h)) }));

// ── workspaces ─────────────────────────────────────────────────────────
export const wsNodes = (s: State, id: string) => (id === s.ws ? s.nodes : s.workspaces.find((w) => w.id === id)?.nodes ?? []);
export function switchWs(id: string) {
  set((s) => {
    if (id === s.ws) return { view: 'board', selected: null };
    const to = s.workspaces.find((w) => w.id === id)!;
    return {
      workspaces: s.workspaces.map((w) => (w.id === s.ws ? { ...w, nodes: s.nodes, edges: s.edges } : w)),
      ws: id, nodes: to.nodes, edges: to.edges, view: 'board', selected: null, ghost: null, ghostStage: 0, partner: { ...s.partner, on: null },
    };
  });
}
export function createWs(name: string) {
  const id = `w${Date.now().toString(36)}`;
  set((s) => ({ workspaces: [...s.workspaces, { id, name, nodes: [], edges: [] }] }));
  switchWs(id);
}
export function startFrom(t: 'explainer' | 'shorts' | 'blank') {
  if (t === 'blank') { set((s) => ({ blank: [...s.blank, s.ws] })); return; }
  set((s) => templateBoard(t, s.ws));
}

const stamp = () => new Date().toTimeString().slice(0, 8);
export function log(id: string, line: string) {
  set((s) => ({ logs: { ...s.logs, [id]: [...(s.logs[id] ?? []), `${stamp()}  ${line}`].slice(-80) } }));
}

// ── simulated runs ─────────────────────────────────────────────────────
const timers = new Set<number>();
const later = (ms: number, fn: () => void) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
let speed = 1;

/** Run a node for `ms`, streaming `lines` into its log and advancing its progress. Calls `done` at the end. */
function run(id: string, ms: number, lines: string[], done?: () => void) {
  ms *= speed;
  patchNode(id, { status: 'running', progress: 0, note: 'Running' });
  const t0 = performance.now();
  lines.forEach((l, i) => later((ms * (i + 0.5)) / lines.length, () => log(id, l)));
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    if (node(id)?.status !== 'running') return;
    patchNode(id, { progress: p });
    if (p < 1) later(120, tick);
    else done?.();
  };
  later(120, tick);
}

export function runTrend() {
  run('trend', 6000, [`polling ${get().keywords.length} keywords`, 'google_trends → 198 rows', 'google_news → 71 articles', 'scoring velocity and novelty', 'sent top 6 to Today’s top trends'], () => {
    set((s) => ({ topics: s.topics.map((t) => ({ ...t, velocity: Math.min(0.97, Math.max(0.3, t.velocity + (Math.random() - 0.45) * 0.12)), spark: spark() })).sort((a, b) => b.velocity - a.velocity) }));
    patchNode('trend', { status: 'idle', note: 'Last run just now' });
    log('toptrends', 'refreshed from Trend Scout');
  });
}

/** Where a topic stands today: already made, waiting in the queue, or being written now. */
export function topicState(s: State, name: string): 'made' | 'queued' | 'writing' | null {
  if (s.draftTopic === name) return 'writing';
  if (s.queue.includes(name)) return 'queued';
  if (s.history.some((h) => h.topic === name && h.script === 'approved')) return 'made';
  return null;
}

/** A topic dropped onto a Screenplay node: write now, or queue when it's busy. */
export function dropTopic(name: string, id = 'screenplay') {
  const n = node(id);
  if (!n) return;
  if (n.status === 'running' || n.status === 'approval' || get().draftTopic) {
    if (get().draftTopic !== name && !get().queue.includes(name)) { set((s) => ({ queue: [...s.queue, name] })); log(id, `queued: ${name}`); }
    return;
  }
  draft(name, id);
}

function draft(name: string, id = 'screenplay') {
  set({ draftTopic: name });
  log(id, `topic dropped: ${name}`);
  if (get().session.status === 'Authenticated') {
    createBackendRun(get().ws, name, get().screenplayMode)
      .then((r) => log(id, `synced backend run ${r.run_id}`))
      .catch((e) => log(id, `backend run sync skipped: ${(e as Error).message}`));
  }
  run(id, 4500, ['reading 12 sources', 'outlining hook and beats', 'writing 4 scenes', 'schema ok (zod)'], () => {
    const sc = scriptFor(name);
    set({ hook: sc.hook, scenes: sc.scenes });
    if (get().screenplayMode === 'auto') {
      log(id, 'auto mode: advancing straight to Voiceover');
      approveScript();
      return;
    }
    patchNode(id, { status: 'approval', note: `Draft ready: ${name}` });
    log(id, 'paused: waiting for approval');
  });
}

export function unqueue(name: string) { set((s) => ({ queue: s.queue.filter((q) => q !== name) })); }

function nextFromQueue() {
  const [next, ...rest] = get().queue;
  if (!next || get().draftTopic) return;
  set({ queue: rest });
  draft(next);
}

let vidN = 419;
export function approveScript() {
  const s = get();
  const topic = s.draftTopic ?? 'Untitled';
  const vid = `VID-0${vidN++}`;
  const secs = s.scenes.reduce((a, b) => a + b.secs, 0);
  set((st) => ({
    draftTopic: null,
    history: [{ vid, topic, title: topic, hook: st.hook, scenes: st.scenes, date: 'Just now', t: 100 + vidN, hue: (vidN * 47) % 360, secs, words: Math.round(secs * 2.4), voice: 'Ada · warm narrator', script: 'approved', video: 'none', platforms: [], views: 0 }, ...st.history],
  }));
  patchNode('screenplay', { status: 'idle', note: `Approved: ${topic}` });
  log('screenplay', `approved ${vid} · handed to Voiceover`);
  later(900, nextFromQueue);
  run('voice', 5000, [`${vid} synthesising 4 scenes`, 'eleven_multilingual_v2', 'aligning word timestamps', `${secs}.0 s`], () => {
    patchNode('voice', { status: 'idle', note: `${vid} · ${secs}.0 s aligned` });
    patchProd(vid, { video: 'voiced' });
    set((st) => ({ credits: { ...st.credits, used: Math.min(st.credits.total, st.credits.used + 2_140) }, spend: st.spend.map((x) => (x.label === 'ElevenLabs' ? { ...x, cost: x.cost + 0.64 } : x)) }));
    run('animation', 7000, [`${vid} scene 1: chart`, 'scene 2: kinetic type', 'scene 3: Manim (fallback to Remotion)', 'scene 4: map callout', 'composition ready'], () => {
      patchNode('animation', { status: 'idle', note: `${vid} · 4 scenes rendered` });
      patchProd(vid, { video: 'rendered' });
      run('compiler', 8000, [`${vid} 16:9 on 6 workers`, '9:16 on 6 workers', 'mixing audio', 'burning captions'], () => {
        patchNode('compiler', { status: 'idle', note: `${vid} · both formats ready` });
        patchProd(vid, { video: 'ready' });
        set((st) => ({ videos: [{ id: vid, title: topic, topic, hue: (vidN * 47) % 360, state: 'ready', when: 'Ready now' }, ...st.videos] }));
        if (get().publishMode === 'auto') {
          log('publisher', `auto-publishing ${vid} “${topic}”`);
          signOff(vid, ['yt', 'shorts', 'tiktok']);
          return;
        }
        const ready = get().videos.filter((v) => v.state === 'ready').length;
        patchNode('publisher', { status: 'approval', note: `${ready} video${ready > 1 ? 's' : ''} waiting for sign-off` });
        log('publisher', `queued ${vid} “${topic}”`);
      });
    });
  });
}

/** Request changes: the same topic is written again. */
export function redraft() {
  const t = get().draftTopic;
  if (!t) return;
  log('screenplay', 'changes requested · rewriting');
  set({ draftTopic: null });
  draft(t);
}

export function retry(id: string) {
  if (id === 'manim') run('manim', 4000, ['pulling render image with texlive', 'scene 3: equation morph', 'rendered 312 frames'], () => {
    patchNode('manim', { status: 'idle', note: 'Healthy · 312 frames last run' });
    set((s) => ({ beats: { ...s.beats, manim: [...s.beats.manim.slice(1), true] } }));
  });
  else if (id === 'trend') runTrend();
  else run(id, 4000, ['started by you', 'working', 'done'], () => patchNode(id, { status: 'idle', note: 'Ran just now' }));
}

export function stop(id: string) {
  patchNode(id, { status: 'idle', note: 'Stopped by you', progress: 0 });
  log(id, 'stopped by you');
}

export function signOff(videoId: string, platforms: string[] = ['yt', 'shorts', 'tiktok']) {
  set((s) => ({ videos: s.videos.map((v) => (v.id === videoId ? { ...v, state: 'published', when: 'Just now' } : v)) }));
  patchProd(videoId, { video: 'published', platforms, date: 'Just now' });
  set((s) => ({ income: s.income + 0.4 }));
  const left = get().videos.filter((v) => v.state === 'ready').length;
  patchNode('publisher', left ? { note: `${left} video${left > 1 ? 's' : ''} waiting for sign-off` } : { status: 'idle', note: 'Everything published' });
}

/** Ambient life: Trend Scout polls on its own. In preview, topics are dropped and approved on their own too. */
export function startSim(preview: boolean) {
  speed = preview ? 0.6 : 1;
  const loop = () => {
    if (node('trend')?.status === 'idle') runTrend();
    later(preview ? 16000 : 32000, loop);
  };
  later(preview ? 1200 : 5000, loop);
  if (preview) {
    let i = 1;
    const auto = () => {
      if (node('screenplay')?.status === 'approval') approveScript();
      else if (!get().draftTopic && node('screenplay')?.status === 'idle') dropTopic(get().topics[i++ % get().topics.length].name);
      later(6000, auto);
    };
    later(3000, auto);
  }
  return () => { timers.forEach(clearTimeout); timers.clear(); state = initial(); };
}

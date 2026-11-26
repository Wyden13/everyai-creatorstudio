/** The deeper control panel that slides in from the right when a node is clicked. */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { eligibleModelsForKind } from './capabilities';
import { Icon } from './icons';
import { AnimationHistory, PublishHistory, ScriptHistory, VoiceHistory } from './history';
import { kindIcon, TopicRow, typeLabel } from './nodes';
import { band } from './physics';
import { approveScript, componentCode, redraft, retry, rollbackComponentVersion, set, snapshotComponentVersion, stop, unqueue, useStudio, visibleTopTrends, type BoardNode, type Scene, type State } from './store';
import { Button, Field, Segmented, Select, Shape, StatusMark, Swap, Tiles } from './ui';

const prompts: Record<string, string> = {
  trend: 'Poll the org keywords across Google Trends and Google News. Score each topic by velocity (growth over 48 h) and novelty (distance from our last 30 videos). Return the top five with sources.',
  screenplay: 'You write 40–60 second explainers in the style of a calm, curious narrator. Open with a hook under 12 words. Every scene has narration, one visual directive, and one primitive from the library. Never invent statistics; cite the trend sources.',
  voice: 'Narrate in a warm, unhurried voice. Keep pauses at scene boundaries. Return word-level timestamps.',
  animation: 'Turn each scene into a Remotion composition using only the primitive library. Lock every cue to the word timestamps.',
  manim: 'Render scenes tagged equation or vector with Manim CE at 60 fps, transparent background.',
  compiler: 'Render 16:9 and 9:16 from the same scene data. Mix narration at -14 LUFS. Burn word-synced captions.',
  publisher: 'Draft a title under 60 characters, 8 tags, and three thumbnail variants. Queue for sign-off.',
  research: 'Take the winning topic and gather 10–20 deep sources. Summarise the strongest three claims with links.',
  thumbs: 'Generate three thumbnail variants and run a 48 h CTR test.',
};

const payloads = (n: BoardNode, s: State) => {
  const sp = { hook: s.hook, scenes: s.scenes.map((x) => ({ narration: x.narration.slice(0, 48) + '…', visual_directive: x.visual.slice(0, 40) + '…', primitive: x.primitive, seconds: x.secs })), aspect_ratio: ['16:9', '9:16'] };
  const map: Record<string, [unknown, unknown]> = {
    trend: [{ keywords: ['batteries', 'shipping', 'cities', 'math'], window: '48h' }, { topics: s.topics.slice(0, 3).map((t) => ({ name: t.name, velocity: +t.velocity.toFixed(2), novelty: t.novelty })) }],
    screenplay: [{ topic: s.topics[0].name, sources: 12 }, sp],
    voice: [{ narration: s.scenes.map((x) => x.id) }, { audio: 'voice_041.mp3', duration_s: 41.0, words: 98 }],
    animation: [{ scenes: 4, timestamps: 'voice_041.json' }, { composition: 'explainer_041', fps: 60 }],
    manim: [{ scene: 's3', primitive: 'equation' }, { error: 'latex: command not found', exit: 1 }],
    compiler: [{ composition: 'explainer_041' }, { wide: 'out/041_16x9.mp4', tall: 'out/041_9x16.mp4' }],
    publisher: [{ wide: 'out/041_16x9.mp4', tall: 'out/041_9x16.mp4' }, { title: s.videos[0].title, tags: 8, thumbnails: 3 }],
  };
  return map[n.kind] ?? [{ source: '/api/widgets/' + n.id }, { ok: true }];
};

function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const parts = text.split(/("(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|true|false)/g);
  return <pre className="json">{parts.map((p, i) => (i % 2 ? <span className={p.startsWith('"') ? (text.includes(p + ':') ? 'jk' : 'js') : 'jn'}>{p}</span> : p))}</pre>;
}

const primitives = [
  { id: 'kinetic', label: 'Kinetic type' },
  { id: 'chart', label: 'Chart' },
  { id: 'map', label: 'Map callout' },
  { id: 'equation', label: 'Equation' },
];

function SceneCard({ sc, i, start, onChange, onRemove }: { sc: Scene; i: number; start: number; onChange: (p: Partial<Scene>) => void; onRemove: () => void }) {
  const t = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return (
    <div className="scene rise" style={{ animationDelay: `${120 + i * 30}ms` }}>
      <div className="scene-head">
        <span className={`swatch p-${sc.primitive}`} />
        <span className="num scene-time">{t(start)}–{t(start + sc.secs)}</span>
        <span className="grow" />
        <button type="button" className="iconbtn" aria-label="Remove scene" onClick={onRemove}><Icon name="close" size={14} /></button>
      </div>
      <Field label="Narration" area rows={3} value={sc.narration} onChange={(v) => onChange({ narration: v })} />
      <Field label="Visual directive" area rows={2} value={sc.visual} onChange={(v) => onChange({ visual: v })} />
      <Tiles small options={primitives} value={[sc.primitive]} onChange={(v) => onChange({ primitive: v[0] })} />
    </div>
  );
}

function UpNext({ s }: { s: State }) {
  if (!s.queue.length) return null;
  return (
    <div className="rise">
      <span className="field-label">Up next · starts when this one clears</span>
      <ol className="queue-list">
        {s.queue.map((q, i) => (
          <li style={{ animationDelay: `${i * 30}ms` }}><span className="num dim">{i + 1}</span><span className="tname">{q}</span>
            <button type="button" className="iconbtn" aria-label={`Remove ${q}`} onClick={() => unqueue(q)}><Icon name="close" size={14} /></button></li>
        ))}
      </ol>
    </div>
  );
}

function ScriptEditor({ s, n }: { s: State; n: BoardNode }) {
  const [formats, setFormats] = useState(['wide', 'tall']);
  const modePicker = (
    <div className="rise" style={{ animationDelay: '15ms' }}>
      <span className="field-label">Approval mode</span>
      <Segmented
        value={s.screenplayMode}
        onChange={(v) => set({ screenplayMode: v })}
        options={[
          { id: 'gate', label: 'Approval gate' },
          { id: 'auto', label: 'Auto' },
        ]}
      />
    </div>
  );
  if (n.status === 'running') {
    return (
      <div className="stack">
        {modePicker}
        <div className="rise"><span className="field-label">Writing a script for</span><p className="hook big">{s.draftTopic}</p></div>
        <div className="rise skel big" style={{ animationDelay: '30ms' }}><span /><span /><span style={{ width: '70%' }} /><span /><span style={{ width: '45%' }} /></div>
        <UpNext s={s} />
      </div>
    );
  }
  if (n.status !== 'approval') {
    return (
      <div className="stack">
        {modePicker}
        <div className="rise empty"><Icon name="trend" size={20} /><b>Nothing being written</b><p className="prose dim">Drag a topic from Today’s top trends onto Screenplay. Past scripts are under History.</p></div>
        <UpNext s={s} />
      </div>
    );
  }
  let acc = 0;
  const upd = (id: string, p: Partial<Scene>) => set((st) => ({ scenes: st.scenes.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  return (
    <div className="stack">
      {modePicker}
      <div className="rise" style={{ animationDelay: '30ms' }}><span className="field-label">Topic</span><b className="topic-now">{s.draftTopic}</b></div>
      <UpNext s={s} />
      <div className="rise" style={{ animationDelay: '60ms' }}><Field label="Hook" area rows={2} value={s.hook} count={90} onChange={(v) => set({ hook: v })} /></div>
      <div className="rise" style={{ animationDelay: '90ms' }}>
        <span className="field-label">Formats</span>
        <Tiles multi options={[{ id: 'wide', label: '16:9', hint: 'YouTube', icon: <span className="ar wide" /> }, { id: 'tall', label: '9:16', hint: 'Shorts, Reels, TikTok', icon: <span className="ar tall" /> }]} value={formats} onChange={setFormats} />
      </div>
      {s.scenes.map((sc, i) => { const st = acc; acc += sc.secs; return <SceneCard key={sc.id} sc={sc} i={i} start={st} onChange={(p) => upd(sc.id, p)} onRemove={() => set((x) => ({ scenes: x.scenes.filter((y) => y.id !== sc.id) }))} />; })}
      <Button icon="plus" onClick={() => set((x) => ({ scenes: [...x.scenes, { id: `s${Date.now()}`, secs: 8, narration: '', visual: '', primitive: 'kinetic' }] }))}>Add scene</Button>
    </div>
  );
}

function Logs({ lines, live }: { lines: string[]; live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const count = useRef(lines.length);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); count.current = lines.length; }, [lines.length]);
  return (
    <div className="logs" ref={box}>
      {lines.map((l, i) => <div className={`log ${i >= count.current ? 'new' : ''}`} key={i + l}><span className="lt">{l.slice(0, 8)}</span>{l.slice(9)}</div>)}
      {live && <div className="log caret"><span className="lt" />▍</div>}
    </div>
  );
}

const blurb = {
  agent: '',
  status: 'Tracks whether a task or agent is working. It has no output of its own: it turns coral when something breaks and tells you what.',
  tracker: 'Tracks numbers over time: stats, costs and income. A JSON layout bound to a polling endpoint, so an edit can’t break the board.',
  aggregator: 'Collects what an agent finds into a list you can act on. Rows can be dragged onto other components.',
};

function TrendSetup({ s }: { s: State }) {
  const [draft, setDraft] = useState('');
  const [src, setSrc] = useState(['trends', 'news']);
  return (
    <>
      <div className="rise" style={{ animationDelay: '30ms' }}>
        <span className="field-label">Searching for</span>
        <div className="tokens">
          {s.keywords.map((k) => <span key={k} className="token">{k}<button type="button" aria-label={`Remove ${k}`} onClick={() => set({ keywords: s.keywords.filter((x) => x !== k) })}><Icon name="close" size={11} /></button></span>)}
          <input className="token-in" value={draft} placeholder="Add a keyword" onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { set({ keywords: [...s.keywords, draft.trim()] }); setDraft(''); } }} />
        </div>
        <p className="prose dim set-note">Auto-runs on schedule, adding rising topics and pruning stale ones from Today’s top trends.</p>
      </div>
      <div className="rise" style={{ animationDelay: '60ms' }}>
        <span className="field-label">Auto-schedule</span>
        <Segmented
          value={s.scoutSchedule}
          onChange={(v) => set({ scoutSchedule: v })}
          options={[
            { id: '15m', label: '15m' },
            { id: '30m', label: '30m' },
            { id: '2h', label: '2h' },
            { id: 'daily', label: 'Daily' },
            { id: 'off', label: 'Off' },
          ]}
        />
      </div>
      <div className="rise" style={{ animationDelay: '90ms' }}>
        <span className="field-label">Sources</span>
        <Tiles multi options={[{ id: 'trends', label: 'Google Trends', hint: 'via SerpApi' }, { id: 'news', label: 'Google News', hint: 'via SerpApi' }, { id: 'exa', label: 'Exa', hint: 'semantic depth' }]} value={src} onChange={setSrc} />
      </div>
    </>
  );
}

function StatusDetail({ n, s }: { n: BoardNode; s: State }) {
  const beats = s.beats[n.kind] ?? Array(24).fill(true);
  const fails = beats.filter((b) => !b).length;
  return (
    <>
      <div className="rise">
        <div className={`sbig big ${n.status}`}><span className="dot" />{n.status === 'failed' ? 'Failing' : n.status === 'running' ? 'Working' : 'Healthy'}</div>
        <p className="prose">{n.status === 'failed' ? n.note : `${beats.length - fails} of the last ${beats.length} checks passed.`}</p>
      </div>
      <div className="rise" style={{ animationDelay: '30ms' }}>
        <span className="field-label">Last {beats.length} checks · every 15 min</span>
        <div className="beats big">{beats.map((ok, i) => <span className={ok ? 'ok' : 'bad'} title={ok ? 'Passed' : 'Failed'} style={{ animationDelay: `${i * 12}ms` }} />)}</div>
      </div>
      {fails > 0 && (
        <div className="rise" style={{ animationDelay: '60ms' }}>
          <span className="field-label">Incident</span>
          <div className="incident"><span className="dot bad" /><div><b>Since 08:41</b><p className="prose">Scene 3 (equation morph) of VID-0418 fell back to Remotion. The render image is missing texlive.</p></div></div>
        </div>
      )}
    </>
  );
}

function Body({ n, s, tab }: { n: BoardNode; s: State; tab: string }) {
  const modelOptions = eligibleModelsForKind(n.kind);
  const [model, setModel] = useState(modelOptions[0]?.id ?? '');
  const [trigger, setTrigger] = useState<'auto' | 'gate' | 'manual'>(n.kind === 'screenplay' || n.kind === 'publisher' ? 'gate' : 'auto');
  const [io, setIo] = useState<'in' | 'out'>('out');
  const [prompt, setPrompt] = useState(s.nodePrompts[n.id] ?? prompts[n.kind] ?? '');
  useEffect(() => {
    setPrompt(s.nodePrompts[n.id] ?? prompts[n.kind] ?? '');
  }, [n.id, s.nodePrompts[n.id]]);
  const versions = s.versions[n.id] ?? [];
  if (tab === 'script') return <ScriptEditor s={s} n={n} />;
  if (tab === 'history') {
    if (n.kind === 'screenplay') return <ScriptHistory s={s} />;
    if (n.kind === 'voice') return <VoiceHistory s={s} />;
    if (n.kind === 'animation') return <AnimationHistory s={s} />;
    if (n.kind === 'publisher') return <PublishHistory s={s} />;
  }
  if (tab === 'logs') return <Logs lines={s.logs[n.id] ?? []} live={n.status === 'running'} />;
  if (tab === 'payload') {
    const [a, b] = payloads(n, s);
    return (
      <div className="stack">
        <div className="rise"><Segmented value={io} onChange={setIo} options={[{ id: 'in', label: 'Input' }, { id: 'out', label: 'Output' }]} /></div>
        <div className="rise" style={{ animationDelay: '30ms' }}><Swap k={io}><Json value={io === 'in' ? a : b} /></Swap></div>
      </div>
    );
  }
  if (tab === 'prompt') {
    return (
      <div className="stack">
        <div className="rise" style={{ animationDelay: '30ms' }}><span className="field-label">Model (capability-filtered)</span><Select value={model} onChange={setModel} options={modelOptions} /></div>
        <div className="rise" style={{ animationDelay: '60ms' }}><Field label="System prompt" area rows={7} value={prompt} onChange={setPrompt} /></div>
        <div className="rise" style={{ animationDelay: '75ms', display: 'flex', gap: 8 }}>
          <Button icon="check" onClick={() => snapshotComponentVersion(n.id, 'Prompt snapshot', undefined, prompt)}>
            Save v{versions.length + 1} snapshot
          </Button>
        </div>
        {versions.length > 0 && (
          <div className="rise" style={{ animationDelay: '85ms' }}>
            <span className="field-label">Component versions · 1-click rollback</span>
            <div className="ver-list">
              {[...versions].reverse().map((v) => (
                <div key={v.version} className="ver-row">
                  <span className="ver-tag mono">v{v.version}</span>
                  <span className="ver-meta"><b>{v.reason}</b><small>{v.savedAt}</small></span>
                  <Button onClick={() => rollbackComponentVersion(n.id, v.version)}>Rollback</Button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rise" style={{ animationDelay: '90ms' }}><Field label="Output schema" mono area rows={3} readOnly value={n.kind === 'screenplay' ? 'BeatSheet { format: "explainer" | "short"; beats: { act; narration; shot }[] }' : 'z.object({ … })'} /></div>
      </div>
    );
  }
  // overview
  const ins = s.edges.filter((e) => e.to === n.id).map((e) => s.nodes.find((x) => x.id === e.from)!).filter(Boolean);
  const outs = s.edges.filter((e) => e.from === n.id).map((e) => s.nodes.find((x) => x.id === e.to)!).filter(Boolean);
  return (
    <div className="stack">
      {n.kind === 'trend' && <TrendSetup s={s} />}
      {n.kind === 'toptrends' && (
        <div className="rise">
          <span className="field-label">Today’s top trends · drag one onto Screenplay</span>
          <ol className="trows big">{visibleTopTrends(s).map((t, i) => <TopicRow key={t.name} s={s} name={t.name} velocity={t.velocity} sparkline={t.spark} i={i} big />)}</ol>
        </div>
      )}
      {n.type === 'status' && <StatusDetail n={n} s={s} />}
      {n.type === 'agent' && n.kind !== 'trend' && (
        <div className="rise" style={{ animationDelay: '30ms' }}>
          <span className="field-label">When it runs</span>
          <Tiles options={[{ id: 'auto', label: 'Automatic', hint: 'when input arrives' }, { id: 'gate', label: 'Approval gate', hint: 'pauses for you' }, { id: 'manual', label: 'Manual', hint: 'only on Run' }]} value={[trigger]} onChange={(v) => setTrigger(v[0] as never)} />
        </div>
      )}
      {n.type !== 'agent' && (
        <div className="rise" style={{ animationDelay: '60ms' }}>
          <span className="field-label">{typeLabel[n.type]} component</span>
          <p className="prose">{blurb[n.type]}</p>
        </div>
      )}
      <div className="rise flow" style={{ animationDelay: '90ms' }}>
        <div><span className="field-label">Gets input from</span>{ins.length ? ins.map((x) => <button type="button" className="linkrow" onClick={() => set({ selected: x.id, tab: null })}><Icon name={kindIcon[x.kind]} size={15} />{x.title}<StatusMark s={x.status} /></button>) : <p className="prose dim">Nothing. It starts the pipeline.</p>}</div>
        {n.type !== 'status' && <div><span className="field-label">Sends output to</span>{outs.length ? outs.map((x) => <button type="button" className="linkrow" onClick={() => set({ selected: x.id, tab: null })}><Icon name={kindIcon[x.kind]} size={15} />{x.title}<StatusMark s={x.status} /></button>) : <p className="prose dim">Nothing yet.</p>}</div>}
      </div>
      <div className="rise" style={{ animationDelay: '120ms' }}>
        <span className="field-label">{n.type === 'agent' ? 'Recent runs' : 'Recent refreshes'}</span>
        <div className="runs">
          {[['Today 09:12', '6.1 s', 'ok'], ['Today 08:40', '5.8 s', 'ok'], ['Yesterday 21:02', '7.4 s', n.kind === 'manim' ? 'fail' : 'ok']].map(([a, b, c]) => (
            <div className="run"><span className={`dot ${c}`} /><span>{a}</span><span className="num dim">{b}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Inspector({ width, onWidth }: { width: number; onWidth: (w: number) => void }) {
  const s = useStudio();
  const [shownId, setShownId] = useState<string | null>(s.selected);
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (s.selected) { setShownId(s.selected); setLeaving(false); }
    else if (shownId) { setLeaving(true); const t = setTimeout(() => { setShownId(null); setLeaving(false); }, 250); return () => clearTimeout(t); }
  }, [s.selected]);

  const n = s.nodes.find((x) => x.id === shownId) ?? null;
  const T = (id: string, label: string) => ({ id, label });
  const hasHistory = n && ['voice', 'animation', 'publisher'].includes(n.kind);
  const tabs = !n ? [] : n.kind === 'screenplay'
    ? [T('script', 'Script'), T('history', 'History'), T('prompt', 'Prompt'), T('logs', 'Logs')]
    : n.type === 'status' ? [T('overview', 'Status'), T('logs', 'Logs')]
    : n.widget ? [T('overview', 'Overview'), T('payload', 'Data'), T('logs', 'Logs')]
    : hasHistory ? [T('overview', 'Overview'), T('history', 'History'), T('prompt', 'Prompt'), T('logs', 'Logs')]
    : [T('overview', 'Overview'), T('prompt', 'Prompt'), T('logs', 'Logs'), T('payload', 'Payload')];

  useEffect(() => {
    if (!n) return;
    const want = s.tab ?? (n.kind === 'screenplay' ? 'script' : 'overview');
    setTab(tabs.some((t) => t.id === want) ? want : tabs[0].id);
    if (s.tab) set({ tab: null });
  }, [shownId, s.tab]);

  useEffect(() => { onWidth(n?.kind === 'screenplay' || n?.kind === 'animation' ? 500 : 440); }, [n?.kind]);

  if (!n) return null;

  const act = (fn: () => void, label: string) => { setBusy(label); setTimeout(() => { fn(); setBusy(null); }, 450); };
  const seam = (e: ReactPointerEvent<HTMLElement>) => {
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = width;
    setHeld(true);
    const move = (ev: PointerEvent) => {
      const w = w0 + (x0 - ev.clientX);
      onWidth(w < 380 ? 380 + band(w - 380, 34) : w > 760 ? 760 + band(w - 760, 34) : w);
    };
    const up = () => {
      t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up);
      setHeld(false);
      onWidth(Math.max(380, Math.min(760, Math.round(width))));
    };
    t.addEventListener('pointermove', move); t.addEventListener('pointerup', up);
  };

  const footer = n.status === 'approval' && n.kind === 'screenplay' ? (
    <>
      <Button onClick={() => { redraft(); setTab('script'); }}>Request changes</Button>
      <Button kind="primary" icon="check" busy={busy === 'approve'} onClick={() => act(approveScript, 'approve')}>Approve and continue</Button>
    </>
  ) : n.status === 'approval' ? (
    <Button kind="primary" icon="publish" onClick={() => set({ view: 'publish', selected: null })}>Open in Publish</Button>
  ) : n.status === 'failed' ? (
    <>
      <Button onClick={() => setTab('logs')}>View logs</Button>
      <Button kind="primary" icon="retry" busy={busy === 'retry'} onClick={() => act(() => retry(n.id), 'retry')}>Retry</Button>
    </>
  ) : n.status === 'running' ? (
    <Button icon="stop" onClick={() => stop(n.id)}>Stop</Button>
  ) : n.type !== 'agent' ? (
    <Button icon="sparkle" onClick={() => { set({ selected: null }); document.querySelector<HTMLInputElement>('.architect input')?.focus(); }}>Change with Architect</Button>
  ) : (
    <Button kind="primary" icon="play" busy={busy === 'run'} onClick={() => act(() => retry(n.id), 'run')}>Run now</Button>
  );

  return (
    <aside className={`drawer ${leaving ? 'leaving' : ''} ${held ? 'held' : ''}`} style={{ width: `${width}px` }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="seam" onPointerDown={seam} aria-hidden="true" />
      <Shape r={30} className="drawer-shape" skin="glass thick drawer-skin">
        <header className={`dh t-${n.type}`}>
          <Swap k={n.id} className="dh-swap">
            <div className="dh-row">
              <span className="nh-ic big"><Icon name={kindIcon[n.kind]} size={18} /></span>
              <div className="dh-t">
                <b>{n.title}</b>
                <small>
                  {n.sub} ·{' '}
                  <button
                    type="button"
                    className="id-chip mono"
                    title="Click to copy Component ID"
                    onClick={() => navigator.clipboard?.writeText(componentCode(n)).catch(() => {})}
                  >
                    {componentCode(n)}
                  </button>
                </small>
              </div>
            </div>
          </Swap>
          {!n.widget && <StatusMark s={n.status} />}
          <button type="button" className="iconbtn" aria-label="Close" onClick={() => set({ selected: null })}><Icon name="close" size={16} /></button>
        </header>
        {n.status === 'failed' && <div className="alert coral rise"><Icon name="bolt" size={15} />{n.note}</div>}
        {n.status === 'approval' && <div className="alert amber rise"><Icon name="clock" size={15} />{n.note}</div>}
        <div className="dtabs"><Segmented value={tab} onChange={setTab} options={tabs} /></div>
        <div className="dbody overlay-scroll" key={`${n.id}-${tab}`}>
          <Body n={n} s={s} tab={tab} />
        </div>
        <footer className="dfoot">{footer}</footer>
      </Shape>
    </aside>
  );
}

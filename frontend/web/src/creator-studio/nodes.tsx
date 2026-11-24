/** What each component shows on the board. Four types: agent, status, tracker, aggregator. */
import { Brand, Icon } from './icons';
import { approveScript, retry, set, topicState, type BoardNode, type State } from './store';
import { startTopicDrag } from './topicdrag';
import { Button } from './ui';

export const kindIcon: Record<string, string> = {
  trend: 'trend', toptrends: 'list', screenplay: 'screenplay', voice: 'voice', animation: 'animation', manim: 'pulse', uploads: 'pulse',
  compiler: 'compiler', publisher: 'publish', credits: 'credits', analytics: 'analytics', spend: 'coins', research: 'research', thumbs: 'thumbs',
};
export const typeLabel = { agent: 'Agent', status: 'Status', tracker: 'Tracker', aggregator: 'Aggregator' } as const;

/** A mock motion-graphics frame (stands in for a rendered video). Kinetic words, a chart and synced captions. */
export function Frame({ hue, title, tall, playing, small }: { hue: number; title: string; tall?: boolean; playing?: boolean; small?: boolean }) {
  const words = title.split(' ');
  return (
    <div className={`frame ${tall ? 'tall' : ''} ${playing ? 'playing' : ''} ${small ? 'small' : ''}`} style={{ '--h': hue } as never}>
      <div className="frame-head">
        {words.map((w, i) => <span className="fw" style={{ animationDelay: `${i * 90}ms` }}>{w}</span>)}
      </div>
      <div className="frame-chart">
        {[0.35, 0.55, 0.8, 0.62].map((v, i) => <span style={{ height: `${v * 100}%`, animationDelay: `${300 + i * 80}ms` }} />)}
      </div>
      {!small && (
        <div className="frame-cap">
          {'and that is why it matters'.split(' ').map((w, i) => <span style={{ animationDelay: `${600 + i * 420}ms` }}>{w}</span>)}
        </div>
      )}
    </div>
  );
}

export const waveFor = (seed: number, n = 46) => Array.from({ length: n }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i * 0.7 + seed) * Math.cos(i * 0.23 + seed * 0.3) + 0.15 * Math.sin(i * 2.1)));
const wave = waveFor(0);

function Bar({ p }: { p: number }) {
  return <div className="pbar"><span style={{ transform: `scaleX(${p})` }} /></div>;
}

/** Keywords as small square tokens. */
export function Keywords({ words, max }: { words: string[]; max?: number }) {
  const shown = max ? words.slice(0, max) : words;
  return (
    <div className="kw">
      {shown.map((w) => <span className="kw-t">{w}</span>)}
      {max && words.length > max && <span className="kw-more">+{words.length - max}</span>}
    </div>
  );
}

const marks = { made: 'Made', queued: 'Queued', writing: 'Writing' };
/** One trend you can pick up and drop on Screenplay. */
export function TopicRow({ s, name, velocity, sparkline, i, big }: { s: State; name: string; velocity: number; sparkline: number[]; i: number; big?: boolean }) {
  const st = topicState(s, name);
  const lifted = s.drag?.topic === name;
  return (
    <li className={`trow ${st ?? ''} ${lifted ? 'lifted' : ''} ${big ? 'big' : ''}`} style={{ animationDelay: `${i * 30}ms` }} onPointerDown={(e) => startTopicDrag(e, name)} title="Drag onto Screenplay">
      <Icon name="grip" size={14} className="grip" />
      <span className="tname">{name}</span>
      {st ? <span className={`tmark ${st}`}>{marks[st]}</span> : (
        <svg className="spark" viewBox="0 0 52 16" preserveAspectRatio="none"><polyline points={sparkline.map((v, j) => `${j * 4},${16 - v * 14}`).join(' ')} /></svg>
      )}
      <span className="num">{velocity.toFixed(2)}</span>
    </li>
  );
}

/** Status components: is this thing working? A big state, a strip of recent checks, and the last word on it. */
function StatusBody({ n, s }: { n: BoardNode; s: State }) {
  const beats = s.beats[n.kind] ?? Array(24).fill(true);
  const word = n.status === 'failed' ? 'Failing' : n.status === 'running' ? 'Working' : 'Healthy';
  return (
    <div className="nb">
      <div className={`sbig ${n.status}`}><span className="dot" />{word}</div>
      <div className="beats">{beats.map((ok, i) => <span className={ok ? 'ok' : 'bad'} style={{ animationDelay: `${i * 12}ms` }} />)}</div>
      <div className="nfoot">
        {n.status === 'failed'
          ? <><span>{n.note}</span><div className="nacts"><Button size="sm" kind="primary" icon="retry" onClick={() => retry(n.id)}>Retry</Button></div></>
          : n.status === 'running' ? <Bar p={n.progress} /> : <span>{n.note || 'Last 24 checks'}</span>}
      </div>
    </div>
  );
}

export function NodeBody({ n, s, onOpen }: { n: BoardNode; s: State; onOpen: (tab?: string) => void }) {
  const running = n.status === 'running';
  if (n.type === 'status') return <StatusBody n={n} s={s} />;
  switch (n.kind) {
    case 'trend':
      return (
        <div className="nb">
          <span className="nlabel"><Icon name="research" size={12} />Searching for</span>
          <Keywords words={s.keywords} max={6} />
          <div className="nfoot">{running ? <Bar p={n.progress} /> : <span>{n.note} · next in 26 min</span>}</div>
        </div>
      );
    case 'toptrends':
      return (
        <div className="nb">
          <ol className="trows">
            {s.topics.slice(0, 6).map((t, i) => <TopicRow s={s} name={t.name} velocity={t.velocity} sparkline={t.spark} i={i} />)}
          </ol>
          <div className="nfoot"><span><Icon name="grip" size={12} /> Drag a topic onto Screenplay</span></div>
        </div>
      );
    case 'screenplay': {
      const total = s.scenes.reduce((a, b) => a + b.secs, 0);
      const q = s.queue.length;
      return (
        <div className="nb">
          {running ? (
            <>
              <span className="nlabel">Writing</span>
              <p className="hook">{s.draftTopic}</p>
              <div className="skel"><span /><span /><span style={{ width: '60%' }} /></div>
              <Bar p={n.progress} />
            </>
          ) : n.status === 'approval' ? (
            <>
              <span className="nlabel">{s.draftTopic}</span>
              <p className="hook">“{s.hook}”</p>
              <div className="strip">{s.scenes.map((sc) => <span className={`p-${sc.primitive}`} style={{ flex: sc.secs }} />)}</div>
              <div className="meta">{s.scenes.length} scenes · {total} s</div>
            </>
          ) : (
            <div className="dropzone"><Icon name="trend" size={16} /><span>Drop a trend here</span></div>
          )}
          <div className="nfoot">
            {n.status === 'approval' ? (
              <>
                {q ? <span className="upnext">{q} up next</span> : null}
                <div className="nacts">
                  <Button size="sm" onClick={() => onOpen('script')}>Review</Button>
                  <Button size="sm" kind="primary" icon="check" onClick={approveScript}>Approve</Button>
                </div>
              </>
            ) : <span>{q ? <span className="upnext">{q} up next</span> : n.note}</span>}
          </div>
        </div>
      );
    }
    case 'voice':
      return (
        <div className="nb">
          <div className={`wave ${running ? 'live' : ''}`}>
            {wave.map((v, i) => <span className={running && i / wave.length > n.progress ? 'pending' : ''} style={{ height: `${v * 100}%` }} />)}
          </div>
          <div className="nfoot"><span>{n.note}</span></div>
        </div>
      );
    case 'animation':
      return (
        <div className="nb">
          <Frame hue={280} title="Salt beats lithium" small playing={running} />
          <div className="cells">{s.scenes.map((_, i) => <span className={running ? (n.progress > (i + 1) / 4 ? 'full' : n.progress > i / 4 ? 'now' : '') : 'full'} />)}</div>
          <div className="nfoot"><span>{n.note}</span></div>
        </div>
      );
    case 'compiler': {
      const a = running ? Math.min(1, n.progress * 1.6) : 1, b = running ? Math.max(0, n.progress * 1.6 - 0.6) : 1;
      return (
        <div className="nb">
          <div className="formats">
            <div className="fmt"><span className="ar wide" /><span>16:9</span><Bar p={a} /><span className="num">{Math.round(a * 100)}%</span></div>
            <div className="fmt"><span className="ar tall" /><span>9:16</span><Bar p={b} /><span className="num">{Math.round(b * 100)}%</span></div>
          </div>
          <div className="nfoot"><span>{n.note}</span></div>
        </div>
      );
    }
    case 'publisher': {
      const v = s.videos.find((x) => x.state === 'ready') ?? s.videos[0];
      return (
        <div className="nb">
          <Frame hue={v.hue} title={v.title} small />
          <div className="ptitle"><span className="num dim">{v.id}</span> {v.title}</div>
          <div className="nfoot">
            {n.status === 'approval'
              ? <div className="nacts"><Button size="sm" kind="primary" icon="publish" onClick={() => set({ view: 'publish' })}>Sign off</Button></div>
              : <span>{n.note}</span>}
          </div>
        </div>
      );
    }
    case 'analytics':
      return (
        <div className="nb">
          <div className="kpis">
            <div><b className="num">48.2k</b><span>Views</span></div>
            <div><b className="num">1,904</b><span>Watch hours</span></div>
            <div><b className="num">+612</b><span>Subscribers</span></div>
          </div>
          <div className="bars7">{[0.4, 0.55, 0.48, 0.7, 0.62, 0.9, 0.78].map((v, i) => <span style={{ height: `${v * 100}%`, animationDelay: `${i * 30}ms` }} />)}</div>
        </div>
      );
    case 'spend': {
      const total = s.spend.reduce((a, b) => a + b.cost, 0);
      const max = Math.max(...s.spend.map((x) => x.cost));
      return (
        <div className="nb">
          <div className="money"><b className="num">${total.toFixed(2)}</b><span>spent</span><b className="num mint">+${s.income.toFixed(2)}</b><span>earned</span></div>
          <div className="costs">
            {s.spend.map((x, i) => (
              <div className="cost" style={{ animationDelay: `${i * 30}ms` }}><span>{x.label}</span><div className="pbar"><span style={{ transform: `scaleX(${x.cost / max})` }} /></div><span className="num">${x.cost.toFixed(2)}</span></div>
            ))}
          </div>
        </div>
      );
    }
    case 'credits': {
      const p = s.credits.used / s.credits.total;
      const len = Math.PI * 34;
      return (
        <div className="nb credits">
          <svg viewBox="0 0 80 46" className="gauge">
            <path d="M6 40a34 34 0 0 1 68 0" className="g-track" />
            <path d="M6 40a34 34 0 0 1 68 0" className="g-fill" style={{ strokeDasharray: `${len * p} ${len}` }} />
          </svg>
          <div className="cred-num"><b className="num">{Math.round((s.credits.total - s.credits.used) / 1000)}k</b><span>characters left · ≈ {Math.round((s.credits.total - s.credits.used) / 2200)} videos</span></div>
          <div className="cred-brand"><Brand name="siElevenlabs" size={14} /> Renews Dec 1</div>
        </div>
      );
    }
    case 'research':
      return (
        <div className="nb">
          <ol className="topics">
            {['exa.ai · 12 sources', 'tavily · 8 sources', 'arXiv · 3 papers'].map((t, i) => <li style={{ animationDelay: `${i * 30}ms` }}><span className="tname">{t}</span></li>)}
          </ol>
          <div className="nfoot"><span>Deepens the winning topic</span></div>
        </div>
      );
    case 'thumbs':
      return (
        <div className="nb">
          <div className="thumbs3">{[262, 20, 190].map((h) => <Frame hue={h} title="GPS time" small />)}</div>
          <div className="nfoot"><span>3 variants · CTR test 48 h</span></div>
        </div>
      );
  }
  return <div className="nb"><Icon name="bolt" /></div>;
}

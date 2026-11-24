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
    <div class={`frame ${tall ? 'tall' : ''} ${playing ? 'playing' : ''} ${small ? 'small' : ''}`} style={{ '--h': hue } as never}>
      <div class="frame-head">
        {words.map((w, i) => <span class="fw" style={{ animationDelay: `${i * 90}ms` }}>{w}</span>)}
      </div>
      <div class="frame-chart">
        {[0.35, 0.55, 0.8, 0.62].map((v, i) => <span style={{ height: `${v * 100}%`, animationDelay: `${300 + i * 80}ms` }} />)}
      </div>
      {!small && (
        <div class="frame-cap">
          {'and that is why it matters'.split(' ').map((w, i) => <span style={{ animationDelay: `${600 + i * 420}ms` }}>{w}</span>)}
        </div>
      )}
    </div>
  );
}

export const waveFor = (seed: number, n = 46) => Array.from({ length: n }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i * 0.7 + seed) * Math.cos(i * 0.23 + seed * 0.3) + 0.15 * Math.sin(i * 2.1)));
const wave = waveFor(0);

function Bar({ p }: { p: number }) {
  return <div class="pbar"><span style={{ transform: `scaleX(${p})` }} /></div>;
}

/** Keywords as small square tokens. */
export function Keywords({ words, max }: { words: string[]; max?: number }) {
  const shown = max ? words.slice(0, max) : words;
  return (
    <div class="kw">
      {shown.map((w) => <span class="kw-t">{w}</span>)}
      {max && words.length > max && <span class="kw-more">+{words.length - max}</span>}
    </div>
  );
}

const marks = { made: 'Made', queued: 'Queued', writing: 'Writing' };
/** One trend you can pick up and drop on Screenplay. */
export function TopicRow({ s, name, velocity, sparkline, i, big }: { s: State; name: string; velocity: number; sparkline: number[]; i: number; big?: boolean }) {
  const st = topicState(s, name);
  const lifted = s.drag?.topic === name;
  return (
    <li class={`trow ${st ?? ''} ${lifted ? 'lifted' : ''} ${big ? 'big' : ''}`} style={{ animationDelay: `${i * 30}ms` }} onPointerDown={(e) => startTopicDrag(e, name)} title="Drag onto Screenplay">
      <Icon name="grip" size={14} class="grip" />
      <span class="tname">{name}</span>
      {st ? <span class={`tmark ${st}`}>{marks[st]}</span> : (
        <svg class="spark" viewBox="0 0 52 16" preserveAspectRatio="none"><polyline points={sparkline.map((v, j) => `${j * 4},${16 - v * 14}`).join(' ')} /></svg>
      )}
      <span class="num">{velocity.toFixed(2)}</span>
    </li>
  );
}

/** Status components: is this thing working? A big state, a strip of recent checks, and the last word on it. */
function StatusBody({ n, s }: { n: BoardNode; s: State }) {
  const beats = s.beats[n.kind] ?? Array(24).fill(true);
  const word = n.status === 'failed' ? 'Failing' : n.status === 'running' ? 'Working' : 'Healthy';
  return (
    <div class="nb">
      <div class={`sbig ${n.status}`}><span class="dot" />{word}</div>
      <div class="beats">{beats.map((ok, i) => <span class={ok ? 'ok' : 'bad'} style={{ animationDelay: `${i * 12}ms` }} />)}</div>
      <div class="nfoot">
        {n.status === 'failed'
          ? <><span>{n.note}</span><div class="nacts"><Button size="sm" kind="primary" icon="retry" onClick={() => retry(n.id)}>Retry</Button></div></>
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
        <div class="nb">
          <span class="nlabel"><Icon name="research" size={12} />Searching for</span>
          <Keywords words={s.keywords} max={6} />
          <div class="nfoot">{running ? <Bar p={n.progress} /> : <span>{n.note} · next in 26 min</span>}</div>
        </div>
      );
    case 'toptrends':
      return (
        <div class="nb">
          <ol class="trows">
            {s.topics.slice(0, 6).map((t, i) => <TopicRow s={s} name={t.name} velocity={t.velocity} sparkline={t.spark} i={i} />)}
          </ol>
          <div class="nfoot"><span><Icon name="grip" size={12} /> Drag a topic onto Screenplay</span></div>
        </div>
      );
    case 'screenplay': {
      const total = s.scenes.reduce((a, b) => a + b.secs, 0);
      const q = s.queue.length;
      return (
        <div class="nb">
          {running ? (
            <>
              <span class="nlabel">Writing</span>
              <p class="hook">{s.draftTopic}</p>
              <div class="skel"><span /><span /><span style={{ width: '60%' }} /></div>
              <Bar p={n.progress} />
            </>
          ) : n.status === 'approval' ? (
            <>
              <span class="nlabel">{s.draftTopic}</span>
              <p class="hook">“{s.hook}”</p>
              <div class="strip">{s.scenes.map((sc) => <span class={`p-${sc.primitive}`} style={{ flex: sc.secs }} />)}</div>
              <div class="meta">{s.scenes.length} scenes · {total} s</div>
            </>
          ) : (
            <div class="dropzone"><Icon name="trend" size={16} /><span>Drop a trend here</span></div>
          )}
          <div class="nfoot">
            {n.status === 'approval' ? (
              <>
                {q ? <span class="upnext">{q} up next</span> : null}
                <div class="nacts">
                  <Button size="sm" onClick={() => onOpen('script')}>Review</Button>
                  <Button size="sm" kind="primary" icon="check" onClick={approveScript}>Approve</Button>
                </div>
              </>
            ) : <span>{q ? <span class="upnext">{q} up next</span> : n.note}</span>}
          </div>
        </div>
      );
    }
    case 'voice':
      return (
        <div class="nb">
          <div class={`wave ${running ? 'live' : ''}`}>
            {wave.map((v, i) => <span class={running && i / wave.length > n.progress ? 'pending' : ''} style={{ height: `${v * 100}%` }} />)}
          </div>
          <div class="nfoot"><span>{n.note}</span></div>
        </div>
      );
    case 'animation':
      return (
        <div class="nb">
          <Frame hue={280} title="Salt beats lithium" small playing={running} />
          <div class="cells">{s.scenes.map((_, i) => <span class={running ? (n.progress > (i + 1) / 4 ? 'full' : n.progress > i / 4 ? 'now' : '') : 'full'} />)}</div>
          <div class="nfoot"><span>{n.note}</span></div>
        </div>
      );
    case 'compiler': {
      const a = running ? Math.min(1, n.progress * 1.6) : 1, b = running ? Math.max(0, n.progress * 1.6 - 0.6) : 1;
      return (
        <div class="nb">
          <div class="formats">
            <div class="fmt"><span class="ar wide" /><span>16:9</span><Bar p={a} /><span class="num">{Math.round(a * 100)}%</span></div>
            <div class="fmt"><span class="ar tall" /><span>9:16</span><Bar p={b} /><span class="num">{Math.round(b * 100)}%</span></div>
          </div>
          <div class="nfoot"><span>{n.note}</span></div>
        </div>
      );
    }
    case 'publisher': {
      const v = s.videos.find((x) => x.state === 'ready') ?? s.videos[0];
      return (
        <div class="nb">
          <Frame hue={v.hue} title={v.title} small />
          <div class="ptitle"><span class="num dim">{v.id}</span> {v.title}</div>
          <div class="nfoot">
            {n.status === 'approval'
              ? <div class="nacts"><Button size="sm" kind="primary" icon="publish" onClick={() => set({ view: 'publish' })}>Sign off</Button></div>
              : <span>{n.note}</span>}
          </div>
        </div>
      );
    }
    case 'analytics':
      return (
        <div class="nb">
          <div class="kpis">
            <div><b class="num">48.2k</b><span>Views</span></div>
            <div><b class="num">1,904</b><span>Watch hours</span></div>
            <div><b class="num">+612</b><span>Subscribers</span></div>
          </div>
          <div class="bars7">{[0.4, 0.55, 0.48, 0.7, 0.62, 0.9, 0.78].map((v, i) => <span style={{ height: `${v * 100}%`, animationDelay: `${i * 30}ms` }} />)}</div>
        </div>
      );
    case 'spend': {
      const total = s.spend.reduce((a, b) => a + b.cost, 0);
      const max = Math.max(...s.spend.map((x) => x.cost));
      return (
        <div class="nb">
          <div class="money"><b class="num">${total.toFixed(2)}</b><span>spent</span><b class="num mint">+${s.income.toFixed(2)}</b><span>earned</span></div>
          <div class="costs">
            {s.spend.map((x, i) => (
              <div class="cost" style={{ animationDelay: `${i * 30}ms` }}><span>{x.label}</span><div class="pbar"><span style={{ transform: `scaleX(${x.cost / max})` }} /></div><span class="num">${x.cost.toFixed(2)}</span></div>
            ))}
          </div>
        </div>
      );
    }
    case 'credits': {
      const p = s.credits.used / s.credits.total;
      const len = Math.PI * 34;
      return (
        <div class="nb credits">
          <svg viewBox="0 0 80 46" class="gauge">
            <path d="M6 40a34 34 0 0 1 68 0" class="g-track" />
            <path d="M6 40a34 34 0 0 1 68 0" class="g-fill" style={{ strokeDasharray: `${len * p} ${len}` }} />
          </svg>
          <div class="cred-num"><b class="num">{Math.round((s.credits.total - s.credits.used) / 1000)}k</b><span>characters left · ≈ {Math.round((s.credits.total - s.credits.used) / 2200)} videos</span></div>
          <div class="cred-brand"><Brand name="siElevenlabs" size={14} /> Renews Dec 1</div>
        </div>
      );
    }
    case 'research':
      return (
        <div class="nb">
          <ol class="topics">
            {['exa.ai · 12 sources', 'tavily · 8 sources', 'arXiv · 3 papers'].map((t, i) => <li style={{ animationDelay: `${i * 30}ms` }}><span class="tname">{t}</span></li>)}
          </ol>
          <div class="nfoot"><span>Deepens the winning topic</span></div>
        </div>
      );
    case 'thumbs':
      return (
        <div class="nb">
          <div class="thumbs3">{[262, 20, 190].map((h) => <Frame hue={h} title="GPS time" small />)}</div>
          <div class="nfoot"><span>3 variants · CTR test 48 h</span></div>
        </div>
      );
  }
  return <div class="nb"><Icon name="bolt" /></div>;
}

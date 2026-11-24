/** Publish: one-click sign-off for finished videos. */
import { useEffect, useState } from 'react';
import { Brand, Icon } from './icons';
import { Frame } from './nodes';
import { signOff, useStudio, type Video } from './store';
import { Button, Field, Segmented, Select, Shape, Swap, Tiles } from './ui';

const dests = [
  { id: 'yt', label: 'YouTube', hint: '16:9', icon: <Brand name="siYoutube" size={18} /> },
  { id: 'shorts', label: 'Shorts', hint: '9:16', icon: <Brand name="siYoutubeshorts" size={18} /> },
  { id: 'tiktok', label: 'TikTok', hint: '9:16', icon: <Brand name="siTiktok" size={18} /> },
  { id: 'reels', label: 'Reels', hint: '9:16', icon: <Brand name="siInstagram" size={18} /> },
];

function Player({ v }: { v: Video }) {
  const [playing, setPlaying] = useState(true);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setK((n) => n + 1), 6000);
    return () => clearInterval(t);
  }, [playing]);
  return (
    <div className="player">
      <div className={`screens ${playing ? '' : 'paused'}`} key={`${v.id}-${k}`}>
        <Shape r={20} className="screen wide"><Frame hue={v.hue} title={v.title} playing /></Shape>
        <Shape r={20} className="screen tall"><Frame hue={v.hue} title={v.title} tall playing /></Shape>
      </div>
      <div className="transport">
        <button type="button" className="iconbtn solid" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
          <Swap k={playing ? 'p' : 'l'}><Icon name={playing ? 'pause' : 'play'} size={15} /></Swap>
        </button>
        <div className={`scrub ${playing ? '' : 'paused'}`} key={`s${v.id}-${k}`}><span /></div>
        <span className="num dim">0:41</span>
      </div>
    </div>
  );
}

export function Publish() {
  const s = useStudio();
  const [sel, setSel] = useState(s.videos.find((v) => v.state === 'ready')?.id ?? s.videos[0].id);
  const v = s.videos.find((x) => x.id === sel) ?? s.videos[0];
  const [title, setTitle] = useState(v.title);
  const [desc, setDesc] = useState(`${v.topic}, explained in under a minute. Sources in the pinned comment.`);
  const [tags, setTags] = useState(['explainer', 'science', 'technology', 'batteries']);
  const [thumb, setThumb] = useState('a');
  const [to, setTo] = useState(['yt', 'shorts', 'tiktok']);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [slot, setSlot] = useState('thu9');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => { setTitle(v.title); setDesc(`${v.topic}, explained in under a minute. Sources in the pinned comment.`); setDone(v.state === 'published'); }, [v.id]);

  const go = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setDone(true); signOff(v.id, to); }, 1100);
  };

  return (
    <div className="page publish">
      <div className="page-head rise">
        <div><h1>Publish</h1><p>Finished videos wait here for one-click sign-off.</p></div>
        <div className="pub-cta">
          <span className="dim">{done ? 'Live. Analytics land on the board within the hour.' : `${to.length} destination${to.length === 1 ? '' : 's'} · captions burned in · 0:41`}</span>
          <Button kind="primary" icon="publish" busy={busy} done={done} disabled={!to.length || done} onClick={go}>
            <Swap k={done ? 'd' : when}>{done ? 'Published' : when === 'now' ? 'Sign off and publish' : 'Sign off and schedule'}</Swap>
          </Button>
        </div>
      </div>
      <div className="pub-grid">
        <div className="queue">
          {s.videos.map((x, i) => (
            <button type="button" className={`qrow ${x.id === v.id ? 'on' : ''}`} style={{ animationDelay: `${60 + i * 30}ms` }} onClick={() => setSel(x.id)}>
              <Shape r={10} className="qthumb"><Frame hue={x.hue} title={x.title} small /></Shape>
              <span className="qt"><b>{x.title}</b><small className={`q-${x.state}`}><span className="dot" />{x.state === 'ready' ? 'Ready for sign-off' : x.state === 'scheduled' ? `Scheduled · ${x.when}` : `Published · ${x.when}`}</small></span>
            </button>
          ))}
        </div>
        <div className="pub-main overlay-scroll" key={v.id}>
          <div className="rise" style={{ animationDelay: '40ms' }}><Player v={v} /></div>
          <div className="pub-form">
            <div className="col">
              <div className="rise" style={{ animationDelay: '80ms' }}><Field label="Title" value={title} count={60} onChange={setTitle} /></div>
              <div className="rise" style={{ animationDelay: '110ms' }}><Field label="Description" area rows={3} value={desc} onChange={setDesc} /></div>
              <div className="rise" style={{ animationDelay: '140ms' }}>
                <span className="field-label">Tags</span>
                <div className="tokens">
                  {tags.map((t) => <span className="token">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><Icon name="close" size={11} /></button></span>)}
                  <input className="token-in" value={draft} placeholder="Add tag" onChange={(e) => setDraft((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { setTags([...tags, draft.trim()]); setDraft(''); } }} />
                </div>
              </div>
            </div>
            <div className="col">
              <div className="rise" style={{ animationDelay: '100ms' }}>
                <span className="field-label">Thumbnail</span>
                <div className="thumbpick">
                  {[['a', v.hue], ['b', (v.hue + 140) % 360], ['c', (v.hue + 220) % 360]].map(([id, h]) => (
                    <button type="button" className={`thumb ${thumb === id ? 'on' : ''}`} onClick={() => setThumb(id as string)} aria-pressed={thumb === id}>
                      <Frame hue={h as number} title={v.title.split(' ').slice(0, 3).join(' ')} small />
                    </button>
                  ))}
                </div>
              </div>
              <div className="rise" style={{ animationDelay: '130ms' }}>
                <span className="field-label">Publish to</span>
                <Tiles multi cols={4} options={dests} value={to} onChange={setTo} />
              </div>
              <div className="rise when" style={{ animationDelay: '160ms' }}>
                <Segmented value={when} onChange={setWhen} options={[{ id: 'now', label: 'Now' }, { id: 'later', label: 'Schedule' }]} />
                {when === 'later' && <div className="ov-in"><Select up value={slot} onChange={setSlot} options={[{ id: 'thu9', label: 'Thu 09:00', hint: 'best for your audience' }, { id: 'thu18', label: 'Thu 18:00' }, { id: 'fri9', label: 'Fri 09:00' }]} /></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

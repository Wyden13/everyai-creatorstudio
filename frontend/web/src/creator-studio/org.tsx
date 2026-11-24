/** Organization (keys, people, approvals, billing) and Settings. */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { canPerform, listVaultSecrets, loginOrg, logoutOrg, saveVaultSecret, type VaultSecretView } from './api';
import { Brand, Icon } from './icons';
import { Frame } from './nodes';
import { set, useStudio, type State } from './store';
import { Button, Field, Segmented, Select, Shape, Swap, Toggle } from './ui';

const keys = [
  { id: 'anthropic', name: 'Anthropic', env: 'ANTHROPIC_API_KEY', last4: 'x7Qa', used: '2 min ago', brand: 'siAnthropic' },
  { id: 'openai', name: 'OpenAI', env: 'OPENAI_API_KEY', last4: 'k2Lm', used: '1 h ago', brand: '' },
  { id: 'eleven', name: 'ElevenLabs', env: 'ELEVENLABS_API_KEY', last4: '9fTe', used: '38 min ago', brand: 'siElevenlabs' },
  { id: 'serp', name: 'SerpApi', env: 'SERPAPI_KEY', last4: 'b81c', used: '4 min ago', brand: 'siGoogle' },
  { id: 'youtube', name: 'YouTube', env: 'YOUTUBE_OAUTH_TOKEN', last4: 'OAuth', used: 'Yesterday', brand: 'siYoutube', expiring: true },
];

function Keys() {
  const s = useStudio();
  const canWrite = canPerform(s.session, 'vault:write');
  const [shown, setShown] = useState<string | null>(null);
  const [rotated, setRotated] = useState<string[]>([]);
  const [liveSecrets, setLiveSecrets] = useState<VaultSecretView[]>([]);
  const [newKeyName, setNewKeyName] = useState('ANTHROPIC_API_KEY');
  const [newProvider, setNewProvider] = useState('anthropic');
  const [newPlaintext, setNewPlaintext] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (s.session.status !== 'Authenticated' || !canWrite) return;
    listVaultSecrets().then(setLiveSecrets).catch(() => {});
  }, [s.session.status, canWrite]);

  const submitKey = async () => {
    if (!newPlaintext.trim()) return;
    try {
      const saved = await saveVaultSecret(newKeyName.trim(), newProvider.trim(), newPlaintext.trim());
      setLiveSecrets((prev) => [...prev.filter((x) => x.key_name !== saved.key_name), saved]);
      setNewPlaintext('');
      setSaveMsg(`Encrypted & saved ${saved.key_name} (${saved.hint})`);
    } catch (err) {
      setSaveMsg((err as Error).message);
    }
  };

  return (
    <div className="rows">
      {!canWrite && (
        <div className="row rise">
          <Icon name="lock" size={16} />
          <span className="dim">Read-only: only <b>org:admin</b> can manage the encrypted API Key Vault.</span>
        </div>
      )}
      {liveSecrets.map((k, i) => (
        <div key={k.key_name} className="row rise" style={{ animationDelay: `${40 + i * 25}ms` }}>
          <span className="row-ic"><Icon name="key" size={18} /></span>
          <span className="row-t"><b>{k.provider_id}</b><small className="mono">{k.key_name}</small></span>
          <span className="mono keyval">{k.hint}</span>
          <span className="row-meta">AES-256-GCM · Vault</span>
        </div>
      ))}
      {keys.map((k, i) => (
        <div key={k.id} className="row rise" style={{ animationDelay: `${60 + i * 30}ms` }}>
          <span className="row-ic">{k.brand ? <Brand name={k.brand} size={18} /> : <Icon name="key" size={18} />}</span>
          <span className="row-t"><b>{k.name}</b><small className="mono">{k.env}</small></span>
          <span className="mono keyval">
            <Swap k={shown === k.id ? 'on' : 'off'}>{shown === k.id ? `sk-…${k.last4}-${k.id.slice(0, 3)}9e2` : `•••• ${k.last4}`}</Swap>
          </span>
          <span className={`row-meta ${k.expiring ? 'amber-t' : ''}`}>{k.expiring ? 'Expires in 3 days' : `Used ${k.used}`}</span>
          <span className="row-acts">
            <button type="button" className="iconbtn" aria-label="Reveal" onClick={() => { setShown(k.id); setTimeout(() => setShown((x) => (x === k.id ? null : x)), 3000); }}><Icon name="eye" size={16} /></button>
            <Button size="sm" icon="retry" disabled={!canWrite} done={rotated.includes(k.id)} onClick={() => setRotated([...rotated, k.id])}>{k.expiring ? 'Reconnect' : 'Rotate'}</Button>
          </span>
        </div>
      ))}
      {canWrite && (
        <div className="invite rise" style={{ animationDelay: '220ms' }}>
          <span className="field-label">Encrypt & store API key in Org Vault</span>
          <div className="invite-row">
            <Field value={newKeyName} placeholder="ANTHROPIC_API_KEY" onChange={setNewKeyName} />
            <Field value={newProvider} placeholder="anthropic" onChange={setNewProvider} />
            <div className="grow"><Field value={newPlaintext} placeholder="Paste secret key (write-only)" onChange={setNewPlaintext} /></div>
            <Button kind="primary" icon="lock" disabled={!newPlaintext.trim() || s.session.status !== 'Authenticated'} onClick={submitKey}>Encrypt</Button>
          </div>
          {saveMsg && <p className="prose dim">{saveMsg}</p>}
        </div>
      )}
    </div>
  );
}

function People() {
  const [roles, setRoles] = useState<Record<string, string>>({ a: 'admin', n: 'manager' });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'admin'>('manager');
  const [sent, setSent] = useState(false);
  const opts = [{ id: 'admin', label: 'Admin', hint: 'keys, billing, approvals' }, { id: 'manager', label: 'Manager', hint: 'board, runs, scripts' }];
  return (
    <div className="rows">
      {[['a', 'You', 'Owner', 'you'], ['n', 'Wendy Nguyen', 'Viewing the board', 'wendy']].map(([id, name, meta, cls], i) => (
        <div className="row rise" style={{ animationDelay: `${60 + i * 30}ms` }}>
          <span className={`face ${cls}`}>{name[0] === 'Y' ? 'A' : 'W'}</span>
          <span className="row-t"><b>{name}</b><small>{meta}</small></span>
          <span className="grow" />
          <div className="row-role"><Select value={roles[id]} onChange={(v) => setRoles({ ...roles, [id]: v })} options={opts} /></div>
        </div>
      ))}
      <div className="invite rise" style={{ animationDelay: '140ms' }}>
        <span className="field-label">Invite someone</span>
        <div className="invite-row">
          <div className="grow"><Field value={email} placeholder="name@studio.com" onChange={(v) => { setEmail(v); setSent(false); }} /></div>
          <Segmented value={role} onChange={setRole} options={[{ id: 'manager', label: 'Manager' }, { id: 'admin', label: 'Admin' }]} />
          <Button kind="primary" icon="mail" done={sent} disabled={!email.includes('@')} onClick={() => setSent(true)}>{sent ? 'Sent' : 'Invite'}</Button>
        </div>
      </div>
    </div>
  );
}

function Approvals() {
  const [state, setState] = useState<Record<string, 'ok' | 'no' | undefined>>({});
  const items = [
    { id: 'w1', title: 'Render queue heatmap', by: 'Wendy, via the Architect', kind: 'Sandboxed TSX widget', note: 'Compiled with esbuild-wasm in an isolated frame. Reads Compiler logs only.' },
    { id: 'w2', title: 'Shorts retention card', by: 'You, via the Architect', kind: 'JSON widget spec', note: 'metric_card ×2, progress_bar ×1, bound to /api/youtube/retention.' },
  ];
  return (
    <div className="approvals">
      {items.map((it, i) => (
        <Shape r={22} className={`appr rise ${state[it.id] ?? ''}`} skin="appr-skin" style={{ animationDelay: `${60 + i * 30}ms` }}>
          <div className="appr-prev"><div className="mini-bars">{[0.3, 0.6, 0.9, 0.5, 0.7, 0.4, 0.8, 0.6].map((v) => <span style={{ height: `${v * 100}%` }} />)}</div></div>
          <div className="appr-t"><b>{it.title}</b><small>{it.kind} · {it.by}</small><p className="prose dim">{it.note}</p></div>
          <div className="nacts">
            <Swap k={state[it.id] ?? 'x'}>
              {state[it.id] ? <span className={`status ${state[it.id] === 'ok' ? 'done' : 'failed'}`}><span className="dot" />{state[it.id] === 'ok' ? 'Deployed to the board' : 'Rejected'}</span> : (
                <span className="nacts">
                  <Button onClick={() => setState({ ...state, [it.id]: 'no' })}>Reject</Button>
                  <Button kind="primary" icon="check" onClick={() => setState({ ...state, [it.id]: 'ok' })}>Approve</Button>
                </span>
              )}
            </Swap>
          </div>
        </Shape>
      ))}
    </div>
  );
}

function Meter({ label, used, total, unit, brand, i }: { label: string; used: number; total: number; unit: string; brand?: string; i: number }) {
  const p = used / total;
  return (
    <div className="meter rise" style={{ animationDelay: `${90 + i * 30}ms` }}>
      <div className="meter-top">
        <span className="meter-l">{brand ? <Brand name={brand} size={15} /> : <Icon name="bolt" size={15} />}{label}</span>
        <span className="num">{used.toLocaleString()} <span className="dim">/ {total.toLocaleString()} {unit}</span></span>
      </div>
      <div className={`mbar ${p > 0.8 ? 'warn' : ''}`}><span style={{ transform: `scaleX(${p})`, transitionDelay: `${200 + i * 30}ms` }} /></div>
    </div>
  );
}

function Billing({ s }: { s: State }) {
  return (
    <div className="billing">
      <Shape r={24} className="plan rise" skin="plan-skin">
        <div><small className="dim">Plan</small><b>Studio</b><span className="dim">2 seats · renews Dec 1</span></div>
        <div className="plan-num"><b className="num">$148</b><span className="dim">this month so far</span></div>
        <Button>Manage plan</Button>
      </Shape>
      <Meter i={0} label="ElevenLabs characters" used={s.credits.used} total={s.credits.total} unit="" brand="siElevenlabs" />
      <Meter i={1} label="Claude tokens" used={8_400_000} total={20_000_000} unit="" brand="siAnthropic" />
      <Meter i={2} label="SerpApi searches" used={3_120} total={5_000} unit="" brand="siGoogle" />
      <Meter i={3} label="Render minutes" used={212} total={600} unit="min" />
    </div>
  );
}

export function Org() {
  const s = useStudio();
  const [tab, setTab] = useState<'keys' | 'people' | 'approvals' | 'billing'>('keys');
  const [email, setEmail] = useState('admin@everyai.studio');
  const [password, setPassword] = useState('creatorstudio-dev');
  const [authErr, setAuthErr] = useState<string | null>(null);

  const signIn = async () => {
    setAuthErr(null);
    try {
      const session = await loginOrg(email, password);
      set({ session });
    } catch (err) {
      setAuthErr((err as Error).message);
    }
  };
  const signOut = async () => {
    await logoutOrg().catch(() => {});
    set({ session: { status: 'Anonymous' } });
  };

  return (
    <div className="page org">
      <div className="page-head rise">
        <div>
          <h1>Organization</h1>
          <p>
            {s.session.status === 'Authenticated'
              ? `EveryAI Studio · ${s.session.displayName} (${s.session.role}) · Sync: ${s.syncState}`
              : 'EveryAI Studio · Sign in to connect to backend/core (:8080)'}
          </p>
        </div>
        {s.session.status === 'Authenticated' ? (
          <Button size="sm" icon="lock" onClick={signOut}>Sign out</Button>
        ) : (
          <div className="invite-row">
            <Field value={email} placeholder="admin@everyai.studio" onChange={setEmail} />
            <Field value={password} placeholder="Password" onChange={setPassword} />
            <Button size="sm" kind="primary" icon="key" onClick={signIn}>Sign in</Button>
          </div>
        )}
      </div>
      {authErr && <p className="prose dim">{authErr}</p>}
      <div className="rise" style={{ animationDelay: '30ms' }}>
        <Segmented value={tab} onChange={setTab} options={[
          { id: 'keys', label: 'Key vault', icon: 'key' },
          { id: 'people', label: 'People', icon: 'user' },
          { id: 'approvals', label: 'Approvals', icon: 'shield', count: 2 },
          { id: 'billing', label: 'Billing', icon: 'card' },
        ]} />
      </div>
      <div className="page-body overlay-scroll" key={tab}>
        {tab === 'keys' && <Keys />}
        {tab === 'people' && <People />}
        {tab === 'approvals' && <Approvals />}
        {tab === 'billing' && <Billing s={s} />}
      </div>
    </div>
  );
}

function Row({ title, hint, children, i }: { title: string; hint: string; children: ReactNode; i: number }) {
  return <div className="srow rise" style={{ animationDelay: `${60 + i * 30}ms` }}><span className="row-t"><b>{title}</b><small>{hint}</small></span>{children}</div>;
}

export function Settings() {
  const s = useStudio();
  const p = s.prefs;
  const tog = (k: keyof State['prefs']) => (v: boolean) => set((st) => ({ prefs: { ...st.prefs, [k]: v } }));
  return (
    <div className="page settings">
      <div className="page-head rise"><div><h1>Settings</h1><p>Only for you. Board changes still sync to Wendy.</p></div></div>
      <div className="page-body overlay-scroll">
        <h2 className="rise">Board</h2>
        <Row i={0} title="Snap to grid" hint="Dropped nodes settle onto a 20 px grid"><Toggle on={p.snap} onChange={tog('snap')} /></Row>
        <Row i={1} title="Show Wendy's cursor" hint="See where your partner is looking"><Toggle on={p.cursors} onChange={tog('cursors')} /></Row>
        <Row i={2} title="Data pulses on edges" hint="Dots travel into a node while it runs"><Toggle on={p.pulses} onChange={tog('pulses')} /></Row>
        <h2 className="rise" style={{ animationDelay: '150ms' }}>Notifications</h2>
        <Row i={4} title="Something needs approval" hint="Screenplays, publishing, new widgets"><Toggle on={p.notifyApproval} onChange={tog('notifyApproval')} /></Row>
        <Row i={5} title="A run fails" hint="With the last 20 log lines"><Toggle on={p.notifyFail} onChange={tog('notifyFail')} /></Row>
      </div>
    </div>
  );
}

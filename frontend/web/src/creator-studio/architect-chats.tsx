/**
 * "Architect chats" view: interactive multi-turn builder where users attach pictures/files,
 * answer Architect MCQ/multi-select clarifying questions, preview the generated widget live,
 * and deploy it to the active workspace in one click.
 */
import { useEffect, useRef, useState } from 'react';
import { DynamicBoardNode, type DeclarativeWidgetSpec } from './dynamic-node';
import { Icon } from './icons';
import { componentCode, get, madeTopics, patchNode, set, useStudio, type BoardNode } from './store';
import { Button } from './ui';

export type ThreadStage = 'Drafting' | 'Clarifying' | 'Ready' | 'Deployed';

interface ChatAttachment {
  id: string;
  name: string;
  kind: 'image' | 'file';
  mimeType: string;
  previewUrl?: string;
  /** Base64 image data (without data: prefix) or UTF-8 text content for live Architect turns. */
  payloadData?: string;
  sizeKb: number;
}

const ARCHITECT_API = (import.meta.env.VITE_ARCHITECT_URL as string | undefined) ?? 'http://localhost:8081';

async function callLiveArchitectTurn(body: {
  prompt: string;
  answers?: Record<string, string[]>;
  attachments?: ChatAttachment[];
}): Promise<{ kind: 'clarify'; summary: string; questions: McqQuestion[] } | { kind: 'plan'; summary: string; spec: DeclarativeWidgetSpec } | null> {
  try {
    const res = await fetch(`${ARCHITECT_API}/api/architect/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: body.prompt,
        answers: body.answers,
        attachments: (body.attachments ?? [])
          .filter((a) => !!a.payloadData)
          .map((a) => ({ name: a.name, mimeType: a.mimeType, data: a.payloadData!, kind: a.kind })),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as
      | { kind: 'clarify'; summary: string; questions: { id: string; question: string; multi_select: boolean; options: { id: string; label: string; hint?: string }[] }[] }
      | { kind: 'plan'; plan: { summary: string; create_board_widget: DeclarativeWidgetSpec } };
    if (data.kind === 'clarify') {
      return {
        kind: 'clarify',
        summary: data.summary,
        questions: data.questions.map((q) => ({ id: q.id, question: q.question, multiSelect: q.multi_select, options: q.options })),
      };
    }
    if (data.kind === 'plan' && data.plan.create_board_widget.spec_type === 'declarative_json') {
      return { kind: 'plan', summary: data.plan.summary, spec: data.plan.create_board_widget };
    }
    return null;
  } catch {
    return null;
  }
}

interface McqQuestion {
  id: string;
  question: string;
  multiSelect: boolean;
  options: { id: string; label: string; hint?: string }[];
}

type ChatMessage =
  | { id: string; role: 'user'; text: string; attachments?: ChatAttachment[] }
  | { id: string; role: 'architect'; kind: 'clarify'; summary: string; questions: McqQuestion[]; answered?: Record<string, string[]> }
  | { id: string; role: 'architect'; kind: 'plan'; summary: string; spec: DeclarativeWidgetSpec; sampleData: Record<string, unknown> };

interface ArchitectThread {
  id: string;
  title: string;
  stage: ThreadStage;
  messages: ChatMessage[];
}

const INITIAL_THREADS: ArchitectThread[] = [
  {
    id: 'chat-market',
    title: 'US Market News Aggregator',
    stage: 'Clarifying',
    messages: [
      { id: 'm1', role: 'user', text: 'Make a component that tracks US market news so we can spot explainer topics fast.' },
      {
        id: 'm2',
        role: 'architect',
        kind: 'clarify',
        summary: 'Before I wire the widget and server worker, let’s lock down 2 quick choices:',
        questions: [
          {
            id: 'sources',
            question: 'Which sources should feed the aggregator?',
            multiSelect: true,
            options: [
              { id: 'serpapi', label: 'SerpApi Google News', hint: 'fast headlines' },
              { id: 'tavily', label: 'Tavily Finance', hint: 'deep summaries' },
              { id: 'exa', label: 'Exa Neural', hint: 'research papers & filings' },
            ],
          },
          {
            id: 'cadence',
            question: 'How often should it poll?',
            multiSelect: false,
            options: [
              { id: '5m', label: 'Every 5 min', hint: 'market open' },
              { id: '30m', label: 'Every 30 min', hint: 'balanced' },
              { id: 'manual', label: 'Manual trigger only' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'chat-yt',
    title: 'YouTube Analytics Tracker',
    stage: 'Ready',
    messages: [
      { id: 'y1', role: 'user', text: 'Track my YouTube channel views, watch hours, CTR, and recent video performance.' },
      {
        id: 'y2',
        role: 'architect',
        kind: 'plan',
        summary: 'Built a Tracker widget bound to /api/widgets/youtube-analytics (Tier 1 Declarative JSON — safe to deploy immediately).',
        spec: {
          spec_type: 'declarative_json',
          archetype: 'tracker',
          title: 'YouTube Analytics',
          subtitle: '28-day channel metrics',
          data_endpoint: '/api/widgets/youtube-analytics',
          poll_interval_ms: 60000,
          blocks: [
            { id: 'b1', kind: 'metric_card', label: 'Views (28d)', value_path: 'views' },
            { id: 'b2', kind: 'metric_card', label: 'Watch Hours', value_path: 'hours' },
            { id: 'b3', kind: 'progress_bar', label: 'Avg CTR Goal', value_path: 'ctr_pct' },
          ],
        },
        sampleData: { views: '142.8K', hours: '6,410 h', ctr_pct: 68 },
      },
    ],
  },
];

function buildClarifyingQuestions(prompt: string): McqQuestion[] {
  return [
    {
      id: 'archetype',
      question: `Which board component style fits “${prompt.slice(0, 42)}”?`,
      multiSelect: false,
      options: [
        { id: 'tracker', label: 'Tracker', hint: 'metrics, charts, costs' },
        { id: 'aggregator', label: 'Aggregator', hint: 'actionable list of items' },
        { id: 'status', label: 'Status monitor', hint: 'uptime & health strip' },
        { id: 'agent', label: 'Agent worker', hint: 'runs & emits output' },
      ],
    },
    {
      id: 'tier',
      question: 'Which rendering tier do you want?',
      multiSelect: false,
      options: [
        { id: 'declarative_json', label: 'Declarative JSON', hint: 'instant deploy, safest' },
        { id: 'sandboxed_tsx', label: 'Sandboxed TSX', hint: 'custom UI, Admin approval' },
      ],
    },
  ];
}

function buildPlanFromAnswers(title: string, answers: Record<string, string[]>): { spec: DeclarativeWidgetSpec; sampleData: Record<string, unknown> } {
  const lower = title.toLowerCase();
  if (lower.includes('made') || lower.includes('produced') || lower.includes('past video')) {
    return {
      spec: {
        spec_type: 'declarative_json',
        archetype: 'aggregator',
        title: 'Topics We Made Videos About',
        subtitle: 'Backed by /api/topics/made',
        data_endpoint: '/api/topics/made',
        poll_interval_ms: 60000,
        blocks: [
          { id: 'b1', kind: 'list_aggregator', label: 'Produced topics', value_path: 'items' },
        ],
      },
      sampleData: { items: madeTopics(get()) },
    };
  }
  const archetype = (answers.archetype?.[0] as DeclarativeWidgetSpec['archetype'] | undefined) ?? 'aggregator';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-widget';
  if (archetype === 'aggregator') {
    return {
      spec: {
        spec_type: 'declarative_json',
        archetype: 'aggregator',
        title,
        subtitle: 'Live polled feed',
        data_endpoint: `/api/widgets/${slug}`,
        poll_interval_ms: 30000,
        blocks: [
          { id: 'b1', kind: 'list_aggregator', label: 'Latest items', value_path: 'items' },
          { id: 'b2', kind: 'trigger_button', label: 'Refresh now', action_endpoint: `/api/widgets/${slug}/refresh` },
        ],
      },
      sampleData: {
        items: [
          'Fed holds rates steady; tech futures climb +1.2%',
          'NVIDIA announces next-gen inference rack shipments',
          'US Treasury yields dip after CPI print',
        ],
      },
    };
  }
  return {
    spec: {
      spec_type: 'declarative_json',
      archetype,
      title,
      subtitle: 'Architect generated',
      data_endpoint: `/api/widgets/${slug}`,
      poll_interval_ms: 30000,
      blocks: [
        { id: 'b1', kind: 'metric_card', label: 'Primary metric', value_path: 'primary' },
        { id: 'b2', kind: 'status_strip', label: 'Recent checks', value_path: 'checks' },
      ],
    },
    sampleData: { primary: '99.4%', checks: [true, true, true, true, true, true, true, true] },
  };
}

export function ArchitectChats() {
  const studio = useStudio();
  const [threads, setThreads] = useState<ArchitectThread[]>(INITIAL_THREADS);
  const [activeId, setActiveId] = useState<string>(INITIAL_THREADS[0]!.id);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string[]>>({});
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!studio.architectPrefill) return;
    setDraft(studio.architectPrefill);
    set({ architectPrefill: null });
  }, [studio.architectPrefill]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0]!;

  const updateThread = (id: string, fn: (t: ArchitectThread) => ArchitectThread) => {
    setThreads((list) => list.map((t) => (t.id === id ? fn(t) : t)));
  };

  const handleFiles = async (files: FileList | null, kind: 'image' | 'file') => {
    if (!files) return;
    const added: ChatAttachment[] = await Promise.all(
      Array.from(files).map(async (f) => {
        let payloadData = '';
        if (kind === 'image') {
          const buf = new Uint8Array(await f.arrayBuffer());
          let bin = '';
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
          payloadData = btoa(bin);
        } else {
          payloadData = (await f.text()).slice(0, 16000);
        }
        return {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name,
          kind,
          mimeType: f.type || (kind === 'image' ? 'image/png' : 'text/plain'),
          previewUrl: kind === 'image' ? URL.createObjectURL(f) : undefined,
          payloadData,
          sizeKb: Math.max(1, Math.round(f.size / 1024)),
        };
      }),
    );
    setAttachments((prev) => [...prev, ...added]);
  };

  const newChat = () => {
    const id = `chat-${Date.now().toString(36)}`;
    const t: ArchitectThread = { id, title: 'New Architect chat', stage: 'Drafting', messages: [] };
    setThreads((prev) => [t, ...prev]);
    setActiveId(id);
    setPendingAnswers({});
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    const sentAtts = attachments;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text || `Attached ${sentAtts.length} file(s)`,
      attachments: sentAtts.length ? sentAtts : undefined,
    };
    const threadId = active.id;
    updateThread(threadId, (t) => ({
      ...t,
      title: t.messages.length === 0 && text ? text.slice(0, 36) : t.title,
      stage: 'Drafting',
      messages: [...t.messages, userMsg],
    }));
    setDraft('');
    setAttachments([]);
    setPendingAnswers({});

    // Direct in-place component edit detection (by cmp_* ID or "edit my <title>").
    const editMatch = /\bcmp_[a-z0-9_]+\b/i.exec(text);
    const targetNode = editMatch
      ? get().nodes.find((n) => componentCode(n).toLowerCase() === editMatch[0].toLowerCase())
      : /^edit\b/i.test(text)
        ? get().nodes.find((n) => text.toLowerCase().includes(n.title.toLowerCase()))
        : undefined;
    if (targetNode) {
      const styleNote = text.replace(/^edit\s+(component\s+\S+\s*(\([^)]*\))?:?\s*)?/i, '').trim() || 'Updated via Architect';
      patchNode(targetNode.id, { sub: `${targetNode.sub.split('·')[0]!.trim()} · ${styleNote.slice(0, 36)}`, note: `Edited by Architect: ${styleNote.slice(0, 48)}` });
      const editReply: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'architect',
        kind: 'plan',
        summary: `Updated ${targetNode.title} (${componentCode(targetNode)}) in place: “${styleNote}”.`,
        spec: {
          spec_type: 'declarative_json',
          archetype: targetNode.type,
          title: targetNode.title,
          subtitle: styleNote,
          data_endpoint: `/api/components/${componentCode(targetNode)}`,
          blocks: [{ id: 'b1', kind: 'metric_card', label: 'Applied edit', value_path: 'style' }],
        },
        sampleData: { style: styleNote },
      };
      updateThread(threadId, (t) => ({ ...t, stage: 'Deployed', messages: [...t.messages, editReply] }));
      return;
    }

    const live = await callLiveArchitectTurn({ prompt: text || `Build from ${sentAtts[0]!.name}`, attachments: sentAtts });
    const reply: ChatMessage = live?.kind === 'plan'
      ? { id: `p-${Date.now()}`, role: 'architect', kind: 'plan', summary: live.summary, spec: live.spec, sampleData: {} }
      : live?.kind === 'clarify'
        ? { id: `a-${Date.now()}`, role: 'architect', kind: 'clarify', summary: live.summary, questions: live.questions }
        : {
            id: `a-${Date.now()}`,
            role: 'architect',
            kind: 'clarify',
            summary: sentAtts.length
              ? `Got your ${sentAtts.length} attachment(s). Clarify these two details before I generate the component:`
              : 'Before building, confirm these details so I pick the exact layout and data bindings:',
            questions: buildClarifyingQuestions(text || sentAtts[0]!.name),
          };

    updateThread(threadId, (t) => ({
      ...t,
      stage: reply.kind === 'plan' ? 'Ready' : 'Clarifying',
      messages: [...t.messages, reply],
    }));
  };

  const toggleOption = (q: McqQuestion, optId: string) => {
    setPendingAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.multiSelect) {
        return { ...prev, [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [q.id]: [optId] };
    });
  };

  const submitMcq = (msgId: string) => {
    const built = buildPlanFromAnswers(active.title, pendingAnswers);
    const planMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      role: 'architect',
      kind: 'plan',
      summary: `Ready to deploy as a ${built.spec.archetype} widget (${built.spec.data_endpoint}).`,
      spec: built.spec,
      sampleData: built.sampleData,
    };
    updateThread(active.id, (t) => ({
      ...t,
      stage: 'Ready',
      messages: [
        ...t.messages.map((m) => (m.id === msgId && m.role === 'architect' && m.kind === 'clarify' ? { ...m, answered: pendingAnswers } : m)),
        planMsg,
      ],
    }));
    setPendingAnswers({});
  };

  const deployToBoard = (spec: DeclarativeWidgetSpec) => {
    const cur = get().nodes;
    const maxX = cur.reduce((m, n) => Math.max(m, n.x + n.w), 80);
    const newNode: BoardNode = {
      id: `arch-${Date.now().toString(36)}`,
      kind: spec.archetype === 'tracker' ? 'analytics' : spec.archetype === 'aggregator' ? 'toptrends' : 'research',
      type: spec.archetype,
      title: spec.title,
      sub: spec.subtitle ?? spec.data_endpoint,
      x: Math.min(maxX + 48, 980),
      y: 260,
      w: 290,
      h: 200,
      status: 'idle',
      progress: 0,
      note: 'Deployed from Architect chat',
      widget: spec.archetype === 'tracker' || spec.archetype === 'aggregator',
    };
    set((s) => ({ nodes: [...s.nodes, newNode], view: 'board', selected: newNode.id }));
    updateThread(active.id, (t) => ({ ...t, stage: 'Deployed' }));
  };

  return (
    <div className="arch-chats">
      <aside className="ac-side">
        <div className="ac-side-h">
          <b>Architect chats</b>
          <Button size="sm" kind="primary" icon="plus" onClick={newChat}>New</Button>
        </div>
        <div className="ac-list">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ac-item ${t.id === active.id ? 'on' : ''}`}
              onClick={() => { setActiveId(t.id); setPendingAnswers({}); }}
            >
              <span className="ac-item-t">{t.title}</span>
              <span className={`ac-stage st-${t.stage.toLowerCase()}`}>{t.stage}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="ac-main">
        <header className="ac-head">
          <div>
            <h2>{active.title}</h2>
            <p className="prose dim">Attach reference screenshots or data files, answer quick MCQs, and deploy directly to your workspace.</p>
          </div>
          <span className={`ac-stage st-${active.stage.toLowerCase()}`}>{active.stage}</span>
        </header>

        <div className="ac-feed overlay-scroll">
          {active.messages.length === 0 && (
            <div className="empty">
              <Icon name="sparkle" size={22} />
              <b>Describe what you want to build</b>
              <p className="prose dim">Drop a screenshot mockup, a JSON sample, or a rough idea — the Architect will ask clarifying MCQs before generating.</p>
            </div>
          )}

          {active.messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="ac-msg user">
                  <p>{m.text}</p>
                  {m.attachments && (
                    <div className="ac-atts">
                      {m.attachments.map((a) => (
                        <div key={a.id} className="ac-att">
                          {a.previewUrl ? <img src={a.previewUrl} alt={a.name} /> : <Icon name="screenplay" size={15} />}
                          <span>{a.name}</span>
                          <small className="dim">{a.sizeKb} KB</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (m.kind === 'clarify') {
              const locked = !!m.answered;
              const sel = m.answered ?? pendingAnswers;
              return (
                <div key={m.id} className="ac-msg arch">
                  <div className="ac-arch-tag"><Icon name="sparkle" size={14} />Architect · Clarifying questions</div>
                  <p>{m.summary}</p>
                  <div className="ac-mcqs">
                    {m.questions.map((q) => (
                      <div key={q.id} className="ac-mcq">
                        <span className="field-label">{q.question}{q.multiSelect ? ' · multi-select' : ''}</span>
                        <div className="ac-opts">
                          {q.options.map((opt) => {
                            const on = (sel[q.id] ?? []).includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={locked}
                                className={`ac-opt ${on ? 'on' : ''}`}
                                onClick={() => toggleOption(q, opt.id)}
                              >
                                <b>{opt.label}</b>
                                {opt.hint && <small>{opt.hint}</small>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!locked && (
                    <div className="ac-mcq-foot">
                      <Button kind="primary" size="sm" icon="check" onClick={() => submitMcq(m.id)}>
                        Submit answers & build
                      </Button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={m.id} className="ac-msg arch">
                <div className="ac-arch-tag"><Icon name="sparkle" size={14} />Architect · Ready to deploy</div>
                <p>{m.summary}</p>
                <div className="ac-preview">
                  <div className="ac-preview-h">
                    <b>{m.spec.title}</b>
                    <small className="mono dim">{m.spec.data_endpoint}</small>
                  </div>
                  <DynamicBoardNode spec={m.spec} data={m.sampleData} />
                </div>
                <div className="ac-mcq-foot">
                  <Button kind="primary" size="sm" icon="plus" onClick={() => deployToBoard(m.spec)}>
                    Deploy to workspace
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="ac-compose">
          {attachments.length > 0 && (
            <div className="ac-atts">
              {attachments.map((a) => (
                <div key={a.id} className="ac-att">
                  {a.previewUrl ? <img src={a.previewUrl} alt={a.name} /> : <Icon name="screenplay" size={14} />}
                  <span>{a.name}</span>
                  <button type="button" className="iconbtn" onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))} aria-label="Remove attachment">
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="ac-compose-row">
            <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files, 'image')} />
            <input ref={fileInput} type="file" accept=".json,.csv,.md,.txt,.tsx,.ts,.py" multiple hidden onChange={(e) => handleFiles(e.target.files, 'file')} />
            <Button size="sm" kind="secondary" icon="thumbs" title="Attach picture / mockup" onClick={() => imageInput.current?.click()}>Picture</Button>
            <Button size="sm" kind="secondary" icon="screenplay" title="Attach JSON / CSV / code file" onClick={() => fileInput.current?.click()}>File</Button>
            <input
              className="input grow"
              value={draft}
              placeholder="Describe a widget, tracker, or agent — or drop a screenshot/file…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <Button size="sm" kind="primary" icon="send" onClick={sendMessage}>Send</Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

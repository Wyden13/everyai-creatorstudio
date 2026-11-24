/**
 * Universal Architect-generated widget renderers:
 * - Tier 1: <DynamicBoardNode/> renders Declarative JSON UI specs via a data lookup table (zero eval).
 * - Tier 2: <SandboxedTsxFrame/> isolates compiled TSX inside <iframe sandbox="allow-scripts">
 *   (NO allow-same-origin) and blocks execution until org:admin approves.
 */
import type { ReactNode } from 'react';
import { Button } from './ui';

export type DeclarativeBlockKind =
  | 'metric_card'
  | 'progress_bar'
  | 'table'
  | 'trigger_button'
  | 'status_strip'
  | 'list_aggregator';

export interface DeclarativeBlock {
  id: string;
  kind: DeclarativeBlockKind;
  label: string;
  value_path?: string;
  action_endpoint?: string;
}

export interface DeclarativeWidgetSpec {
  spec_type: 'declarative_json';
  archetype: 'agent' | 'status' | 'tracker' | 'aggregator';
  title: string;
  subtitle?: string;
  data_endpoint: string;
  poll_interval_ms?: number;
  blocks: DeclarativeBlock[];
}

export interface SandboxedTsxSpec {
  spec_type: 'sandboxed_tsx';
  archetype: 'agent' | 'status' | 'tracker' | 'aggregator';
  title: string;
  subtitle?: string;
  tsx_source: string;
  approval_status: 'pending_admin' | 'approved' | 'rejected';
}

function readPath(obj: Record<string, unknown>, path?: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

type BlockRenderer = (block: DeclarativeBlock, val: unknown, onAction?: (endpoint: string) => void) => ReactNode;

/** Declarative block renderer table; add new block kinds as rows here. */
const BLOCK_RENDERERS: Record<DeclarativeBlockKind, BlockRenderer> = {
  metric_card: (b, val) => (
    <div className="dyn-metric">
      <small className="dim">{b.label}</small>
      <b className="num">{val !== undefined ? String(val) : '—'}</b>
    </div>
  ),
  progress_bar: (b, val) => {
    const pct = Math.max(0, Math.min(100, Number(val ?? 0)));
    return (
      <div className="dyn-prog">
        <div className="dyn-prog-h">
          <small>{b.label}</small>
          <span className="num dim">{pct.toFixed(0)}%</span>
        </div>
        <div className="prog"><i style={{ width: `${pct}%` }} /></div>
      </div>
    );
  },
  status_strip: (b, val) => {
    const items = Array.isArray(val) ? val : [true, true, true, true, true, true];
    return (
      <div className="dyn-strip">
        <small className="dim">{b.label}</small>
        <div className="beats">
          {items.map((ok, i) => (
            <span key={i} className={ok ? 'ok' : 'bad'} />
          ))}
        </div>
      </div>
    );
  },
  list_aggregator: (b, val) => {
    const rows = Array.isArray(val) ? val : [];
    return (
      <div className="dyn-list">
        <small className="dim">{b.label}</small>
        <ul className="trows">
          {rows.slice(0, 5).map((item, i) => (
            <li key={i} className="trow">
              <span className="tname">{typeof item === 'string' ? item : JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  },
  table: (b, val) => {
    const rows = Array.isArray(val) ? (val as Record<string, unknown>[]) : [];
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    return (
      <div className="dyn-table">
        <small className="dim">{b.label}</small>
        {cols.length === 0 ? (
          <p className="prose dim">No rows yet.</p>
        ) : (
          <table>
            <thead>
              <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 4).map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  },
  trigger_button: (b, _, onAction) => (
    <Button
      size="sm"
      kind="secondary"
      onClick={() => b.action_endpoint && onAction?.(b.action_endpoint)}
    >
      {b.label}
    </Button>
  ),
};

export function DynamicBoardNode({
  spec,
  data,
  onAction,
}: {
  spec: DeclarativeWidgetSpec;
  data: Record<string, unknown>;
  onAction?: (endpoint: string) => void;
}) {
  return (
    <div className="nb dyn-node">
      {spec.blocks.map((block) => (
        <div key={block.id} className="dyn-block">
          {BLOCK_RENDERERS[block.kind](block, readPath(data, block.value_path), onAction)}
        </div>
      ))}
    </div>
  );
}

/**
 * Isolated iframe host for Admin-approved custom TSX widgets.
 * Enforces sandbox="allow-scripts" WITHOUT allow-same-origin.
 */
export function SandboxedTsxFrame({
  spec,
  compiledJs,
  onApproveAdmin,
}: {
  spec: SandboxedTsxSpec;
  compiledJs?: string;
  onApproveAdmin?: () => void;
}) {
  if (spec.approval_status !== 'approved') {
    return (
      <div className="nb dyn-gate">
        <span className="status approval"><span className="dot" />Admin approval required</span>
        <p className="prose dim">Custom TSX widgets stay blocked until an org:admin reviews and approves them.</p>
        {onApproveAdmin && (
          <Button size="sm" kind="amber" icon="shield" onClick={onApproveAdmin}>
            Approve TSX (Admin)
          </Button>
        )}
      </div>
    );
  }

  const srcDoc = `<!doctype html><html><head><style>body{margin:0;background:#15161B;color:#ECECF1;font:13px system-ui;}</style></head><body><div id="w"></div><script type="module">${compiledJs ?? ''}</script></body></html>`;
  return (
    <iframe
      title={spec.title}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ width: '100%', height: '100%', border: 0, borderRadius: 12 }}
    />
  );
}

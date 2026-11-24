/**
 * Self-hosted Yjs realtime sync + SSE server-to-board event client.
 * Models connection lifecycle with an explicit state × event transition table.
 */
import * as Y from 'yjs';
import type { Status } from './store';

export type SyncState = 'Disconnected' | 'Connecting' | 'Synced' | 'Reconnecting';
export type SyncEvent = 'connect' | 'open' | 'close' | 'error' | 'disconnect';

/** Every legal sync connection transition is a row here; add new behavior as a row. */
const SYNC_TRANSITIONS: Record<SyncState, Partial<Record<SyncEvent, SyncState>>> = {
  Disconnected: { connect: 'Connecting' },
  Connecting: { open: 'Synced', close: 'Reconnecting', error: 'Reconnecting', disconnect: 'Disconnected' },
  Synced: { close: 'Reconnecting', error: 'Reconnecting', disconnect: 'Disconnected' },
  Reconnecting: { connect: 'Connecting', open: 'Synced', disconnect: 'Disconnected' },
};

export function transitionSync(state: SyncState, event: SyncEvent): SyncState {
  return SYNC_TRANSITIONS[state][event] ?? state;
}

export interface NodePositionUpdate {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ServerBoardEvent {
  event_type: 'node.status_changed' | 'node.log_chunk' | 'node.queue_updated' | 'worker.health_check';
  workspace_id: string;
  node_id: string | null;
  payload: {
    status?: Status;
    line?: string;
    progress?: number;
  };
}

export interface BoardSyncCallbacks {
  onStateChange: (state: SyncState) => void;
  onRemoteNodeMove: (update: NodePositionUpdate) => void;
  onServerEvent: (ev: ServerBoardEvent) => void;
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8080';

export function createWorkspaceSync(workspaceId: string, cb: BoardSyncCallbacks) {
  const doc = new Y.Doc();
  const nodesMap = doc.getMap<NodePositionUpdate>('nodes');

  let state: SyncState = 'Disconnected';
  let ws: WebSocket | null = null;
  let sse: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const setState = (event: SyncEvent) => {
    const next = transitionSync(state, event);
    if (next === state) return;
    state = next;
    cb.onStateChange(state);
  };

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(update);
    }
  };
  doc.on('update', onDocUpdate);

  nodesMap.observe((ev) => {
    if (ev.transaction.origin !== 'remote') return;
    ev.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const val = nodesMap.get(key);
        if (val) cb.onRemoteNodeMove(val);
      }
    });
  });

  const openSocket = () => {
    if (disposed) return;
    setState('connect');
    const socket = new WebSocket(`${WS_URL}/ws/board/${encodeURIComponent(workspaceId)}`);
    socket.binaryType = 'arraybuffer';
    ws = socket;

    socket.onopen = () => {
      setState('open');
      // Push local state vector on connect so peers converge.
      const full = Y.encodeStateAsUpdate(doc);
      if (full.byteLength > 2) socket.send(full);
    };

    socket.onmessage = (msg) => {
      if (msg.data instanceof ArrayBuffer) {
        Y.applyUpdate(doc, new Uint8Array(msg.data), 'remote');
      }
    };

    socket.onerror = () => setState('error');
    socket.onclose = () => {
      if (ws === socket) ws = null;
      if (disposed) return;
      setState('close');
      retryTimer = setTimeout(openSocket, 3000);
    };
  };

  const openEvents = () => {
    if (disposed || typeof EventSource === 'undefined') return;
    const source = new EventSource(`${API_URL}/api/events/${encodeURIComponent(workspaceId)}`, {
      withCredentials: true,
    });
    sse = source;
    source.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as ServerBoardEvent;
        cb.onServerEvent(parsed);
      } catch {
        // Ignore malformed frames
      }
    };
  };

  openSocket();
  openEvents();

  return {
    publishNodePosition(pos: NodePositionUpdate) {
      doc.transact(() => {
        nodesMap.set(pos.id, pos);
      }, 'local');
    },
    dispose() {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      doc.off('update', onDocUpdate);
      ws?.close();
      sse?.close();
      ws = null;
      sse = null;
      setState('disconnect');
      doc.destroy();
    },
  };
}

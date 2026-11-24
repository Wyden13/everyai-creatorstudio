/**
 * Persistent Redis job consumer daemon for backend/worker-agents.
 * Uses Bun's native RedisClient, an explicit DaemonState × DaemonEvent transition table,
 * and streams live status/log updates back to Anole's /api/internal/events endpoint.
 */
import { z } from 'zod';

export const AGENTS_QUEUE_KEY = 'creatorstudio:jobs:agents';

export type DaemonState = 'Stopped' | 'Connecting' | 'Polling' | 'Executing' | 'Draining';
export type DaemonEvent = 'start' | 'connected' | 'job_received' | 'job_done' | 'error' | 'shutdown' | 'drained';

/** Every legal daemon lifecycle transition is a row here; add new behavior as a row. */
const DAEMON_TRANSITIONS: Partial<Record<`${DaemonState}:${DaemonEvent}`, DaemonState>> = {
  'Stopped:start': 'Connecting',
  'Connecting:connected': 'Polling',
  'Connecting:error': 'Stopped',
  'Connecting:shutdown': 'Draining',
  'Polling:job_received': 'Executing',
  'Polling:error': 'Connecting',
  'Polling:shutdown': 'Draining',
  'Executing:job_done': 'Polling',
  'Executing:error': 'Polling',
  'Executing:shutdown': 'Draining',
  'Draining:drained': 'Stopped',
};

export function transitionDaemon(state: DaemonState, event: DaemonEvent): DaemonState {
  return DAEMON_TRANSITIONS[`${state}:${event}`] ?? state;
}

export const AgentJobSchema = z.object({
  job_id: z.string().min(1),
  run_id: z.string().min(1),
  workspace_id: z.string().min(1),
  kind: z.enum(['trend_scout', 'screenplay', 'voiceover', 'animation', 'compile', 'publish']),
  topic: z.string().optional(),
  approval_mode: z.enum(['gate', 'auto', 'scheduled']).optional(),
});
export type AgentJob = z.infer<typeof AgentJobSchema>;

export function parseAgentJob(raw: string): { ok: true; job: AgentJob } | { ok: false; reason: string } {
  try {
    const parsed = AgentJobSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ok: false, reason: parsed.error.message };
    return { ok: true, job: parsed.data };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function emitCoreEvent(opts: {
  coreUrl: string;
  workerToken: string;
  workspaceId: string;
  eventType: string;
  nodeId?: string;
  status?: string;
  line?: string;
}): Promise<void> {
  const res = await fetch(`${opts.coreUrl}/api/internal/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-worker-token': opts.workerToken,
    },
    body: JSON.stringify({
      workspace_id: opts.workspaceId,
      event_type: opts.eventType,
      node_id: opts.nodeId ?? null,
      status: opts.status ?? null,
      line: opts.line ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Core event push failed (${res.status}): ${await res.text()}`);
  }
}

export async function startAgentDaemon(opts: {
  redisUrl: string;
  coreUrl: string;
  workerToken: string;
}): Promise<void> {
  let state: DaemonState = transitionDaemon('Stopped', 'start');
  const redis = new Bun.RedisClient(opts.redisUrl);
  await redis.connect();
  state = transitionDaemon(state, 'connected');
  console.log(`[worker-agents] daemon ${state} on ${AGENTS_QUEUE_KEY}`);

  const stop = () => {
    state = transitionDaemon(state, 'shutdown');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (state !== 'Draining' && state !== 'Stopped') {
    const raw = await redis.rpop(AGENTS_QUEUE_KEY);
    if (!raw) {
      await Bun.sleep(250);
      continue;
    }
    const parsed = parseAgentJob(raw);
    if (!parsed.ok) {
      console.error('[worker-agents] invalid job payload:', parsed.reason);
      continue;
    }
    state = transitionDaemon(state, 'job_received');
    const job = parsed.job;
    try {
      await emitCoreEvent({
        coreUrl: opts.coreUrl,
        workerToken: opts.workerToken,
        workspaceId: job.workspace_id,
        eventType: 'node.status_changed',
        nodeId: job.kind,
        status: 'Running',
        line: `started ${job.kind} (${job.run_id})`,
      });
    } catch (err) {
      console.error('[worker-agents] event push error:', (err as Error).message);
    } finally {
      state = transitionDaemon(state, 'job_done');
    }
  }

  redis.close();
  state = transitionDaemon(state, 'drained');
  console.log(`[worker-agents] daemon ${state}`);
}

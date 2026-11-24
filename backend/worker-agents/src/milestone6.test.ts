import { describe, expect, test } from 'bun:test';
import { parseAgentJob, transitionDaemon, type DaemonEvent, type DaemonState } from './daemon';

describe('worker-agents Redis daemon state machine', () => {
  const rows: [DaemonState, DaemonEvent, DaemonState][] = [
    ['Stopped', 'start', 'Connecting'],
    ['Stopped', 'job_received', 'Stopped'],
    ['Connecting', 'connected', 'Polling'],
    ['Connecting', 'error', 'Stopped'],
    ['Polling', 'job_received', 'Executing'],
    ['Polling', 'shutdown', 'Draining'],
    ['Executing', 'job_done', 'Polling'],
    ['Executing', 'error', 'Polling'],
    ['Executing', 'shutdown', 'Draining'],
    ['Draining', 'drained', 'Stopped'],
  ];

  for (const [from, event, expected] of rows) {
    test(`${from} × ${event} → ${expected}`, () => {
      expect(transitionDaemon(from, event)).toBe(expected);
    });
  }

  test('validates Redis job JSON envelopes and rejects malformed jobs', () => {
    const ok = parseAgentJob(
      JSON.stringify({
        job_id: 'job_1',
        run_id: 'run_1',
        workspace_id: 'ws_explainers',
        kind: 'screenplay',
        topic: 'Sodium batteries',
        approval_mode: 'auto',
      }),
    );
    expect(ok.ok).toBe(true);

    expect(parseAgentJob('not-json').ok).toBe(false);
    expect(parseAgentJob(JSON.stringify({ job_id: 'j1', kind: 'unknown' })).ok).toBe(false);
  });
});

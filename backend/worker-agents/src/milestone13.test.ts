import { describe, expect, test } from 'bun:test';
import { isScheduleDue, nextRunAtMs, reconcileTopTrends, type ScheduleInterval } from './scheduler';

describe('auto-scheduler intervals', () => {
  const now = 1_700_000_000_000;
  const cases: [ScheduleInterval, number | null, boolean][] = [
    ['off', null, false],
    ['off', now - 999_999_999, false],
    ['15m', null, true],
    ['15m', now - 10 * 60_000, false],
    ['15m', now - 15 * 60_000, true],
    ['30m', now - 29 * 60_000, false],
    ['30m', now - 31 * 60_000, true],
    ['daily', now - 25 * 60 * 60_000, true],
  ];

  for (const [interval, lastRunAtMs, expected] of cases) {
    test(`interval=${interval} lastRun=${lastRunAtMs === null ? 'never' : 'past'} → due=${expected}`, () => {
      expect(isScheduleDue({ nodeId: 'trend', interval, lastRunAtMs }, now)).toBe(expected);
    });
  }

  test('nextRunAtMs returns null when off', () => {
    expect(nextRunAtMs({ nodeId: 'trend', interval: 'off', lastRunAtMs: now }, now)).toBeNull();
    expect(nextRunAtMs({ nodeId: 'trend', interval: '30m', lastRunAtMs: now }, now)).toBe(now + 30 * 60_000);
  });
});

describe('Top Trends reconciler (add fresh, prune stale/weak, exclude Made)', () => {
  const now = 1_700_000_000_000;
  const hour = 60 * 60_000;

  test('adds rising topics, prunes stale/low-velocity topics, and removes Made topics', () => {
    const existing = [
      { topic: 'Sodium batteries are coming', velocity: 0.91, novelty: 0.8, addedAtMs: now - 2 * hour },
      { topic: 'Stale old trend', velocity: 0.85, novelty: 0.7, addedAtMs: now - 72 * hour },
      { topic: 'Fading low-velocity trend', velocity: 0.22, novelty: 0.6, addedAtMs: now - 3 * hour },
      { topic: 'How GPS knows the time', velocity: 0.95, novelty: 0.9, addedAtMs: now - 1 * hour },
    ];
    const incoming = [
      { topic: 'Quantum error correction breakthrough', velocity: 0.94, novelty: 0.92, addedAtMs: now },
      { topic: 'How GPS knows the time', velocity: 0.95, novelty: 0.9, addedAtMs: now },
    ];
    const made = ['How GPS knows the time'];

    const res = reconcileTopTrends(existing, incoming, made, { nowMs: now });
    expect(res.added).toEqual(['Quantum error correction breakthrough']);
    expect(res.removed).toEqual(['Stale old trend', 'Fading low-velocity trend', 'How GPS knows the time']);
    expect(res.topics.map((t) => t.topic)).toEqual([
      'Quantum error correction breakthrough',
      'Sodium batteries are coming',
    ]);
  });
});

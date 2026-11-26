import { describe, expect, test } from 'bun:test';
import { isScheduleDue, nextRunAtMs, noveltyAgainst, reconcileTopTrends, trendScore, type ScheduleInterval } from './scheduler';

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

describe('trend novelty & score', () => {
  const recent = ['WebSockets guide for beginners', 'How Rome built its roads'];
  const rows: [string, string, number][] = [
    ['all content words new', 'Zero-copy Zig WebTransport benchmarks', 1],
    ['half the words already used', 'WebSockets guide alternatives compared', 0.5],
    ['fully repeated title floors at 0.1', 'WebSockets guide', 0.1],
    ['case and punctuation ignored', 'ROME: roads!', 0.1],
    ['only short words is neutral', 'AI on TV', 0.5],
  ];
  for (const [name, topic, expected] of rows) test(name, () => expect(noveltyAgainst(topic, recent)).toBe(expected));
  test('no recent titles means fully novel', () => expect(noveltyAgainst('Roman roads', [])).toBe(1));
  test('velocity outweighs novelty', () => expect(trendScore({ velocity: 1, novelty: 0 })).toBeGreaterThan(trendScore({ velocity: 0, novelty: 1 })));
});

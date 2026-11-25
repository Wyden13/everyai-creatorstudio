/**
 * Declarative auto-scheduler & Top Trends reconciler.
 * Interval durations live in INTERVAL_MS; reconcileTopTrends() is a pure function
 * that adds rising topics, prunes stale/low-velocity ones, and excludes "Made" topics.
 */

export type ScheduleInterval = 'off' | '15m' | '30m' | '2h' | '6h' | 'daily';

/** Canonical interval lookup table; add new cadences as rows here. */
export const INTERVAL_MS: Record<ScheduleInterval, number | null> = {
  off: null,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '2h': 2 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

export interface NodeSchedule {
  nodeId: string;
  interval: ScheduleInterval;
  lastRunAtMs: number | null;
}

export function isScheduleDue(schedule: NodeSchedule, nowMs: number): boolean {
  const period = INTERVAL_MS[schedule.interval];
  if (period === null) return false;
  if (schedule.lastRunAtMs === null) return true;
  return nowMs - schedule.lastRunAtMs >= period;
}

export function nextRunAtMs(schedule: NodeSchedule, nowMs: number): number | null {
  const period = INTERVAL_MS[schedule.interval];
  if (period === null) return null;
  const base = schedule.lastRunAtMs ?? nowMs;
  return base + period;
}

export interface TrendItem {
  topic: string;
  velocity: number;
  novelty: number;
  addedAtMs: number;
}

export interface ReconcileOptions {
  nowMs: number;
  minVelocity?: number;
  maxAgeMs?: number;
  maxItems?: number;
}

export interface ReconcileResult {
  topics: TrendItem[];
  added: string[];
  removed: string[];
}

/**
 * Pure Top Trends reconciler:
 * 1. Excludes any topic already in `madeTopics` (keeps Top Trends strictly actionable).
 * 2. Prunes existing items that dropped below `minVelocity` or aged past `maxAgeMs`.
 * 3. Adds fresh incoming items above `minVelocity` and sorts by combined velocity/novelty.
 */
export function reconcileTopTrends(
  existing: readonly TrendItem[],
  incoming: readonly TrendItem[],
  madeTopics: readonly string[],
  opts: ReconcileOptions,
): ReconcileResult {
  const minVelocity = opts.minVelocity ?? 0.4;
  const maxAgeMs = opts.maxAgeMs ?? 48 * 60 * 60_000;
  const maxItems = opts.maxItems ?? 8;

  const madeSet = new Set(madeTopics.map((t) => t.trim().toLowerCase()));
  const incomingByKey = new Map(incoming.map((t) => [t.topic.trim().toLowerCase(), t]));
  const existingKeys = new Set(existing.map((t) => t.topic.trim().toLowerCase()));

  const kept: TrendItem[] = [];
  const removed: string[] = [];

  for (const item of existing) {
    const key = item.topic.trim().toLowerCase();
    const fresh = incomingByKey.get(key);
    const merged = fresh ? { ...item, velocity: fresh.velocity, novelty: fresh.novelty } : item;
    const isMade = madeSet.has(key);
    const isStale = opts.nowMs - merged.addedAtMs > maxAgeMs;
    const isWeak = merged.velocity < minVelocity;

    if (isMade || isStale || isWeak) {
      removed.push(item.topic);
    } else {
      kept.push(merged);
    }
  }

  const added: string[] = [];
  for (const item of incoming) {
    const key = item.topic.trim().toLowerCase();
    if (existingKeys.has(key) || madeSet.has(key) || item.velocity < minVelocity) continue;
    kept.push(item);
    added.push(item.topic);
  }

  const sorted = kept
    .sort((a, b) => b.velocity * 0.6 + b.novelty * 0.4 - (a.velocity * 0.6 + a.novelty * 0.4))
    .slice(0, maxItems);

  return { topics: sorted, added, removed };
}

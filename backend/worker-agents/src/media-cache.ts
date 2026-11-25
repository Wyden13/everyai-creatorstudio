/**
 * Bounded LRU media cache index + RFC 7233 HTTP Byte Range parser for
 * instant <video>/<audio> scrubbing over Google Drive 5TB storage.
 */

export interface ByteRange {
  start: number;
  end: number;
  contentLength: number;
  contentRangeHeader: string;
}

/**
 * Pure RFC 7233 single-range parser (`bytes=start-end` or `bytes=start-`).
 * Returns null if the range is malformed or unsatisfiable (caller responds 416).
 */
export function parseByteRange(rangeHeader: string, totalBytes: number): ByteRange | null {
  if (totalBytes <= 0) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), totalBytes - 1) : totalBytes - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalBytes) {
    return null;
  }
  return {
    start,
    end,
    contentLength: end - start + 1,
    contentRangeHeader: `bytes ${start}-${end}/${totalBytes}`,
  };
}

export interface CacheEntry {
  key: string;
  sizeBytes: number;
}

/**
 * Pure bounded LRU cache tracker. Keeps total bytes <= maxBytes and returns
 * evicted keys so callers can unlink the corresponding files on disk.
 */
export class MediaLruCache {
  private readonly maxBytes: number;
  private readonly entries = new Map<string, number>();
  private totalBytes = 0;

  constructor(maxBytes: number) {
    this.maxBytes = Math.max(1, maxBytes);
  }

  get currentBytes(): number {
    return this.totalBytes;
  }

  touch(key: string): boolean {
    const size = this.entries.get(key);
    if (size === undefined) return false;
    this.entries.delete(key);
    this.entries.set(key, size);
    return true;
  }

  put(key: string, sizeBytes: number): string[] {
    if (this.entries.has(key)) {
      this.totalBytes -= this.entries.get(key)!;
      this.entries.delete(key);
    }
    this.entries.set(key, sizeBytes);
    this.totalBytes += sizeBytes;

    const evicted: string[] = [];
    for (const [oldestKey, oldestSize] of this.entries) {
      if (this.totalBytes <= this.maxBytes) break;
      if (oldestKey === key && this.entries.size === 1) break;
      this.entries.delete(oldestKey);
      this.totalBytes -= oldestSize;
      evicted.push(oldestKey);
    }
    return evicted;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }
}

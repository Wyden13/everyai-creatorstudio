import { describe, expect, test } from 'bun:test';
import { normalizeYouTubeStats } from './analytics';
import { MediaLruCache, parseByteRange } from './media-cache';

describe('HTTP Byte Range parser & LRU media cache', () => {
  test('parses valid byte ranges and rejects out-of-bounds ranges', () => {
    const r1 = parseByteRange('bytes=0-1023', 4096);
    expect(r1).toEqual({ start: 0, end: 1023, contentLength: 1024, contentRangeHeader: 'bytes 0-1023/4096' });

    const r2 = parseByteRange('bytes=1000-', 4096);
    expect(r2?.end).toBe(4095);
    expect(r2?.contentLength).toBe(3096);

    expect(parseByteRange('bytes=5000-6000', 4096)).toBeNull();
    expect(parseByteRange('invalid', 4096)).toBeNull();
  });

  test('evicts least-recently-used entries when exceeding maxBytes', () => {
    const cache = new MediaLruCache(100);
    expect(cache.put('a.mp4', 40)).toEqual([]);
    expect(cache.put('b.mp4', 40)).toEqual([]);
    cache.touch('a.mp4'); // b.mp4 is now LRU
    expect(cache.put('c.mp4', 40)).toEqual(['b.mp4']);
    expect(cache.has('a.mp4')).toBe(true);
    expect(cache.has('b.mp4')).toBe(false);
    expect(cache.currentBytes).toBe(80);
  });

  test('normalizes YouTube Data API v3 video statistics', () => {
    const stats = normalizeYouTubeStats(
      [{ id: 'yt_123', statistics: { viewCount: '18400', likeCount: '920', commentCount: '44' } }],
      '2026-11-24T00:00:00Z',
    );
    expect(stats[0]).toEqual({
      platform: 'youtube',
      externalId: 'yt_123',
      views: 18400,
      likes: 920,
      comments: 44,
      fetchedAt: '2026-11-24T00:00:00Z',
    });
  });
});

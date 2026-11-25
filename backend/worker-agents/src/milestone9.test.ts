import { describe, expect, test } from 'bun:test';
import { normalizeYouTubeStats } from './analytics';
import type { Storyboard } from './contracts';
import { MediaLruCache, parseByteRange } from './media-cache';
import { buildRemotionCompositionTsx, buildRemotionRenderCommand } from './remotion/runner';

const BOARD: Storyboard = {
  video_id: 'vid_m9',
  title: 'How QUIC avoids head-of-line blocking',
  hook: 'Independent streams over UDP.',
  aspect_ratios: ['16:9', '9:16'],
  scenes: [
    {
      scene_id: 'sc_1',
      index: 0,
      narration: 'Each stream carries its own sequence space.',
      visual_directive: 'Three parallel packet lanes.',
      animation_engine: 'remotion',
    },
  ],
};

describe('Remotion composition & render runner', () => {
  test('generates native 9:16 composition TSX and CLI render args', () => {
    const tsx = buildRemotionCompositionTsx(BOARD, [{ word: 'QUIC', start_ms: 0, end_ms: 4000 }], '9:16');
    expect(tsx).toContain('"width":1080');
    expect(tsx).toContain('"height":1920');
    expect(tsx).toContain('EveryAIComposition');

    const cmd = buildRemotionRenderCommand({
      entryPath: '/tmp/root.tsx',
      compositionId: 'EveryAIComposition',
      aspectRatio: '9:16',
      propsJsonPath: '/tmp/props.json',
      outputPath: '/tmp/out.mp4',
    });
    expect(cmd).toContain('1080');
    expect(cmd).toContain('1920');
  });
});

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

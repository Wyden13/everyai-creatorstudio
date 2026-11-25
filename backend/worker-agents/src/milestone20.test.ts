import { describe, expect, test } from 'bun:test';
import { createStudioMcpRouter } from '../../mcp/src/registry';
import { buildCompilePlan } from './compiler';
import { normalizeFreesoundResults } from './connectors/freesound';
import { normalizePexelsVideos } from './connectors/pexels';
import { normalizeRedditListing } from './connectors/reddit';
import { normalizeXSearch } from './connectors/x';
import { normalizeYahooMarketNews } from './connectors/yahoo-finance';
import { selectSkillsForPrompt } from './skills';
import { inferMcpToolForEndpoint } from './widget-runtime';

describe('M20: High-Signal Org Connectors Pack #1 normalizers', () => {
  test('normalizes Reddit, X, Yahoo Finance, Pexels, and Freesound payloads cleanly', () => {
    const reddit = normalizeRedditListing({
      data: { children: [{ data: { id: 'r1', subreddit: 'technology', title: 'New sodium cell', permalink: '/r/tech/r1', score: 920, num_comments: 140, created_utc: 1700000000 } }] },
    });
    expect(reddit[0]).toMatchObject({ id: 'r1', subreddit: 'technology', score: 920 });

    const xPosts = normalizeXSearch({
      data: [{ id: 'x1', text: 'QUIC benchmarks are wild', public_metrics: { like_count: 500, retweet_count: 80, reply_count: 19 } }],
    });
    expect(xPosts[0]).toMatchObject({ id: 'x1', likes: 500, retweets: 80 });

    const yf = normalizeYahooMarketNews({
      news: [{ uuid: 'y1', title: 'S&P 500 hits record high', publisher: 'Reuters', link: 'https://finance.yahoo.com/1', relatedTickers: ['SPY', 'NVDA'] }],
    });
    expect(yf[0]).toMatchObject({ uuid: 'y1', tickers: ['SPY', 'NVDA'] });

    const pexels = normalizePexelsVideos({
      videos: [{ id: 77, duration: 12, video_files: [{ link: 'https://p/720.mp4', width: 1280, height: 720, file_type: 'video/mp4' }, { link: 'https://p/1080.mp4', width: 1920, height: 1080, file_type: 'video/mp4' }] }],
    });
    expect(pexels[0]?.downloadUrl).toBe('https://p/1080.mp4');

    const audio = normalizeFreesoundResults({
      results: [{ id: 99, name: 'Ambient Synth Bed', duration: 64, license: 'CC0', previews: { 'preview-hq-mp3': 'https://fs/99.mp3' } }],
    });
    expect(audio[0]).toMatchObject({ id: 99, previewMp3Url: 'https://fs/99.mp3' });
  });

  test('compiler builds sidechain auto-ducking filter graph when musicBedPath is provided', () => {
    const plan = buildCompilePlan({
      aspectRatio: '16:9',
      baseVideoPath: '/tmp/v.mp4',
      audioPath: '/tmp/voice.mp3',
      musicBedPath: '/tmp/music.mp3',
      outputPath: '/tmp/final.mp4',
    });
    const filter = plan.args[plan.args.indexOf('-filter_complex') + 1]!;
    expect(filter).toContain('sidechaincompress');
    expect(filter).toContain('loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  });

  test('registers all 6 M20 MCP tools, endpoint bindings, and assets-audio skill routing', async () => {
    const router = createStudioMcpRouter({
      listNodes: () => [],
      listMadeTopics: () => [],
      listConnectedProviders: () => ['reddit', 'x', 'yahoo_finance', 'pexels', 'freesound'],
      editComponent: () => true,
    });
    const res = await router.handleRpc(
      { orgId: 'o1', workspaceId: 'w1', agentId: 'architect', componentId: 'c1' },
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    );
    const ids = (res.result as { tools: { id: string }[] }).tools.map((t) => t.id);
    expect(ids).toContain('mcp-social-analytics.reddit_fetch_trends');
    expect(ids).toContain('mcp-social-analytics.x_search');
    expect(ids).toContain('mcp-social-analytics.x_post_thread');
    expect(ids).toContain('mcp-social-analytics.yf_market_news');
    expect(ids).toContain('mcp-media-storage.pexels_search');
    expect(ids).toContain('mcp-media-storage.freesound_search');

    expect(inferMcpToolForEndpoint('/api/widgets/us-market-news')).toBe('mcp-social-analytics.yf_market_news');
    expect(selectSkillsForPrompt('Find Pexels B-roll and Freesound music bed').map((s) => s.name)).toContain('assets-audio');
  });
});

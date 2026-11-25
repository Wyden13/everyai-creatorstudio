import { describe, expect, test } from 'bun:test';
import { createStudioMcpRouter } from '../../mcp/src/registry';
import { inferMcpToolForEndpoint, WidgetPipelineRegistry } from './widget-runtime';

describe('M17: Executable MCP-backed widget pipelines & poller', () => {
  const router = createStudioMcpRouter({
    listNodes: () => [{ id: 'cmp_trend_01', title: 'Trend Scout', kind: 'trend' }],
    listMadeTopics: () => ['How GPS knows the time', 'Cities that banned cars'],
    listConnectedProviders: () => ['anthropic', 'youtube', 'gdrive'],
    editComponent: () => true,
  });

  test('maps widget data endpoints to canonical MCP tools declaratively', () => {
    expect(inferMcpToolForEndpoint('/api/topics/made')).toBe('mcp-studio-board.list_made_topics');
    expect(inferMcpToolForEndpoint('/api/widgets/youtube-analytics')).toBe('mcp-social-analytics.youtube_video_stats');
    expect(inferMcpToolForEndpoint('/api/widgets/gdrive-renders')).toBe('mcp-media-storage.gdrive_list_renders');
    expect(inferMcpToolForEndpoint('/api/widgets/connectors')).toBe('mcp-org-connectors.list_connected_providers');
  });

  test('executes registered widget via MCP and honors pollIntervalMs on tickDueWidgets', async () => {
    const reg = new WidgetPipelineRegistry(router);
    reg.register({
      slug: 'made-topics',
      orgId: 'org_1',
      workspaceId: 'ws_1',
      componentId: 'cmp_made_01',
      mcpToolId: 'mcp-studio-board.list_made_topics',
      pollIntervalMs: 60_000,
    });

    const t0 = 1_700_000_000_000;
    const ran1 = await reg.tickDueWidgets(t0);
    expect(ran1).toEqual(['made-topics']);
    expect(reg.get('made-topics')?.status).toBe('Live');
    expect(reg.get('made-topics')?.lastPayload).toEqual({
      topics: ['How GPS knows the time', 'Cities that banned cars'],
    });

    // Not due yet at t0 + 10s
    expect(await reg.tickDueWidgets(t0 + 10_000)).toEqual([]);
    // Due again at t0 + 60s
    expect(await reg.tickDueWidgets(t0 + 60_000)).toEqual(['made-topics']);
  });
});

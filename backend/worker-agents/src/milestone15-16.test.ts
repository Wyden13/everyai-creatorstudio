import { describe, expect, test } from 'bun:test';
import { createStudioMcpRouter } from '../../mcp/src/registry';
import { loadSkillsContext, selectSkillsForPrompt } from './skills';

describe('M15: Architect progressive-disclosure skills router', () => {
  test('loads design-system + social-connectors for YouTube analytics prompts', () => {
    const names = selectSkillsForPrompt('Make a YouTube analytics tracker with CTR and views').map((s) => s.name);
    expect(names).toContain('design-system');
    expect(names).toContain('social-connectors');
    expect(names).not.toContain('aggregator-scheduler');
  });

  test('loads design-system + aggregator-scheduler for US market news prompts', () => {
    const ctx = loadSkillsContext('Track US market news every 30m in an aggregator');
    expect(ctx.skillNames).toContain('design-system');
    expect(ctx.skillNames).toContain('aggregator-scheduler');
    expect(ctx.markdown).toContain('#0B0C0F');
    expect(ctx.markdown).toContain('/api/topics/made');
  });
});

describe('M16: In-process scoped MCP router & write-ownership isolation', () => {
  const edited: Record<string, Record<string, unknown>> = {};
  const router = createStudioMcpRouter({
    listNodes: () => [{ id: 'cmp_animation_01', title: 'Animation', kind: 'animation' }],
    listMadeTopics: () => ['How GPS knows the time', 'Cities that banned cars'],
    listConnectedProviders: () => ['anthropic', 'youtube', 'gdrive'],
    editComponent: (_ws, id, patch) => {
      if (id !== 'cmp_animation_01') return false;
      edited[id] = patch;
      return true;
    },
  });

  const architectScope = { orgId: 'org_1', workspaceId: 'ws_1', agentId: 'architect', componentId: 'cmp_arch' };
  const scoutScope = { orgId: 'org_1', workspaceId: 'ws_1', agentId: 'trend_scout', componentId: 'cmp_trend_01' };

  test('discovers all 4 domain MCP servers via tools/list', async () => {
    const res = await router.handleRpc(architectScope, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tools = (res.result as { tools: { id: string }[] }).tools.map((t) => t.id);
    expect(tools).toContain('mcp-studio-board.list_made_topics');
    expect(tools).toContain('mcp-org-connectors.list_connected_providers');
    expect(tools).toContain('mcp-social-analytics.youtube_video_stats');
    expect(tools).toContain('mcp-media-storage.gdrive_list_renders');
  });

  test('allows Architect to edit target component but blocks cross-component writes from other agents', async () => {
    const denied = await router.handleRpc(scoutScope, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'mcp-studio-board.edit_board_component',
        arguments: { target_component_id: 'cmp_animation_01', patch: { style: 'hijack' } },
      },
    });
    expect(denied.error?.code).toBe(-32003);

    const allowed = await router.handleRpc(architectScope, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'mcp-studio-board.edit_board_component',
        arguments: { target_component_id: 'cmp_animation_01', patch: { style: 'vox_editorial' } },
      },
    });
    expect(allowed.error).toBeUndefined();
    expect(edited['cmp_animation_01']).toEqual({ style: 'vox_editorial' });
  });
});

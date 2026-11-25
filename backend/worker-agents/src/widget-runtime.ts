/**
 * Executable Widget Pipeline Runtime: binds Architect-deployed widgets to real
 * in-process MCP tools, executes live data queries under each widget's isolated
 * McpScope, and runs scheduled polling ticks.
 */
import type { InProcessMcpRouter, McpScope } from '../../mcp/src/registry';

export interface WidgetPipelineDef {
  slug: string;
  orgId: string;
  workspaceId: string;
  componentId: string;
  mcpToolId: string;
  mcpArgs?: Record<string, unknown>;
  pollIntervalMs: number;
}

export interface WidgetRuntimeState {
  def: WidgetPipelineDef;
  status: 'Idle' | 'Live' | 'Failed';
  lastFetchedAtMs: number | null;
  lastPayload: Record<string, unknown> | null;
  lastError: string | null;
}

/** Declarative endpoint-to-MCP-tool routing table; add new widget bindings as rows here. */
const ENDPOINT_MCP_RULES: readonly { match: RegExp; toolId: string }[] = [
  { match: /\/topics\/made$/i, toolId: 'mcp-studio-board.list_made_topics' },
  { match: /youtube|yt-analytics/i, toolId: 'mcp-social-analytics.youtube_video_stats' },
  { match: /market|finance|yahoo|stocks/i, toolId: 'mcp-social-analytics.yf_market_news' },
  { match: /reddit/i, toolId: 'mcp-social-analytics.reddit_fetch_trends' },
  { match: /twitter|\/x-/i, toolId: 'mcp-social-analytics.x_search' },
  { match: /pexels|b-?roll|stock/i, toolId: 'mcp-media-storage.pexels_search' },
  { match: /freesound|music|sfx/i, toolId: 'mcp-media-storage.freesound_search' },
  { match: /render|drive|storage/i, toolId: 'mcp-media-storage.gdrive_list_renders' },
  { match: /connector|provider|vault/i, toolId: 'mcp-org-connectors.list_connected_providers' },
];

export function inferMcpToolForEndpoint(dataEndpoint: string): string {
  for (const rule of ENDPOINT_MCP_RULES) {
    if (rule.match.test(dataEndpoint)) return rule.toolId;
  }
  return 'mcp-studio-board.list_workspace_nodes';
}

export class WidgetPipelineRegistry {
  private readonly router: InProcessMcpRouter;
  private readonly pipelines = new Map<string, WidgetRuntimeState>();

  constructor(router: InProcessMcpRouter) {
    this.router = router;
  }

  register(def: WidgetPipelineDef): WidgetRuntimeState {
    const entry: WidgetRuntimeState = {
      def,
      status: 'Idle',
      lastFetchedAtMs: null,
      lastPayload: null,
      lastError: null,
    };
    this.pipelines.set(def.slug, entry);
    return entry;
  }

  get(slug: string): WidgetRuntimeState | undefined {
    return this.pipelines.get(slug);
  }

  async execute(slug: string, nowMs = Date.now()): Promise<WidgetRuntimeState> {
    const entry = this.pipelines.get(slug);
    if (!entry) throw new Error(`Widget pipeline "${slug}" is not registered`);

    const scope: McpScope = {
      orgId: entry.def.orgId,
      workspaceId: entry.def.workspaceId,
      agentId: 'widget_poller',
      componentId: entry.def.componentId,
    };

    const rpc = await this.router.handleRpc(scope, {
      jsonrpc: '2.0',
      id: `${slug}-${nowMs}`,
      method: 'tools/call',
      params: { name: entry.def.mcpToolId, arguments: entry.def.mcpArgs ?? {} },
    });

    entry.lastFetchedAtMs = nowMs;
    if (rpc.error) {
      entry.status = 'Failed';
      entry.lastError = rpc.error.message;
    } else {
      entry.status = 'Live';
      entry.lastError = null;
      entry.lastPayload = (rpc.result ?? {}) as Record<string, unknown>;
    }
    return entry;
  }

  /** Executes all registered widgets whose pollIntervalMs has elapsed. */
  async tickDueWidgets(nowMs = Date.now()): Promise<string[]> {
    const ran: string[] = [];
    for (const [slug, entry] of this.pipelines) {
      const due =
        entry.lastFetchedAtMs === null || nowMs - entry.lastFetchedAtMs >= entry.def.pollIntervalMs;
      if (!due) continue;
      await this.execute(slug, nowMs);
      ran.push(slug);
    }
    return ran;
  }
}

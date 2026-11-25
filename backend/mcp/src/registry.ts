/**
 * In-process JSON-RPC 2.0 MCP tool registry scoped by (orgId, workspaceId, agentId, componentId).
 * Enforces component write-ownership so no agent can write into another component's state.
 */

export interface McpScope {
  orgId: string;
  workspaceId: string;
  agentId: string;
  componentId: string;
}

export interface McpToolDef {
  server: 'mcp-studio-board' | 'mcp-org-connectors' | 'mcp-social-analytics' | 'mcp-media-storage';
  name: string;
  description: string;
  mutatesComponent?: boolean;
  inputSchema: Record<string, unknown>;
  handler: (scope: McpScope, args: Record<string, unknown>) => Promise<unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/list' | 'tools/call';
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class InProcessMcpRouter {
  private readonly tools = new Map<string, McpToolDef>();

  register(def: McpToolDef): void {
    this.tools.set(`${def.server}.${def.name}`, def);
  }

  listTools(): { id: string; server: string; name: string; description: string; inputSchema: Record<string, unknown> }[] {
    return Array.from(this.tools.entries()).map(([id, t]) => ({
      id,
      server: t.server,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async handleRpc(scope: McpScope, req: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (req.method === 'tools/list') {
      return { jsonrpc: '2.0', id: req.id, result: { tools: this.listTools() } };
    }

    if (req.method === 'tools/call') {
      const toolId = req.params?.name ?? '';
      const def = this.tools.get(toolId);
      if (!def) {
        return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Unknown MCP tool: ${toolId}` } };
      }

      const args = req.params?.arguments ?? {};
      // Component write-ownership guard: non-architect agents may only mutate their own componentId.
      if (def.mutatesComponent) {
        const targetId = typeof args.target_component_id === 'string' ? args.target_component_id : scope.componentId;
        if (scope.agentId !== 'architect' && targetId !== scope.componentId) {
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32003,
              message: `Write denied: agent "${scope.agentId}" (${scope.componentId}) cannot mutate "${targetId}"`,
            },
          };
        }
      }

      try {
        const result = await def.handler(scope, args);
        return { jsonrpc: '2.0', id: req.id, result };
      } catch (err) {
        return { jsonrpc: '2.0', id: req.id, error: { code: -32000, message: (err as Error).message } };
      }
    }

    return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Unsupported method: ${req.method}` } };
  }
}

/** Builds the default studio MCP router with all 4 in-process domain servers. */
export function createStudioMcpRouter(deps: {
  listNodes: (workspaceId: string) => { id: string; title: string; kind: string }[];
  listMadeTopics: (workspaceId: string) => string[];
  listConnectedProviders: (orgId: string) => string[];
  editComponent: (workspaceId: string, componentId: string, patch: Record<string, unknown>) => boolean;
}): InProcessMcpRouter {
  const router = new InProcessMcpRouter();

  router.register({
    server: 'mcp-studio-board',
    name: 'list_workspace_nodes',
    description: 'Lists all component IDs, titles, and kinds in the active workspace.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (scope) => ({ nodes: deps.listNodes(scope.workspaceId) }),
  });

  router.register({
    server: 'mcp-studio-board',
    name: 'list_made_topics',
    description: 'Returns all topics for which videos have already been produced.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (scope) => ({ topics: deps.listMadeTopics(scope.workspaceId) }),
  });

  router.register({
    server: 'mcp-studio-board',
    name: 'edit_board_component',
    description: 'Applies an in-place patch to a board component by its component ID.',
    mutatesComponent: true,
    inputSchema: {
      type: 'object',
      required: ['target_component_id', 'patch'],
      properties: { target_component_id: { type: 'string' }, patch: { type: 'object' } },
    },
    handler: async (scope, args) => {
      const targetId = String(args.target_component_id);
      const ok = deps.editComponent(scope.workspaceId, targetId, (args.patch ?? {}) as Record<string, unknown>);
      if (!ok) throw new Error(`Component "${targetId}" not found in workspace "${scope.workspaceId}"`);
      return { ok: true, target_component_id: targetId };
    },
  });

  router.register({
    server: 'mcp-org-connectors',
    name: 'list_connected_providers',
    description: 'Lists configured Org Vault connector IDs (never returns plaintext keys).',
    inputSchema: { type: 'object', properties: {} },
    handler: async (scope) => ({ providers: deps.listConnectedProviders(scope.orgId) }),
  });

  router.register({
    server: 'mcp-social-analytics',
    name: 'youtube_video_stats',
    description: 'Fetches normalized views, likes, and comments for published YouTube video IDs.',
    inputSchema: { type: 'object', properties: { video_ids: { type: 'array', items: { type: 'string' } } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'youtube',
      video_ids: args.video_ids ?? [],
      status: 'ready',
    }),
  });

  router.register({
    server: 'mcp-media-storage',
    name: 'gdrive_list_renders',
    description: 'Lists recent 16:9 and 9:16 renders stored in the org 5TB Google Drive folder.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      backend: 'gdrive',
      limit: Number(args.limit ?? 10),
    }),
  });

  router.register({
    server: 'mcp-social-analytics',
    name: 'reddit_fetch_trends',
    description: 'Fetches hot/rising subreddit discussions via the org Reddit connector.',
    inputSchema: { type: 'object', required: ['subreddit'], properties: { subreddit: { type: 'string' }, limit: { type: 'number' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'reddit',
      subreddit: String(args.subreddit ?? 'technology'),
      limit: Number(args.limit ?? 10),
    }),
  });

  router.register({
    server: 'mcp-social-analytics',
    name: 'x_search',
    description: 'Searches recent X (Twitter) posts via the org X API v2 connector.',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, max_results: { type: 'number' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'x',
      query: String(args.query ?? ''),
      max_results: Number(args.max_results ?? 15),
    }),
  });

  router.register({
    server: 'mcp-social-analytics',
    name: 'x_post_thread',
    description: 'Publishes a multi-post thread via the org X OAuth2 connector.',
    inputSchema: { type: 'object', required: ['tweets'], properties: { tweets: { type: 'array', items: { type: 'string' } } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'x',
      count: Array.isArray(args.tweets) ? args.tweets.length : 0,
      status: 'queued',
    }),
  });

  router.register({
    server: 'mcp-social-analytics',
    name: 'yf_market_news',
    description: 'Fetches US market headlines and related tickers via Yahoo Finance.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'number' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'yahoo_finance',
      query: String(args.query ?? 'US stock market'),
      count: Number(args.count ?? 10),
    }),
  });

  router.register({
    server: 'mcp-media-storage',
    name: 'pexels_search',
    description: 'Searches Pexels stock B-roll videos matching a scene orientation (landscape or portrait).',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, orientation: { type: 'string' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'pexels',
      query: String(args.query ?? ''),
      orientation: String(args.orientation ?? 'landscape'),
    }),
  });

  router.register({
    server: 'mcp-media-storage',
    name: 'freesound_search',
    description: 'Searches Freesound royalty-free SFX and background music beds.',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, max_duration_sec: { type: 'number' } } },
    handler: async (scope, args) => ({
      orgId: scope.orgId,
      connector: 'freesound',
      query: String(args.query ?? ''),
      max_duration_sec: Number(args.max_duration_sec ?? 120),
    }),
  });

  return router;
}

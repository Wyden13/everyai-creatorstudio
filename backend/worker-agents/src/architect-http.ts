/**
 * Live HTTP endpoint for interactive Architect chats (POST /api/architect/turn).
 * Accepts multimodal image/file attachments + MCQ answers and invokes runArchitectTurn().
 */
import { z } from 'zod';
import { createStudioMcpRouter } from '../../mcp/src/registry';
import { runArchitectTurn } from './agents/architect';
import { inferMcpToolForEndpoint, WidgetPipelineRegistry } from './widget-runtime';

export const ArchitectTurnRequestSchema = z.object({
  prompt: z.string().min(1),
  answers: z.record(z.array(z.string())).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        mimeType: z.string().min(1),
        data: z.string().min(1),
        kind: z.enum(['image', 'file']),
      }),
    )
    .max(6)
    .optional(),
  preferTsx: z.boolean().optional(),
  providerId: z.enum(['anthropic', 'openai', 'google_gemini']).default('anthropic'),
  modelId: z.string().default('claude-haiku-4-5'),
});
export type ArchitectTurnRequest = z.infer<typeof ArchitectTurnRequestSchema>;

const ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'tauri://localhost']);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:5173';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
  };
}

function resolveApiKey(providerId: 'anthropic' | 'openai' | 'google_gemini'): string {
  const map = {
    anthropic: process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_TEST_API_KEY ?? '',
    openai: process.env.OPENAI_API_KEY ?? '',
    google_gemini: process.env.GEMINI_API_KEY ?? '',
  };
  return map[providerId];
}

const RegisterWidgetSchema = z.object({
  slug: z.string().min(1),
  orgId: z.string().default('org_default'),
  workspaceId: z.string().default('explainers'),
  componentId: z.string().min(1),
  dataEndpoint: z.string().min(1),
  pollIntervalMs: z.number().int().min(1000).default(30000),
  mcpToolId: z.string().optional(),
  mcpArgs: z.record(z.unknown()).optional(),
});

export function startArchitectServer(port = Number(process.env.ARCHITECT_PORT ?? 8081)) {
  const mcpRouter = createStudioMcpRouter({
    listNodes: () => [
      { id: 'cmp_trend_01', title: 'Trend Scout', kind: 'trend' },
      { id: 'cmp_screenplay_01', title: 'Screenplay', kind: 'screenplay' },
      { id: 'cmp_animation_01', title: 'Animation', kind: 'animation' },
    ],
    listMadeTopics: () => ['How GPS knows the time', 'Why ocean shipping got slow', 'Cities that banned cars'],
    listConnectedProviders: () => ['anthropic', 'youtube', 'gdrive'],
    editComponent: () => true,
  });
  const widgets = new WidgetPipelineRegistry(mcpRouter);

  return Bun.serve({
    port,
    async fetch(req) {
      const origin = req.headers.get('origin');
      const headers = corsHeaders(origin);
      const url = new URL(req.url);

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }

      if (req.method === 'GET' && url.pathname === '/healthz') {
        return Response.json({ ok: true, service: 'architect-http' }, { headers });
      }

      if (req.method === 'POST' && url.pathname === '/api/widgets/register') {
        const parsed = RegisterWidgetSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 422, headers });
        const d = parsed.data;
        widgets.register({
          slug: d.slug,
          orgId: d.orgId,
          workspaceId: d.workspaceId,
          componentId: d.componentId,
          mcpToolId: d.mcpToolId ?? inferMcpToolForEndpoint(d.dataEndpoint),
          mcpArgs: d.mcpArgs,
          pollIntervalMs: d.pollIntervalMs,
        });
        const state = await widgets.execute(d.slug);
        return Response.json({ slug: d.slug, status: state.status, data: state.lastPayload }, { status: 201, headers });
      }

      const dataMatch = /^\/api\/widgets\/([^/]+)\/(data|refresh)$/.exec(url.pathname);
      if (dataMatch) {
        const [, slug, action] = dataMatch;
        if (!widgets.get(slug!)) {
          widgets.register({
            slug: slug!,
            orgId: 'org_default',
            workspaceId: 'explainers',
            componentId: `cmp_widget_${slug}`,
            mcpToolId: inferMcpToolForEndpoint(`/api/widgets/${slug}`),
            pollIntervalMs: 30000,
          });
        }
        const state = action === 'refresh' || !widgets.get(slug!)?.lastPayload
          ? await widgets.execute(slug!)
          : widgets.get(slug!)!;
        return Response.json({ slug, status: state.status, data: state.lastPayload, error: state.lastError }, { headers });
      }

      if (req.method === 'POST' && url.pathname === '/api/architect/turn') {
        let rawBody: unknown;
        try {
          rawBody = await req.json();
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers });
        }

        const parsed = ArchitectTurnRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 422, headers });
        }

        const apiKey = resolveApiKey(parsed.data.providerId);
        if (!apiKey) {
          return Response.json(
            { error: `Missing server API key for provider "${parsed.data.providerId}"` },
            { status: 503, headers },
          );
        }

        try {
          const turn = await runArchitectTurn({
            prompt: parsed.data.prompt,
            answers: parsed.data.answers,
            attachments: parsed.data.attachments,
            preferTsx: parsed.data.preferTsx,
            providerId: parsed.data.providerId,
            modelId: parsed.data.modelId,
            apiKey,
          });
          return Response.json(turn, { headers });
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 502, headers });
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers });
    },
  });
}

if (import.meta.main) {
  const srv = startArchitectServer();
  console.log(`[worker-agents] Architect HTTP listening on http://localhost:${srv.port}`);
}

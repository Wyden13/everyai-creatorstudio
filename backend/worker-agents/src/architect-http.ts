/**
 * Live HTTP endpoint for interactive Architect chats (POST /api/architect/turn).
 * Accepts multimodal image/file attachments + MCQ answers and invokes runArchitectTurn().
 */
import { z } from 'zod';
import { runArchitectTurn } from './agents/architect';

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
    'access-control-allow-methods': 'POST, OPTIONS',
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

export function startArchitectServer(port = Number(process.env.ARCHITECT_PORT ?? 8081)) {
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

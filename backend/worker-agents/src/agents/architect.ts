/**
 * Architect Agent: turns natural language prompts into validated board widgets
 * (Tier 1 Declarative JSON by default, or Tier 2 Admin-gated Sandboxed TSX)
 * and optional server-side agent worker definitions.
 */
import { z } from 'zod';
import { validateModelForNode } from '../contracts';
import { callLlmJson } from '../providers';

export const ArchetypeSchema = z.enum(['agent', 'status', 'tracker', 'aggregator']);

export const DeclarativeBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'metric_card',
    'progress_bar',
    'table',
    'trigger_button',
    'status_strip',
    'list_aggregator',
  ]),
  label: z.string().min(1),
  value_path: z.string().optional(),
  action_endpoint: z.string().regex(/^\/api\//).optional(),
});

export const DeclarativeWidgetSpecSchema = z.object({
  spec_type: z.literal('declarative_json'),
  archetype: ArchetypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  data_endpoint: z.string().regex(/^\/api\//),
  poll_interval_ms: z.number().int().min(1000).default(15000),
  blocks: z.array(DeclarativeBlockSchema).min(1),
});

export const SandboxedTsxWidgetSpecSchema = z.object({
  spec_type: z.literal('sandboxed_tsx'),
  archetype: ArchetypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  tsx_source: z.string().min(20),
  data_endpoint: z.string().regex(/^\/api\//).optional(),
  /** Security invariant: Architect-generated TSX ALWAYS starts pending_admin. */
  approval_status: z.literal('pending_admin'),
});

export const DynamicWidgetSpecSchema = z.discriminatedUnion('spec_type', [
  DeclarativeWidgetSpecSchema,
  SandboxedTsxWidgetSpecSchema,
]);
export type DynamicWidgetSpec = z.infer<typeof DynamicWidgetSpecSchema>;

export const AgentWorkerToolSchema = z.object({
  node_kind: z.enum([
    'trend_scout',
    'screenplay',
    'voiceover',
    'animation_remotion',
    'animation_manim',
    'architect',
    'publisher',
  ]),
  provider_id: z.string().min(1),
  model_id: z.string().min(1),
  system_prompt: z.string().min(1),
  upstream_node_id: z.string().nullable().optional(),
});

export const ArchitectPlanSchema = z.object({
  summary: z.string().min(1),
  wire_from_node_id: z.string().nullable().optional(),
  create_board_widget: DynamicWidgetSpecSchema,
  create_agent_worker: AgentWorkerToolSchema.nullable().optional(),
});
export type ArchitectPlan = z.infer<typeof ArchitectPlanSchema>;

/** Validates both schema compliance AND capability-typed model rules on any worker tool call. */
export function validateArchitectPlan(
  raw: unknown,
): { ok: true; plan: ArchitectPlan } | { ok: false; reason: string } {
  const parsed = ArchitectPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }
  const worker = parsed.data.create_agent_worker;
  if (worker) {
    const capCheck = validateModelForNode(worker.node_kind, worker.provider_id, worker.model_id);
    if (!capCheck.ok) {
      return { ok: false, reason: `create_agent_worker capability error: ${capCheck.reason}` };
    }
  }
  return { ok: true, plan: parsed.data };
}

export async function runArchitectAgent(opts: {
  prompt: string;
  preferTsx?: boolean;
  providerId: string;
  modelId: string;
  apiKey: string;
}): Promise<ArchitectPlan> {
  const mode = opts.preferTsx ? 'sandboxed_tsx' : 'declarative_json';
  const raw = await callLlmJson({
    nodeKind: 'architect',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    systemPrompt:
      'You are the EveryAI CreatorStudio Architect Agent. Return ONLY valid JSON (no markdown fences) matching ArchitectPlan. Pick the best component archetype: "tracker" (stats/analytics/costs), "aggregator" (collects news/items into an actionable list), "status" (health checks), or "agent" (runs and produces output).',
    userPrompt: JSON.stringify({
      user_request: opts.prompt,
      required_spec_type: mode,
      required_shape: {
        summary: 'Short explanation of what was created and which archetype was chosen',
        wire_from_node_id: null,
        create_board_widget:
          mode === 'declarative_json'
            ? {
                spec_type: 'declarative_json',
                archetype: 'tracker | aggregator | status | agent',
                title: 'string',
                subtitle: 'string',
                data_endpoint: '/api/widgets/<slug>',
                poll_interval_ms: 30000,
                blocks: [
                  {
                    id: 'b1',
                    kind: 'metric_card | progress_bar | table | trigger_button | status_strip | list_aggregator',
                    label: 'string',
                    value_path: 'dot.path',
                  },
                ],
              }
            : {
                spec_type: 'sandboxed_tsx',
                archetype: 'tracker | aggregator | status | agent',
                title: 'string',
                subtitle: 'string',
                tsx_source: 'export default function Widget({ data }) { return <div>...</div>; }',
                data_endpoint: '/api/widgets/<slug>',
                approval_status: 'pending_admin',
              },
        create_agent_worker: null,
      },
    }),
  });

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const checked = validateArchitectPlan(JSON.parse(cleaned));
  if (!checked.ok) {
    throw new Error(`Architect output violated contract: ${checked.reason}`);
  }
  return checked.plan;
}

/**
 * Architect Agent: turns natural language prompts into validated board widgets
 * (Tier 1 Declarative JSON by default, or Tier 2 Admin-gated Sandboxed TSX)
 * and optional server-side agent worker definitions.
 */
import { z } from 'zod';
import { validateModelForNode } from '../contracts';
import { callLlmJson, type LlmAttachment } from '../providers';

export const McqOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
});

export const McqQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  multi_select: z.boolean().default(false),
  options: z.array(McqOptionSchema).min(2),
});
export type McqQuestion = z.infer<typeof McqQuestionSchema>;

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

export const ArchitectEditSchema = z.object({
  target_component_id: z.string().min(1),
  summary: z.string().min(1),
  patch: z.object({
    title: z.string().min(1).optional(),
    subtitle: z.string().optional(),
    system_prompt: z.string().min(1).optional(),
    style_preset: z.string().min(1).optional(),
    provider_id: z.string().min(1).optional(),
    model_id: z.string().min(1).optional(),
    node_kind: AgentWorkerToolSchema.shape.node_kind.optional(),
    schedule_interval: z.enum(['off', '15m', '30m', '2h', '6h', 'daily']).optional(),
    blocks: z.array(DeclarativeBlockSchema).min(1).optional(),
  }),
});
export type ArchitectEdit = z.infer<typeof ArchitectEditSchema>;

/** Explicit discriminated union for interactive Architect turns: clarify via MCQ, create plan, OR edit existing component. */
export const ArchitectTurnSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('clarify'),
    summary: z.string().min(1),
    questions: z.array(McqQuestionSchema).min(1).max(5),
  }),
  z.object({
    kind: z.literal('plan'),
    plan: ArchitectPlanSchema,
  }),
  z.object({
    kind: z.literal('edit'),
    edit: ArchitectEditSchema,
  }),
]);
export type ArchitectTurn = z.infer<typeof ArchitectTurnSchema>;

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

export function validateArchitectTurn(
  raw: unknown,
): { ok: true; turn: ArchitectTurn } | { ok: false; reason: string } {
  const parsed = ArchitectTurnSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.message };
  if (parsed.data.kind === 'plan') {
    const planCheck = validateArchitectPlan(parsed.data.plan);
    if (!planCheck.ok) return planCheck;
  }
  if (parsed.data.kind === 'edit') {
    const { node_kind, provider_id, model_id } = parsed.data.edit.patch;
    if (provider_id && model_id && node_kind) {
      const capCheck = validateModelForNode(node_kind, provider_id, model_id);
      if (!capCheck.ok) return { ok: false, reason: `edit_board_component capability error: ${capCheck.reason}` };
    }
  }
  return { ok: true, turn: parsed.data };
}

/**
 * Interactive Architect turn: accepts prompt, optional prior MCQ answers, and attached
 * pictures/files. Returns either clarifying MCQ questions OR a validated build plan.
 */
export async function runArchitectTurn(opts: {
  prompt: string;
  answers?: Record<string, string[]>;
  attachments?: readonly LlmAttachment[];
  preferTsx?: boolean;
  providerId: string;
  modelId: string;
  apiKey: string;
}): Promise<ArchitectTurn> {
  const hasAnswers = opts.answers && Object.keys(opts.answers).length > 0;
  const mode = opts.preferTsx ? 'sandboxed_tsx' : 'declarative_json';

  const raw = await callLlmJson({
    nodeKind: 'architect',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    attachments: opts.attachments,
    systemPrompt:
      'You are the EveryAI CreatorStudio Architect Agent. Return ONLY valid JSON (no markdown fences). If the request has open design choices (data source, refresh rate, metrics/columns, archetype, or layout) and no user answers have been provided yet, return {"kind":"clarify","summary":"...","questions":[...]} with 2-4 crisp MCQ/multi-select questions. Once answers are provided (or the spec is fully explicit), return {"kind":"plan","plan":{...}}.',
    userPrompt: JSON.stringify({
      user_request: opts.prompt,
      user_mcq_answers: hasAnswers ? opts.answers : undefined,
      attached_files: (opts.attachments ?? []).map((a) => ({ name: a.name, kind: a.kind, mimeType: a.mimeType })),
      required_spec_type_when_planning: mode,
      clarify_shape: {
        kind: 'clarify',
        summary: 'Brief note on what you want to confirm before building',
        questions: [
          {
            id: 'q1',
            question: 'string',
            multi_select: false,
            options: [
              { id: 'opt1', label: 'string', hint: 'optional short hint' },
              { id: 'opt2', label: 'string' },
            ],
          },
        ],
      },
      plan_shape: {
        kind: 'plan',
        plan: {
          summary: 'string',
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
                  blocks: [{ id: 'b1', kind: 'metric_card', label: 'string', value_path: 'dot.path' }],
                }
              : {
                  spec_type: 'sandboxed_tsx',
                  archetype: 'tracker | aggregator | status | agent',
                  title: 'string',
                  tsx_source: 'export default function Widget() { return <div />; }',
                  approval_status: 'pending_admin',
                },
          create_agent_worker: null,
        },
      },
    }),
  });

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const checked = validateArchitectTurn(JSON.parse(cleaned));
  if (!checked.ok) {
    throw new Error(`Architect turn violated contract: ${checked.reason}`);
  }
  return checked.turn;
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

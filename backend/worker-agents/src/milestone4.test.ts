import { describe, expect, test } from 'bun:test';
import { validateArchitectPlan, validateArchitectTurn } from './agents/architect';

describe('Architect Agent widget & worker tool validation', () => {
  test('accepts Tier 1 declarative JSON tracker widget', () => {
    const res = validateArchitectPlan({
      summary: 'Created a YouTube Analytics tracker widget.',
      wire_from_node_id: 'publisher',
      create_board_widget: {
        spec_type: 'declarative_json',
        archetype: 'tracker',
        title: 'YouTube Analytics',
        subtitle: '28-day channel metrics',
        data_endpoint: '/api/widgets/yt-analytics',
        poll_interval_ms: 60000,
        blocks: [
          { id: 'views', kind: 'metric_card', label: 'Views (28d)', value_path: 'views_28d' },
          { id: 'ctr', kind: 'progress_bar', label: 'Avg CTR', value_path: 'ctr_pct' },
        ],
      },
      create_agent_worker: null,
    });
    expect(res.ok).toBe(true);
  });

  test('enforces pending_admin approval_status on Tier 2 sandboxed TSX widgets', () => {
    const validTsx = validateArchitectPlan({
      summary: 'Created custom TSX widget awaiting admin approval.',
      create_board_widget: {
        spec_type: 'sandboxed_tsx',
        archetype: 'tracker',
        title: 'Custom Revenue Sparkline',
        tsx_source: 'export default function Widget({ data }: any) { return <div>{data.total}</div>; }',
        data_endpoint: '/api/widgets/revenue',
        approval_status: 'pending_admin',
      },
    });
    expect(validTsx.ok).toBe(true);

    const bypassAttempt = validateArchitectPlan({
      summary: 'Attempted to skip admin gate.',
      create_board_widget: {
        spec_type: 'sandboxed_tsx',
        archetype: 'tracker',
        title: 'Bypass',
        tsx_source: 'export default function Widget() { return <div />; }',
        approval_status: 'approved',
      },
    });
    expect(bypassAttempt.ok).toBe(false);
  });

  test('rejects capability-mismatched create_agent_worker tool calls', () => {
    const badWorker = validateArchitectPlan({
      summary: 'Invalid TTS model assigned to animation.',
      create_board_widget: {
        spec_type: 'declarative_json',
        archetype: 'agent',
        title: 'Bad Agent',
        data_endpoint: '/api/widgets/bad',
        blocks: [{ id: 'b1', kind: 'status_strip', label: 'Health' }],
      },
      create_agent_worker: {
        node_kind: 'animation_remotion',
        provider_id: 'elevenlabs',
        model_id: 'eleven_multilingual_v2',
        system_prompt: 'Write Remotion code',
      },
    });
    expect(badWorker.ok).toBe(false);
  });

  test('validates interactive clarify MCQ turn and rejects empty options', () => {
    const okTurn = validateArchitectTurn({
      kind: 'clarify',
      summary: 'Confirm data source and refresh interval.',
      questions: [
        {
          id: 'q1',
          question: 'Which sources should feed this tracker?',
          multi_select: true,
          options: [
            { id: 'serp', label: 'SerpApi' },
            { id: 'tavily', label: 'Tavily' },
          ],
        },
      ],
    });
    expect(okTurn.ok).toBe(true);

    const badTurn = validateArchitectTurn({
      kind: 'clarify',
      summary: 'Missing second option',
      questions: [{ id: 'q1', question: 'Pick one', multi_select: false, options: [{ id: 'only', label: 'Only' }] }],
    });
    expect(badTurn.ok).toBe(false);
  });
});

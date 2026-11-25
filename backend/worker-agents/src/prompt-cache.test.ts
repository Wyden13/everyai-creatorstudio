import { describe, expect, test } from 'bun:test';
import { buildLlmRequestPayload, callLlmJsonWithUsage, computeLlmCost } from './providers';

describe('Prompt caching payload builder & cost telemetry', () => {
  test('Anthropic marks systemPrompt and cachedContext with ephemeral cache_control', () => {
    const payload = buildLlmRequestPayload({
      nodeKind: 'screenplay',
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      systemPrompt: 'System rules',
      cachedContext: 'Show Bible content',
      userPrompt: 'Draft Chapter 1',
    });

    const system = payload.system as Array<{ type: string; text: string; cache_control?: { type: string } }>;
    expect(system).toHaveLength(2);
    expect(system[0]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(system[1]?.text).toBe('Show Bible content');
    expect(system[1]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  test('OpenAI places cachedContext in stable system prefix and sets prompt_cache_key', () => {
    const payload = buildLlmRequestPayload({
      nodeKind: 'architect',
      providerId: 'openai',
      modelId: 'gpt-4o',
      systemPrompt: 'Architect rules',
      cachedContext: 'Skills markdown',
      cacheKey: 'architect:design-system',
      userPrompt: 'Build tracker',
    });

    expect(payload.prompt_cache_key).toBe('architect:design-system');
    const msgs = payload.messages as Array<{ role: string; content: string }>;
    expect(msgs[0]?.content).toContain('Architect rules');
    expect(msgs[0]?.content).toContain('Skills markdown');
  });

  test('Gemini places cachedContext in systemInstruction parts', () => {
    const payload = buildLlmRequestPayload({
      nodeKind: 'screenplay',
      providerId: 'google_gemini',
      modelId: 'gemini-2.5-pro',
      systemPrompt: 'Screenplay rules',
      cachedContext: 'Show Bible',
      userPrompt: 'Draft Chapter 2',
    });

    const sys = payload.systemInstruction as { parts: Array<{ text: string }> };
    expect(sys.parts).toHaveLength(2);
    expect(sys.parts[1]?.text).toBe('Show Bible');
  });

  test('computeLlmCost accurately computes 90% Anthropic cache read savings', () => {
    const usage = computeLlmCost('claude-sonnet-4-5', {
      inputTokens: 200,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 10_000,
    });
    // Full input cost for 10k tokens = $0.03; 90% saved = $0.027.
    expect(usage.savedUsd).toBeCloseTo(0.027, 5);
    expect(usage.estimatedUsd).toBeGreaterThan(0);
    expect(usage.estimatedUsd).toBeLessThan(0.02);
  });

  test(
    'Live Anthropic prompt cache hit: 2nd turn reads >= 1024 cached tokens',
    async () => {
      if (process.env.RUN_LIVE_CACHE_TEST !== '1') return;
      const apiKey = process.env.ANTHROPIC_TEST_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_TEST_API_KEY missing in environment');

      // Anthropic minimum cacheable prefix for Claude Sonnet 4.5 is 1,024 tokens (~4,500+ chars).
      const sharedShowBible = Array.from({ length: 45 }, (_, i) =>
        `Chapter ${i + 1} Beat: Analyze how sodium-ion grid storage scales with manufacturing learning curves, raw material supply chains, thermal runaway margins, and utility dispatch economics in section ${i + 1}.`,
      ).join('\n');

      const turn1 = await callLlmJsonWithUsage({
        nodeKind: 'screenplay',
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-5',
        apiKey,
        maxTokens: 128,
        systemPrompt: 'You are a concise video essay assistant. Return ONLY valid JSON: {"chapter": number, "hook": string}.',
        cachedContext: sharedShowBible,
        userPrompt: 'Return JSON for Chapter 1 hook in under 10 words.',
      });

      const turn2 = await callLlmJsonWithUsage({
        nodeKind: 'screenplay',
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-5',
        apiKey,
        maxTokens: 128,
        systemPrompt: 'You are a concise video essay assistant. Return ONLY valid JSON: {"chapter": number, "hook": string}.',
        cachedContext: sharedShowBible,
        userPrompt: 'Return JSON for Chapter 2 hook in under 10 words.',
      });

      console.log('Live Anthropic Cache Telemetry:', { turn1: turn1.usage, turn2: turn2.usage });
      expect(turn1.usage.cacheCreationTokens + turn1.usage.cacheReadTokens).toBeGreaterThanOrEqual(1024);
      expect(turn2.usage.cacheReadTokens).toBeGreaterThanOrEqual(1024);
      expect(turn2.usage.savedUsd).toBeGreaterThan(0);
    },
    30_000,
  );
});

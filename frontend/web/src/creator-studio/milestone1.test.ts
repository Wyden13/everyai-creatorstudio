import { describe, expect, test } from 'bun:test';
import { eligibleModelsForKind } from './capabilities';
import { transitionSync, type SyncEvent, type SyncState } from './sync';

describe('capability-filtered model selector', () => {
  const cases: { kind: Parameters<typeof eligibleModelsForKind>[0]; mustInclude: string[]; mustExclude: string[] }[] = [
    {
      kind: 'voice',
      mustInclude: ['elevenlabs:eleven_multilingual_v2', 'google_tts:google-chirp3-hd', 'openai:gpt-4o-mini-tts'],
      mustExclude: ['anthropic:claude-sonnet-4-5', 'openai:gpt-4o', 'google_gemini:gemini-2.5-pro'],
    },
    {
      kind: 'screenplay',
      mustInclude: ['anthropic:claude-sonnet-4-5', 'openai:gpt-4o', 'google_gemini:gemini-2.5-pro'],
      mustExclude: ['elevenlabs:eleven_multilingual_v2', 'google_tts:google-chirp3-hd', 'openai:gpt-4o-mini-tts'],
    },
    {
      kind: 'animation',
      mustInclude: ['anthropic:claude-sonnet-4-5', 'openai:o3', 'google_gemini:gemini-2.5-pro'],
      mustExclude: ['elevenlabs:eleven_multilingual_v2', 'serpapi:google-trends-news'],
    },
    {
      kind: 'trend',
      mustInclude: ['serpapi:google-trends-news', 'exa:exa-neural', 'tavily:tavily-search', 'google_gemini:gemini-2.5-flash'],
      mustExclude: ['elevenlabs:eleven_multilingual_v2', 'youtube:youtube-v3'],
    },
    {
      kind: 'publisher',
      mustInclude: ['youtube:youtube-v3', 'ayrshare:ayrshare-social', 'anthropic:claude-haiku-4-5'],
      mustExclude: ['elevenlabs:eleven_multilingual_v2', 'serpapi:google-trends-news'],
    },
  ];

  for (const c of cases) {
    test(`node kind "${c.kind}" exposes only capability-eligible models`, () => {
      const ids = eligibleModelsForKind(c.kind).map((m) => m.id);
      for (const expected of c.mustInclude) expect(ids).toContain(expected);
      for (const forbidden of c.mustExclude) expect(ids).not.toContain(forbidden);
    });
  }
});

describe('workspace sync state machine', () => {
  const rows: [SyncState, SyncEvent, SyncState][] = [
    ['Disconnected', 'connect', 'Connecting'],
    ['Disconnected', 'open', 'Disconnected'],
    ['Connecting', 'open', 'Synced'],
    ['Connecting', 'error', 'Reconnecting'],
    ['Connecting', 'close', 'Reconnecting'],
    ['Connecting', 'disconnect', 'Disconnected'],
    ['Synced', 'close', 'Reconnecting'],
    ['Synced', 'error', 'Reconnecting'],
    ['Synced', 'disconnect', 'Disconnected'],
    ['Reconnecting', 'connect', 'Connecting'],
    ['Reconnecting', 'open', 'Synced'],
    ['Reconnecting', 'disconnect', 'Disconnected'],
  ];

  for (const [from, event, expected] of rows) {
    test(`${from} × ${event} → ${expected}`, () => {
      expect(transitionSync(from, event)).toBe(expected);
    });
  }
});

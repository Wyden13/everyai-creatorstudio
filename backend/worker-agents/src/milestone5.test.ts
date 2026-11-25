import { describe, expect, test } from 'bun:test';
import { transitionPublish, type PublishApprovalMode, type PublishEvent, type PublishState } from './agents/publisher';
import { checkSpendGuardrail } from './guardrails';
import { resolveStorageConfig, resolveStorageConfigFromOrgVault } from './storage';

describe('Publisher state machine (gate | scheduled | auto)', () => {
  const rows: [PublishState, PublishEvent, PublishApprovalMode, PublishState | null][] = [
    ['Drafting', 'metadata_ready', 'gate', 'NeedsApproval'],
    ['Drafting', 'metadata_ready', 'scheduled', 'Scheduled'],
    ['Drafting', 'metadata_ready', 'auto', 'Publishing'],
    ['NeedsApproval', 'approve', 'gate', 'Publishing'],
    ['NeedsApproval', 'schedule', 'gate', 'Scheduled'],
    ['NeedsApproval', 'published', 'gate', null],
    ['Scheduled', 'due', 'scheduled', 'Publishing'],
    ['Publishing', 'published', 'auto', 'Published'],
    ['Publishing', 'fail', 'auto', 'Failed'],
    ['Failed', 'retry', 'gate', 'Publishing'],
    ['Published', 'retry', 'gate', null],
  ];

  for (const [state, event, mode, expected] of rows) {
    test(`${state} × ${event} (${mode}) → ${expected ?? 'REJECT'}`, () => {
      const res = transitionPublish(state, event, mode);
      if (expected === null) {
        expect(res.ok).toBe(false);
      } else {
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.next).toBe(expected);
      }
    });
  }
});

describe('Storage config & spend guardrails', () => {
  test('validates Google Drive OAuth2 refresh-token config and fails loudly when incomplete', () => {
    const ok = resolveStorageConfig({
      STORAGE_BACKEND: 'gdrive',
      GDRIVE_FOLDER_ID: 'folder_123',
      GDRIVE_CLIENT_ID: 'cid',
      GDRIVE_CLIENT_SECRET: 'csec',
      GDRIVE_REFRESH_TOKEN: 'rtok',
    });
    expect(ok.backend).toBe('gdrive');
    expect(() => resolveStorageConfig({ STORAGE_BACKEND: 'gdrive' })).toThrow();

    const fromVault = resolveStorageConfigFromOrgVault({
      GDRIVE_OAUTH_BUNDLE: JSON.stringify({
        folderId: 'f1',
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'rtok',
      }),
    });
    expect(fromVault.backend).toBe('gdrive');
    expect(() => resolveStorageConfigFromOrgVault({})).toThrow();
  });

  test('enforces daily USD, TTS, and render caps', () => {
    const limits = { maxUsdPerDay: 25, maxTtsCharsPerDay: 50_000, maxRendersPerDay: 20 };
    expect(checkSpendGuardrail({ usdSpentToday: 10, ttsCharsToday: 5_000, rendersToday: 2 }, limits).ok).toBe(true);
    expect(checkSpendGuardrail({ usdSpentToday: 25, ttsCharsToday: 5_000, rendersToday: 2 }, limits).ok).toBe(false);
    expect(checkSpendGuardrail({ usdSpentToday: 10, ttsCharsToday: 50_000, rendersToday: 2 }, limits).ok).toBe(false);
    expect(checkSpendGuardrail({ usdSpentToday: 10, ttsCharsToday: 5_000, rendersToday: 20 }, limits).ok).toBe(false);
  });
});

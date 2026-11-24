import { describe, expect, test } from 'bun:test';
import { canPerform, type Permission, type SessionState } from './api';

describe('frontend RBAC permission table', () => {
  const admin: SessionState = { status: 'Authenticated', email: 'admin@everyai.studio', displayName: 'Admin', role: 'org:admin' };
  const manager: SessionState = { status: 'Authenticated', email: 'wendy@everyai.studio', displayName: 'Wendy', role: 'org:manager' };
  const anon: SessionState = { status: 'Anonymous' };
  const demo: SessionState = { status: 'OfflineDemo', role: 'org:admin' };

  const cases: [string, SessionState, Permission, boolean][] = [
    ['admin can write vault', admin, 'vault:write', true],
    ['admin can approve custom TSX', admin, 'widget:approve_tsx', true],
    ['admin can run pipeline', admin, 'pipeline:run', true],
    ['manager can edit board', manager, 'board:edit', true],
    ['manager can approve pipeline', manager, 'pipeline:approve', true],
    ['manager CANNOT write vault', manager, 'vault:write', false],
    ['manager CANNOT approve custom TSX', manager, 'widget:approve_tsx', false],
    ['anonymous CANNOT edit board', anon, 'board:edit', false],
    ['offline demo retains admin access locally', demo, 'vault:write', true],
  ];

  for (const [name, session, perm, expected] of cases) {
    test(name, () => {
      expect(canPerform(session, perm)).toBe(expected);
    });
  }
});

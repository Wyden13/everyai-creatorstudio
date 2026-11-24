/**
 * Typed HTTP boundary for backend/core (Anole 0.6.1) + explicit SessionState & RBAC table.
 * All browser requests use credentials: 'include' for XChaCha20-Poly1305 sealed cookie sessions.
 */
import type { ApprovalMode } from './store';

export type OrgRole = 'org:admin' | 'org:manager';

export type SessionState =
  | { status: 'Anonymous' }
  | { status: 'Authenticated'; email: string; displayName: string; role: OrgRole }
  | { status: 'OfflineDemo'; role: 'org:admin' };

export type Permission =
  | 'board:edit'
  | 'pipeline:run'
  | 'pipeline:approve'
  | 'architect:prompt'
  | 'vault:read'
  | 'vault:write'
  | 'org:invite'
  | 'widget:approve_tsx';

/** Mirrors backend/core/src/main.zig rbac_policy. Add new grants as rows here. */
const ROLE_GRANTS: Record<OrgRole, readonly Permission[]> = {
  'org:manager': ['board:edit', 'pipeline:run', 'pipeline:approve', 'architect:prompt'],
  'org:admin': [
    'board:edit',
    'pipeline:run',
    'pipeline:approve',
    'architect:prompt',
    'vault:read',
    'vault:write',
    'org:invite',
    'widget:approve_tsx',
  ],
};

export function canPerform(session: SessionState, perm: Permission): boolean {
  if (session.status === 'Anonymous') return false;
  return ROLE_GRANTS[session.role].includes(perm);
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface VaultSecretView {
  key_name: string;
  provider_id: string;
  hint: string;
}

export async function fetchMe(): Promise<SessionState> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
    if (res.status === 401) return { status: 'Anonymous' };
    if (!res.ok) return { status: 'OfflineDemo', role: 'org:admin' };
    const data = (await res.json()) as { email: string; display_name: string; role: OrgRole };
    return { status: 'Authenticated', email: data.email, displayName: data.display_name, role: data.role };
  } catch {
    return { status: 'OfflineDemo', role: 'org:admin' };
  }
}

export async function loginOrg(email: string, password: string): Promise<SessionState> {
  const data = await apiJson<{ email: string; display_name: string; role: OrgRole }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { status: 'Authenticated', email: data.email, displayName: data.display_name, role: data.role };
}

export async function logoutOrg(): Promise<void> {
  await apiJson<void>('/api/auth/logout', { method: 'POST' });
}

export async function listVaultSecrets(): Promise<VaultSecretView[]> {
  const data = await apiJson<{ secrets: VaultSecretView[] }>('/api/vault');
  return data.secrets;
}

export async function saveVaultSecret(keyName: string, providerId: string, plaintext: string): Promise<VaultSecretView> {
  return apiJson<VaultSecretView>(`/api/vault/${encodeURIComponent(keyName)}`, {
    method: 'PUT',
    body: JSON.stringify({ provider_id: providerId, plaintext }),
  });
}

export async function deleteVaultSecret(keyName: string): Promise<void> {
  await apiJson<void>(`/api/vault/${encodeURIComponent(keyName)}`, { method: 'DELETE' });
}

export async function createBackendRun(workspaceId: string, topic: string, approvalMode: ApprovalMode): Promise<{ run_id: string }> {
  return apiJson<{ run_id: string }>('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, topic, approval_mode: approvalMode }),
  });
}

export async function approveBackendRun(runId: string): Promise<void> {
  await apiJson<{ run_id: string; state: string }>(`/api/runs/${encodeURIComponent(runId)}/approve`, {
    method: 'POST',
  });
}

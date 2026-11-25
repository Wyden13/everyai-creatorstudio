/**
 * Pluggable media storage adapter:
 * - Primary: Google Drive (5TB) via OAuth2 refresh token + resumable uploads.
 * - Fallback: S3-compatible object storage.
 */

export type StorageConfig =
  | {
      backend: 'gdrive';
      folderId: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
  | {
      backend: 's3';
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };

/** Fails loudly at boundary if storage env vars are incomplete. */
export function resolveStorageConfig(env: Record<string, string | undefined>): StorageConfig {
  const backend = env.STORAGE_BACKEND ?? 'gdrive';
  if (backend === 'gdrive') {
    const { GDRIVE_FOLDER_ID, GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN } = env;
    if (!GDRIVE_FOLDER_ID || !GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET || !GDRIVE_REFRESH_TOKEN) {
      throw new Error('Incomplete Google Drive OAuth2 config: set GDRIVE_FOLDER_ID, GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN');
    }
    return {
      backend: 'gdrive',
      folderId: GDRIVE_FOLDER_ID,
      clientId: GDRIVE_CLIENT_ID,
      clientSecret: GDRIVE_CLIENT_SECRET,
      refreshToken: GDRIVE_REFRESH_TOKEN,
    };
  }
  if (backend === 's3') {
    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = env;
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error('Incomplete S3 config: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY');
    }
    return {
      backend: 's3',
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET,
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
      region: S3_REGION ?? 'auto',
    };
  }
  throw new Error(`Unsupported STORAGE_BACKEND "${backend}" (expected "gdrive" or "s3")`);
}

/**
 * Resolves StorageConfig from decrypted Organization Vault JSON bundles
 * (`GDRIVE_OAUTH_BUNDLE` or `S3_CREDENTIALS_JSON`) so storage credentials never live in server .env.
 */
export function resolveStorageConfigFromOrgVault(vaultSecrets: Record<string, string | undefined>): StorageConfig {
  if (vaultSecrets.GDRIVE_OAUTH_BUNDLE) {
    const b = JSON.parse(vaultSecrets.GDRIVE_OAUTH_BUNDLE) as {
      folderId?: string;
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
    };
    if (!b.folderId || !b.clientId || !b.clientSecret || !b.refreshToken) {
      throw new Error('Invalid GDRIVE_OAUTH_BUNDLE in Org Vault');
    }
    return {
      backend: 'gdrive',
      folderId: b.folderId,
      clientId: b.clientId,
      clientSecret: b.clientSecret,
      refreshToken: b.refreshToken,
    };
  }
  if (vaultSecrets.S3_CREDENTIALS_JSON) {
    const s = JSON.parse(vaultSecrets.S3_CREDENTIALS_JSON) as {
      endpoint?: string;
      bucket?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
    };
    if (!s.endpoint || !s.bucket || !s.accessKeyId || !s.secretAccessKey) {
      throw new Error('Invalid S3_CREDENTIALS_JSON in Org Vault');
    }
    return {
      backend: 's3',
      endpoint: s.endpoint,
      bucket: s.bucket,
      accessKeyId: s.accessKeyId,
      secretAccessKey: s.secretAccessKey,
      region: s.region ?? 'auto',
    };
  }
  throw new Error('No storage connector configured in Org Vault (expected GDRIVE_OAUTH_BUNDLE or S3_CREDENTIALS_JSON)');
}

/** Fetches a decrypted org secret from backend/core over the authenticated internal worker endpoint. */
export async function fetchOrgVaultSecret(coreUrl: string, workerToken: string, keyName: string): Promise<string> {
  const res = await fetch(`${coreUrl.replace(/\/$/, '')}/api/internal/vault/decrypt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-worker-token': workerToken },
    body: JSON.stringify({ key_name: keyName }),
  });
  if (!res.ok) throw new Error(`Org Vault decrypt failed for ${keyName} (${res.status})`);
  const data = (await res.json()) as { plaintext: string };
  return data.plaintext;
}

export async function exchangeGDriveRefreshToken(cfg: Extract<StorageConfig, { backend: 'gdrive' }>): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth2 token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Google OAuth2 response missing access_token');
  return data.access_token;
}

export async function uploadToGoogleDrive(
  cfg: Extract<StorageConfig, { backend: 'gdrive' }>,
  file: { name: string; mimeType: string; bytes: Uint8Array },
): Promise<{ fileId: string; downloadUrl: string }> {
  const token = await exchangeGDriveRefreshToken(cfg);
  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': file.mimeType,
      'x-upload-content-length': String(file.bytes.byteLength),
    },
    body: JSON.stringify({ name: file.name, parents: [cfg.folderId] }),
  });
  if (!initRes.ok) throw new Error(`GDrive resumable init failed (${initRes.status}): ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('GDrive resumable init missing Location header');

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.mimeType },
    body: Buffer.from(file.bytes),
  });
  if (!putRes.ok) throw new Error(`GDrive upload failed (${putRes.status}): ${await putRes.text()}`);
  const created = (await putRes.json()) as { id: string };
  return {
    fileId: created.id,
    downloadUrl: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}?alt=media`,
  };
}

/** Proxies an HTTP Range request directly to Google Drive so <video>/<audio> scrubs cleanly. */
export async function fetchGoogleDriveRange(
  cfg: Extract<StorageConfig, { backend: 'gdrive' }>,
  fileId: string,
  rangeHeader?: string,
): Promise<Response> {
  const token = await exchangeGDriveRefreshToken(cfg);
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (rangeHeader) headers.range = rangeHeader;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers,
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`GDrive range fetch failed (${res.status}): ${await res.text()}`);
  }
  return res;
}

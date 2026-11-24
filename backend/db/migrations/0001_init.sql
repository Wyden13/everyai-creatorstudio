-- EveryAI CreatorStudio — Initial PostgreSQL Schema (Non-containerized PG 16+)
-- Follows explicit enum state machines and zero implicit boolean lifecycles.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Explicit Enums
CREATE TYPE org_role AS ENUM ('admin', 'manager');
CREATE TYPE node_archetype AS ENUM ('agent', 'status', 'tracker', 'aggregator');
CREATE TYPE capability_class AS ENUM ('llm_text', 'llm_code', 'tts', 'search', 'publish');
CREATE TYPE pipeline_state AS ENUM ('Idle', 'Queued', 'Running', 'NeedsApproval', 'Failed', 'Done');
CREATE TYPE widget_spec_type AS ENUM ('declarative_json', 'sandboxed_tsx');
CREATE TYPE widget_approval_status AS ENUM ('pending_admin', 'approved', 'rejected');
CREATE TYPE storage_backend AS ENUM ('gdrive', 's3');
CREATE TYPE media_asset_type AS ENUM (
  'audio',
  'timestamps',
  'remotion_clip',
  'manim_clip',
  'final_16x9',
  'final_9x16',
  'thumbnail'
);
CREATE TYPE publish_platform AS ENUM ('youtube', 'tiktok', 'instagram');

-- 2. Organization, Users, RBAC & Sessions
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role org_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Encrypted Org Key Vault (AES-256-GCM envelope encryption)
CREATE TABLE org_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  secret_key_name TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, secret_key_name)
);

-- 4. Workspaces, Yjs Snapshots & Custom Widgets
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE board_snapshots (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  yjs_state BYTEA NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE custom_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  archetype node_archetype NOT NULL,
  spec_type widget_spec_type NOT NULL,
  spec_json JSONB NOT NULL,
  approval_status widget_approval_status NOT NULL DEFAULT 'approved',
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Agent Definitions & Durable Pipeline Runs
CREATE TABLE agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_kind TEXT NOT NULL,
  required_capabilities capability_class[] NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  upstream_node_ids TEXT[] NOT NULL DEFAULT '{}',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, node_id)
);

CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  state pipeline_state NOT NULL DEFAULT 'Queued',
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  step_kind TEXT NOT NULL,
  state pipeline_state NOT NULL DEFAULT 'Queued',
  input_json JSONB,
  output_json JSONB,
  error_code TEXT,
  error_message TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Media Assets & Publishing
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  asset_type media_asset_type NOT NULL,
  storage storage_backend NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE published_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  platform publish_platform NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  state pipeline_state NOT NULL DEFAULT 'NeedsApproval',
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_workspace_state ON pipeline_runs (workspace_id, state);
CREATE INDEX idx_run_steps_run_id ON run_steps (run_id);
CREATE INDEX idx_media_assets_run_id ON media_assets (run_id);
CREATE INDEX idx_published_items_org_state ON published_items (org_id, state);

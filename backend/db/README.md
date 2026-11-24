# Database (`backend/db/`)

Schema definitions, ordered SQL migrations, and seed scripts for our **non-containerized PostgreSQL** instance on the VM.

## What It Does

- Owns the canonical relational schema for:
  - Organizations, Users, RBAC Memberships (`org:admin`, `org:manager`), Sessions, Invites.
  - `org_secrets` (AES-256-GCM encrypted API keys).
  - Workspaces, Yjs board snapshots, and Architect custom widgets (including Admin approval state for sandboxed TSX).
  - Agent definitions, durable Pipeline Runs & Step state machines (`Idle | Queued | Running | NeedsApproval | Failed | Done`).
  - Media assets (Google Drive / S3 pointers) and Published video records + metrics.

## Why It's Here

Keeping SQL migrations in `backend/db/` gives `backend/core/` (Zig) and operational scripts a single, version-controlled source of truth for database structure without hiding schema changes inside an ORM.

# Internal MCP Servers (`backend/mcp/`)

In-process Model Context Protocol (JSON-RPC 2.0 `tools/list` + `tools/call`) tool layer shared by the Architect Agent and background workers.

## Why It's Here

Instead of letting LLMs guess REST URLs or touch raw Org Vault secrets, every internal studio capability and external connector is exposed as a typed, discoverable MCP tool scoped by `(orgId, workspaceId, agentId, componentId)`:
- **`mcp-studio-board`** — Workspace node inspection, widget creation, in-place component edits, and produced-topics queries.
- **`mcp-org-connectors`** — Connector availability checks and capability validation (never exposes plaintext API keys to LLM context).
- **`mcp-social-analytics`** — YouTube Data API v3 analytics & Ayrshare social stats/publishing.
- **`mcp-media-storage`** — Google Drive 5TB render listing & signed range-streaming URLs.

## Write-Ownership Invariant

Any mutating tool verifies that `scope.componentId` owns the target component (or `scope.agentId === 'architect'` with an explicit `target_component_id`), preventing agents from ever overwriting another component's state.

# Architect Skills (`shared/skills/`)

Lean, composable Markdown skills with YAML frontmatter loaded on demand by `backend/worker-agents/src/skills.ts`. Keeping each `SKILL.md` small prevents context bloat while ensuring every Architect-generated component matches the studio's visual system and real backend wiring.

## Available Skills
- [design-system/SKILL.md](design-system/SKILL.md) — Graphite/violet palette, continuous corners, tactile springs, "motion = status".
- [social-connectors/SKILL.md](social-connectors/SKILL.md) — YouTube Data API v3, TikTok & Instagram Reels via Org Vault + MCP tools.
- [publisher-pipeline/SKILL.md](publisher-pipeline/SKILL.md) — `gate | scheduled | auto` publishing agents and post-publish analytics.
- [aggregator-scheduler/SKILL.md](aggregator-scheduler/SKILL.md) — Auto-scheduled polling (`15m | 30m | 2h | daily`), add/prune reconciliation, drag-to-trigger edges.

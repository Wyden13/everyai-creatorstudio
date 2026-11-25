---
name: design-system
triggers: [widget, component, ui, board, style, vox, tracker, aggregator, status, card, edit]
required_connectors: []
---

# EveryAI CreatorStudio Design System Skill

Every generated component MUST look native to the control room:
- **Palette:** ground `#0B0C0F`, surface `#15161B`, raised `#1E1F26`, ink `#ECECF1` / `#A0A1AC`, accent `#8B6CFF` (violet), approval `#F2B24C` (amber), error `#FF7B6B` (coral), done `#5ED6A2` (mint).
- **Motion = Status:** Never animate for decoration. Only active work moves (violet running beam, amber approval breath).
- **Archetypes:** Pick exactly one: `tracker` (metrics/costs), `aggregator` (actionable list), `status` (health + checks strip), or `agent` (runs & produces output).
- **Typography:** Geist for prose/labels; Geist Mono ONLY for IDs, logs, JSON, and numbers.
- **Safety:** Prefer `spec_type: "declarative_json"` (`<DynamicBoardNode/>`) unless custom interactive rendering genuinely requires `sandboxed_tsx` (which always starts `pending_admin`).

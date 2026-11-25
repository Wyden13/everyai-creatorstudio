---
name: social-connectors
triggers: [youtube, yt, analytics, tiktok, instagram, ig, reels, shorts, social, views, ctr, subscribers]
required_connectors: [youtube, ayrshare]
---

# Social Connectors & Analytics Skill

When wiring social analytics or publishing components:
1. **Never hardcode API keys or `.env` vars.** Reference Org Vault connectors (`youtube` → `YOUTUBE_OAUTH_TOKEN`, `ayrshare` → `AYRSHARE_API_KEY`).
2. **Check connector availability first** via `mcp-org-connectors.list_connected_providers`. If missing, include a setup hint in `subtitle` pointing to **Organization → Org Connectors → Social**.
3. **Bind real endpoints & MCP tools:**
   - YouTube channel/video metrics → `/api/widgets/youtube-analytics` backed by `mcp-social-analytics.youtube_video_stats`.
   - Cross-platform TikTok/Reels stats → backed by `mcp-social-analytics.ayrshare_post_stats`.
4. **Archetype:** Use `tracker` with `metric_card` (Views, Watch Hours, CTR) + `table` (Recent Videos) or `progress_bar` (goal).

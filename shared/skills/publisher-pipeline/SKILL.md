---
name: publisher-pipeline
triggers: [publish, publisher, upload, schedule, sign-off, thumbnail, metadata]
required_connectors: [youtube, ayrshare, gdrive]
---

# Publisher Pipeline Skill

When creating or editing publishing agents:
1. **Explicit approval mode:** Always model mode as `'gate' | 'scheduled' | 'auto'` — never a boolean.
2. **Capability rules:** Metadata generation uses `llm_text` (Claude/GPT/Gemini); video upload uses `publish` (`youtube-v3`, `ayrshare-social`). Never assign TTS models to publisher nodes.
3. **Storage & Media:** Fetch final `16:9` and `9:16` assets via `mcp-media-storage.gdrive_list_renders` / `get_signed_stream_url`.
4. **Post-publish loop:** Wire output to a `tracker` node so views/likes/comments flow back onto the board automatically.

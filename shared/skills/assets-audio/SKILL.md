---
name: assets-audio
triggers: [pexels, b-roll, broll, stock, footage, freesound, music, sfx, audio, soundtrack, ducking]
required_connectors: [pexels, freesound]
---

# Stock Assets & Audio Sourcing Skill

When sourcing visuals or background music for videos:
1. **Stock B-roll (`pexels`):** Call `mcp-media-storage.pexels_search` matching the scene's aspect ratio (`orientation: "landscape"` for `16:9`, `"portrait"` for `9:16`).
2. **Background Music / SFX (`freesound`):** Call `mcp-media-storage.freesound_search` with `max_duration_sec` covering the scene or full runtime.
3. **Auto-Ducking:** Pass `musicBedPath` into `compiler.ts`; FFmpeg automatically sidechain-ducks the music bed (~`-24 LUFS`) under `-14 LUFS` narration.
4. **Org Vault:** Never put `PEXELS_API_KEY` or `FREESOUND_API_KEY` in `.env` — read from Org Vault (`Organization → Org Connectors → Tools`).

/**
 * Pure per-org daily spend & render guardrails to prevent runaway loops from
 * exhausting ElevenLabs characters, LLM spend, or render compute.
 */

export interface DailyUsage {
  usdSpentToday: number;
  ttsCharsToday: number;
  rendersToday: number;
}

export interface DailyLimits {
  maxUsdPerDay: number;
  maxTtsCharsPerDay: number;
  maxRendersPerDay: number;
}

export function checkSpendGuardrail(
  usage: DailyUsage,
  limits: DailyLimits,
): { ok: true } | { ok: false; reason: string } {
  if (usage.usdSpentToday >= limits.maxUsdPerDay) {
    return { ok: false, reason: `Daily USD budget reached ($${usage.usdSpentToday.toFixed(2)} / $${limits.maxUsdPerDay.toFixed(2)})` };
  }
  if (usage.ttsCharsToday >= limits.maxTtsCharsPerDay) {
    return { ok: false, reason: `Daily TTS character cap reached (${usage.ttsCharsToday} / ${limits.maxTtsCharsPerDay})` };
  }
  if (usage.rendersToday >= limits.maxRendersPerDay) {
    return { ok: false, reason: `Daily render cap reached (${usage.rendersToday} / ${limits.maxRendersPerDay})` };
  }
  return { ok: true };
}

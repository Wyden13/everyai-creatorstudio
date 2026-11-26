/**
 * What a harness run cost, read from its session. LLM replies carry their usage (computeLlmCost
 * in providers.ts); TTS calls are recorded by the contract shell with TTS_USD_PER_AUDIO_SEC (providers.ts).
 */
import type { HarnessMessage, HarnessSession } from './contract';

export const roundUsd = (usd: number) => Number(usd.toFixed(6));

/** USD each recorded message cost. Every message role has a row. */
const MESSAGE_USD: { [R in HarnessMessage['role']]: (m: Extract<HarnessMessage, { role: R }>) => number } = {
  user: () => 0,
  assistant: (m) => m.usage.estimatedUsd,
  tts: (m) => m.estimatedUsd,
  // The adapter computed it from the registry price and the provider's reported usage (src/assets/image-gen.ts).
  image: (m) => m.costUsd,
};

export const sessionSpendUsd = (session: HarnessSession) =>
  roundUsd(session.messages.reduce((usd, m) => usd + (MESSAGE_USD[m.role] as (m: HarnessMessage) => number)(m), 0));

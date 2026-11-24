import { validateModelForNode } from './contracts';

const bootCheck = validateModelForNode('voiceover', 'elevenlabs', 'eleven_multilingual_v2');
if (!bootCheck.ok) {
  throw new Error(`Registry self-check failed: ${bootCheck.reason}`);
}

console.log('[worker-agents] Bun worker bootstrap ready. Waiting for Milestone 2 Redis queue wiring.');

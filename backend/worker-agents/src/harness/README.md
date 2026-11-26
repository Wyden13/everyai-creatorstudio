# `src/harness/`: the harness contract

A **harness** has a system prompt, tools, and calls an LLM for one task (root `AGENTS.md` §3). Everything here exists so each one can be piped, resumed, and tested for real on its own.

| File | Responsibility |
|---|---|
| `contract.ts` | `Harness`, `HarnessEdges`, `HarnessSession`, `HarnessResult`, and `defineHarness` (validates input/output, records LLM exchanges, turns throws into `Failed`) |
| `registry.ts` | `HARNESSES`, in pipeline order. Add a harness as a row, plus its live test |
| `scout.ts` | Claude + server `web_search` → ranked topics; novelty is scored in code (`scheduler.ts`); a run must search, and a source whose URL no search returned is dropped (listed in `unverified`) |
| `screenplay.ts` | `screenplay` (topic → Vox beat sheet) and `repair` (one beat's shot, narration locked) over `src/vox/screenplay.ts` |
| `voiceover.ts` | Tool-only stage: Gemini TTS → WAV → word alignment (`src/align.ts`, `scripts/align_words.py`) |
| `animation.ts` | `produceVoxVideo`: compile → audit → `repair` harness → render |
| `asset.ts` | Asset Generation: request → closed model menu → LLM picks a model and writes the provider prompt → `imageGen` edge → file + `source` provenance; output pipes into the Asset Storage tool (`src/assets/store.ts`) |
| `env.ts` | The only place real edges are built from env vars (`imageGen` gets one row per provider whose key is set) |
| `live-run.ts` | Live tests as one checkpointed run (`src/checkpoint.ts`): `liveStage`, `liveOutput`, `liveMediaPath`; `LIVE_RUN`, `LIVE_FORCE`, `LIVE_BUDGET_USD` |
| `spend.ts` | What a session cost (LLM usage + recorded TTS and image calls) |
| `*.live.test.ts` | One real run per harness (`bun run test:live <id>`) |
| `harness.test.ts` | Unit tests with scripted edges |

## Rules

- A harness gets only the edges it declares (`edges: ['llm', 'model']`). It never reads env, the Vault or globals; keys are bound into `llm`/`tts` at the edge.
- `run(input, edges, resume?)` never throws: it returns `{ state: 'Done', output, session }` or `{ state: 'Failed', error, session }`.
- A harness that reads files besides its JSON input lists them in `inputFiles`, so a changed file reruns it from its checkpoint (`src/checkpoint.ts`). Checkpointing happens in the runner, never inside a harness.
- The session holds every exchanged message (each reply with its usage, search count and search-result URLs; each TTS call with its audio length and cost), the last output and the failure. Pass it back as `resume` (optionally with a new `failure`, e.g. from a status flag) and the harness continues from it: scout and screenplay show the model its previous output and the failure; animation restarts from the last repaired sheet; voiceover reruns.

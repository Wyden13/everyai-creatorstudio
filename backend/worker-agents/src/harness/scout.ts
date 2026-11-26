/**
 * Scout harness: finds what is rising in a niche with Claude's server-side web_search, then
 * ranks it. The model judges momentum (velocity); code scores novelty against recent videos,
 * so "we already made this" never depends on the model's memory. Sources are checked against the
 * run's actual search results the same way: a URL the searches never returned is dropped and
 * flagged in `unverified`, a topic left with no verified source is dropped, and a run that did
 * not search (or keeps no topic) fails.
 */
import { z } from 'zod';
import { parseLlmJson } from '../providers';
import { noveltyAgainst, trendScore } from '../scheduler';
import { defineHarness } from './contract';

const SourceSchema = z.object({ title: z.string().min(1), url: z.string().url() });
const TopicSchema = z.object({
  topic: z.string().min(1).max(120),
  angle: z.string().min(1).max(280),
  velocity: z.number().min(0).max(1),
  sources: z.array(SourceSchema).min(1),
});

export const ScoutInputSchema = z.object({
  niche: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  recentTitles: z.array(z.string()),
  count: z.number().int().min(1).max(10),
});

export const ScoutOutputSchema = z.object({
  topics: z.array(TopicSchema.extend({ novelty: z.number(), score: z.number() })).min(1),
  /** Sources the model cited that no search in this run returned (dropped from their topic). */
  unverified: z.array(SourceSchema.extend({ topic: z.string() })),
});

/** Same page despite scheme, `www.` or a trailing slash. */
export const pageKey = (url: string) => url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

const SYSTEM_PROMPT = `You are the trend scout for a documentary explainer channel.
Search the web for what is rising RIGHT NOW in the given niche, then pick the best video topics.
A good topic is concrete, recent, and explainable with maps, numbers and timelines; skip anything already covered by recent_titles.
Every source must be a page you actually found with web_search, its url copied exactly as the search returned it. Never invent URLs: sources that are not in your search results are dropped.
When done searching, reply with ONLY one JSON object, no prose and no markdown fences:
{"topics":[{"topic":"short title","angle":"the one-sentence hook or question the video answers","velocity":0.0-1.0,"sources":[{"title":"…","url":"https://…"}]}]}
velocity = how fast coverage is rising: 1 = breaking across many outlets in the last 24h, 0.5 = steady recent interest, 0.1 = evergreen.`;

export const scoutHarness = defineHarness({
  id: 'scout',
  capability: 'llm_text',
  systemPrompt: SYSTEM_PROMPT,
  tools: [{ id: 'web_search', kind: 'server', description: 'Anthropic server-side web search' }],
  input: ScoutInputSchema,
  output: ScoutOutputSchema,
  edges: ['llm', 'model'],
  async body({ input, edges, resume, llm }) {
    const reply = await llm({
      nodeKind: 'trend_scout',
      ...edges.model,
      serverTools: ['web_search'],
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        niche: input.niche,
        keywords: input.keywords,
        recent_titles: input.recentTitles,
        count: input.count,
        ...(resume && { previous_output: resume.lastOutput, failure: resume.failure, instruction: 'Fix the failure; keep the rest of previous_output.' }),
      }),
    });
    if (reply.usage.webSearchRequests < 1) return { state: 'Failed', error: 'scout ran no web_search, so its sources could only come from model memory' };
    const { topics } = z.object({ topics: z.array(TopicSchema).min(1) }).parse(parseLlmJson(reply.text));
    const found = new Set(reply.searchResults.map((r) => pageKey(r.url)));
    const isFound = (s: { url: string }) => found.has(pageKey(s.url));
    const unverified = topics.flatMap((t) => t.sources.filter((s) => !isFound(s)).map((s) => ({ ...s, topic: t.topic })));
    const verified = topics.map((t) => ({ ...t, sources: t.sources.filter(isFound) })).filter((t) => t.sources.length > 0);
    if (verified.length === 0) {
      return { state: 'Failed', error: `no topic kept a source this run's ${reply.usage.webSearchRequests} web_search(es) returned; unverified: ${unverified.map((s) => s.url).join(', ')}`, partial: { topics } };
    }
    const ranked = verified
      .map((t) => ({ ...t, novelty: noveltyAgainst(t.topic, input.recentTitles) }))
      .map((t) => ({ ...t, score: trendScore(t) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.count);
    return { state: 'Done', output: { topics: ranked, unverified } };
  },
});

/**
 * Progressive-disclosure Skill router for the Architect Agent.
 * Reads lean SKILL.md files from shared/skills/ and selects only the relevant skills per prompt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SkillEntry {
  name: string;
  triggers: readonly string[];
  requiredConnectors: readonly string[];
  relativePath: string;
}

/** Declarative skill catalog; add new skills as rows here. */
export const SKILL_CATALOG: readonly SkillEntry[] = [
  {
    name: 'design-system',
    triggers: ['widget', 'component', 'ui', 'board', 'style', 'vox', 'tracker', 'aggregator', 'status', 'card', 'edit'],
    requiredConnectors: [],
    relativePath: 'design-system/SKILL.md',
  },
  {
    name: 'social-connectors',
    triggers: ['youtube', 'yt', 'analytics', 'tiktok', 'instagram', 'ig', 'reels', 'shorts', 'social', 'views', 'ctr'],
    requiredConnectors: ['youtube', 'ayrshare'],
    relativePath: 'social-connectors/SKILL.md',
  },
  {
    name: 'publisher-pipeline',
    triggers: ['publish', 'publisher', 'upload', 'sign-off', 'thumbnail', 'metadata'],
    requiredConnectors: ['youtube', 'ayrshare', 'gdrive'],
    relativePath: 'publisher-pipeline/SKILL.md',
  },
  {
    name: 'aggregator-scheduler',
    triggers: ['news', 'market', 'trend', 'scout', 'poll', 'schedule', 'interval', 'aggregator', 'feed', 'topics', 'made'],
    requiredConnectors: ['serpapi', 'exa', 'tavily'],
    relativePath: 'aggregator-scheduler/SKILL.md',
  },
];

const SKILLS_DIR = join(import.meta.dir, '../../../shared/skills');

/** Selects only the lean skills relevant to `prompt` (always includes design-system). */
export function selectSkillsForPrompt(prompt: string): SkillEntry[] {
  const lower = prompt.toLowerCase();
  const picked: SkillEntry[] = [];
  for (const skill of SKILL_CATALOG) {
    if (skill.name === 'design-system' || skill.triggers.some((t) => lower.includes(t))) {
      picked.push(skill);
    }
  }
  return picked;
}

export function loadSkillsContext(prompt: string): { skillNames: string[]; markdown: string } {
  const selected = selectSkillsForPrompt(prompt);
  const parts = selected.map((s) => readFileSync(join(SKILLS_DIR, s.relativePath), 'utf-8').trim());
  return {
    skillNames: selected.map((s) => s.name),
    markdown: parts.join('\n\n---\n\n'),
  };
}

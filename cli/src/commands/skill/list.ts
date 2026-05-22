import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { buildSkillManifest, type SkillEntry } from '../../lib/skill-manifest.js';
import type { CommandContext } from '../../framework/context.js';

export interface SkillListResult { skills: SkillEntry[] }

export function skillList(opts: { repoRoot: string }): SkillListResult {
  return { skills: buildSkillManifest({ repoRoot: opts.repoRoot }) };
}

interface Args { 'repo-root'?: string }

export const skillListCommand = defineCommand({
  name: 'skill-list',
  description: 'List repository SKILL.md entries eligible for planner-spawn discovery',
  args: {
    'repo-root': {
      description: 'Absolute path to the repository root whose skills are scanned',
      required: true,
    },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const root = args['repo-root'];
    if (!root) throw new UserError('--repo-root is required');
    return skillList({ repoRoot: root });
  },
});

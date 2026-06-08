import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GroupDeleteOptions {
  root: string;
  group: string;
}

export interface GroupDeleteResult {
  rev: number;
}

export function runGroupDelete({ root, group }: GroupDeleteOptions): GroupDeleteResult {
  try {
    return new WorkGraphService({ root }).deleteGroup(group);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

interface Args { group?: string }

export const groupDeleteCommand = defineCommand({
  name: 'project-group-delete',
  description: 'Delete a project-group without removing its member projects',
  args: {
    group: { description: 'Id of the project-group to delete', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    const root = userDataPaths().root;
    return runGroupDelete({ root, group: args.group });
  },
});

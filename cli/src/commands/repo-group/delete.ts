import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, deleteGroup } from '@rad-orchestration/repo-registry';
import type { CommandContext } from '../../framework/context.js';

export interface GroupDeleteOptions {
  root: string;
  name: string;
}

export interface GroupDeleteResult {
  name: string;
}

export function groupDelete({ root, name }: GroupDeleteOptions): GroupDeleteResult {
  const reg = readRegistry({ root });
  if (!reg.repoGroups[name]) {
    throw new UserError(`'${name}' is not a registered repo-group`);
  }
  deleteGroup({ root, name });
  return { name };
}

interface Args { name?: string }

export const groupDeleteCommand = defineCommand({
  name: 'repo-group-delete',
  description: 'Delete a repo-group without unregistering its member repos',
  args: {
    name: { description: 'Name of the repo-group to delete', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return groupDelete({ root, name: args.name });
  },
});

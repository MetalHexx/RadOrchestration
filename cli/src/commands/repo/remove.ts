import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, removeRepo } from '@rad-orchestration/repo-registry';
import type { CommandContext } from '../../framework/context.js';

export interface RepoRemoveOptions {
  root: string;
  name: string;
}

export interface RepoRemoveResult {
  name: string;
}

export function repoRemove({ root, name }: RepoRemoveOptions): RepoRemoveResult {
  const reg = readRegistry({ root });
  if (!reg.repos[name]) {
    throw new UserError(`repo '${name}' is not registered`);
  }
  removeRepo({ root, name });
  return { name };
}

interface Args { name?: string }

export const repoRemoveCommand = defineCommand({
  name: 'repo-remove',
  description: 'Unregister a repo from the registry, removing it from all group memberships',
  args: {
    name: { description: 'Registered repo name to remove', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const name = args.name;
    if (!name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return repoRemove({ root, name });
  },
});

import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, writeIdentity } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface RepoEditOptions {
  root: string;
  name: string;
  description?: string;
  remote?: string;
  defaultBranch?: string;
}

export interface RepoEditResult {
  name: string;
  description: string;
  remote: string;
  default_branch: string;
}

export function repoEdit({ root, name, description, remote, defaultBranch }: RepoEditOptions): RepoEditResult {
  const reg = readRegistry({ root });
  const identity = reg.repos[name];
  if (!identity) {
    throw new UserError(`repo '${name}' is not registered`);
  }
  if (description === undefined && remote === undefined && defaultBranch === undefined) {
    throw new UserError('no editable field flag supplied');
  }
  // The description is a required field — it can be changed, but never blanked.
  if (description !== undefined && !description.trim()) {
    throw new UserError('--description cannot be empty');
  }
  if (description !== undefined) identity.description = description.trim();
  if (remote !== undefined) identity.remote = remote;
  if (defaultBranch !== undefined) identity.default_branch = defaultBranch;
  writeIdentity({ root, repos: reg.repos, repoGroups: reg.repoGroups });
  return { name, description: identity.description, remote: identity.remote, default_branch: identity.default_branch };
}

interface Flags { description?: string; remote?: string; 'default-branch'?: string }
interface Args { name?: string }

export const repoEditCommand = defineCommand({
  name: 'repo-edit',
  description: 'Edit mutable identity fields of a registered repo (description, remote, default-branch)',
  args: {
    name: { description: 'Registered repo name to edit', required: true },
  },
  flags: {
    description: { description: 'New description for the repo', type: 'string' },
    remote: { description: 'New remote URL for the repo', type: 'string' },
    'default-branch': { description: 'New default branch for the repo', type: 'string' },
  },
  handler: async ({ args, flags }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    const name = args.name;
    if (!name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return repoEdit({
      root,
      name,
      description: flags.description,
      remote: flags.remote,
      defaultBranch: flags['default-branch'],
    });
  },
});

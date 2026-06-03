import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, editRepo } from '@rad-orchestration/repo-registry';
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
  if (!reg.repos[name]) {
    throw new UserError(`repo '${name}' is not registered`);
  }
  if (description === undefined && remote === undefined && defaultBranch === undefined) {
    throw new UserError('no editable field flag supplied');
  }
  // The description is a required field — it can be changed, but never blanked.
  if (description !== undefined && !description.trim()) {
    throw new UserError('--description cannot be empty');
  }
  // Write through the library mutation seam (the UI consumes the same surface).
  const updated = editRepo({
    root,
    name,
    description: description !== undefined ? description.trim() : undefined,
    remote,
    defaultBranch,
  });
  return { name, description: updated.description, remote: updated.remote, default_branch: updated.default_branch };
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

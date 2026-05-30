import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, resolveRepoPath } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface RepoShowOptions {
  root: string;
  name: string;
}

export interface RepoShowResult {
  name: string;
  remote: string;
  default_branch: string;
  description: string;
  groups: string[];
  bound: boolean;
  path: string | null;
  hint: string | null;
}

export function repoShow({ root, name }: RepoShowOptions): RepoShowResult {
  const reg = readRegistry({ root });
  const identity = reg.repos[name];
  if (!identity) {
    throw new UserError(`repo '${name}' is not registered`);
  }
  const resolved = resolveRepoPath(reg, name);
  const groups = Object.entries(reg.repoGroups)
    .filter(([, group]) => group.members.includes(name))
    .map(([groupName]) => groupName);
  return {
    name,
    remote: identity.remote,
    default_branch: identity.default_branch,
    description: identity.description,
    groups,
    bound: resolved.bound,
    path: resolved.path,
    hint: resolved.hint,
  };
}

interface Args { name?: string }

export const repoShowCommand = defineCommand({
  name: 'repo-show',
  description: 'Show full detail for a registered repo including group memberships and bind state',
  args: {
    name: { description: 'Registered repo name to show', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; flags: Record<string, never>; ctx: CommandContext }) => {
    const name = args.name;
    if (!name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return repoShow({ root, name });
  },
});

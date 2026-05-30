import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, addGroupMember, removeGroupMember } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface GroupAddOptions {
  root: string;
  group: string;
  repo: string;
}

export interface GroupAddResult {
  group: string;
  repo: string;
}

export interface GroupRemoveOptions {
  root: string;
  group: string;
  repo: string;
}

export interface GroupRemoveResult {
  group: string;
  repo: string;
  removed: boolean;
}

export function groupAdd({ root, group, repo }: GroupAddOptions): GroupAddResult {
  const reg = readRegistry({ root });
  if (!reg.repoGroups[group]) {
    throw new UserError(`'${group}' is not a registered repo-group`);
  }
  if (!reg.repos[repo]) {
    throw new UserError(`'${repo}' is not a registered repo`);
  }
  addGroupMember({ root, group, repo });
  return { group, repo };
}

export function groupRemove({ root, group, repo }: GroupRemoveOptions): GroupRemoveResult {
  const reg = readRegistry({ root });
  if (!reg.repoGroups[group]) {
    throw new UserError(`'${group}' is not a registered repo-group`);
  }
  const grp = reg.repoGroups[group];
  const isMember = grp.members.includes(repo);
  if (isMember) {
    removeGroupMember({ root, group, repo });
  }
  return { group, repo, removed: isMember };
}

interface AddArgs { group?: string; repo?: string }
interface RemoveArgs { group?: string; repo?: string }

export const groupAddCommand = defineCommand({
  name: 'repo-group-add',
  description: 'Add a registered repo to a repo-group',
  args: {
    group: { description: 'Name of the repo-group', required: true },
    repo: { description: 'Name of the registered repo to add', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: AddArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    if (!args.repo) throw new UserError('--repo is required');
    const root = userDataPaths().root;
    return groupAdd({ root, group: args.group, repo: args.repo });
  },
});

export const groupRemoveCommand = defineCommand({
  name: 'repo-group-remove',
  description: 'Remove a repo from a repo-group membership; no-op if repo is not a member',
  args: {
    group: { description: 'Name of the repo-group', required: true },
    repo: { description: 'Name of the registered repo to remove', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: RemoveArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    if (!args.repo) throw new UserError('--repo is required');
    const root = userDataPaths().root;
    return groupRemove({ root, group: args.group, repo: args.repo });
  },
});

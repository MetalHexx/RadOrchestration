import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface GroupListOptions {
  root: string;
}

export interface GroupListEntry {
  name: string;
  description: string;
  members: string[];
}

export interface GroupListResult {
  groups: GroupListEntry[];
}

export interface GroupShowOptions {
  root: string;
  name: string;
}

export interface GroupShowResult {
  name: string;
  description: string;
  members: string[];
}

export function groupList({ root }: GroupListOptions): GroupListResult {
  const reg = readRegistry({ root });
  const groups: GroupListEntry[] = Object.entries(reg.repoGroups).map(([name, group]) => ({
    name,
    description: group.description,
    members: [...group.members],
  }));
  return { groups };
}

export function groupShow({ root, name }: GroupShowOptions): GroupShowResult {
  const reg = readRegistry({ root });
  const group = reg.repoGroups[name];
  if (!group) {
    throw new UserError(`'${name}' is not a registered repo-group`);
  }
  return {
    name,
    description: group.description,
    members: [...group.members],
  };
}

interface ShowArgs { name?: string }

export const groupListCommand = defineCommand({
  name: 'repo-group-list',
  description: 'List all repo-groups with their members',
  args: {},
  flags: {},
  handler: async ({ ctx: _ctx }: { args: Record<string, never>; flags: Record<string, never>; ctx: CommandContext }) => {
    const root = userDataPaths().root;
    return groupList({ root });
  },
});

export const groupShowCommand = defineCommand({
  name: 'repo-group-show',
  description: 'Show description and members of a repo-group',
  args: {
    name: { description: 'Name of the repo-group to show', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: ShowArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return groupShow({ root, name: args.name });
  },
});

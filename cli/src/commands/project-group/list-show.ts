import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { Group } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GroupListOptions {
  root: string;
}

export interface GroupListResult {
  groups: Group[];
}

export interface GroupShowOptions {
  root: string;
  group: string;
}

export interface GroupShowResult {
  node: Group;
}

export function runGroupList({ root }: GroupListOptions): GroupListResult {
  const groups = new WorkGraphService({ root }).listGroups();
  return { groups };
}

export function runGroupShow({ root, group }: GroupShowOptions): GroupShowResult {
  const node = new WorkGraphService({ root }).getNode(group);
  if (!node || node.kind !== 'group') {
    throw new UserError(`'${group}' is not a registered project-group`);
  }
  return { node: node as Group };
}

interface ShowArgs { group?: string }

export const groupListCommand = defineCommand({
  name: 'project-group-list',
  description: 'List all project-groups',
  args: {},
  flags: {},
  handler: async ({ ctx: _ctx }: { args: Record<string, never>; flags: Record<string, never>; ctx: CommandContext }) => {
    const root = userDataPaths().root;
    return runGroupList({ root });
  },
});

export const groupShowCommand = defineCommand({
  name: 'project-group-show',
  description: 'Show details of a project-group',
  args: {
    group: { description: 'Id of the project-group to show', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: ShowArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    const root = userDataPaths().root;
    return runGroupShow({ root, group: args.group });
  },
});

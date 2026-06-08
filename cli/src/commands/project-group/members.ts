import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { Edge } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GroupAddOptions {
  root: string;
  group: string;
  member: string;
}

export interface GroupAddResult {
  edge: Edge;
  rev: number;
}

export interface GroupRemoveOptions {
  root: string;
  group: string;
  member: string;
}

export interface GroupRemoveResult {
  rev: number;
}

export function runGroupAdd({ root, group, member }: GroupAddOptions): GroupAddResult {
  try {
    return new WorkGraphService({ root }).addMember(group, member);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

export function runGroupRemove({ root, group, member }: GroupRemoveOptions): GroupRemoveResult {
  try {
    return new WorkGraphService({ root }).removeMember(group, member);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

interface AddArgs { group?: string; member?: string }
interface RemoveArgs { group?: string; member?: string }

export const groupAddCommand = defineCommand({
  name: 'project-group-add',
  description: 'Add a project or sub-group to a group',
  args: {
    group: { description: 'Id of the project-group', required: true },
    member: { description: 'Id of the project or sub-group to add', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: AddArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    if (!args.member) throw new UserError('--member is required');
    const root = userDataPaths().root;
    return runGroupAdd({ root, group: args.group, member: args.member });
  },
});

export const groupRemoveCommand = defineCommand({
  name: 'project-group-remove',
  description: 'Remove a project or sub-group from a group',
  args: {
    group: { description: 'Id of the project-group', required: true },
    member: { description: 'Id of the project or sub-group to remove', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: RemoveArgs; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    if (!args.member) throw new UserError('--member is required');
    const root = userDataPaths().root;
    return runGroupRemove({ root, group: args.group, member: args.member });
  },
});

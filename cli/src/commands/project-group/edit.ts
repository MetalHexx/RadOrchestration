import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { Group } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GroupEditOptions {
  root: string;
  group: string;
  name?: string;
  description?: string;
}

export interface GroupEditResult {
  node: Group;
  rev: number;
}

export function runGroupEdit({ root, group, name, description }: GroupEditOptions): GroupEditResult {
  if (name === undefined && description === undefined) {
    throw new UserError('no editable field flag supplied');
  }
  if (description !== undefined && !description.trim()) {
    throw new UserError('--description cannot be empty');
  }
  try {
    const patch: { name?: string; description?: string } = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description.trim();
    return new WorkGraphService({ root }).updateGroup(group, patch);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

interface Args { group?: string }
interface Flags { name?: string; description?: string }

export const groupEditCommand = defineCommand({
  name: 'project-group-edit',
  description: "Edit a project-group's name or description",
  args: {
    group: { description: 'Id of the project-group to edit', required: true },
  },
  flags: {
    name: { description: 'New display name', type: 'string' as const },
    description: { description: 'New description (the scoping rationale; cannot be blank)', type: 'string' as const },
  },
  handler: async ({ args, flags, ctx: _ctx }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.group) throw new UserError('--group is required');
    const root = userDataPaths().root;
    return runGroupEdit({ root, group: args.group, name: flags.name, description: flags.description });
  },
});

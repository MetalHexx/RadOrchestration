import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { Group } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GroupCreateOptions {
  root: string;
  name: string;
  description?: string;
  parent?: string;
}

export interface GroupCreateResult {
  node: Group;
  rev: number;
}

export function runGroupCreate({ root, name, description, parent }: GroupCreateOptions): GroupCreateResult {
  if (!description?.trim()) throw new UserError('a non-empty --description is required to create a project-group');
  const r = new WorkGraphService({ root }).createGroup({ name, description, parentId: parent });
  if (!r.ok) throw new UserError(r.error.message);
  return r.data;
}

interface Args { name?: string }
interface Flags { description?: string; parent?: string }

export const groupCreateCommand = defineCommand({
  name: 'project-group-create',
  description: 'Create a project-group',
  args: { name: { description: 'Name for the new project-group', required: true } },
  flags: {
    description: { description: 'What this group scopes and why an agent would look here (required)', type: 'string' as const },
    parent: { description: 'Optional parent group id to nest this group under', type: 'string' as const },
  },
  handler: async ({ args, flags, ctx }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.name) throw new UserError('--name is required');
    const out = runGroupCreate({ root: userDataPaths().root, name: args.name, description: flags.description, parent: flags.parent });
    if (!ctx.ux.json) ctx.stderr.write(`✓ created ${out.node.id} (rev ${out.rev})\n`);
    return out;
  },
});

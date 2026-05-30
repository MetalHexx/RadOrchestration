import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, assertUniqueName, createGroup } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface GroupCreateOptions {
  root: string;
  name: string;
  members: string[];
  description?: string;
}

export interface GroupCreateResult {
  name: string;
  members: string[];
}

export function groupCreate({ root, name, members, description = '' }: GroupCreateOptions): GroupCreateResult {
  const reg = readRegistry({ root });
  try {
    assertUniqueName(reg, name);
  } catch (e) {
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
  for (const member of members) {
    if (!reg.repos[member]) {
      throw new UserError(`'${member}' is not a registered repo`);
    }
  }
  createGroup({ root, name, members, description });
  return { name, members: [...members] };
}

interface Args { name?: string; members?: string; description?: string }

export const groupCreateCommand = defineCommand({
  name: 'repo-group-create',
  description: 'Create a repo-group with one or more member repos',
  args: {
    name: { description: 'Name for the new repo-group', required: true },
    members: { description: 'Comma-separated list of registered repo names to include', required: true },
  },
  flags: {
    description: { description: 'Optional description for the repo-group', type: 'string' as const },
  },
  handler: async ({ args, flags }: { args: Args; flags: { description?: string }; ctx: CommandContext }) => {
    if (!args.name) throw new UserError('--name is required');
    if (!args.members) throw new UserError('--members is required');
    const members = args.members.split(',').map(m => m.trim()).filter(Boolean);
    const root = userDataPaths().root;
    return groupCreate({ root, name: args.name, members, description: flags.description });
  },
});

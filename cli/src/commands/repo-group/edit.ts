import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, editGroup } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface GroupEditOptions { root: string; name: string; description?: string }
export interface GroupEditResult { name: string; description: string }

export function groupEdit({ root, name, description }: GroupEditOptions): GroupEditResult {
  const reg = readRegistry({ root });
  if (!reg.repoGroups[name]) {
    throw new UserError(`'${name}' is not a registered repo-group`);
  }
  if (description === undefined) {
    throw new UserError('no editable field flag supplied');
  }
  // The description is the scoping rationale — editable, but never blanked.
  if (!description.trim()) {
    throw new UserError('--description cannot be empty');
  }
  const trimmed = description.trim();
  editGroup({ root, name, description: trimmed });
  return { name, description: trimmed };
}

interface Args { name?: string }
interface Flags { description?: string }

export const groupEditCommand = defineCommand({
  name: 'repo-group-edit',
  description: "Edit a repo-group's description",
  args: {
    name: { description: 'Name of the repo-group to edit', required: true },
  },
  flags: {
    description: { description: 'New description (the scoping rationale; cannot be blank)', type: 'string' as const },
  },
  handler: async ({ args, flags }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.name) throw new UserError('--name is required');
    const root = userDataPaths().root;
    return groupEdit({ root, name: args.name, description: flags.description });
  },
});

import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import type { WorktreeRef } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export function buildWorktreesResult(name: string, refs: WorktreeRef[]) {
  return { name, worktrees: refs.map((w) => ({ repo: w.repo, path: w.path, branch: w.branch, exists: w.exists })) };
}

interface Args { id?: string }
export const projectWorktreesCommand = defineCommand({
  name: 'project-worktrees',
  description: "Show a project's resolved worktrees (repo, path, branch, exists)",
  args: { id: { description: 'Project id (folder name) whose worktrees to resolve', required: true } },
  flags: {},
  handler: async ({ args, ctx }: { args: Args; flags: Record<string, never>; ctx: CommandContext }) => {
    if (!args.id) throw new UserError('--id is required');
    const paths = userDataPaths();
    const refs = new WorkGraphService({ root: paths.root, worktreesDir: paths.worktrees }).resolveWorktrees(args.id);
    const result = buildWorktreesResult(args.id, refs);
    if (!ctx.ux.json) {
      ctx.stderr.write(result.worktrees.map((w) => `${w.repo}\t${w.path}\t${w.branch ?? '-'}\texists=${w.exists}`).join('\n') + '\n');
    }
    return result;
  },
});

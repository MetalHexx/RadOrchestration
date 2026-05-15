import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import {
  processEvent,
  resolvePathContext,
  makeIO,
  autoResolveFinalReviewDocPath,
} from './shared.js';
import { readState } from '../../../../skills/rad-orchestration/scripts/lib/state-io.js';
import type { PipelineResult } from '../../../../skills/rad-orchestration/scripts/lib/types.js';

export interface ApproveFinalOptions { projectDir: string }

/**
 * AD-5: this is the single sanctioned cross-package consumer of the pipeline
 * engine from cli/. AD-6: path resolution flows from import.meta.url and the
 * caller-supplied projectDir; process.cwd() is never consulted.
 */
export async function runApproveFinal(opts: ApproveFinalOptions): Promise<PipelineResult> {
  const dir = opts.projectDir;
  if (!dir) throw new UserError('--project-dir is required');
  const state = readState(dir);
  if (!state) throw new UserError(`No state.json at ${dir}`);
  const docPath = autoResolveFinalReviewDocPath(state);
  const ctx = docPath ? { doc_path: docPath } : {};
  const result = processEvent('final_approved', dir, ctx, makeIO(), resolvePathContext());
  return result;
}

interface Flags { 'project-dir'?: string }

export const approveFinalCommand = defineCommand({
  name: 'approve-final',
  description: 'Approve the project Final Review',
  args: {},
  flags: { 'project-dir': { description: 'absolute path to the project directory', type: 'string' as const } },
  handler: async ({ flags }: { flags: Flags; ctx: CommandContext }) => {
    const dir = flags['project-dir'];
    if (!dir) throw new UserError('--project-dir is required');
    const result = await runApproveFinal({ projectDir: dir });
    return result;
  },
  mapResult: (r: PipelineResult) => r.success
    ? { ok: true as const, data: r, exit_code: 0 }
    : { ok: false as const, error: { type: 'user_error' as const, message: r.error?.message ?? 'pipeline rejected' } },
});

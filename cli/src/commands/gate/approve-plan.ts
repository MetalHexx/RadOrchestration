import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import {
  processEvent,
  resolvePathContext,
  resolveDiscoveredConfigPath,
  makeIO,
  autoResolveMasterPlanDocPath,
} from './shared.js';
import { readState } from '../../lib/pipeline-engine/state-io.js';
import type { PipelineResult } from '../../lib/pipeline-engine/types.js';

export interface ApprovePlanOptions { projectDir: string; configPath?: string }

/**
 * AD-5: this is the single sanctioned cross-package consumer of the pipeline
 * engine from cli/. AD-6: path resolution flows from import.meta.url and the
 * caller-supplied projectDir; process.cwd() is never consulted.
 */
export async function runApprovePlan(opts: ApprovePlanOptions): Promise<PipelineResult> {
  const dir = opts.projectDir;
  if (!dir) throw new UserError('--project-dir is required');
  const state = readState(dir);
  if (!state) throw new UserError(`No state.json at ${dir}`);
  const docPath = autoResolveMasterPlanDocPath(state);
  const ctx = docPath ? { doc_path: docPath } : {};
  // Mirror `pipeline signal`: walk under the live orchestration.yml so gates
  // (e.g. gate-mode) resolve against the operator's config, not DEFAULT_CONFIG.
  const configPath = opts.configPath ?? resolveDiscoveredConfigPath();
  const result = processEvent('plan_approved', dir, ctx, makeIO(), resolvePathContext(), configPath);
  return result;
}

interface Flags { 'project-dir'?: string; config?: string }

export const approvePlanCommand = defineCommand({
  name: 'approve-plan',
  description: 'Approve the project Master Plan',
  args: {},
  flags: {
    'project-dir': { description: 'absolute path to the project directory', type: 'string' as const },
    config: { description: 'Override path to orchestration.yml; default ~/.radorc/orchestration.yml', type: 'string' as const },
  },
  handler: async ({ flags }: { flags: Flags; ctx: CommandContext }) => {
    const dir = flags['project-dir'];
    if (!dir) throw new UserError('--project-dir is required');
    const result = await runApprovePlan({ projectDir: dir, configPath: flags['config'] });
    return result;
  },
  mapResult: (r: PipelineResult) => r.error
    ? { ok: false as const, error: { type: 'user_error' as const, message: r.error.message } }
    : { ok: true as const, data: r, exit_code: 0 },
});

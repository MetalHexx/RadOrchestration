import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService, GraphValidationError } from '@rad-orchestration/work-graph';
import type { Edge } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GraphPruneOptions {
  root: string;
}

export interface GraphPruneResult {
  removed: Edge[];
  rev: number;
}

export function runGraphPrune({ root }: GraphPruneOptions): GraphPruneResult {
  try {
    return new WorkGraphService({ root }).prune();
  } catch (e) {
    if (e instanceof GraphValidationError) throw new UserError(e.message);
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

export const graphPruneCommand = defineCommand({
  name: 'graph-prune',
  description: 'Remove dangling edges from the work-graph',
  args: {},
  flags: {},
  handler: async ({ ctx: _ctx }: { args: Record<string, never>; flags: Record<string, never>; ctx: CommandContext }) => {
    return runGraphPrune({ root: userDataPaths().root });
  },
});

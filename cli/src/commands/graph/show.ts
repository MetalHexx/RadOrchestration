import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService, GraphValidationError } from '@rad-orchestration/work-graph';
import type { GraphDTO } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GraphShowOptions {
  root: string;
  rootId?: string;
  depth?: number;
}

export interface GraphShowResult {
  data: GraphDTO;
}

export function runGraphShow({ root, rootId, depth }: GraphShowOptions): GraphShowResult {
  try {
    const svc = new WorkGraphService({ root });
    return { data: svc.getGraph({ rootId, depth }) };
  } catch (e) {
    if (e instanceof GraphValidationError) throw new UserError(e.message);
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

interface ShowFlags { root?: string; depth?: string }

export const graphShowCommand = defineCommand({
  name: 'graph-show',
  description: 'Show the work-graph projection',
  args: {},
  flags: {
    root: { description: 'Scope by root node id', type: 'string' as const },
    depth: { description: 'Traversal depth when scoping by root', type: 'string' as const },
  },
  handler: async ({ flags, ctx: _ctx }: { args: Record<string, never>; flags: ShowFlags; ctx: CommandContext }) => {
    const { root } = userDataPaths();
    const depth = flags.depth !== undefined ? parseInt(flags.depth, 10) : undefined;
    return runGraphShow({ root, rootId: flags.root, depth });
  },
});

import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
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

/**
 * Parse the raw `--depth` flag into a non-negative integer.
 *
 * FR-10/DD-4: a non-numeric or negative `--depth` previously coerced to `NaN`
 * and silently degraded to an unbounded traversal. Reject it with a clean
 * UserError instead so the user learns their input was ignored.
 */
export function parseDepth(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw.trim())) {
    throw new UserError('--depth must be a non-negative number');
  }
  return Number(raw.trim());
}

export function runGraphShow({ root, rootId, depth }: GraphShowOptions): GraphShowResult {
  try {
    const svc = new WorkGraphService({ root });
    return { data: svc.getGraph({ rootId, depth }) };
  } catch (e) {
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
    const depth = parseDepth(flags.depth);
    return runGraphShow({ root, rootId: flags.root, depth });
  },
});

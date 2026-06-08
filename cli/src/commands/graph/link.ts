import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { WorkGraphService, GraphValidationError } from '@rad-orchestration/work-graph';
import type { Edge } from '@rad-orchestration/work-graph';
import type { CommandContext } from '../../framework/context.js';

export interface GraphLinkOptions {
  root: string;
  from: string;
  to: string;
  type: string;
}

export interface GraphLinkResult {
  edge: Edge;
  rev: number;
}

export interface GraphUnlinkOptions {
  root: string;
  from: string;
  to: string;
  type: string;
}

export interface GraphUnlinkResult {
  rev: number;
}

export function runGraphLink({ root, from, to, type }: GraphLinkOptions): GraphLinkResult {
  try {
    return new WorkGraphService({ root }).link(from, to, type);
  } catch (e) {
    if (e instanceof GraphValidationError) throw new UserError(e.message);
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

export function runGraphUnlink({ root, from, to, type }: GraphUnlinkOptions): GraphUnlinkResult {
  try {
    return new WorkGraphService({ root }).unlink(from, to, type);
  } catch (e) {
    if (e instanceof GraphValidationError) throw new UserError(e.message);
    throw new UserError(e instanceof Error ? e.message : String(e));
  }
}

interface Args { from?: string; to?: string }
interface Flags { type?: string }

export const graphLinkCommand = defineCommand({
  name: 'graph-link',
  description: 'Add a relationship edge between two nodes',
  args: {
    from: { description: 'Source node id (project id or group id)', required: true },
    to: { description: 'Target node id (project id or group id)', required: true },
  },
  flags: {
    type: { description: 'Edge type. Known: spawned-from (side missions), follows (iteration series). Unknown types are accepted and rendered generically.', type: 'string' as const },
  },
  handler: async ({ args, flags, ctx }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.from || !args.to || !flags.type) throw new UserError('--from, --to, and --type are required');
    const out = runGraphLink({ root: userDataPaths().root, from: args.from, to: args.to, type: flags.type });
    if (!ctx.ux.json) ctx.stderr.write(`linked ${out.edge.from} -[${out.edge.type}]-> ${out.edge.to} (rev ${out.rev})\n`);
    return out;
  },
});

export const graphUnlinkCommand = defineCommand({
  name: 'graph-unlink',
  description: 'Remove a relationship edge between two nodes',
  args: {
    from: { description: 'Source node id (project id or group id)', required: true },
    to: { description: 'Target node id (project id or group id)', required: true },
  },
  flags: {
    type: { description: 'Edge type to remove. Known: spawned-from (side missions), follows (iteration series). Unknown types are accepted.', type: 'string' as const },
  },
  handler: async ({ args, flags, ctx: _ctx }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.from || !args.to || !flags.type) throw new UserError('--from, --to, and --type are required');
    return runGraphUnlink({ root: userDataPaths().root, from: args.from, to: args.to, type: flags.type });
  },
});

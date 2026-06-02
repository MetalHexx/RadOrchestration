import { defineCommand } from '../../framework/command.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, resolveRepoPath } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

export interface RepoListOptions {
  root: string;
}

export interface RepoListEntry {
  name: string;
  remote: string;
  default_branch: string;
  description: string;
  bound: boolean;
  path: string | null;
  hint: string | null;
}

export interface RepoListResult {
  repos: RepoListEntry[];
}

export function repoList({ root }: RepoListOptions): RepoListResult {
  const reg = readRegistry({ root });
  const repos: RepoListEntry[] = Object.entries(reg.repos).map(([name, identity]) => {
    const resolved = resolveRepoPath(reg, name);
    return {
      name,
      remote: identity.remote,
      default_branch: identity.default_branch,
      description: identity.description,
      bound: resolved.bound,
      path: resolved.path,
      hint: resolved.hint,
    };
  });
  return { repos };
}

export const repoListCommand = defineCommand({
  name: 'repo-list',
  description: 'List all registered repos with their bound/unbound state',
  args: {},
  flags: {},
  handler: async ({ ctx: _ctx }: { args: Record<string, never>; flags: Record<string, never>; ctx: CommandContext }) => {
    const root = userDataPaths().root;
    return repoList({ root });
  },
});

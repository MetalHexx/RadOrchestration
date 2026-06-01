import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { readRegistry, writeLocal } from '../../../../lib/repo-registry/src/index.js';
import { type Exec, isInsideWorkTree, getMainWorktreePath, getRemotes, samePath } from '../../lib/repo-identity.js';
import type { CommandContext } from '../../framework/context.js';

export interface RepoBindOptions {
  root: string;
  name: string;
  repoPath: string;
  exec?: Exec;
}

export interface RepoBindResult {
  name: string;
  repoPath: string;
  /** Present when the bound path differs from the one supplied (worktree resolved). */
  resolvedFrom?: string;
  /** Non-fatal advisories (not a git tree, remote mismatch, worktree resolution). */
  warnings: string[];
}

function makeDefaultExec(cwd: string): Exec {
  return (file: string, args: string[]): string =>
    execFileSync(file, args, { encoding: 'utf8', cwd }) as unknown as string;
}

/**
 * Anchor an already-registered repo to a local clone path on this machine.
 * Like `repo add`, it prefers the durable main clone: when the path is a linked
 * worktree it binds the main clone instead. Git checks here are advisory
 * (warnings, never fatal) so binding a teammate's clone stays frictionless.
 */
export function repoBind({ root, name, repoPath, exec }: RepoBindOptions): RepoBindResult {
  // Hard requirements: the path exists and the name is registered.
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new UserError(`path is not a directory: ${repoPath}`);
  }
  const reg = readRegistry({ root });
  if (!(name in reg.repos)) {
    throw new UserError(`repo '${name}' is not registered in the repo registry`);
  }

  const warnings: string[] = [];
  let boundPath = repoPath;
  const actualExec = exec ?? makeDefaultExec(repoPath);

  if (isInsideWorkTree(actualExec)) {
    // Anchor the durable main clone, not a transient linked worktree.
    const mainWorktree = getMainWorktreePath(actualExec);
    if (mainWorktree && !samePath(mainWorktree, repoPath)) {
      boundPath = mainWorktree;
      warnings.push(`resolved worktree to its main clone: ${mainWorktree}`);
    }
    // Warn (don't fail) when the directory's remote doesn't match the identity.
    const remotes = getRemotes(actualExec);
    const registeredRemote = reg.repos[name].remote;
    if (remotes.size > 0 && ![...remotes.values()].includes(registeredRemote)) {
      warnings.push(`path remote does not match '${name}' identity (${registeredRemote})`);
    }
  } else {
    warnings.push('path is not a git working tree');
  }

  reg.localPaths[name] = boundPath;
  writeLocal({ root, localPaths: reg.localPaths });

  const result: RepoBindResult = { name, repoPath: boundPath, warnings };
  if (!samePath(boundPath, repoPath)) result.resolvedFrom = repoPath;
  return result;
}

interface Args { name?: string; path?: string }

export const repoBindCommand = defineCommand({
  name: 'repo-bind',
  description: 'Bind a registered repo name to a local directory path',
  args: {
    name: { description: 'Registered repo name to bind', required: true },
    path: { description: 'Absolute path to the local directory for this repo (a worktree is resolved to its main clone)', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const name = args.name;
    const repoPath = args.path;
    if (!name) throw new UserError('--name is required');
    if (!repoPath) throw new UserError('--path is required');
    const root = userDataPaths().root;
    return repoBind({ root, name, repoPath });
  },
});

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { userDataPaths } from '../../lib/paths.js';
import { addRepo } from '../../../../lib/repo-registry/src/index.js';
import type { CommandContext } from '../../framework/context.js';

type Exec = (file: string, args: string[]) => string;

export interface RepoAddOptions {
  root: string;
  repoPath: string;
  exec?: Exec;
}

export interface RepoAddResult {
  name: string;
  remote: string;
  default_branch: string;
}

function makeDefaultExec(cwd: string): Exec {
  return (file: string, args: string[]): string =>
    execFileSync(file, args, { encoding: 'utf8', cwd }) as unknown as string;
}

function slugify(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRemote(raw: string): string {
  // Strip trailing .git
  let r = raw.trim().replace(/\.git$/, '');
  // Convert git@github.com:org/repo → https://github.com/org/repo
  const sshMatch = r.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    r = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return r;
}

export function repoAdd({ root, repoPath, exec }: RepoAddOptions): RepoAddResult {
  const actualExec = exec ?? makeDefaultExec(repoPath);
  // Confirm the path is a git repository
  try {
    actualExec('git', ['rev-parse', '--git-dir']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new UserError(`path is not a git repository: ${msg}`);
  }

  // Read remotes
  let remotesOutput: string;
  try {
    remotesOutput = actualExec('git', ['remote', '-v']);
  } catch {
    remotesOutput = '';
  }

  // Parse remotes: extract unique remote names and their fetch URLs
  const fetchLines = remotesOutput
    .split('\n')
    .filter(l => l.includes('(fetch)'));

  const remoteMap = new Map<string, string>();
  for (const line of fetchLines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const urlWithTag = parts[1].trim();
    const url = urlWithTag.replace(/\s*\(fetch\)\s*$/, '').trim();
    remoteMap.set(name, url);
  }

  if (remoteMap.size === 0) {
    throw new UserError('no remote configured for this repository');
  }

  let chosenRemoteUrl: string;
  if (remoteMap.size === 1) {
    chosenRemoteUrl = remoteMap.values().next().value as string;
  } else if (remoteMap.has('origin')) {
    chosenRemoteUrl = remoteMap.get('origin') as string;
  } else {
    throw new UserError('more than one remote found and none is named "origin" — cannot infer remote');
  }

  const normalizedRemote = normalizeRemote(chosenRemoteUrl);

  // Derive default branch
  let defaultBranch = 'main';
  try {
    const symref = actualExec('git', ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const match = symref.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (match) defaultBranch = match[1];
  } catch {
    // fall back to 'main'
  }

  // Infer name from the last path segment of repoPath
  const lastSegment = path.basename(repoPath);
  const name = slugify(lastSegment);

  // Write to registry (addRepo handles uniqueness check and file writes)
  try {
    addRepo({ root, name, identity: { remote: normalizedRemote, default_branch: defaultBranch, description: '' }, localPath: repoPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Map library errors to UserError
    throw new UserError(msg);
  }

  return { name, remote: normalizedRemote, default_branch: defaultBranch };
}

interface Args { path?: string }

export const repoAddCommand = defineCommand({
  name: 'repo-add',
  description: 'Register a local git repository in the repo registry, inferring identity from the git directory',
  args: {
    path: { description: 'Absolute path to the local git repository to register', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const repoPath = args.path;
    if (!repoPath) throw new UserError('--path is required');
    const root = userDataPaths().root;
    return repoAdd({ root, repoPath });
  },
});

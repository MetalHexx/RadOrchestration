import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import { userDataPaths } from '../../lib/paths.js';
import { ensureGitignored as defaultEnsure } from '@rad-orchestration/repo-registry';

export type SideProjectInitErrorType = 'init_failed' | 'commit_failed' | 'missing_args' | null;
export interface SideProjectInitResult {
  created: boolean; repoPath: string | null; branch: string;
  seedCommitMessage: string; error: string | null; errorType: SideProjectInitErrorType;
}
type Exec = (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => string;
export interface SideProjectInitOptions {
  project: string; root: string; exec?: Exec;
  ensureGitignored?: (a: { root: string; entry: string }) => void;
  mkdirp?: (dir: string) => void;
}
const SEED_MESSAGE = 'chore: initialize side-project';

export function sideProjectInit(opts: SideProjectInitOptions): SideProjectInitResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, { ...o, stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as string);
  const ensure = opts.ensureGitignored ?? defaultEnsure;
  const mkdirp = opts.mkdirp ?? ((dir: string) => fs.mkdirSync(dir, { recursive: true }));
  const repoPath = path.join(opts.root, 'side-projects', opts.project);
  try {
    mkdirp(repoPath);
    exec('git', ['init', '-b', 'main'], { cwd: repoPath, encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    return { created: false, repoPath: path.resolve(repoPath), branch: 'main', seedCommitMessage: SEED_MESSAGE,
      error: (err.stderr || err.message || '').trim(), errorType: 'init_failed' };
  }
  try {
    exec('git', ['commit', '-m', SEED_MESSAGE, '--allow-empty'], { cwd: repoPath, encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    return { created: false, repoPath: path.resolve(repoPath), branch: 'main', seedCommitMessage: SEED_MESSAGE,
      error: (err.stderr || err.message || '').trim(), errorType: 'commit_failed' };
  }
  ensure({ root: opts.root, entry: 'side-projects/' });
  return { created: true, repoPath: path.resolve(repoPath), branch: 'main', seedCommitMessage: SEED_MESSAGE, error: null, errorType: null };
}

interface Args { project?: string }
export const sideProjectInitCommand = defineCommand({
  name: 'side-project-init',
  description: 'Provision a local-only side-project git repo (git init + seed commit) under ~/.radorc/side-projects and return its path',
  args: { project: { description: 'Project name; resolves the repo at ~/.radorc/side-projects/<project>/', required: true } },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const project = args.project;
    if (!project) throw new UserError('--project is required');
    return sideProjectInit({ project, root: userDataPaths().root });
  },
  mapResult: (r: SideProjectInitResult) => {
    if (!r.created) {
      return { ok: false, error: { type: 'user_error' as const, message: r.error ?? 'side-project init failed', errorType: r.errorType, repoPath: r.repoPath }, exit_code: 2 };
    }
    return { ok: true, data: r, exit_code: 0 };
  },
});

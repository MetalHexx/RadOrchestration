import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';

export type WorktreeCreateErrorType =
  | 'already_exists_path' | 'already_exists_branch' | 'invalid_reference' | 'missing_args' | 'unknown' | null;

export interface WorktreeCreateResult {
  created: boolean;
  worktreePath: string | null;
  branch: string | null;
  baseBranch: string | null;
  pushed: boolean;
  remoteUrl: string;
  compareUrl: string;
  error: string | null;
  errorType: WorktreeCreateErrorType;
}

type Exec = (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => string;

export interface WorktreeCreateOptions {
  repoRoot: string; branch: string; worktreePath: string; baseBranch: string; exec?: Exec;
}

function deriveRemoteUrl(raw: string): string {
  if (!raw) return '';
  const ssh = raw.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}`;
  if (raw.startsWith('https://')) return raw.replace(/\.git$/, '');
  return '';
}

function classify(stderr: string): WorktreeCreateErrorType {
  const m = (stderr || '').toLowerCase();
  if (m.includes('already exists') && m.includes('branch')) return 'already_exists_branch';
  if (m.includes('already exists')) return 'already_exists_path';
  if (m.includes('invalid reference') || m.includes('not a valid')) return 'invalid_reference';
  return 'unknown';
}

export function worktreeCreate(opts: WorktreeCreateOptions): WorktreeCreateResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, o) as unknown as string);
  try {
    exec('git', ['worktree', 'add', '-b', opts.branch, opts.worktreePath, opts.baseBranch],
      { cwd: opts.repoRoot, encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const stderr = (err.stderr || err.message || '').trim();
    return {
      created: false, worktreePath: opts.worktreePath, branch: opts.branch, baseBranch: opts.baseBranch,
      pushed: false, remoteUrl: '', compareUrl: '', error: stderr, errorType: classify(stderr),
    };
  }

  let pushed = false;
  try {
    exec('git', ['push', '-u', 'origin', opts.branch], { cwd: opts.worktreePath, encoding: 'utf8' });
    pushed = true;
  } catch { /* non-blocking */ }

  let raw = '';
  try { raw = String(exec('git', ['remote', 'get-url', 'origin'], { cwd: opts.worktreePath, encoding: 'utf8' })).trim(); }
  catch { /* none */ }
  const remoteUrl = deriveRemoteUrl(raw);
  const baseShort = opts.baseBranch.replace(/^origin\//, '');
  const compareUrl = remoteUrl ? `${remoteUrl}/compare/${baseShort}...${opts.branch}` : '';

  return {
    created: true, worktreePath: path.resolve(opts.worktreePath), branch: opts.branch, baseBranch: opts.baseBranch,
    pushed, remoteUrl, compareUrl, error: null, errorType: null,
  };
}

interface Args { 'repo-root'?: string; branch?: string; 'worktree-path'?: string; 'base-branch'?: string }

export const worktreeCreateCommand = defineCommand({
  name: 'worktree-create',
  description: 'Create a worktree at the given path on a new branch from base',
  args: {
    'repo-root': { description: 'Absolute path to the repository root from which the worktree is added', required: true },
    branch: { description: 'New branch name to create with the worktree', required: true },
    'worktree-path': { description: 'Absolute target path for the new worktree directory', required: true },
    'base-branch': { description: 'Existing ref to branch from (e.g. main, origin/main, or a commit SHA)', required: true },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const root = args['repo-root']; const br = args.branch;
    const wt = args['worktree-path']; const base = args['base-branch'];
    if (!root || !br || !wt || !base) {
      throw new UserError('--repo-root, --branch, --worktree-path, and --base-branch are all required');
    }
    return worktreeCreate({ repoRoot: root, branch: br, worktreePath: wt, baseBranch: base });
  },
  mapResult: (r: WorktreeCreateResult) => {
    if (!r.created) {
      // Framework invariant: failure envelopes must not carry `data` (data XOR error).
      // We lift the classifier's `errorType` plus enough structured context onto the
      // `error` object so programmatic callers can still discriminate the failure
      // mode (already_exists_path, already_exists_branch, invalid_reference, unknown)
      // and identify which worktree/branch the failure refers to.
      const error = {
        type: 'user_error' as const,
        message: r.error ?? 'worktree creation failed',
        errorType: r.errorType,
        worktreePath: r.worktreePath,
        branch: r.branch,
        baseBranch: r.baseBranch,
      };
      return { ok: false, error, exit_code: 2 } as { ok: false; error: { type: 'user_error'; message: string }; exit_code: number };
    }
    return { ok: true, data: r, exit_code: r.pushed ? 0 : 1 };
  },
});

import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';

export interface GitCommitResult {
  committed: boolean;
  pushed: boolean;
  commitHash: string | null;
  upstreamConfigured: boolean;
  error: string | null;
  errorType: 'nothing_to_commit' | 'commit_failed' | 'push_failed' | null;
}

type Exec = (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => string;

export interface GitCommitOptions { worktreePath: string; message: string; exec?: Exec }

export function gitCommit(opts: GitCommitOptions): GitCommitResult {
  const exec = opts.exec ?? ((file, args, o) => execFileSync(file, args, o) as unknown as string);
  let commitHash: string | null = null;
  try {
    exec('git', ['add', '-A'], { cwd: opts.worktreePath, encoding: 'utf8' });
    exec('git', ['commit', '-m', opts.message], { cwd: opts.worktreePath, encoding: 'utf8' });
    commitHash = String(exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: opts.worktreePath, encoding: 'utf8' })).trim();
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message: string };
    const text = (err.stderr || err.stdout || err.message || '');
    const isNothing = text.includes('nothing to commit')
      || (err.stdout && err.stdout.includes('nothing to commit'))
      || err.message.includes('nothing to commit');
    return {
      committed: false, pushed: false, commitHash: null, upstreamConfigured: false,
      error: isNothing ? 'nothing to commit' : (text.trim() || err.message.trim()),
      errorType: isNothing ? 'nothing_to_commit' : 'commit_failed',
    };
  }
  let hasOrigin = true;
  try {
    exec('git', ['remote', 'get-url', 'origin'], { cwd: opts.worktreePath, encoding: 'utf8' });
  } catch {
    hasOrigin = false;
  }
  if (!hasOrigin) {
    return { committed: true, pushed: false, commitHash, upstreamConfigured: false, error: null, errorType: null };
  }
  try {
    exec('git', ['push'], { cwd: opts.worktreePath, encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const text = (err.stderr || err.message || '');
    if (text.includes('has no upstream branch') || text.includes('no upstream branch')) {
      try {
        const branch = String(exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: opts.worktreePath, encoding: 'utf8' })).trim();
        exec('git', ['push', '--set-upstream', 'origin', branch], { cwd: opts.worktreePath, encoding: 'utf8' });
        return { committed: true, pushed: true, commitHash, upstreamConfigured: true, error: null, errorType: null };
      } catch (retryErr) {
        const r = retryErr as { stderr?: string; message: string };
        const rt = (r.stderr || r.message || '');
        return {
          committed: true, pushed: false, commitHash, upstreamConfigured: false,
          error: rt.trim() || r.message.trim(), errorType: 'push_failed',
        };
      }
    }
    return {
      committed: true, pushed: false, commitHash, upstreamConfigured: false,
      error: text.trim() || err.message.trim(), errorType: 'push_failed',
    };
  }
  return { committed: true, pushed: true, commitHash, upstreamConfigured: false, error: null, errorType: null };
}

export interface CommitFanOutEntry { name: string; path: string; message: string; }
export interface CommitFanOutResult { name: string; committed: boolean; commitHash: string | null; pushed: boolean; }

export function gitCommitFanOut(opts: { repos: CommitFanOutEntry[]; exec?: Exec }): CommitFanOutResult[] {
  return opts.repos.map((r) => {
    const res = gitCommit({ worktreePath: r.path, message: r.message, exec: opts.exec });
    if (res.errorType === 'nothing_to_commit') return { name: r.name, committed: false, commitHash: null, pushed: false };
    if (res.errorType === 'commit_failed') throw new UserError(`Commit failed in repo "${r.name}": ${res.error}`);
    return { name: r.name, committed: res.committed, commitHash: res.commitHash, pushed: res.pushed };
  });
}

interface Args { 'worktree-path'?: string; message?: string }
interface Flags { repos?: string }

export const gitCommitCommand = defineCommand({
  name: 'git-commit',
  description: 'Commit changes in the worktree and push to origin when a remote is configured',
  args: {
    'worktree-path': { description: 'Absolute path to the worktree to commit from', required: false },
    message: { description: 'Commit message body (used as the -m argument to git commit)', required: false },
  },
  flags: {
    repos: { description: 'JSON array of {name, path, message} objects for fan-out commits', type: 'string' },
  },
  handler: async ({ args, flags }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    const reposJson = flags.repos;
    if (reposJson) {
      let repos: CommitFanOutEntry[];
      try {
        repos = JSON.parse(reposJson) as CommitFanOutEntry[];
      } catch {
        throw new UserError('--repos must be a valid JSON array of {name, path, message} objects');
      }
      return gitCommitFanOut({ repos });
    }
    const wt = args['worktree-path'];
    const msg = args.message;
    if (!wt || !msg) throw new UserError('--worktree-path and --message are both required');
    return gitCommit({ worktreePath: wt, message: msg });
  },
});

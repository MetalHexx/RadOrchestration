import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import type { CommandContext } from '../../framework/context.js';

export interface GhPrResult {
  pr_created: boolean;
  pr_url: string | null;
  pr_number: number | null;
  pr_existed: boolean;
  error: 'gh_not_found' | 'auth_failed' | 'no_remote' | 'creation_failed' | 'precondition_failure' | null;
  message: string;
}

type Exec = (file: string, args: string[], opts: { cwd?: string; encoding: 'utf8' }) => string;

export interface GhPrOptions {
  worktreePath: string;
  branch: string;
  baseBranch: string;
  title: string;
  bodyFile?: string;
  exec?: Exec;
}

export function ghPr(opts: GhPrOptions): GhPrResult {
  const exec = opts.exec ?? ((file, args, o) => execFileSync(file, args, o) as unknown as string);
  if (!opts.worktreePath || !opts.branch || !opts.baseBranch || !opts.title) {
    return {
      pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
      error: 'precondition_failure',
      message: 'Missing required argument: --worktree-path, --branch, --base-branch, and --title are all required',
    };
  }
  try {
    exec('gh', ['auth', 'status'], { encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message: string };
    const text = (err.stderr || err.stdout || err.message || '');
    const isNotFound = text.includes('ENOENT') || text.includes('not found') || text.includes('not recognized');
    return {
      pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
      error: isNotFound ? 'gh_not_found' : 'auth_failed',
      message: text.trim() || err.message.trim(),
    };
  }
  let remote = '';
  try {
    remote = String(exec('git', ['remote'], { cwd: opts.worktreePath, encoding: 'utf8' })).trim();
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    return {
      pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
      error: 'no_remote',
      message: (err.stderr || err.message || 'Failed to detect git remote').trim(),
    };
  }
  if (!remote) {
    return {
      pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
      error: 'no_remote', message: 'No git remote configured',
    };
  }
  try {
    const list = String(exec('gh', [
      'pr', 'list', '--head', opts.branch, '--base', opts.baseBranch,
      '--json', 'url,number', '--limit', '1',
    ], { cwd: opts.worktreePath, encoding: 'utf8' })).trim();
    const parsed = JSON.parse(list) as Array<{ url: string; number: number }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        pr_created: false, pr_url: parsed[0].url, pr_number: parsed[0].number,
        pr_existed: true, error: null, message: 'Existing PR found',
      };
    }
  } catch {
    // gh pr list non-fatal; fall through to create.
  }
  try {
    const args = ['pr', 'create', '--head', opts.branch, '--base', opts.baseBranch, '--title', opts.title];
    if (opts.bodyFile) args.push('--body-file', opts.bodyFile);
    const url = String(exec('gh', args, { cwd: opts.worktreePath, encoding: 'utf8' })).trim();
    const segs = url.split('/');
    const n = parseInt(segs[segs.length - 1], 10);
    return {
      pr_created: true, pr_url: url, pr_number: Number.isNaN(n) ? null : n,
      pr_existed: false, error: null, message: 'PR created successfully',
    };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message: string };
    const text = (err.stderr || err.stdout || err.message || '');
    return {
      pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
      error: 'creation_failed',
      message: text.trim() || err.message.trim(),
    };
  }
}

interface Args {
  'worktree-path'?: string;
  branch?: string;
  'base-branch'?: string;
  title?: string;
  'body-file'?: string;
}

export const gitPrCommand = defineCommand({
  name: 'git-pr',
  description: 'Open a GitHub pull request for the worktree branch',
  args: {
    'worktree-path': { description: 'Absolute path to the worktree containing the branch', required: true },
    branch: { description: 'Head branch name to open the PR from', required: true },
    'base-branch': { description: 'Base branch name to target (typically main)', required: true },
    title: { description: 'PR title — typically the project name', required: true },
    'body-file': { description: 'Optional absolute path to a markdown file used as the PR description; omitted means the PR opens with no body' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    // runCommand throws UserError for missing required args before reaching this
    // handler, so the `?? ''` fallbacks below are type-checker satisfaction only.
    // The `precondition_failure` gate inside ghPr() remains for direct programmatic
    // callers (unit tests exercise it by passing empty strings).
    return ghPr({
      worktreePath: args['worktree-path'] ?? '',
      branch: args.branch ?? '',
      baseBranch: args['base-branch'] ?? '',
      title: args.title ?? '',
      bodyFile: args['body-file'],
    });
  },
});

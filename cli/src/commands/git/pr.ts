import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

export interface FanOutRepo {
  name: string;
  path: string;
  branch: string;
  baseBranch: string;
  title: string;
  description: string;
}

export interface FanOutResult {
  name: string;
  pr_url: string;
}

export interface GhPrFanOutOptions {
  repos: FanOutRepo[];
  exec?: Exec;
}

export function ghPrFanOut(opts: GhPrFanOutOptions): FanOutResult[] {
  const exec = opts.exec ?? ((file, args, o) => execFileSync(file, args, o) as unknown as string);

  // Pass 1: create all PRs
  const created: Array<{ name: string; pr_url: string; pr_number: number | null }> = [];
  for (const repo of opts.repos) {
    // Write description to a temp body-file so ghPr can use it
    const bodyFile = join(tmpdir(), `rad-pr-body-${repo.name}-${Date.now()}.md`);
    writeFileSync(bodyFile, repo.description, 'utf8');

    const result = ghPr({
      worktreePath: repo.path,
      branch: repo.branch,
      baseBranch: repo.baseBranch,
      title: repo.title,
      bodyFile,
      exec,
    });

    if (result.error !== null && !result.pr_existed) {
      throw new Error(`Failed to create PR for ${repo.name}: ${result.message}`);
    }

    created.push({
      name: repo.name,
      pr_url: result.pr_url ?? '',
      pr_number: result.pr_number,
    });
  }

  // Pass 2: cross-link siblings (only when more than one PR)
  if (created.length > 1) {
    for (let i = 0; i < created.length; i++) {
      const repo = opts.repos[i];
      const pr = created[i];
      const siblings = created.filter((_, j) => j !== i);
      const linkedSection = '\n\n## Linked PRs\n' + siblings.map(s => `- ${s.name}: ${s.pr_url}`).join('\n');
      const combinedBody = repo.description + linkedSection;

      const bodyFile = join(tmpdir(), `rad-pr-xlink-${repo.name}-${Date.now()}.md`);
      writeFileSync(bodyFile, combinedBody, 'utf8');

      if (pr.pr_number !== null) {
        exec('gh', ['pr', 'edit', String(pr.pr_number), '--body-file', bodyFile], {
          cwd: repo.path,
          encoding: 'utf8',
        });
      }
    }
  }

  return created.map(c => ({ name: c.name, pr_url: c.pr_url }));
}

interface Args {
  'worktree-path'?: string;
  branch?: string;
  'base-branch'?: string;
  title?: string;
  'body-file'?: string;
  repos?: string;
}

export const gitPrCommand = defineCommand({
  name: 'git-pr',
  description: 'Open a GitHub pull request for the worktree branch',
  args: {
    'worktree-path': { description: 'Absolute path to the worktree containing the branch', required: false },
    branch: { description: 'Head branch name to open the PR from', required: false },
    'base-branch': { description: 'Base branch name to target (typically main)', required: false },
    title: { description: 'PR title — typically the project name', required: false },
    'body-file': { description: 'Optional absolute path to a markdown file used as the PR description; omitted means the PR opens with no body' },
    repos: { description: 'JSON array of repos [{name, path, branch, baseBranch, title, description}] for multi-repo fan-out' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    // Fan-out mode: --repos '<json>'
    if (args.repos) {
      const repoList = JSON.parse(args.repos) as FanOutRepo[];
      return ghPrFanOut({ repos: repoList });
    }
    // Single-repo mode (original behaviour)
    // runCommand throws UserError for missing required args before reaching this
    // handler, so the `?? ''` fallbacks below are type-checker satisfaction only.
    // The `precondition_failure` gate inside ghPr() remains for direct programmatic
    // callers (unit tests exercise it by passing empty strings).
    if (!args['worktree-path'] || !args.branch || !args['base-branch'] || !args.title) {
      return {
        pr_created: false, pr_url: null, pr_number: null, pr_existed: false,
        error: 'precondition_failure',
        message: 'Missing required argument: --worktree-path, --branch, --base-branch, and --title are all required',
      };
    }
    return ghPr({
      worktreePath: args['worktree-path'] ?? '',
      branch: args.branch ?? '',
      baseBranch: args['base-branch'] ?? '',
      title: args.title ?? '',
      bodyFile: args['body-file'],
    });
  },
});

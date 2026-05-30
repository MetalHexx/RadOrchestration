import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { vi } from 'vitest';
import { repoAdd } from '../../../src/commands/repo/add.js';

let root: string;
let tempRepos: string[] = [];
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'add-')); tempRepos = []; });
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  for (const d of tempRepos) fs.rmSync(d, { recursive: true, force: true });
});

function execOk(remote = 'https://github.com/o/web-app.git') {
  return vi.fn((file: string, args: string[]) => {
    if (args[0] === 'rev-parse') return '.git';
    if (args.includes('remote') && args.includes('-v')) return `origin\t${remote} (fetch)\norigin\t${remote} (push)`;
    if (args[0] === 'symbolic-ref') return 'refs/remotes/origin/main';
    return '';
  });
}

describe('repo add', () => {
  it('registers an inferred slug name, remote, and default branch', () => {
    const r = repoAdd({ root, repoPath: '/src/web-app', exec: execOk() });
    expect(r.name).toBe('web-app');
    expect(r.remote).toBe('https://github.com/o/web-app');
    expect(r.default_branch).toBe('main');
  });
  it('fails when path is not a git repository', () => {
    const exec = vi.fn((_f: string, a: string[]) => { if (a[0] === 'rev-parse') throw new Error('not a git repository'); return ''; });
    expect(() => repoAdd({ root, repoPath: '/x', exec })).toThrow(/not a git repository/i);
  });
  it('fails when there is no remote', () => {
    const exec = execOk(); const e = vi.fn((f: string, a: string[]) => a.includes('-v') ? '' : (exec as any)(f, a));
    expect(() => repoAdd({ root, repoPath: '/src/x', exec: e })).toThrow(/no remote/i);
  });
  it('fails when multiple remotes and none is origin', () => {
    const e = vi.fn((_f: string, a: string[]) => {
      if (a[0] === 'rev-parse') return '.git';
      if (a.includes('-v')) return 'upstream\tg (fetch)\nfork\th (fetch)';
      return '';
    });
    expect(() => repoAdd({ root, repoPath: '/src/x', exec: e })).toThrow(/more than one remote/i);
  });
  it('fails when the inferred name already exists', () => {
    repoAdd({ root, repoPath: '/src/web-app', exec: execOk() });
    expect(() => repoAdd({ root, repoPath: '/other/web-app', exec: execOk() })).toThrow(/already exists/i);
  });
  it('uses the default branch from a sole remote named something other than origin', () => {
    const exec = vi.fn((_file: string, args: string[]) => {
      if (args[0] === 'rev-parse') return '.git';
      if (args.includes('remote') && args.includes('-v'))
        return 'upstream\thttps://github.com/o/lib.git (fetch)\nupstream\thttps://github.com/o/lib.git (push)';
      if (args[0] === 'symbolic-ref' && args[1] === 'refs/remotes/upstream/HEAD')
        return 'refs/remotes/upstream/develop\n';
      return '';
    });
    const r = repoAdd({ root, repoPath: '/src/lib', exec });
    expect(r.remote).toBe('https://github.com/o/lib');
    expect(r.default_branch).toBe('develop');
  });
});

describe('repo add — cwd (FR-4)', () => {
  it('infers remote and default_branch from repoPath, not process.cwd()', () => {
    // Build a real git repo in a temp directory so defaultExec can shell out to git.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-cwd-'));
    tempRepos.push(tmp);

    // Init the repo with a known remote URL.
    // Use -b flag for the initial branch name (compatible across git versions).
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@test.com' };
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmp, encoding: 'utf8' });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/test/my-repo.git'], { cwd: tmp, encoding: 'utf8' });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: tmp, encoding: 'utf8', env: gitEnv });

    // Ensure the test's own cwd is NOT the temp repo so a cwd bug is observable.
    expect(process.cwd()).not.toBe(tmp);

    // Call repoAdd without injecting a mock exec — defaultExec must run inside repoPath.
    const result = repoAdd({ root, repoPath: tmp });

    // The remote must come from the temp repo, not process.cwd() (which has its own remote).
    expect(result.remote).toBe('https://github.com/test/my-repo');
    // Branch falls back to 'main' when symbolic-ref is absent — either value is valid;
    // what matters is that git ran inside the temp repo, not process.cwd().
    expect(result.default_branch).toBe('main');
  });
});

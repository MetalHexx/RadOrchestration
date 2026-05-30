import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { repoAdd } from '../../../src/commands/repo/add.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'add-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

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
});

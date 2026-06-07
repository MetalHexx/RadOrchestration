import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { sideProjectInit } from '../../../src/commands/side-project/init.js';

describe('sideProjectInit core', () => {
  it('git inits, seed-commits on main, ensures gitignore, returns the repo path', () => {
    const calls: string[][] = [];
    const exec = vi.fn((_f: string, args: string[]) => { calls.push(args); return ''; });
    const ensure = vi.fn();
    const mkdir = vi.fn();
    const r = sideProjectInit({
      project: 'MYTOOL', root: '/home/.radorc',
      exec, ensureGitignored: ensure, mkdirp: mkdir,
    });
    const expectedRepo = path.join('/home/.radorc', 'side-projects', 'MYTOOL');
    expect(r.created).toBe(true);
    expect(r.repoPath).toBe(path.resolve(expectedRepo));
    expect(r.errorType).toBeNull();
    expect(mkdir).toHaveBeenCalledWith(expectedRepo);
    expect(ensure).toHaveBeenCalledWith({ root: '/home/.radorc', entry: 'side-projects/' });
    const flat = calls.map(a => a.join(' '));
    expect(flat).toContain('init -b main');
    expect(flat.some(c => c === 'commit -m chore: initialize side-project' || c === 'commit -m chore: initialize side-project --allow-empty')).toBe(true);
  });
  it('returns created:false with errorType when git init fails', () => {
    const exec = vi.fn(() => { const e = new Error('fatal: cannot init') as Error & { stderr: string }; e.stderr = 'fatal: cannot init'; throw e; });
    const r = sideProjectInit({ project: 'X', root: '/r', exec, ensureGitignored: vi.fn(), mkdirp: vi.fn() });
    expect(r.created).toBe(false);
    expect(r.errorType).toBe('init_failed');
  });
});

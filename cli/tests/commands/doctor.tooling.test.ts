import { describe, it, expect, vi } from 'vitest';
import { runToolingChecks } from '../../src/commands/doctor/checks.js';

type SpawnResult = { status: number; stdout: string; stderr: string; error?: NodeJS.ErrnoException };

describe('runToolingChecks', () => {
  it('reports git pass with version when git is present', async () => {
    const exec = vi.fn<(file: string, args: string[]) => SpawnResult>()
      .mockImplementation((file) => file === 'git'
        ? { status: 0, stdout: 'git version 2.45.1\n', stderr: '' }
        : { status: 0, stdout: 'Logged in to github.com\n', stderr: '' });
    const r = await runToolingChecks({ exec });
    const git = r.find((c) => c.name === 'git');
    expect(git?.status).toBe('pass');
    expect(git?.detail).toMatch(/2\.45\.1/);
  });
  it('reports git fail with remediation hint when git is missing (ENOENT)', async () => {
    const exec = vi.fn<(file: string, args: string[]) => SpawnResult>()
      .mockImplementation((file) => file === 'git'
        ? { status: 1, stdout: '', stderr: '', error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) }
        : { status: 0, stdout: '', stderr: '' });
    const r = await runToolingChecks({ exec });
    const git = r.find((c) => c.name === 'git');
    expect(git?.status).toBe('fail');
    expect(git?.detail).toMatch(/install git/i);
  });
  it('reports gh pass only when both binary and auth status succeed', async () => {
    const exec = vi.fn<(file: string, args: string[]) => SpawnResult>()
      .mockImplementation(() => ({ status: 0, stdout: 'ok', stderr: '' }));
    const r = await runToolingChecks({ exec });
    const gh = r.find((c) => c.name === 'gh');
    expect(gh?.status).toBe('pass');
  });
  it('reports gh fail when auth status fails (binary present)', async () => {
    const exec = vi.fn<(file: string, args: string[]) => SpawnResult>()
      .mockImplementation((file, args) =>
        file === 'gh' && args[0] === 'auth'
          ? { status: 1, stdout: '', stderr: 'You are not logged into any GitHub hosts' }
          : { status: 0, stdout: 'gh version 2.40.0\n', stderr: '' });
    const r = await runToolingChecks({ exec });
    const gh = r.find((c) => c.name === 'gh');
    expect(gh?.status).toBe('fail');
    expect(gh?.detail).toMatch(/not logged in/i);
  });
  it('every result carries category="Tooling"', async () => {
    const exec = vi.fn<(file: string, args: string[]) => SpawnResult>()
      .mockImplementation(() => ({ status: 0, stdout: 'ok', stderr: '' }));
    const r = await runToolingChecks({ exec });
    for (const c of r) expect(c.category).toBe('Tooling');
  });
});

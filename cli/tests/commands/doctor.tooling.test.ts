import { describe, it, expect, vi } from 'vitest';
import { runToolingChecks } from '../../src/commands/doctor/checks.js';
import type { HarnessInstallReport } from '../../src/lib/cross-harness-scan.js';

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

function execStub(map: Record<string, { status: number; stdout?: string; stderr?: string; error?: NodeJS.ErrnoException }>) {
  return vi.fn((file: string, args: string[]) => {
    const key = `${file} ${args.join(' ')}`;
    if (key in map) return { stdout: '', stderr: '', ...map[key] } as SpawnResult;
    return { status: 0, stdout: '', stderr: '' };
  });
}

function reports(installed: Array<HarnessInstallReport['installKey']>): HarnessInstallReport[] {
  return [
    { installKey: 'claude', installed: installed.includes('claude') },
    { installKey: 'claude-plugin', installed: installed.includes('claude-plugin') },
    { installKey: 'copilot-cli', installed: installed.includes('copilot-cli') },
    { installKey: 'copilot-cli-plugin', installed: installed.includes('copilot-cli-plugin') },
    { installKey: 'copilot-vscode', installed: installed.includes('copilot-vscode') },
    { installKey: 'copilot-vscode-plugin', installed: installed.includes('copilot-vscode-plugin') },
  ];
}

describe('runToolingChecks — conditional agent checks', () => {
  it('omits all three agent checks when no relevant harness is registered', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports([]) });
    expect(out.find((c) => c.name === 'claude')).toBeUndefined();
    expect(out.find((c) => c.name === 'copilot')).toBeUndefined();
    expect(out.find((c) => c.name === 'code')).toBeUndefined();
  });

  it('runs claude check when claude or claude-plugin is registered; fails when CLI missing', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'claude --version': { status: 1, stdout: '', stderr: '', error: Object.assign(new Error('not found'), { code: 'ENOENT' }) as NodeJS.ErrnoException },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['claude-plugin']) });
    const claude = out.find((c) => c.name === 'claude');
    expect(claude?.status).toBe('fail');
    expect(claude?.detail).toMatch(/claude.*PATH/i);
  });

  it('runs copilot check when copilot-cli is registered; passes when present', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'copilot --version': { status: 0, stdout: 'copilot 1.0\n' },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['copilot-cli']) });
    expect(out.find((c) => c.name === 'copilot')?.status).toBe('pass');
  });

  it('runs code check when copilot-vscode is registered; passes when present', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'code --version': { status: 0, stdout: '1.95\n' },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['copilot-vscode']) });
    expect(out.find((c) => c.name === 'code')?.status).toBe('pass');
  });

  it('runs claude check when claude is registered; passes when CLI present', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'claude --version': { status: 0, stdout: 'claude 0.8.0\n' },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['claude']) });
    const claude = out.find((c) => c.name === 'claude');
    expect(claude?.status).toBe('pass');
    expect(claude?.detail).toMatch(/claude 0\.8\.0/);
  });

  it('runs copilot check when copilot-cli is registered; fails when CLI missing', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'copilot --version': { status: 1, stdout: '', stderr: '', error: Object.assign(new Error('not found'), { code: 'ENOENT' }) as NodeJS.ErrnoException },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['copilot-cli']) });
    const copilot = out.find((c) => c.name === 'copilot');
    expect(copilot?.status).toBe('fail');
    expect(copilot?.detail).toMatch(/copilot.*PATH/i);
  });

  it('runs code check when copilot-vscode is registered; fails when CLI missing', async () => {
    const exec = execStub({
      'git --version': { status: 0, stdout: 'git version 2.40\n' },
      'gh --version': { status: 0, stdout: 'gh 2.0\n' },
      'gh auth status': { status: 0 },
      'code --version': { status: 1, stdout: '', stderr: '', error: Object.assign(new Error('not found'), { code: 'ENOENT' }) as NodeJS.ErrnoException },
    });
    const out = await runToolingChecks({ exec, harnessReports: reports(['copilot-vscode']) });
    const code = out.find((c) => c.name === 'code');
    expect(code?.status).toBe('fail');
    expect(code?.detail).toMatch(/code.*PATH/i);
  });
});

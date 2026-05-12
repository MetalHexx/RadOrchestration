import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');

describe('radorch program wiring', () => {
  it('exposes install, doctor, harness, and where subcommands in --help', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const { stdout } = await execP('node', ['dist/cli/src/bin/radorch.js', '--help'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    expect(stdout).toMatch(/install/);
    expect(stdout).toMatch(/doctor/);
    expect(stdout).toMatch(/harness/);
    expect(stdout).toMatch(/where/);
    expect(stdout).toMatch(/Tip: use 'radorch where <name>'/);
  }, 30_000);
});

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-e2e-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

async function radorch(args: string[], home: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const r = await execP('node', ['dist/bin/radorch.js', ...args, '--non-interactive', '--json'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_HOME: home, RADORCH_NO_LOG: '1' },
    });
    return { stdout: r.stdout, stderr: r.stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 };
  }
}

describe('install → harness use → harness list → doctor', () => {
  it('completes the full chain against a temp RADORCH_HOME', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const home = path.join(tmp, 'rad');

    const r1 = await radorch(['install', '--default-harness', 'claude'], home);
    const env1 = JSON.parse(r1.stdout.trim());
    expect(env1.ok).toBe(true);
    expect(env1.data.active_harness).toBe('claude');

    const r2 = await radorch(['harness', 'use', 'copilot-cli'], home);
    const env2 = JSON.parse(r2.stdout.trim());
    expect(env2.ok).toBe(true);
    expect(env2.data.active).toBe('copilot-cli');
    expect(env2.data.no_change).toBe(false);

    const r3 = await radorch(['harness', 'list'], home);
    const env3 = JSON.parse(r3.stdout.trim());
    expect(env3.ok).toBe(true);
    const active = env3.data.harnesses.find((h: { name: string; active: boolean }) => h.active);
    expect(active.name).toBe('copilot-cli');

    const r4 = await radorch(['doctor'], home);
    const env4 = JSON.parse(r4.stdout.trim());
    expect(env4.ok).toBe(true);
    expect(env4.data.all_passed).toBe(true);
  });
});

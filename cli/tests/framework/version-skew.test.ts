import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..', '..');

let home: string;
beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-skew-')); });
afterEach(async () => { await fs.rm(home, { recursive: true, force: true }); });

async function radorch(args: string[], home: string, extraEnv: NodeJS.ProcessEnv = {}) {
  try {
    const r = await execP('node', ['dist/bin/radorch.js', ...args, '--non-interactive', '--json'], {
      cwd: cliRoot,
      env: { ...process.env, RADORCH_HOME: home, RADORCH_NO_LOG: '1', ...extraEnv },
    });
    return { stdout: r.stdout, stderr: r.stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 };
  }
}

describe('version skew', () => {
  it('refuses to operate when last_writer_version > local version', async () => {
    await execP('npx', ['tsc'], { cwd: cliRoot, shell: process.platform === 'win32' });
    await radorch(['install', '--default-harness', 'claude'], home);
    // Tamper install.json: bump last_writer_version far beyond CLI version
    const ijPath = path.join(home, 'install.json');
    const ij = JSON.parse(await fs.readFile(ijPath, 'utf8'));
    ij.last_writer_version = '999.0.0';
    await fs.writeFile(ijPath, JSON.stringify(ij, null, 2) + '\n');
    const r = await radorch(['doctor'], home);
    const env = JSON.parse(r.stdout.trim());
    expect(env.ok).toBe(false);
    expect(env.error.message).toMatch(/last written by radorch 999\.0\.0/);
  }, 60_000);

  it('does NOT block install (install creates install.json)', async () => {
    await execP('npx', ['tsc'], { cwd: cliRoot, shell: process.platform === 'win32' });
    const r = await radorch(['install', '--default-harness', 'claude'], home);
    const env = JSON.parse(r.stdout.trim());
    expect(env.ok).toBe(true);
  }, 60_000);
});

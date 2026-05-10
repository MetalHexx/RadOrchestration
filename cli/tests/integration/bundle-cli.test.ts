import { describe, it, expect, beforeAll } from 'vitest';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..', '..');

describe('cli bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-bundle-'));
    bundlePath = path.join(tmp, 'radorch.mjs');
    await execP('npm', ['run', 'bundle', '--', `--out=${bundlePath}`], { cwd: cliRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file ESM bundle under 6 MB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(6 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(100 * 1024);
  });

  it('runs --version from a tempdir with no sibling node_modules', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-iso-'));
    const copy = path.join(isolated, 'radorch.mjs');
    await fs.copyFile(bundlePath, copy);
    const r = await execP('node', [copy, '--version']);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('rejects --out= with an empty value', () => {
    const bundleScript = path.join(cliRoot, 'scripts', 'bundle.mjs');
    const result = spawnSync('node', [bundleScript, '--out='], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--out= requires a non-empty path');
  });
});

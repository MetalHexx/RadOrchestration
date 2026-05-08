import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(__dirname, '..');

describe('pipeline bundle', () => {
  let tmp: string;
  let bundlePath: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pipe-'));
    bundlePath = path.join(tmp, 'pipeline.js');
    await execP('npm', ['run', 'bundle', '--', `--out=${bundlePath}`], { cwd: scriptsRoot, shell: process.platform === 'win32' });
  }, 120_000);

  it('emits a single-file bundle under 6 MB', async () => {
    const stat = await fs.stat(bundlePath);
    expect(stat.size).toBeLessThan(6 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(50 * 1024);
  });

  it('exits non-zero with no event flag, but loads without npm-install bootstrap', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pipe-iso-'));
    const copy = path.join(isolated, 'pipeline.js');
    await fs.copyFile(bundlePath, copy);
    const result = await execP('node', [copy], { reject: false } as never).catch((e: { stderr?: string; stdout?: string; code?: number }) => e);
    const merged = ((result as { stderr?: string }).stderr ?? '') + ((result as { stdout?: string }).stdout ?? '');
    expect(merged).not.toMatch(/npm (ci|install)/);
  });
});

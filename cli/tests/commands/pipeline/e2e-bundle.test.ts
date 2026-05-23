import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const TEMPLATES_DIR = path.resolve(repoRoot, '..', 'runtime-config', 'templates');

describe('pipeline signal end-to-end via the built bundle', () => {
  it('emits a canonical envelope on stdout for `start`', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-e2e-'));
    fs.copyFileSync(path.join(TEMPLATES_DIR, 'medium.yml'), path.join(dir, 'template.yml'));
    const { stdout } = await execP('node', [
      'dist/cli/src/bin/radorch.js', 'pipeline', 'signal',
      '--event', 'start', '--project-dir', dir, '--template', 'medium',
    ], { cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' } });
    const env = JSON.parse(stdout);
    expect(env.ok).toBe(true);
    expect(Object.keys(env.data).sort()).toEqual(['action', 'context']);
  }, 60_000);
});

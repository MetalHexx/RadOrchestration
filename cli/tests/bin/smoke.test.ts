import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const execP = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

describe('binary smoke', () => {
  it('runs `radorch --help` and exits successfully', async () => {
    const { stdout, stderr } = await execP('node', ['dist/bin/radorch.js', '--help'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    // commander's --help writes to stdout via commander itself; envelope is not emitted on --help
    expect(stdout.length + stderr.length).toBeGreaterThan(0);
  }, 30_000);
});

import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');

describe('radorch project subcommands run through the compiled ESM binary', () => {
  it('`project context` exits 0 and returns a JSON envelope with a string orchRoot', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const { stdout } = await execP('node', ['dist/cli/src/bin/radorch.js', 'project', 'context'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const envelope = JSON.parse(stdout) as { ok: boolean; data?: { orchRoot?: unknown } };
    expect(envelope.ok).toBe(true);
    expect(typeof envelope.data?.orchRoot).toBe('string');
    expect((envelope.data!.orchRoot as string).length).toBeGreaterThan(0);
  }, 30_000);
});

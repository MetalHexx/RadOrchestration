/**
 * Tests for ui/lib/launch-claude-project.js
 *
 * Exercises the script via `node` with a stubbed `spawn` by swapping the
 * child_process module through NODE_OPTIONS --require. Keeps everything
 * in-process-safe by asserting against JSON stdout only. No real terminal
 * is opened during tests.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, 'launch-claude-project.js');

function runLauncher(args: string[], env: NodeJS.ProcessEnv = {}): { stdout: string; status: number | null } {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...env, LAUNCH_CLAUDE_PROJECT_DRY_RUN: '1' },
  });
  return { stdout: res.stdout, status: res.status };
}

// Missing args → JSON error + non-zero exit
{
  const { stdout, status } = runLauncher([]);
  const parsed = JSON.parse(stdout.trim());
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Missing required args/);
  assert.notEqual(status, 0);
  console.log('✓ missing args → JSON error + non-zero exit');
}

// Invalid permission mode → JSON error
{
  const { stdout, status } = runLauncher([
    '--workspace-root', 'C:/tmp',
    '--prompt', '/brainstorm FOO',
    '--permission-mode', 'nope',
  ]);
  const parsed = JSON.parse(stdout.trim());
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Invalid --permission-mode/);
  assert.notEqual(status, 0);
  console.log('✓ invalid permission mode → JSON error');
}

// Happy path (dry-run) → success JSON with platform + permissionMode
{
  const { stdout, status } = runLauncher([
    '--workspace-root', process.cwd(),
    '--prompt', '/brainstorm FOO',
  ]);
  const parsed = JSON.parse(stdout.trim());
  assert.equal(parsed.success, true);
  assert.equal(typeof parsed.platform, 'string');
  assert.equal(parsed.permissionMode, 'auto');
  assert.equal(status, 0);
  console.log('✓ dry-run happy path → success JSON (platform + permissionMode=auto)');
}

console.log('\nAll launch-claude-project tests passed');

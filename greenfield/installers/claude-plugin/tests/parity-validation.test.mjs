import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

// Operator-driven parity validation. Skipped in CI; the parity script is
// one-shot (AD-23) and retires after migration validation. Set
// RUN_PARITY=1 to drive it locally.
test('legacy plugin and new installer output match modulo intentional drops', { skip: process.env.RUN_PARITY !== '1' }, () => {
  const repoRoot = REPO_ROOT;
  // 1. Build today's legacy plugin via the existing script.
  execSync('npm run build:plugin', { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  const legacy = join(repoRoot, 'cli/dist/marketplaces/claude/plugins/rad-orchestration');
  assert.ok(fs.existsSync(legacy), 'legacy plugin payload present after build:plugin');
  // 2. Build the new installer (idempotent; cheap if output/ already in place).
  execSync('node greenfield/installers/claude-plugin/build-scripts/build.js', {
    cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32',
  });
  const fresh = join(repoRoot, 'greenfield/installers/claude-plugin/output');
  // 3. Diff via parity-check.js.
  const result = spawnSync(process.execPath, [
    'greenfield/installers/claude-plugin/build-scripts/parity-check.js',
    `--new=${fresh}`, `--legacy=${legacy}`,
  ], { cwd: repoRoot, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `parity-check FAIL:\n${result.stderr}`);
});

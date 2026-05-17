import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function makeCase(pluginVer, installedVer) {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'pr-'));
  fs.writeFileSync(join(pluginRoot, 'package.json'), JSON.stringify({ name: 'p', version: pluginVer }));
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rh-'));
  if (installedVer) {
    // Current install.json shape — unversioned, identified by presence of
    // the harnesses object (FR-18).
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'claude-plugin': { version: installedVer, channel: 'claude-plugin', installed_at: 'x', last_writer_version: installedVer } },
    }));
  }
  return { pluginRoot, radHome };
}

test('drift-check emits a single stdout line on mismatch (DD-14, FR-6)', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0');
  const result = spawnSync(process.execPath, [
    'greenfield/installers/claude-plugin/hooks/drift-check.mjs',
  ], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  assert.strictEqual(lines.length, 1, 'single drift line emitted');
  assert.match(lines[0], /1\.0\.0/);
  assert.match(lines[0], /1\.1\.0/);
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check is silent when versions match (FR-6)', () => {
  const { pluginRoot, radHome } = makeCase('1.0.0', '1.0.0');
  const result = spawnSync(process.execPath, [
    'greenfield/installers/claude-plugin/hooks/drift-check.mjs',
  ], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, '', 'no drift output on version match');
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

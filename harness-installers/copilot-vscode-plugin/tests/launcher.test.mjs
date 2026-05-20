import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const LAUNCHER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/launcher.cjs');

test('launcher resolves script via COPILOT_PLUGIN_ROOT when env var is set (FR-9, FR-10)', () => {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'lnch-env-'));
  const hooksDir = join(pluginRoot, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(join(hooksDir, 'echo.mjs'),
    `process.stdout.write('hook-ran:' + process.execPath); process.exit(0);\n`);
  try {
    const result = spawnSync(process.execPath, [LAUNCHER, 'echo.mjs'], {
      env: { ...process.env, COPILOT_PLUGIN_ROOT: pluginRoot },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /hook-ran:/);
  } finally { fs.rmSync(pluginRoot, { recursive: true, force: true }); }
});

test('launcher falls back to __dirname when COPILOT_PLUGIN_ROOT is absent (FR-10)', () => {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'lnch-dir-'));
  const hooksDir = join(pluginRoot, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  // Copy launcher into the synthetic plugin root so its __dirname resolves there.
  fs.copyFileSync(LAUNCHER, join(hooksDir, 'launcher.cjs'));
  fs.writeFileSync(join(hooksDir, 'echo.mjs'),
    `process.stdout.write('fallback-ok'); process.exit(0);\n`);
  try {
    const env = { ...process.env };
    delete env.COPILOT_PLUGIN_ROOT;
    const result = spawnSync(process.execPath, [join(hooksDir, 'launcher.cjs'), 'echo.mjs'], { env, encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /fallback-ok/);
  } finally { fs.rmSync(pluginRoot, { recursive: true, force: true }); }
});

test('launcher fails with a clear stderr line when no script is specified (FR-9)', () => {
  const result = spawnSync(process.execPath, [LAUNCHER], { encoding: 'utf8' });
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /no script specified/);
});

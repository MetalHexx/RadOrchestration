import { test } from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const hookDir = path.join(repoRoot, 'marketplace', 'plugins', 'rad-orchestration', 'hooks');

test('hooks.json declares two SessionStart entries (bash + powershell)', () => {
  const f = path.join(hookDir, 'hooks.json');
  assert.ok(fs.existsSync(f));
  const h = JSON.parse(fs.readFileSync(f, 'utf8'));
  const sessionStart = h.hooks?.SessionStart ?? h.SessionStart;
  assert.ok(Array.isArray(sessionStart), 'SessionStart array required');
  const shells = sessionStart.map((e) => e.shell ?? e.type);
  assert.ok(shells.includes('bash'), 'bash SessionStart entry required');
  assert.ok(shells.includes('powershell'), 'powershell SessionStart entry required');
});

test('first run creates ~/.radorch/ skeleton; second run is a no-op', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-boot-'));
  const env = { ...process.env, RADORCH_HOME: home };
  const isWin = process.platform === 'win32';
  const cmd = isWin
    ? { bin: 'powershell', args: ['-NoProfile', '-File', path.join(hookDir, 'session-start.ps1')] }
    : { bin: 'bash', args: [path.join(hookDir, 'session-start.sh')] };
  const t0 = Date.now();
  await execP(cmd.bin, cmd.args, { env });
  const t1 = Date.now();
  assert.ok(fs.existsSync(path.join(home, 'projects')));
  assert.ok(fs.existsSync(path.join(home, 'registry.yml')));
  assert.ok(fs.existsSync(path.join(home, 'config.yml')));
  assert.ok(fs.existsSync(path.join(home, 'install.json')));
  // Second run: idempotent; perf budget on already-bootstrapped state.
  const before = fs.readFileSync(path.join(home, 'install.json'), 'utf8');
  const t2 = Date.now();
  await execP(cmd.bin, cmd.args, { env });
  const t3 = Date.now();
  const after = fs.readFileSync(path.join(home, 'install.json'), 'utf8');
  assert.equal(before, after, 'install.json must not be rewritten on second run');
  assert.ok(t3 - t2 < 1000, `second-run bootstrap should complete <1000ms (took ${t3 - t2}ms)`);
  fs.rmSync(home, { recursive: true, force: true });
  assert.ok(t1 - t0 < 5000, 'first-run bootstrap must complete in <5s');
});

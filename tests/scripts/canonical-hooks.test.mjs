import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('canonical hooks/ folder ships the cross-platform bootstrap pair plus hooks.json', () => {
  for (const f of ['session-start.sh', 'session-start.ps1', 'hooks.json']) {
    const abs = path.join(repoRoot, 'hooks', f);
    assert.ok(fs.existsSync(abs), `canonical hooks/${f} missing`);
  }
  const sh = fs.readFileSync(path.join(repoRoot, 'hooks', 'session-start.sh'), 'utf8');
  assert.match(sh, /mkdir -p "\$HOME_DIR\/projects"/);
  const ps1 = fs.readFileSync(path.join(repoRoot, 'hooks', 'session-start.ps1'), 'utf8');
  assert.match(ps1, /projects/);
});

test('legacy marketplace hooks/ files are gone', () => {
  for (const f of ['session-start.sh', 'session-start.ps1', 'hooks.json']) {
    const abs = path.join(repoRoot, 'marketplace', 'plugins', 'rad-orchestration', 'hooks', f);
    assert.ok(!fs.existsSync(abs), `legacy ${f} still present`);
  }
});

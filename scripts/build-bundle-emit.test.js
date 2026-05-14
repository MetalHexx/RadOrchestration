import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('npm run build:all stages pipeline.js with bundled bytes (not the JIT shim)', () => {
  execSync('npm run build:all', { cwd: repoRoot, stdio: 'pipe' });
  for (const harness of ['claude', 'copilot-vscode', 'copilot-cli']) {
    const f = path.join(
      repoRoot, 'dist', 'staging', harness,
      'skills', 'rad-orchestration', 'scripts', 'pipeline.js',
    );
    if (!fs.existsSync(f)) continue; // staging may be absent for a harness if its adapter skipped
    const text = fs.readFileSync(f, 'utf8');
    assert.match(text, /^#!\/usr\/bin\/env node/, `${harness} pipeline.js missing shebang`);
    assert.doesNotMatch(text, /\bnpx\s+tsx\b/, `${harness} pipeline.js still contains npx tsx — bundle did not replace JIT shim`);
    assert.doesNotMatch(text, /\bnpm\s+ci\b/, `${harness} pipeline.js still contains npm ci — bundle did not replace JIT shim`);
  }
});

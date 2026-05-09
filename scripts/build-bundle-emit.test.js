import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('npm run build:all emits the pipeline bundle to every dogfood target', () => {
  execSync('npm run build:all', { cwd: repoRoot, stdio: 'pipe' });
  for (const rel of [
    '.claude/skills/rad-orchestration/scripts/pipeline.js',
    '.github/skills/rad-orchestration/scripts/pipeline.js',
  ]) {
    const f = path.join(repoRoot, rel);
    if (!fs.existsSync(f)) continue; // dogfood target may be absent in CI
    const text = fs.readFileSync(f, 'utf8');
    assert.match(text, /^#!\/usr\/bin\/env node/, `${rel} missing shebang`);
    assert.doesNotMatch(text, /\bnpx\s+tsx\b/, `${rel} still contains npx tsx — bundle did not replace JIT shim`);
    assert.doesNotMatch(text, /\bnpm\s+ci\b/, `${rel} still contains npm ci — bundle did not replace JIT shim`);
  }
});

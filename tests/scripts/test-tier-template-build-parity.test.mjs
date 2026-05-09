import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

const EXPECTED_TIERS = ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml'];
const FORBIDDEN = ['default.yml', 'quick.yml', 'full.yml'];

function templatesAt(rel) {
  const dir = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter(f => f.endsWith('.yml')).sort();
}

test('npm run build:all produces canonical, .claude, and .github with exactly the four tier templates', () => {
  execSync('npm run build:all', { cwd: REPO_ROOT, stdio: 'pipe' });

  const canonical = templatesAt('skills/rad-orchestration/templates');
  const claude = templatesAt('.claude/skills/rad-orchestration/templates');
  const github = templatesAt('.github/skills/rad-orchestration/templates');

  for (const dir of [canonical, claude, github]) {
    if (dir === null) continue; // dogfold target may be absent in CI
    assert.deepEqual(dir, EXPECTED_TIERS.slice().sort(), `Templates dir mismatch: ${JSON.stringify(dir)}`);
    for (const f of FORBIDDEN) assert.ok(!dir.includes(f), `${f} still present`);
  }
});

test('installer pre-compiled bundles do not contain retired template files', () => {
  const harnessDirs = fs.readdirSync(path.join(REPO_ROOT, 'installer', 'src'), { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);
  let bundlesAsserted = 0;
  for (const h of harnessDirs) {
    const rel = path.join('installer', 'src', h, 'skills', 'rad-orchestration', 'templates');
    const dir = templatesAt(rel);
    if (dir === null) continue; // harnesses without a skills/ subtree (e.g. ui) are skipped
    assert.deepEqual(dir, EXPECTED_TIERS.slice().sort(), `${rel} contents mismatch: ${JSON.stringify(dir)}`);
    for (const f of FORBIDDEN) assert.ok(!dir.includes(f), `${rel} still contains ${f}`);
    bundlesAsserted++;
  }
  assert.ok(bundlesAsserted >= 1, `Expected at least one installer bundle to be asserted; found 0. Harness dirs: ${harnessDirs.join(', ')}`);
});

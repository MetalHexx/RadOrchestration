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
  // installer/src/<harness>/.claude/skills/rad-orchestration/templates/ is the pre-compiled bundle path.
  // Sync via installer/scripts/sync-source.js if needed; this test runs after sync.
  const harnessDirs = fs.readdirSync(path.join(REPO_ROOT, 'installer', 'src'), { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);
  for (const h of harnessDirs) {
    const candidates = [
      path.join('installer', 'src', h, '.claude', 'skills', 'rad-orchestration', 'templates'),
      path.join('installer', 'src', h, '.github', 'skills', 'rad-orchestration', 'templates'),
    ];
    for (const cand of candidates) {
      const dir = templatesAt(cand);
      if (dir === null) continue;
      for (const f of FORBIDDEN) assert.ok(!dir.includes(f), `${cand} still contains ${f}`);
      for (const f of EXPECTED_TIERS) assert.ok(dir.includes(f), `${cand} missing ${f}`);
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

// The e2e harness drives the real build from repo root. The build invokes
// the adapter engine first (FR-24), then every helper. UI build is real;
// expect ~10-30s for the full run (FR-29). Skipped when SKIP_E2E=1.
test('end-to-end build produces a valid plugin payload', { skip: process.env.SKIP_E2E === '1' }, () => {
  const repoRoot = REPO_ROOT;
  execSync('node greenfield/installers/claude-plugin/build-scripts/build.js', {
    cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32',
  });
  const out = join(repoRoot, 'greenfield/installers/claude-plugin/output');
  // Required surfaces present (FR-22, FR-33 gate 1).
  for (const rel of [
    '.claude-plugin/plugin.json',
    'package.json',
    'agents/orchestrator.md',
    'skills/rad-orchestration/SKILL.md',
    'skills/rad-orchestration/scripts/radorch.mjs',
    'skills/rad-orchestration/scripts/pipeline.js',
    'skills/rad-orchestration/scripts/explode-master-plan.js',
    'hooks/hooks.json',
    'hooks/bootstrap.mjs',
    'hooks/drift-check.mjs',
    'orchestration.yml',
    'templates/medium.yml',
    'ui/server.js',
  ]) {
    assert.ok(fs.existsSync(join(out, rel)), `missing ${rel}`);
  }
  // No leftover bin/ or build-scripts/ (FR-22).
  assert.ok(!fs.existsSync(join(out, 'bin')), 'no bin/');
  assert.ok(!fs.existsSync(join(out, 'build-scripts')), 'no build-scripts/');

  // npm pack --dry-run --json succeeds and reports size under budget (NFR-5).
  const packOut = execSync('npm pack --dry-run --json', {
    cwd: out, shell: process.platform === 'win32', encoding: 'utf8',
  });
  const parsed = JSON.parse(packOut);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const size = entry?.unpackedSize ?? entry?.size ?? 0;
  const limit = Math.round(50 * 1024 * 1024 * 1.1);
  assert.ok(size > 0 && size <= limit, `pack size ${size} must be > 0 and ≤ ${limit} (NFR-5)`);
});

test('post-build: no source-folder litter (NFR-4)', { skip: process.env.SKIP_E2E === '1' }, () => {
  // Build helpers respect no-litter: no cli/dist/, no ui/.next/ after build.
  // cli/ and ui/ live at the repo root per parent design Decision 10.
  const repoRoot = REPO_ROOT;
  assert.ok(!fs.existsSync(join(repoRoot, 'cli/dist')), 'no cli/dist/ litter');
  assert.ok(!fs.existsSync(join(repoRoot, 'ui/.next')), 'no ui/.next/ litter');
});

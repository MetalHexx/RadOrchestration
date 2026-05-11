import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('rad-build-harness SKILL.md describes the installer-wrapper flow', () => {
  const p = path.join(repoRoot, '.agents', 'skills', 'rad-build-harness', 'SKILL.md');
  const text = fs.readFileSync(p, 'utf8');
  // Must reference each load-bearing step of the wrapper flow (vocabulary only):
  assert.match(text, /npm uninstall -g rad-orchestration/);
  assert.match(text, /npm pack/);
  assert.match(text, /radorch --yes/);
  assert.match(text, /plugin-bootstrap.*--force/);
  assert.match(text, /sha256/);
  assert.match(text, /radorch doctor/);
  // Must NOT carry retired references:
  assert.doesNotMatch(text, /base_path/);
  assert.doesNotMatch(text, /orch_root/);
  assert.doesNotMatch(text, /projects\.naming/);
});

test('rad-test-release prompt is retired', () => {
  assert.ok(!fs.existsSync(path.join(repoRoot, '.agents', 'prompts', 'rad-test-release.prompt.md')));
});

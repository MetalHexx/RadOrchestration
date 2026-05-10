import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('publish.yml carries a parallel plugin publish job', () => {
  const text = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'publish.yml'), 'utf8');
  assert.match(text, /jobs:[\s\S]*publish:[\s\S]*publish-plugin:/);
  assert.match(text, /npm run build:plugin/);
  assert.match(text, /@rad-orchestration\/claude-plugin/);
  assert.match(text, /npm publish --access public --provenance/);
  // both jobs share the v* trigger
  assert.match(text, /tags:\s*\['v\*'\]/);
});

test('publish-plugin job uses per-workspace installs (no root npm ci)', () => {
  const text = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'publish.yml'), 'utf8');
  // Locate the publish-plugin job body
  const start = text.indexOf('publish-plugin:');
  assert.ok(start >= 0, 'publish-plugin job must be present');
  const body = text.slice(start);
  // Per-workspace install steps must be present
  assert.match(body, /working-directory:\s*cli\s*\n\s*run:\s*npm ci/);
  assert.match(body, /working-directory:\s*ui\s*\n\s*run:\s*npm ci/);
  assert.match(body, /working-directory:\s*skills\/rad-orchestration\/scripts\s*\n\s*run:\s*npm install/);
});

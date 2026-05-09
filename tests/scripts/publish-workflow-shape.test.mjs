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

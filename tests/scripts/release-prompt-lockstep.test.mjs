import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('rad-release.prompt.md lockstep list matches AD-16 file set', () => {
  const text = fs.readFileSync(path.join(repoRoot, '.agents', 'prompts', 'rad-release.prompt.md'), 'utf8');
  // Required entries
  assert.match(text, /installer\/package\.json/);
  assert.match(text, /ui\/package\.json/);
  assert.match(text, /skills\/rad-orchestration\/scripts\/package\.json/);
  assert.match(text, /cli\/package\.json/);
  assert.match(text, /plugin\/package\.json/);
  // Removed entry
  assert.doesNotMatch(text, /marketplace\/plugins\/rad-orchestration\/\.claude-plugin\/plugin\.json/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

test('legacy .agents/prompts/rad-release.prompt.md is removed (FR-9)', () => {
  assert.strictEqual(
    fs.existsSync(path.join(repoRoot, '.agents/prompts/rad-release.prompt.md')),
    false,
  );
});

test('no file in the repo references the legacy prompt path (DD-5)', () => {
  // git grep returns non-zero (exit 1) when there are no matches — desired
  // Exclude docs/internals/ (historical design docs that predate this iteration)
  let matches = '';
  try {
    matches = execSync(
      'git grep -l "rad-release.prompt.md" -- ":(exclude)docs/internals/"',
      { cwd: repoRoot, encoding: 'utf8' },
    );
  } catch (e) {
    // non-zero exit == no matches; that's the passing branch
    return;
  }
  assert.fail('legacy prompt still referenced in: ' + matches);
});

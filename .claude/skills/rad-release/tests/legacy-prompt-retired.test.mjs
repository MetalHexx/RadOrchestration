import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

test('legacy .agents/prompts/rad-release.prompt.md is removed', () => {
  assert.strictEqual(
    fs.existsSync(path.join(repoRoot, '.agents/prompts/rad-release.prompt.md')),
    false,
  );
});

test('no file in the repo references the legacy prompt path', () => {
  // git grep returns non-zero (exit 1) when there are no matches — desired
  // Exclude docs/internals/ (historical design docs that predate this iteration)
  let matches = '';
  try {
    matches = execSync(
      'git grep -l "rad-release.prompt.md" -- ":(exclude)docs/internals/" ":(exclude).claude/skills/rad-release/tests/legacy-prompt-retired.test.mjs"',
      { cwd: repoRoot, encoding: 'utf8' },
    );
  } catch (e) {
    // git grep exits 1 when there are no matches — that's the passing branch.
    // Any other status (git missing, not a repo, bad pathspec) is a real error
    // and must surface as a test failure.
    if (e.status === 1) return;
    throw e;
  }
  assert.fail('legacy prompt still referenced in: ' + matches);
});

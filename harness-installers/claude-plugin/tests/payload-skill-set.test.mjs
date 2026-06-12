import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../output/skills');

test('built payload includes rad-execute skill (FR-19)', () => {
  assert.ok(fs.existsSync(path.join(OUT, 'rad-execute/SKILL.md')),
    'output/skills/rad-execute/SKILL.md must be present in the payload');
});

test('built payload excludes retired rad-execute-parallel skill (FR-19, AD-5)', () => {
  assert.ok(!fs.existsSync(path.join(OUT, 'rad-execute-parallel')),
    'output/skills/rad-execute-parallel must not be in the payload');
});

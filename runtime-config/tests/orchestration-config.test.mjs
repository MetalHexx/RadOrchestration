import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const YML = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../orchestration.yml');
const body = fs.readFileSync(YML, 'utf8');

test('execution_mode is autonomous (FR-11, AD-1)', () => {
  assert.match(body, /^\s*execution_mode:\s*autonomous\s*$/m);
  assert.doesNotMatch(body, /^\s*execution_mode:\s*ask\s*$/m);
});

test('plan-approval and final-review remain hard human gates (FR-12)', () => {
  assert.match(body, /^\s*after_planning:\s*true\s*$/m);
  assert.match(body, /^\s*after_final_review:\s*true\s*$/m);
});

test('source-control config model is unchanged (NFR-4)', () => {
  assert.match(body, /^\s*auto_commit:\s*ask\s*$/m);
  assert.match(body, /^\s*auto_pr:\s*ask\s*$/m);
});

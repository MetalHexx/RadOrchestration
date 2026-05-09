import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

test('.claude/scheduled_tasks.lock is gitignored', () => {
  const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.claude/scheduled_tasks.lock'), '.gitignore must include the .claude/scheduled_tasks.lock pattern');
});

test('.claude/scheduled_tasks.lock is absent from the working tree', () => {
  const lockPath = path.join(repoRoot, '.claude', 'scheduled_tasks.lock');
  assert.equal(fs.existsSync(lockPath), false, '.claude/scheduled_tasks.lock must not exist in the working tree');
});

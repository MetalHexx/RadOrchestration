import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

test('page imports RepoDetailPane from the repo-registry component (FR-17)', () => {
  assert.match(page, /import.*RepoDetailPane.*from.*repo-detail-pane/);
});

test('page renders RepoDetailPane in the repo-selection branch with store-derived repo, upsertRepo, removeRepo, and onDeselect (FR-17)', () => {
  // Must use RepoDetailPane in JSX
  assert.match(page, /<RepoDetailPane/);
  // Must pass upsertRepo prop
  assert.match(page, /upsertRepo=/);
  // Must pass removeRepo prop
  assert.match(page, /removeRepo=/);
  // Must pass onDeselect that clears selection
  assert.match(page, /onDeselect/);
  // Must guard the repo selection branch with selected.kind === 'repo'
  assert.match(page, /selected\.kind\s*===\s*['"]repo['"]/);
});

test('page pulls upsertRepo and removeRepo from the store hook (FR-17)', () => {
  // The destructuring of useRegistryStore must include upsertRepo and removeRepo
  assert.match(page, /upsertRepo/);
  assert.match(page, /removeRepo/);
});

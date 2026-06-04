import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateRepoDraft, validateRepoDraftField, repoDraftFrom } from './repo-save-flow';
import type { RepoRead } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pane = readFileSync(join(__dirname, 'repo-detail-pane.tsx'), 'utf-8');

const repo: RepoRead = {
  slug: 'a', remote: 'github.com/x/a', defaultBranch: 'main',
  description: 'd', groups: ['g'], bind: { state: 'bound', path: 'p' },
};

test('repoDraftFrom seeds the editable draft from a RepoRead, localPath blank for unbound (FR-5)', () => {
  const d = repoDraftFrom(repo);
  assert.strictEqual(d.remote, 'github.com/x/a');
  assert.deepStrictEqual(d.groups, ['g']);
  assert.strictEqual(d.localPath, 'p');
  const unbound = repoDraftFrom({ ...repo, bind: { state: 'unbound', path: null } });
  assert.strictEqual(unbound.localPath, '');
});

test('client mirror flags empty required fields before save with Proper-Case labels (FR-23, FR-21)', () => {
  const errs = validateRepoDraft({ remote: '', defaultBranch: '', description: '', localPath: '', groups: [] });
  assert.strictEqual(errs.remote, 'Remote is required.');
  assert.strictEqual(errs.defaultBranch, 'Default Branch is required.');
  assert.strictEqual(errs.description, 'Description is required.');
  assert.ok(!('localPath' in errs)); // blank localPath = leave bind unchanged, not an error
});

test('client mirror flags a malformed remote URL (loose check)', () => {
  const errs = validateRepoDraft({ remote: 'r', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.match(errs.remote, /must be a valid URL/);
});

test('valid draft (incl. scheme-less remote the registry supports) yields no client errors (FR-23)', () => {
  const errs = validateRepoDraft({ remote: 'github.com/x/a', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.deepStrictEqual(errs, {});
});

test('validateRepoDraftField returns a single field message for on-blur validation', () => {
  const draft = { remote: '', defaultBranch: 'main', description: 'd', localPath: '', groups: [] };
  assert.strictEqual(validateRepoDraftField('remote', draft), 'Remote is required.');
  assert.strictEqual(validateRepoDraftField('description', draft), undefined);
});

test('detail pane wires per-field onBlur validation on the editable inputs', () => {
  assert.match(pane, /onBlur=\{\(\) => handleBlur\('remote'\)\}/);
  assert.match(pane, /onBlur=\{\(\) => handleBlur\('defaultBranch'\)\}/);
  assert.match(pane, /onBlur=\{\(\) => handleBlur\('description'\)\}/);
});

test('pane saves via PUT, reconciles response, removes via DELETE with cascade copy (FR-17, FR-19, AD-2, AD-3)', () => {
  assert.match(pane, /PUT/);
  assert.match(pane, /`\/api\/repos\/\$\{[^}]+\}`|\/api\/repos\//);
  assert.match(pane, /DELETE/);
  assert.match(pane, /dropped from every group|local binding is removed/i);
  assert.match(pane, /upsertRepo|onSaved/);
});

test('PUT error path unwraps the inner ApiError before calling classifyError — not the outer envelope (AD-4)', () => {
  // The pane must pass errBody.error (inner ApiError) to classifyError, not the raw errBody.
  // Pattern: classifyError((errBody as ...).error) or classifyError(errBody.error)
  assert.match(pane, /classifyError\([\s\S]*?\.error\)/);
  // Confirm the raw errBody is NOT passed directly (no classifyError(errBody) without .error)
  assert.doesNotMatch(pane, /classifyError\(\s*errBody\s*\)/);
});

test('handleRemove has a non-OK branch that surfaces the DELETE error via setFormError (FR-19)', () => {
  // The pane must handle res.ok === false for DELETE and call setFormError with a message.
  // handleRemove contains removeRepo/onDeselect in the ok branch, followed by an else that calls setFormError.
  // Pattern: removeRepo ... onDeselect ... } else { ... setFormError
  assert.match(pane, /removeRepo[\s\S]{0,200}onDeselect[\s\S]{0,200}\}\s*else[\s\S]{0,200}setFormError/);
});

test('pane imports classifyError and buildRepoSaveBody from a single ./registry-requests statement (P06 F-20)', () => {
  // Combined single import — both symbols in one statement
  assert.match(pane, /import\s*\{[^}]*classifyError[^}]*buildRepoSaveBody[^}]*\}\s*from\s*['"]\.\/registry-requests['"]/);
  // No more than one import from ./registry-requests
  const reqImports = pane.match(/from\s*['"]\.\/registry-requests['"]/g) ?? [];
  assert.strictEqual(reqImports.length, 1);
});

test('pane consolidates RepoRead, RepoGroupRead, ApiError into one ./types import (P06 F-20)', () => {
  assert.match(pane, /import\s+type\s*\{[^}]*RepoRead[^}]*RepoGroupRead[^}]*ApiError[^}]*\}\s*from\s*['"]\.\/types['"]/);
  // Only a single import from ./types
  const typeImports = pane.match(/from\s*['"]\.\/types['"]/g) ?? [];
  assert.strictEqual(typeImports.length, 1);
});

test('pane memoizes the draft baseline keyed on the repo prop (P07 F-21)', () => {
  assert.match(pane, /useMemo/);
  assert.match(pane, /const baseline = useMemo\(\s*\(\)\s*=>\s*repoDraftFrom\(repo\),\s*\[repo\]\s*\)/);
});

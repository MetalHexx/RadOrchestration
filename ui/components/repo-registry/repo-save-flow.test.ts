import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateRepoDraft, repoDraftFrom } from './repo-save-flow';
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

test('client mirror flags empty required fields before save (FR-23, FR-21)', () => {
  const errs = validateRepoDraft({ remote: '', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.strictEqual(errs.remote, 'remote is required.');
  assert.ok(!('localPath' in errs)); // blank localPath = leave bind unchanged, not an error
});

test('valid draft yields no client errors (FR-23)', () => {
  const errs = validateRepoDraft({ remote: 'r', defaultBranch: 'main', description: 'd', localPath: '', groups: [] });
  assert.deepStrictEqual(errs, {});
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

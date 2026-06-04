import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  isRepoCreateValid, isGroupCreateValid,
  validateRepoCreate, validateGroupCreate,
  validateRepoCreateField, validateGroupCreateField,
} from './create-validation';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoDrawer = readFileSync(join(__dirname, 'add-repo-drawer.tsx'), 'utf-8');
const groupDrawer = readFileSync(join(__dirname, 'add-group-drawer.tsx'), 'utf-8');

test('repo create is valid only with valid slug + URL remote + required fields + non-empty local path (FR-23, FR-10)', () => {
  const ok = { slug: 'a', remote: 'github.com/acme/x', defaultBranch: 'main', description: 'd', localPath: 'C:\\x' };
  assert.strictEqual(isRepoCreateValid(ok), true);
  assert.strictEqual(isRepoCreateValid({ ...ok, slug: 'Bad' }), false);
  assert.strictEqual(isRepoCreateValid({ ...ok, localPath: '' }), false);
  assert.strictEqual(isRepoCreateValid({ ...ok, remote: '' }), false);
  assert.strictEqual(isRepoCreateValid({ ...ok, remote: 'r' }), false); // not URL-shaped
});

test('group create is valid only with valid slug + description (FR-23, FR-11)', () => {
  assert.strictEqual(isGroupCreateValid({ slug: 'g', description: 'd' }), true);
  assert.strictEqual(isGroupCreateValid({ slug: 'g', description: '' }), false);
  assert.strictEqual(isGroupCreateValid({ slug: '-bad', description: 'd' }), false);
});

test('validateRepoCreate returns Proper-Case per-field messages incl. slug-format + URL (FR-23)', () => {
  const errs = validateRepoCreate({ slug: 'Bad', remote: "'''", defaultBranch: '', description: '', localPath: '' });
  assert.match(errs.slug, /lowercase-kebab/);
  assert.match(errs.remote, /must be a valid URL/);
  assert.strictEqual(errs.defaultBranch, 'Default Branch is required.');
  assert.strictEqual(errs.description, 'Description is required.');
  assert.strictEqual(errs.localPath, 'Local Path is required.');
});

test('validateRepoCreate distinguishes empty slug (required) from malformed slug (format)', () => {
  assert.strictEqual(validateRepoCreate({ slug: '', remote: 'github.com/a/b', defaultBranch: 'main', description: 'd', localPath: 'C:\\x' }).slug, 'Slug is required.');
  assert.match(validateRepoCreate({ slug: 'Bad', remote: 'github.com/a/b', defaultBranch: 'main', description: 'd', localPath: 'C:\\x' }).slug, /lowercase-kebab/);
});

test('validateGroupCreate returns Proper-Case messages', () => {
  const errs = validateGroupCreate({ slug: '-bad', description: '' });
  assert.match(errs.slug, /lowercase-kebab/);
  assert.strictEqual(errs.description, 'Description is required.');
});

test('the *Field helpers pick a single field message for on-blur validation', () => {
  const f = { slug: 'Bad', remote: 'github.com/a/b', defaultBranch: 'main', description: 'd', localPath: 'C:\\x' };
  const slugMsg = validateRepoCreateField('slug', f);
  assert.ok(slugMsg);
  assert.match(slugMsg, /lowercase-kebab/);
  assert.strictEqual(validateRepoCreateField('remote', f), undefined);
  assert.strictEqual(validateGroupCreateField('description', { slug: 'g', description: '' }), 'Description is required.');
});

test('repo drawer uses the Sheet primitive, posts, and reconciles+selects on create (FR-10, FR-15, AD-2)', () => {
  assert.match(repoDrawer, /Sheet/);
  assert.match(repoDrawer, /POST/);
  assert.match(repoDrawer, /\/api\/repos/);
  assert.match(repoDrawer, /MembershipPicker/);
  assert.match(repoDrawer, /mode="create"|mode={'create'}/);
  assert.match(repoDrawer, /disabled/);
});

test('group drawer uses the Sheet primitive, posts, and reconciles+selects on create (FR-11, FR-16, AD-2)', () => {
  assert.match(groupDrawer, /Sheet/);
  assert.match(groupDrawer, /POST/);
  assert.match(groupDrawer, /\/api\/repo-groups/);
  assert.match(groupDrawer, /MembershipPicker/);
  assert.match(groupDrawer, /mode="create"|mode={'create'}/);
});

test('add-repo drawer drops all grey hint subtitles under inputs', () => {
  assert.doesNotMatch(repoDrawer, /lowercase-kebab · immutable/);
  assert.doesNotMatch(repoDrawer, /must be an existing folder on this machine \(checked/);
  // No grey helper paragraph remains under an input in the drawer body.
  assert.doesNotMatch(repoDrawer, /<p className="mt-1 text-xs text-muted-foreground">/);
});

test('add-group drawer drops the grey slug hint subtitle', () => {
  assert.doesNotMatch(groupDrawer, /lowercase-kebab · immutable/);
  assert.doesNotMatch(groupDrawer, /<p className="mt-1 text-xs text-muted-foreground">/);
});

test('add-repo drawer wires per-field onBlur and validates the whole form on submit', () => {
  for (const field of ['slug', 'remote', 'defaultBranch', 'description', 'localPath']) {
    assert.match(repoDrawer, new RegExp(`onBlur=\\{\\(\\) => handleBlur\\('${field}'\\)\\}`));
  }
  assert.match(repoDrawer, /validateRepoCreate\(form\)/);
});

test('add-group drawer wires per-field onBlur and validates the whole form on submit', () => {
  assert.match(groupDrawer, /onBlur=\{\(\) => handleBlur\('slug'\)\}/);
  assert.match(groupDrawer, /onBlur=\{\(\) => handleBlur\('description'\)\}/);
  assert.match(groupDrawer, /validateGroupCreate\(form\)/);
});

test('submit buttons are enabled (no !valid gate) so a click surfaces all errors', () => {
  assert.match(repoDrawer, /disabled=\{saving\}/);
  assert.doesNotMatch(repoDrawer, /disabled=\{!valid/);
  assert.match(groupDrawer, /disabled=\{saving\}/);
  assert.doesNotMatch(groupDrawer, /disabled=\{!valid/);
});

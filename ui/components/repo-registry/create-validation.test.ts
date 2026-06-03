import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { isRepoCreateValid, isGroupCreateValid } from './create-validation';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoDrawer = readFileSync(join(__dirname, 'add-repo-drawer.tsx'), 'utf-8');
const groupDrawer = readFileSync(join(__dirname, 'add-group-drawer.tsx'), 'utf-8');

test('repo create is valid only with valid slug + required fields + non-empty local path (FR-23, FR-10)', () => {
  const ok = { slug: 'a', remote: 'r', defaultBranch: 'main', description: 'd', localPath: 'C:\\x' };
  assert.strictEqual(isRepoCreateValid(ok), true);
  assert.strictEqual(isRepoCreateValid({ ...ok, slug: 'Bad' }), false);
  assert.strictEqual(isRepoCreateValid({ ...ok, localPath: '' }), false);
  assert.strictEqual(isRepoCreateValid({ ...ok, remote: '' }), false);
});

test('group create is valid only with valid slug + description (FR-23, FR-11)', () => {
  assert.strictEqual(isGroupCreateValid({ slug: 'g', description: 'd' }), true);
  assert.strictEqual(isGroupCreateValid({ slug: 'g', description: '' }), false);
  assert.strictEqual(isGroupCreateValid({ slug: '-bad', description: 'd' }), false);
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

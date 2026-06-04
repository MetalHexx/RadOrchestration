import { test } from 'node:test';
import assert from 'node:assert';
import {
  classifyError, buildRepoCreateBody, buildRepoSaveBody,
  buildGroupCreateBody, buildGroupSaveBody,
} from './registry-requests';

test('classifyError routes a field error to its slot, field:"" to form (AD-4, FR-21, FR-22)', () => {
  assert.deepStrictEqual(
    classifyError({ code: 'REQUIRED', message: 'remote is required.', field: 'remote' }),
    { kind: 'field', field: 'remote', message: 'remote is required.' });
  assert.deepStrictEqual(
    classifyError({ code: 'INTERNAL', message: 'boom', field: '' }),
    { kind: 'form', message: 'boom' });
});

test('repo save omits localPath when blank, includes it when provided; never sends slug (FR-17, AD-3)', () => {
  const unchanged = buildRepoSaveBody({
    remote: 'github.com/a/b', defaultBranch: 'main', description: 'x',
    localPath: '   ', groups: ['checkout'],
  });
  assert.ok(!('localPath' in unchanged));
  assert.ok(!('slug' in unchanged));
  assert.deepStrictEqual(unchanged.groups, ['checkout']);

  const repoint = buildRepoSaveBody({
    remote: 'github.com/a/b', defaultBranch: 'main', description: 'x',
    localPath: 'C:\\dev\\b', groups: [],
  });
  assert.strictEqual(repoint.localPath, 'C:\\dev\\b');
});

test('repo create body carries all fields + groups (FR-15, AD-3)', () => {
  const body = buildRepoCreateBody({
    slug: 'b', remote: 'github.com/a/b', defaultBranch: 'main',
    description: 'x', localPath: 'C:\\dev\\b', groups: ['checkout'],
  });
  assert.deepStrictEqual(body, {
    slug: 'b', remote: 'github.com/a/b', defaultBranch: 'main',
    description: 'x', localPath: 'C:\\dev\\b', groups: ['checkout'],
  });
});

test('group save always sends description + complete members, never slug (FR-18, AD-3)', () => {
  const body = buildGroupSaveBody({ description: 'd', members: ['x', 'y'] });
  assert.strictEqual(body.description, 'd');
  assert.deepStrictEqual(body.members, ['x', 'y']);
  assert.ok(!('slug' in body));
});

test('group create body carries slug + description + members (FR-16, AD-3)', () => {
  const body = buildGroupCreateBody({ slug: 'g', description: 'd', members: ['x'] });
  assert.deepStrictEqual(body, { slug: 'g', description: 'd', members: ['x'] });
});

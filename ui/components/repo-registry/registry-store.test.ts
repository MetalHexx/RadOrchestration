import { test } from 'node:test';
import assert from 'node:assert';
import {
  hydrate, upsertRepo, removeRepo, upsertGroup, removeGroup,
  type RegistryStore,
} from './registry-store';
import type { RepoRead, RepoGroupRead } from './types';

const repoA: RepoRead = {
  slug: 'a', remote: 'r', defaultBranch: 'main', description: 'd',
  groups: [], bind: { state: 'unbound', path: null },
};
const groupG: RepoGroupRead = { slug: 'g', description: 'd', members: [] };

test('hydrate replaces the whole snapshot into one store (AD-1, NFR-4)', () => {
  const s = hydrate({ repos: [repoA], repoGroups: [groupG] });
  assert.strictEqual(s.repos.length, 1);
  assert.strictEqual(s.repoGroups.length, 1);
  assert.strictEqual(s.repos[0].slug, 'a');
});

test('upsertRepo from a response replaces an existing repo or appends a new one (AD-2)', () => {
  let s: RegistryStore = hydrate({ repos: [repoA], repoGroups: [] });
  s = upsertRepo(s, { ...repoA, description: 'edited' });
  assert.strictEqual(s.repos.length, 1);
  assert.strictEqual(s.repos[0].description, 'edited');
  s = upsertRepo(s, { ...repoA, slug: 'b' });
  assert.strictEqual(s.repos.length, 2);
});

test('removeRepo drops by slug (AD-2)', () => {
  let s: RegistryStore = hydrate({ repos: [repoA], repoGroups: [] });
  s = removeRepo(s, 'a');
  assert.strictEqual(s.repos.length, 0);
});

test('upsertGroup / removeGroup mirror the repo behavior (AD-2)', () => {
  let s: RegistryStore = hydrate({ repos: [], repoGroups: [groupG] });
  s = upsertGroup(s, { ...groupG, description: 'edited' });
  assert.strictEqual(s.repoGroups[0].description, 'edited');
  s = removeGroup(s, 'g');
  assert.strictEqual(s.repoGroups.length, 0);
});

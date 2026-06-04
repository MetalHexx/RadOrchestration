import { test } from 'node:test';
import assert from 'node:assert';
import { buildRailSections } from './rail-grouping';
import type { RepoRead, RepoGroupRead } from './types';

const repos: RepoRead[] = [
  { slug: 'web', remote: 'r', defaultBranch: 'main', description: '', groups: ['storefront'], bind: { state: 'bound', path: 'p' } },
  { slug: 'shared', remote: 'r', defaultBranch: 'main', description: '', groups: ['storefront', 'platform'], bind: { state: 'bound', path: 'p' } },
  { slug: 'loose', remote: 'r', defaultBranch: 'main', description: '', groups: [], bind: { state: 'unbound', path: null } },
];
const groups: RepoGroupRead[] = [
  { slug: 'storefront', description: '', members: ['web', 'shared'] },
  { slug: 'platform', description: '', members: ['shared'] },
];

test('a multi-group repo appears once under each group it belongs to (FR-3)', () => {
  const s = buildRailSections(repos, groups);
  const sf = s.repoSections.find(g => g.group === 'storefront')!;
  const pf = s.repoSections.find(g => g.group === 'platform')!;
  assert.deepStrictEqual(sf.repos.map(r => r.slug), ['shared', 'web']);
  assert.deepStrictEqual(pf.repos.map(r => r.slug), ['shared']);
});

test('ungrouped repos collect in their own section (FR-3)', () => {
  const s = buildRailSections(repos, groups);
  assert.deepStrictEqual(s.ungrouped.map(r => r.slug), ['loose']);
});

test('repo groups list is returned for the Repo Groups section (FR-3)', () => {
  const s = buildRailSections(repos, groups);
  assert.deepStrictEqual(s.groups.map(g => g.slug), ['platform', 'storefront']);
});

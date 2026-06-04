import type { RegistrySnapshot, RepoRead, RepoGroupRead } from './types';

export interface RegistryStore {
  repos: RepoRead[];
  repoGroups: RepoGroupRead[];
}

export function hydrate(snapshot: RegistrySnapshot): RegistryStore {
  return { repos: [...snapshot.repos], repoGroups: [...snapshot.repoGroups] };
}

export function upsertRepo(store: RegistryStore, repo: RepoRead): RegistryStore {
  const has = store.repos.some(r => r.slug === repo.slug);
  return {
    ...store,
    repos: has
      ? store.repos.map(r => (r.slug === repo.slug ? repo : r))
      : [...store.repos, repo],
  };
}

export function removeRepo(store: RegistryStore, slug: string): RegistryStore {
  return { ...store, repos: store.repos.filter(r => r.slug !== slug) };
}

export function upsertGroup(store: RegistryStore, group: RepoGroupRead): RegistryStore {
  const has = store.repoGroups.some(g => g.slug === group.slug);
  return {
    ...store,
    repoGroups: has
      ? store.repoGroups.map(g => (g.slug === group.slug ? group : g))
      : [...store.repoGroups, group],
  };
}

export function removeGroup(store: RegistryStore, slug: string): RegistryStore {
  return { ...store, repoGroups: store.repoGroups.filter(g => g.slug !== slug) };
}

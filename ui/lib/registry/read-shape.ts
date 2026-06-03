import { statSync } from 'node:fs';
import type { Registry } from '@rad-orchestration/repo-registry';

export type BindState = 'unbound' | 'bound' | 'missing';
export interface RepoRead {
  slug: string; remote: string; defaultBranch: string; description: string;
  groups: string[]; bind: { state: BindState; path: string | null };
}
export interface RepoGroupRead { slug: string; description: string; members: string[] }
export interface RegistrySnapshot { repos: RepoRead[]; repoGroups: RepoGroupRead[] }

function computeBind(localPath: string | undefined): RepoRead['bind'] {
  if (!localPath) return { state: 'unbound', path: null };
  try {
    if (statSync(localPath).isDirectory()) return { state: 'bound', path: localPath };
  } catch { /* falls through to missing */ }
  return { state: 'missing', path: localPath };
}

function groupsForRepo(reg: Registry, slug: string): string[] {
  return Object.entries(reg.repoGroups)
    .filter(([, g]) => g.members.includes(slug))
    .map(([gslug]) => gslug)
    .sort();
}

export function computeRepo(reg: Registry, slug: string): RepoRead {
  const id = reg.repos[slug];
  return {
    slug,
    remote: id.remote,
    defaultBranch: id.default_branch,
    description: id.description,
    groups: groupsForRepo(reg, slug),
    bind: computeBind(reg.localPaths[slug]),
  };
}

export function computeRepoGroup(reg: Registry, slug: string): RepoGroupRead {
  const g = reg.repoGroups[slug];
  return { slug, description: g.description, members: [...g.members] };
}

export function computeSnapshot(reg: Registry): RegistrySnapshot {
  return {
    repos: Object.keys(reg.repos).map(slug => computeRepo(reg, slug)),
    repoGroups: Object.keys(reg.repoGroups).map(slug => computeRepoGroup(reg, slug)),
  };
}

import type { RepoRead, RepoGroupRead } from './types';

export interface RepoSection { group: string; repos: RepoRead[] }
export interface RailSections {
  repoSections: RepoSection[];
  ungrouped: RepoRead[];
  groups: RepoGroupRead[];
}

export function buildRailSections(repos: RepoRead[], groups: RepoGroupRead[]): RailSections {
  const byGroup = [...groups].sort((a, b) => a.slug.localeCompare(b.slug));
  const repoSections: RepoSection[] = byGroup.map(g => ({
    group: g.slug,
    repos: repos
      .filter(r => r.groups.includes(g.slug))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  }));
  const ungrouped = repos
    .filter(r => r.groups.length === 0)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return { repoSections, ungrouped, groups: byGroup };
}

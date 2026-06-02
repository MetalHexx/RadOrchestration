export interface RepoIdentity { remote: string; default_branch: string; description: string }
export interface RepoGroup { description: string; members: string[] }
export interface Registry {
  repos: Record<string, RepoIdentity>;
  repoGroups: Record<string, RepoGroup>;
  localPaths: Record<string, string>;
}
export interface RootOpts { root: string }

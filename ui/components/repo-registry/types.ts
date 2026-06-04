export type BindState = 'unbound' | 'bound' | 'missing';

export interface RepoRead {
  slug: string;
  remote: string;
  defaultBranch: string;
  description: string;
  groups: string[];
  bind: { state: BindState; path: string | null };
}

export interface RepoGroupRead {
  slug: string;
  description: string;
  members: string[];
}

export interface RegistrySnapshot {
  repos: RepoRead[];
  repoGroups: RepoGroupRead[];
}

export type RegistryErrorCode =
  | 'SLUG_INVALID' | 'NAME_TAKEN' | 'REQUIRED'
  | 'PATH_INVALID' | 'NOT_FOUND' | 'IMMUTABLE_SLUG' | 'INTERNAL';

export interface ApiError { code: RegistryErrorCode; message: string; field: string }

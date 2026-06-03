import type { ApiError } from './types';

export type ClassifiedError =
  | { kind: 'field'; field: string; message: string }
  | { kind: 'form'; message: string };

export function classifyError(err: ApiError): ClassifiedError {
  return err.field && err.field.trim() !== ''
    ? { kind: 'field', field: err.field, message: err.message }
    : { kind: 'form', message: err.message };
}

interface RepoFields {
  slug?: string; remote: string; defaultBranch: string;
  description: string; localPath: string; groups: string[];
}

export function buildRepoCreateBody(f: RepoFields) {
  return {
    slug: f.slug, remote: f.remote, defaultBranch: f.defaultBranch,
    description: f.description, localPath: f.localPath, groups: f.groups,
  };
}

// localPath present = re-point; omitted (blank) = leave bind unchanged.
// slug is never sent.
export function buildRepoSaveBody(f: Omit<RepoFields, 'slug'>) {
  const body: Record<string, unknown> = {
    remote: f.remote, defaultBranch: f.defaultBranch,
    description: f.description, groups: f.groups,
  };
  if (f.localPath.trim() !== '') body.localPath = f.localPath;
  return body;
}

interface GroupFields { slug?: string; description: string; members: string[] }

export function buildGroupCreateBody(f: GroupFields) {
  return { slug: f.slug, description: f.description, members: f.members };
}

// description always sent (editGroup requires it); members = complete set;
// slug never sent.
export function buildGroupSaveBody(f: Omit<GroupFields, 'slug'>) {
  return { description: f.description, members: f.members };
}

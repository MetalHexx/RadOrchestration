import type { RepoRead } from './types';
import { isRequiredFilled } from './validation-mirror';

export interface RepoDraft {
  remote: string; defaultBranch: string; description: string;
  localPath: string; groups: string[];
}

export function repoDraftFrom(repo: RepoRead): RepoDraft {
  return {
    remote: repo.remote,
    defaultBranch: repo.defaultBranch,
    description: repo.description,
    localPath: repo.bind.path ?? '',
    groups: [...repo.groups],
  };
}

// Client mirror: required-non-empty for remote/branch/description.
// A blank localPath is NOT an error — it means "leave the bind unchanged"
// (clearing-to-unbind is unsupported). PATH_INVALID is server-only.
export function validateRepoDraft(d: RepoDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(d.remote)) errs.remote = 'remote is required.';
  if (!isRequiredFilled(d.defaultBranch)) errs.defaultBranch = 'default branch is required.';
  if (!isRequiredFilled(d.description)) errs.description = 'description is required.';
  return errs;
}

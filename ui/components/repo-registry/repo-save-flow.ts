import type { RepoRead } from './types';
import { isRequiredFilled, isRemoteUrlValid, requiredMessage, REMOTE_URL_MESSAGE } from './validation-mirror';

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

// Client mirror: required-non-empty for remote/branch/description, plus a loose
// URL-format check on remote. A blank localPath is NOT an error — it means
// "leave the bind unchanged" (clearing-to-unbind is unsupported). The
// directory-existence check (PATH_INVALID) is server-only.
export function validateRepoDraft(d: RepoDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(d.remote)) errs.remote = requiredMessage('remote');
  else if (!isRemoteUrlValid(d.remote)) errs.remote = REMOTE_URL_MESSAGE;
  if (!isRequiredFilled(d.defaultBranch)) errs.defaultBranch = requiredMessage('defaultBranch');
  if (!isRequiredFilled(d.description)) errs.description = requiredMessage('description');
  return errs;
}

export function validateRepoDraftField(field: string, d: RepoDraft): string | undefined {
  return validateRepoDraft(d)[field];
}

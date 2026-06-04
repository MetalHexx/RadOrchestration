import {
  isSlugValid, isRequiredFilled, isLocalPathFilled, isRemoteUrlValid,
  requiredMessage, SLUG_FORMAT_MESSAGE, REMOTE_URL_MESSAGE,
} from './validation-mirror';

export interface RepoCreateFields {
  slug: string; remote: string; defaultBranch: string; description: string; localPath: string;
}
export interface GroupCreateFields { slug: string; description: string }

export function isRepoCreateValid(f: RepoCreateFields): boolean {
  return isSlugValid(f.slug)
    && isRequiredFilled(f.remote) && isRemoteUrlValid(f.remote)
    && isRequiredFilled(f.defaultBranch)
    && isRequiredFilled(f.description)
    && isLocalPathFilled(f.localPath);
}

export function isGroupCreateValid(f: GroupCreateFields): boolean {
  return isSlugValid(f.slug) && isRequiredFilled(f.description);
}

// Full-form validators returning per-field Proper-Case messages. The drawers
// call these on submit (and per field on blur via the *Field helpers below).
export function validateRepoCreate(f: RepoCreateFields): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(f.slug)) errs.slug = requiredMessage('slug');
  else if (!isSlugValid(f.slug)) errs.slug = SLUG_FORMAT_MESSAGE;
  if (!isRequiredFilled(f.remote)) errs.remote = requiredMessage('remote');
  else if (!isRemoteUrlValid(f.remote)) errs.remote = REMOTE_URL_MESSAGE;
  if (!isRequiredFilled(f.defaultBranch)) errs.defaultBranch = requiredMessage('defaultBranch');
  if (!isRequiredFilled(f.description)) errs.description = requiredMessage('description');
  if (!isLocalPathFilled(f.localPath)) errs.localPath = requiredMessage('localPath');
  return errs;
}

export function validateGroupCreate(f: GroupCreateFields): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!isRequiredFilled(f.slug)) errs.slug = requiredMessage('slug');
  else if (!isSlugValid(f.slug)) errs.slug = SLUG_FORMAT_MESSAGE;
  if (!isRequiredFilled(f.description)) errs.description = requiredMessage('description');
  return errs;
}

export function validateRepoCreateField(field: string, f: RepoCreateFields): string | undefined {
  return validateRepoCreate(f)[field];
}

export function validateGroupCreateField(field: string, f: GroupCreateFields): string | undefined {
  return validateGroupCreate(f)[field];
}

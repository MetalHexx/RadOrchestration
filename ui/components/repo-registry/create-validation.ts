import { isSlugValid, isRequiredFilled, isLocalPathFilled } from './validation-mirror';

export function isRepoCreateValid(f: {
  slug: string; remote: string; defaultBranch: string; description: string; localPath: string;
}): boolean {
  return isSlugValid(f.slug)
    && isRequiredFilled(f.remote)
    && isRequiredFilled(f.defaultBranch)
    && isRequiredFilled(f.description)
    && isLocalPathFilled(f.localPath);
}

export function isGroupCreateValid(f: { slug: string; description: string }): boolean {
  return isSlugValid(f.slug) && isRequiredFilled(f.description);
}

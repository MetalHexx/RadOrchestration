import { statSync } from 'node:fs';
import { isSlug } from '@rad-orchestration/repo-registry';
import type { Registry } from '@rad-orchestration/repo-registry';
import { RegistryError } from './errors.js';

export function validateSlug(slug: string): void {
  if (!isSlug(slug)) {
    throw new RegistryError('SLUG_INVALID', `'${slug}' is not a valid slug.`, 'slug');
  }
}

export function validateRequired(value: string | undefined, field: string): void {
  if (value === undefined || value.trim() === '') {
    throw new RegistryError('REQUIRED', `${field} is required.`, field);
  }
}

export function validateDirectory(p: string, field: string): void {
  try {
    if (statSync(p).isDirectory()) return;
  } catch { /* falls through */ }
  throw new RegistryError('PATH_INVALID', `${field} must be an existing directory.`, field);
}

export function validateUniqueName(reg: Registry, slug: string): void {
  if (slug in reg.repos || slug in reg.repoGroups) {
    throw new RegistryError('NAME_TAKEN', `A repo or repo-group named '${slug}' already exists.`, 'slug');
  }
}

// Normalize a git remote per AD-4: strip a trailing `.git` and coerce the
// remote to an `https://host/path` URL. Handles SSH shorthand
// (`git@host:owner/repo`), `ssh://`/`http://` URLs, scheme-less
// `host/owner/repo`, and already-`https://` forms. Idempotent.
export function normalizeRemote(remote: string): string {
  const trimmed = remote.trim();
  const withoutGit = trimmed.replace(/\.git$/, '');

  // SSH shorthand: git@host:owner/repo → https://host/owner/repo
  const sshShorthand = withoutGit.match(/^[^@/]+@([^:/]+):(.+)$/);
  if (sshShorthand) {
    return `https://${sshShorthand[1]}/${sshShorthand[2]}`;
  }

  // Explicit scheme (ssh://, http://, https://, git://, …):
  // git@-style userinfo is dropped and the scheme is coerced to https.
  const withScheme = withoutGit.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(.+)$/);
  if (withScheme) {
    const afterScheme = withScheme[1].replace(/^[^@/]+@/, '');
    return `https://${afterScheme}`;
  }

  // Scheme-less host/owner/repo → https://host/owner/repo
  return `https://${withoutGit}`;
}

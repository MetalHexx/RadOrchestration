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

export function normalizeRemote(remote: string): string {
  return remote.replace(/\.git$/, '');
}

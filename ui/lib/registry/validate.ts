import { statSync } from 'node:fs';
import { isSlug } from '@rad-orchestration/repo-registry';
import type { Registry } from '@rad-orchestration/repo-registry';
import { RegistryError } from '@/lib/registry/errors';

export function validateSlug(slug: string): void {
  if (!isSlug(slug)) {
    throw new RegistryError('SLUG_INVALID', `'${slug}' is not a valid slug.`, 'slug');
  }
}

// `label` is the human Proper-Case name used in the message ("Local Path");
// `field` stays the machine name so the UI can route the error to the input.
export function validateRequired(value: string | undefined, field: string, label: string = field): void {
  if (value === undefined || value.trim() === '') {
    throw new RegistryError('REQUIRED', `${label} is required.`, field);
  }
}

export function validateDirectory(p: string, field: string, label: string = field): void {
  try {
    if (statSync(p).isDirectory()) return;
  } catch { /* falls through */ }
  throw new RegistryError('PATH_INVALID', `${label} must be an existing folder on this machine.`, field);
}

export function validateUniqueName(reg: Registry, slug: string): void {
  if (slug in reg.repos || slug in reg.repoGroups) {
    throw new RegistryError('NAME_TAKEN', `A repo or repo-group named '${slug}' already exists.`, 'slug');
  }
}

// Normalize a git remote per AD-4. This MIRRORS the canonical normalizer in
// `cli/src/lib/repo-identity.ts` exactly so the CLI and the API agree on a
// single canonical form for the same remote: trim, strip a trailing `.git`,
// and convert SSH shorthand (`git@host:owner/repo` → `https://host/owner/repo`).
// Every other form is left unchanged (no coercion of `http://`, `ssh://`, or
// scheme-less forms to https) — the CLI does not coerce them either, and
// rewriting them here would persist mixed formats across the two writers.
//
// TODO: this duplicated logic should ideally be centralized in
// `@rad-orchestration/repo-registry` so the CLI + API share one source of
// truth. Not extracted here to keep this change scoped.
export function normalizeRemote(raw: string): string {
  let r = raw.trim().replace(/\.git$/, '');
  // git@github.com:org/repo → https://github.com/org/repo
  const sshMatch = r.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) r = `https://${sshMatch[1]}/${sshMatch[2]}`;
  return r;
}

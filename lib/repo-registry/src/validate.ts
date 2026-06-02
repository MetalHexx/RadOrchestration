import type { Registry } from './types.js';
export function isSlug(name: string): boolean { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name); }
export function assertUniqueName(reg: Registry, name: string): void {
  if (name in reg.repos || name in reg.repoGroups) {
    throw new Error(`name '${name}' already exists as a repo or repo-group`);
  }
}

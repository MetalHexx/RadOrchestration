import type { Registry } from './types.js';
export interface Resolved { name: string; bound: boolean; path: string | null; hint: string | null }
export function resolveRepoPath(reg: Registry, name: string): Resolved {
  const local = reg.localPaths[name];
  if (local) return { name, bound: true, path: local, hint: null };
  return { name, bound: false, path: null, hint: `run \`radorch repo bind ${name} <path>\`` };
}

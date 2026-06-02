import { describe, it, expect } from 'vitest';
import { isSlug, assertUniqueName, resolveRepoPath } from '../src/index.js';
import type { Registry } from '../src/index.js';

const reg: Registry = {
  repos: { 'web-app': { remote: 'g', default_branch: 'main', description: '' } },
  repoGroups: { 'core-set': { description: '', members: ['web-app'] } },
  localPaths: { 'web-app': '/clones/web-app' },
};

describe('slug + uniqueness', () => {
  it('accepts lowercase-kebab and rejects others', () => {
    expect(isSlug('web-app')).toBe(true);
    expect(isSlug('Web_App')).toBe(false);
    expect(isSlug('web app')).toBe(false);
  });
  it('rejects a name colliding with a repo or a repo-group', () => {
    expect(() => assertUniqueName(reg, 'web-app')).toThrow(/already exists/i);
    expect(() => assertUniqueName(reg, 'core-set')).toThrow(/already exists/i);
    expect(() => assertUniqueName(reg, 'fresh-name')).not.toThrow();
  });
});

describe('path resolution', () => {
  it('returns bound state for a repo with a local path', () => {
    expect(resolveRepoPath(reg, 'web-app')).toEqual({ name: 'web-app', bound: true, path: '/clones/web-app', hint: null });
  });
  it('returns unbound state with bind hint for a repo lacking a local path', () => {
    const r = resolveRepoPath({ ...reg, localPaths: {} }, 'web-app');
    expect(r.bound).toBe(false);
    expect(r.path).toBeNull();
    expect(r.hint).toMatch(/repo bind/);
  });
});

import { describe, it, expect } from 'vitest';
import { slugify, groupId, isGroupId } from '../src/ids.js';

describe('node id derivation', () => {
  it('kebab-cases a group name into a group:<slug> id', () => {
    expect(groupId('MULTI REPO')).toBe('group:multi-repo');
    expect(groupId('Already-Kebab')).toBe('group:already-kebab');
    expect(groupId('  Spaces & Symbols!! ')).toBe('group:spaces-symbols');
  });
  it('slugify trims, lowercases, and collapses non-alphanumerics to single hyphens', () => {
    expect(slugify('Foo__Bar  Baz')).toBe('foo-bar-baz');
    expect(slugify('--edge--')).toBe('edge');
  });
  it('isGroupId distinguishes stored group ids from derived project ids', () => {
    expect(isGroupId('group:multi-repo')).toBe(true);
    expect(isGroupId('MULTI-REPO-3')).toBe(false);
  });
});

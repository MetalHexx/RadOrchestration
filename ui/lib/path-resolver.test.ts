import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { withHomedir } from './test-helpers.js';
import { getRegistryRoot, getProjectsRoot } from './path-resolver.js';

test('getRegistryRoot returns the user-data root (parent of projects) (AD-6)', async () => {
  await withHomedir('C:\\fake\\home', () => {
    assert.equal(getRegistryRoot(), path.join('C:\\fake\\home', '.radorc'));
  });
});

test('getRegistryRoot is the parent of getProjectsRoot (AD-6)', async () => {
  await withHomedir('C:\\fake\\home', () => {
    assert.equal(getRegistryRoot(), path.dirname(getProjectsRoot()));
  });
});

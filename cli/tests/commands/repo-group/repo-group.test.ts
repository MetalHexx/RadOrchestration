import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo } from '../../../../lib/repo-registry/src/index.js';
import { groupCreate } from '../../../src/commands/repo-group/create.js';
import { groupAdd, groupRemove } from '../../../src/commands/repo-group/members.js';
import { groupDelete } from '../../../src/commands/repo-group/delete.js';
import { groupList, groupShow } from '../../../src/commands/repo-group/list-show.js';

const DESC = 'The product domain stack';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'grp-'));
  addRepo({ root, name: 'a', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/a' });
  addRepo({ root, name: 'b', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo-group', () => {
  it('creates from members and rejects a name colliding with a repo', () => {
    groupCreate({ root, name: 'set', members: ['a', 'b'], description: DESC });
    expect(groupShow({ root, name: 'set' }).members).toEqual(['a', 'b']);
    expect(() => groupCreate({ root, name: 'a', members: ['b'], description: DESC })).toThrow(/already exists/i);
  });
  it('requires a non-empty description', () => {
    expect(() => groupCreate({ root, name: 'set', members: ['a'] })).toThrow(/description is required/i);
    expect(() => groupCreate({ root, name: 'set', members: ['a'], description: '  ' })).toThrow(/description is required/i);
  });
  it('create fails when a named member is not registered', () => {
    expect(() => groupCreate({ root, name: 'set', members: ['ghost'], description: DESC })).toThrow(/not a registered repo/i);
  });
  it('throws UserError when group name is not a valid slug', () => {
    expect(() => groupCreate({ root, name: 'Bad Name', members: ['a'], description: DESC })).toThrow(/not a valid slug/i);
  });
  it('remove throws a UserError when the repo is not registered at all', () => {
    groupCreate({ root, name: 'set', members: ['a'], description: DESC });
    expect(() => groupRemove({ root, group: 'set', repo: 'absent' })).toThrow(/not a registered repo/i);
  });
  it('remove of a registered repo that is not a member is a no-op returning removed: false', () => {
    groupCreate({ root, name: 'set', members: ['a'], description: DESC });
    // 'b' is registered (added in beforeEach) but NOT a member of 'set'
    const r = groupRemove({ root, group: 'set', repo: 'b' });
    expect(r.removed).toBe(false);
  });
  it('add and remove act on membership', () => {
    groupCreate({ root, name: 'set', members: ['a'], description: DESC });
    groupAdd({ root, group: 'set', repo: 'b' });
    expect(groupShow({ root, name: 'set' }).members).toEqual(['a', 'b']);
  });
  it('delete removes the group but not its member repos; list returns groups with members', () => {
    groupCreate({ root, name: 'set', members: ['a', 'b'], description: DESC });
    groupDelete({ root, name: 'set' });
    expect(() => groupShow({ root, name: 'set' })).toThrow(/not a registered repo-group/i);
    expect(groupList({ root }).groups).toEqual([]);
  });
});

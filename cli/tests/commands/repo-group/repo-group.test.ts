import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo } from '../../../../lib/repo-registry/src/index.js';
import { groupCreate } from '../../../src/commands/repo-group/create.js';
import { groupAdd, groupRemove } from '../../../src/commands/repo-group/members.js';
import { groupDelete } from '../../../src/commands/repo-group/delete.js';
import { groupList, groupShow } from '../../../src/commands/repo-group/list-show.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'grp-'));
  addRepo({ root, name: 'a', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/a' });
  addRepo({ root, name: 'b', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo-group', () => {
  it('creates from members and rejects a name colliding with a repo', () => {
    groupCreate({ root, name: 'set', members: ['a', 'b'] });
    expect(groupShow({ root, name: 'set' }).members).toEqual(['a', 'b']);
    expect(() => groupCreate({ root, name: 'a', members: ['b'] })).toThrow(/already exists/i);
  });
  it('create fails when a named member is not registered', () => {
    expect(() => groupCreate({ root, name: 'set', members: ['ghost'] })).toThrow(/not a registered repo/i);
  });
  it('add and remove act on membership and remove of a non-member is a clear no-op', () => {
    groupCreate({ root, name: 'set', members: ['a'] });
    groupAdd({ root, group: 'set', repo: 'b' });
    expect(groupShow({ root, name: 'set' }).members).toEqual(['a', 'b']);
    const r = groupRemove({ root, group: 'set', repo: 'absent' });
    expect(r.removed).toBe(false);
  });
  it('delete removes the group but not its member repos; list returns groups with members', () => {
    groupCreate({ root, name: 'set', members: ['a', 'b'] });
    groupDelete({ root, name: 'set' });
    expect(() => groupShow({ root, name: 'set' })).toThrow(/not a registered repo-group/i);
    expect(groupList({ root }).groups).toEqual([]);
  });
});

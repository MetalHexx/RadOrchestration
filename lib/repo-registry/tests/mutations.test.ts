import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, removeRepo, createGroup, addGroupMember, removeGroupMember, deleteGroup, readRegistry } from '../src/index.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo + group mutations', () => {
  it('adds a repo with identity and local path, rejecting a duplicate name', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    const reg = readRegistry({ root });
    expect(reg.repos.svc).toBeTruthy();
    expect(reg.localPaths.svc).toBe('/c/svc');
    expect(() => addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc2' })).toThrow(/already exists/i);
  });
  it('removing a repo drops it from identity, local paths, and every group membership', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    createGroup({ root, name: 'grp', members: ['svc'] });
    removeRepo({ root, name: 'svc' });
    const reg = readRegistry({ root });
    expect(reg.repos.svc).toBeUndefined();
    expect(reg.localPaths.svc).toBeUndefined();
    expect(reg.repoGroups.grp.members).not.toContain('svc');
  });
  it('group membership add is idempotent and remove of a non-member is a no-op', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    createGroup({ root, name: 'grp', members: [] });
    addGroupMember({ root, group: 'grp', repo: 'svc' });
    addGroupMember({ root, group: 'grp', repo: 'svc' });
    expect(readRegistry({ root }).repoGroups.grp.members).toEqual(['svc']);
    expect(() => removeGroupMember({ root, group: 'grp', repo: 'absent' })).not.toThrow();
    deleteGroup({ root, name: 'grp' });
    expect(readRegistry({ root }).repos.svc).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, editRepo, removeRepo, bindRepo, createGroup, editGroup, addGroupMember, removeGroupMember, deleteGroup, readRegistry } from '../src/index.js';
import { writeIdentity } from '../src/io.js';

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

  it('addRepo throws when name is not a valid slug', () => {
    expect(() => addRepo({ root, name: 'My Repo!', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/myrepo' })).toThrow(/not a valid slug/i);
  });

  it('createGroup throws when name is not a valid slug', () => {
    expect(() => createGroup({ root, name: 'My Group!', members: [] })).toThrow(/not a valid slug/i);
  });

  it('removing an unbound repo (no local path) does NOT create repo-registry.local.yml', () => {
    // Add a repo without a local path by writing the identity file directly — the public
    // API always requires localPath, so we use writeIdentity to simulate the unbound state
    // described in the lazy-creation contract.
    writeIdentity({ root, repos: { unbound: { remote: 'g', default_branch: 'main', description: '' } }, repoGroups: {} });
    // sanity: local file must not exist yet
    const localFile = `${root}/repo-registry.local.yml`;
    expect(fs.existsSync(localFile)).toBe(false);
    removeRepo({ root, name: 'unbound' });
    expect(fs.existsSync(localFile)).toBe(false);
  });

  it('removing a bound repo (with local path) still updates repo-registry.local.yml', () => {
    addRepo({ root, name: 'svc2', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc2' });
    const localFile = `${root}/repo-registry.local.yml`;
    expect(fs.existsSync(localFile)).toBe(true);
    removeRepo({ root, name: 'svc2' });
    expect(fs.existsSync(localFile)).toBe(true);
    const reg = readRegistry({ root });
    expect(reg.localPaths.svc2).toBeUndefined();
  });

  it('editRepo updates only the supplied fields and persists, throwing on a missing repo', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: 'old' }, localPath: '/c/svc' });
    const updated = editRepo({ root, name: 'svc', description: 'new desc' });
    expect(updated.description).toBe('new desc');
    const reg = readRegistry({ root });
    expect(reg.repos.svc.description).toBe('new desc');
    expect(reg.repos.svc.remote).toBe('g'); // untouched
    expect(reg.repos.svc.default_branch).toBe('main'); // untouched
    expect(() => editRepo({ root, name: 'ghost', description: 'x' })).toThrow(/does not exist/i);
  });

  it('bindRepo records the local path and throws when the repo is not registered', () => {
    writeIdentity({ root, repos: { unbound: { remote: 'g', default_branch: 'main', description: '' } }, repoGroups: {} });
    bindRepo({ root, name: 'unbound', localPath: '/c/unbound' });
    expect(readRegistry({ root }).localPaths.unbound).toBe('/c/unbound');
    expect(() => bindRepo({ root, name: 'ghost', localPath: '/c/ghost' })).toThrow(/does not exist/i);
  });

  it('editGroup changes the description without touching members, throwing on a missing group', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    createGroup({ root, name: 'grp', members: ['svc'], description: 'old rationale' });
    editGroup({ root, name: 'grp', description: 'new rationale' });
    const reg = readRegistry({ root });
    expect(reg.repoGroups.grp.description).toBe('new rationale');
    expect(reg.repoGroups.grp.members).toEqual(['svc']);
    expect(() => editGroup({ root, name: 'ghost', description: 'x' })).toThrow(/does not exist/i);
  });
});

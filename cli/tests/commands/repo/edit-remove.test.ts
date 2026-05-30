import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, createGroup, readRegistry } from '../../../../lib/repo-registry/src/index.js';
import { repoEdit } from '../../../src/commands/repo/edit.js';
import { repoRemove } from '../../../src/commands/repo/remove.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'er-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo edit/remove', () => {
  it('edits description without renaming or touching the local path', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: 'old' }, localPath: '/c/svc' });
    repoEdit({ root, name: 'svc', description: 'new' });
    const reg = readRegistry({ root });
    expect(reg.repos.svc.description).toBe('new');
    expect(reg.localPaths.svc).toBe('/c/svc');
  });
  it('edit fails when no editable field flag is supplied', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    expect(() => repoEdit({ root, name: 'svc' })).toThrow(/no editable field/i);
  });
  it('edit fails for an unregistered repo', () => {
    expect(() => repoEdit({ root, name: 'ghost', description: 'x' })).toThrow(/not registered/i);
  });
  it('remove unregisters across identity, local, and groups', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/svc' });
    createGroup({ root, name: 'grp', members: ['svc'] });
    repoRemove({ root, name: 'svc' });
    const reg = readRegistry({ root });
    expect(reg.repos.svc).toBeUndefined();
    expect(reg.localPaths.svc).toBeUndefined();
    expect(reg.repoGroups.grp.members).not.toContain('svc');
  });
  it('remove fails for an unregistered repo', () => {
    expect(() => repoRemove({ root, name: 'ghost' })).toThrow(/not registered/i);
  });
});

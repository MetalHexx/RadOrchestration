import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, writeIdentity } from '../../../../lib/repo-registry/src/index.js';
import { repoList } from '../../../src/commands/repo/list.js';
import { repoShow } from '../../../src/commands/repo/show.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo list/show', () => {
  it('lists a bound repo and an unbound repo with a bind hint', () => {
    addRepo({ root, name: 'bound-one', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
    writeIdentity({ root, repos: { 'bound-one': { remote: 'g', default_branch: 'main', description: '' }, 'unbound-one': { remote: 'h', default_branch: 'main', description: '' } }, repoGroups: {} });
    const r = repoList({ root });
    const ub = r.repos.find((x) => x.name === 'unbound-one')!;
    expect(ub.bound).toBe(false);
    expect(ub.hint).toMatch(/repo bind/);
  });
  it('show returns full detail including group memberships and unbound state', () => {
    writeIdentity({ root, repos: { solo: { remote: 'h', default_branch: 'main', description: 'd' } }, repoGroups: { grp: { description: '', members: ['solo'] } } });
    const r = repoShow({ root, name: 'solo' });
    expect(r.groups).toContain('grp');
    expect(r.bound).toBe(false);
    expect(r.hint).toMatch(/repo bind/);
  });
  it('show fails for an unregistered name', () => {
    expect(() => repoShow({ root, name: 'ghost' })).toThrow(/not registered/i);
  });
});

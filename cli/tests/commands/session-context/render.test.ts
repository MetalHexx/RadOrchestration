import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, writeIdentity, createGroup } from '../../../../lib/repo-registry/src/index.js';
import { renderPreamble } from '../../../src/commands/session-context/render.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('session-context preamble', () => {
  it('empty state: warm verbatim greeting wrapped in a delivery directive, no registry block', () => {
    const text = renderPreamble({ root });
    // Benign delivery directive so the assistant relays the message (not improvises).
    expect(text).toMatch(/Begin your first reply/);
    // The locked empty-state copy.
    expect(text).toMatch(/Rad Orc is ready!/);
    expect(text).toMatch(/there aren't any repositories registered yet/);
    expect(text).toMatch(/plan and make changes across them/);
    expect(text).toMatch(/\/rad-repo/);
    // Empty state never renders the registry block.
    expect(text).not.toMatch(/\[unbound\]/i);
    expect(text).not.toMatch(/your repo map is loaded/);
  });

  it('registered, all bound: names repo + group slugs and counts, ends on the review pointer; no paths, no unbound nudge', () => {
    addRepo({ root, name: 'repo-one', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/one' });
    addRepo({ root, name: 'repo-two', identity: { remote: 'h', default_branch: 'main', description: '' }, localPath: '/c/two' });
    createGroup({ root, name: 'core-set', members: ['repo-one', 'repo-two'] });
    const text = renderPreamble({ root });
    expect(text).toMatch(/Begin your first reply/);
    expect(text).toMatch(/your repo map is loaded/);
    expect(text).toMatch(/2 repositories/);
    expect(text).toContain('repo-one');
    expect(text).toContain('repo-two');
    expect(text).toContain('core-set');
    expect(text).toMatch(/review or update your repos/);
    expect(text).toMatch(/\/rad-repo/);
    // Brevity guarantee: no local paths; and no unbound nudge when all bound.
    expect(text).not.toContain('/c/one');
    expect(text).not.toMatch(/isn't bound/);
  });

  it('registered, with an unbound repo: flags it by name with the bind nudge instead of the review pointer', () => {
    addRepo({ root, name: 'bound-one', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
    writeIdentity({ root, repos: { 'bound-one': { remote: 'g', default_branch: 'main', description: '' }, 'unbound-one': { remote: 'h', default_branch: 'main', description: '' } }, repoGroups: {} });
    const text = renderPreamble({ root });
    expect(text).toMatch(/your repo map is loaded/);
    expect(text).toMatch(/2 repositories/);
    expect(text).toContain('unbound-one');
    expect(text).toMatch(/isn't bound to a local folder/);
    expect(text).toMatch(/point it at the right clone/);
    // The bind nudge replaces the generic review pointer.
    expect(text).not.toMatch(/review or update your repos/);
  });
});

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
  it('emits an assistant-directed summary with repos, unbound flagged, groups, counts, and the /rad-repo pointer', () => {
    addRepo({ root, name: 'bound-one', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
    writeIdentity({ root, repos: { 'bound-one': { remote: 'g', default_branch: 'main', description: '' }, 'unbound-one': { remote: 'h', default_branch: 'main', description: '' } }, repoGroups: {} });
    createGroup({ root, name: 'core-set', members: ['bound-one'] });
    const text = renderPreamble({ root });
    // Assistant-directed relay directive (the announcement instruction).
    expect(text).toMatch(/session-start/i);
    expect(text).toMatch(/first reply/i);
    // Concise facts: names, unbound flag, group, and counts.
    expect(text).toContain('bound-one');
    expect(text).toMatch(/unbound-one.*\[unbound\]/i);
    expect(text).toContain('core-set');
    expect(text).toMatch(/2 total/);
    expect(text).toMatch(/1 unbound/);
    expect(text).toMatch(/\/rad-repo/);
    // Local paths are intentionally omitted for brevity.
    expect(text).not.toContain('/c/b');
  });
  it('emits an assistant-directed empty-state announcement to /rad-repo and no registry block when nothing is registered', () => {
    const text = renderPreamble({ root });
    expect(text).toMatch(/session-start/i);
    expect(text).toMatch(/first reply/i);
    expect(text).toMatch(/no repositories are registered/i);
    expect(text).toMatch(/\/rad-repo/);
    expect(text).not.toMatch(/\[unbound\]/i);
  });
});

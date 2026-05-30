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
  it('emits init line, projects awareness, concise registry block with unbound flagged, and the /rad-repo pointer', () => {
    addRepo({ root, name: 'bound-one', identity: { remote: 'g', default_branch: 'main', description: '' }, localPath: '/c/b' });
    writeIdentity({ root, repos: { 'bound-one': { remote: 'g', default_branch: 'main', description: '' }, 'unbound-one': { remote: 'h', default_branch: 'main', description: '' } }, repoGroups: {} });
    createGroup({ root, name: 'core-set', members: ['bound-one'] });
    const text = renderPreamble({ root });
    expect(text).toContain('Rad Orc Initialized!');
    expect(text).toContain('.radorc/projects/');
    expect(text).toContain('bound-one');
    expect(text).toMatch(/unbound-one.*unbound/i);
    expect(text).toContain('core-set');
    expect(text.trimEnd().endsWith('/rad-repo')).toBe(false);
    expect(text).toMatch(/\/rad-repo/);
  });
  it('emits empty-state nudge to /rad-repo and no registry block when nothing is registered', () => {
    const text = renderPreamble({ root });
    expect(text).toContain('Rad Orc Initialized!');
    expect(text).toMatch(/\/rad-repo/);
    expect(text).not.toMatch(/unbound/i);
  });
});

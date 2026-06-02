import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRepo, createGroup, readRegistry } from '../../../../lib/repo-registry/src/index.js';
import { repoEdit, repoEditCommand } from '../../../src/commands/repo/edit.js';
import { repoRemove } from '../../../src/commands/repo/remove.js';
import { runCommand } from '../../../src/framework/command.js';

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
  it('edit refuses to blank the description', () => {
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: 'old' }, localPath: '/c/svc' });
    expect(() => repoEdit({ root, name: 'svc', description: '   ' })).toThrow(/description cannot be empty/i);
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

describe('repo edit command shell — string flags (FR-8)', () => {
  it('--description flag delivers a string value to the handler, not a boolean', async () => {
    // Seed a repo so the edit can resolve it.
    addRepo({ root, name: 'svc', identity: { remote: 'g', default_branch: 'main', description: 'old' }, localPath: '/c/svc' });

    // Capture which flags the framework delivered to the handler.
    type EditFlags = { description?: string; remote?: string; 'default-branch'?: string };
    let capturedFlags: EditFlags = {};

    // Probe handler: capture flags then forward the edit to our temp root.
    const probeDef = {
      ...repoEditCommand,
      handler: async ({ args, flags }: { args: { name?: string }; flags: EditFlags; ctx: unknown }) => {
        capturedFlags = flags;
        return repoEdit({ root, name: args.name ?? '', description: flags.description, remote: flags.remote, defaultBranch: flags['default-branch'] });
      },
      mapResult: undefined as never,
    };

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);

    try {
      await runCommand(probeDef, {
        argv: ['--name', 'svc', '--description', 'new text'],
        env: { RADORCH_NO_LOG: '1' },
        isTTY: false,
        stderr: process.stderr,
      });
    } finally {
      log.mockRestore();
      exit.mockRestore();
    }

    // The flag must have been delivered as a string, not a boolean or undefined.
    expect(capturedFlags.description).toBe('new text');

    // The registry must now store the updated description.
    const reg = readRegistry({ root });
    expect(reg.repos.svc.description).toBe('new text');
  });
});

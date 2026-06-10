import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { locate } from '../src/derive/locate.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'loc-'));
}

describe('locate classifier (FR-12, FR-13)', () => {
  it('classifies a cwd under worktrees/<name>/<repo> as kind=worktree with name+repo', () => {
    const root = tmp();
    const wt = path.join(root, 'worktrees', 'MY-PROJ', 'rad-orc-source');
    fs.mkdirSync(wt, { recursive: true });
    const r = locate(path.join(wt, 'cli'), {
      projectsDir: path.join(root, 'projects'),
      worktreesDir: path.join(root, 'worktrees'),
      sideProjectsDir: path.join(root, 'side-projects'),
      registryLocalPaths: {},
      exec: () => '',
    });
    expect(r.kind).toBe('worktree');
    expect(r.worktree_name).toBe('MY-PROJ');
    expect(r.repo).toBe('rad-orc-source');
  });

  it('classifies a registered repo local path as kind=main-clone', () => {
    const root = tmp();
    const clone = tmp();
    const r = locate(clone, {
      projectsDir: path.join(root, 'projects'),
      worktreesDir: path.join(root, 'worktrees'),
      sideProjectsDir: path.join(root, 'side-projects'),
      registryLocalPaths: { 'rad-orc-source': clone },
      exec: () => '',
    });
    expect(r.kind).toBe('main-clone');
    expect(r.repo).toBe('rad-orc-source');
  });

  it('classifies a cwd under side-projects/<name> as kind=side-project', () => {
    const root = tmp();
    const sp = path.join(root, 'side-projects', 'TOY');
    fs.mkdirSync(sp, { recursive: true });
    const r = locate(sp, {
      projectsDir: path.join(root, 'projects'),
      worktreesDir: path.join(root, 'worktrees'),
      sideProjectsDir: path.join(root, 'side-projects'),
      registryLocalPaths: {},
      exec: () => '',
    });
    expect(r.kind).toBe('side-project');
    expect(r.worktree_name).toBe('TOY');
  });

  it('classifies an unrelated cwd as kind=none', () => {
    const root = tmp();
    const r = locate(tmp(), {
      projectsDir: path.join(root, 'projects'),
      worktreesDir: path.join(root, 'worktrees'),
      sideProjectsDir: path.join(root, 'side-projects'),
      registryLocalPaths: {},
      exec: () => '',
    });
    expect(r.kind).toBe('none');
  });
});

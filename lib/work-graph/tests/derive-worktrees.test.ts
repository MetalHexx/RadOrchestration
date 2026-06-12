import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveWorktrees } from '../src/derive/worktrees.js';

let root: string;
let projectsDir: string;
let worktreesDir: string;
let sideProjectsDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  projectsDir = path.join(root, 'projects');
  worktreesDir = path.join(root, 'worktrees');
  sideProjectsDir = path.join(root, 'side-projects');
  fs.mkdirSync(path.join(projectsDir, 'DEMO-1'), { recursive: true });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

function writeState(sc: unknown) {
  fs.writeFileSync(path.join(projectsDir, 'DEMO-1', 'state.json'),
    JSON.stringify({ project: { name: 'DEMO-1' }, pipeline: { source_control: sc }, graph: { nodes: {} } }));
}

function writeSideProjectState(sc: unknown) {
  fs.writeFileSync(path.join(projectsDir, 'DEMO-1', 'state.json'),
    JSON.stringify({ project: { name: 'DEMO-1', project_type: 'side-project' }, pipeline: { source_control: sc }, graph: { nodes: {} } }));
}

describe('worktree resolution', () => {
  it('returns [] when source_control is null', () => {
    writeState(null);
    expect(resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => '' })).toEqual([]);
  });
  it('resolves the target multi-repo convention path with live exists/branch from porcelain', () => {
    writeState({ repos: [{ name: 'rad-orc-source' }] });
    const wtPath = path.join(worktreesDir, 'DEMO-1', 'rad-orc-source');
    const porcelain = `worktree ${wtPath}\nHEAD abc\nbranch refs/heads/feature/x\n\n`;
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => porcelain });
    expect(refs).toEqual([{ repo: 'rad-orc-source', path: wtPath, branch: 'feature/x', exists: true, resolvedVia: 'convention' }]);
  });
  it('resolves repo worktrees under a shared worktree_name and reports shared-worktree-name reuse', () => {
    writeState({ repos: [{ name: 'rad-orc-source' }], worktree_name: 'PARENT-1' });
    const wtPath = path.join(worktreesDir, 'PARENT-1', 'rad-orc-source');
    const porcelain = `worktree ${wtPath}\nHEAD abc\nbranch refs/heads/feature/y\n\n`;
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => porcelain });
    expect(refs).toEqual([{ repo: 'rad-orc-source', path: wtPath, branch: 'feature/y', exists: true, resolvedVia: 'shared-worktree-name' }]);
  });
  it('falls back to the legacy single worktree_path with exists=false when git lists nothing', () => {
    writeState({ branch: 'MULTI-REPO-3', worktree_path: '/abs/wt/MULTI-REPO-3' });
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => '' });
    expect(refs).toEqual([{ repo: 'MULTI-REPO-3', path: '/abs/wt/MULTI-REPO-3', branch: 'MULTI-REPO-3', exists: false, resolvedVia: 'git' }]);
  });
});

describe('side-project resolution', () => {
  it('resolves a side-project to sideProjectsDir/<name> with branch and exists from porcelain', () => {
    writeSideProjectState({ worktree_name: 'DEMO-1', repos: [{ name: 'DEMO-1', branch: 'main' }] });
    const spPath = path.join(sideProjectsDir, 'DEMO-1');
    const porcelain = `worktree ${spPath}\nHEAD abc\nbranch refs/heads/main\n\n`;
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, sideProjectsDir, exec: () => porcelain });
    expect(refs).toEqual([{ repo: 'DEMO-1', path: spPath, branch: 'main', exists: true, resolvedVia: 'convention' }]);
  });
  it('reports exists=false and falls back to the sealed branch when git lists nothing', () => {
    writeSideProjectState({ worktree_name: 'DEMO-1', repos: [{ name: 'DEMO-1', branch: 'main' }] });
    const spPath = path.join(sideProjectsDir, 'DEMO-1');
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, sideProjectsDir, exec: () => '' });
    expect(refs).toEqual([{ repo: 'DEMO-1', path: spPath, branch: 'main', exists: false, resolvedVia: 'convention' }]);
  });
  it('defaults the repo name to the project name when sc.repos is empty', () => {
    writeSideProjectState({ repos: [] });
    const spPath = path.join(sideProjectsDir, 'DEMO-1');
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, sideProjectsDir, exec: () => '' });
    expect(refs).toEqual([{ repo: 'DEMO-1', path: spPath, branch: null, exists: false, resolvedVia: 'convention' }]);
  });
  it('degrades to standard worktree resolution when sideProjectsDir is not provided', () => {
    writeSideProjectState({ repos: [{ name: 'rad-orc-source' }] });
    const wtPath = path.join(worktreesDir, 'DEMO-1', 'rad-orc-source');
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => '' });
    expect(refs).toEqual([{ repo: 'rad-orc-source', path: wtPath, branch: null, exists: false, resolvedVia: 'convention' }]);
  });
});

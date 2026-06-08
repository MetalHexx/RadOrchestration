import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveWorktrees } from '../src/index.js';

let root: string;
let projectsDir: string;
let worktreesDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  projectsDir = path.join(root, 'projects');
  worktreesDir = path.join(root, 'worktrees');
  fs.mkdirSync(path.join(projectsDir, 'DEMO-1'), { recursive: true });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

function writeState(sc: unknown) {
  fs.writeFileSync(path.join(projectsDir, 'DEMO-1', 'state.json'),
    JSON.stringify({ project: { name: 'DEMO-1' }, pipeline: { source_control: sc }, graph: { nodes: {} } }));
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
  it('falls back to the legacy single worktree_path with exists=false when git lists nothing', () => {
    writeState({ branch: 'MULTI-REPO-3', worktree_path: '/abs/wt/MULTI-REPO-3' });
    const refs = resolveWorktrees('DEMO-1', { projectsDir, worktreesDir, exec: () => '' });
    expect(refs).toEqual([{ repo: 'MULTI-REPO-3', path: '/abs/wt/MULTI-REPO-3', branch: 'MULTI-REPO-3', exists: false, resolvedVia: 'git' }]);
  });
});

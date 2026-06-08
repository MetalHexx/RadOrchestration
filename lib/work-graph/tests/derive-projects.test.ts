import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listProjectNames, deriveProject } from '../src/index.js';

let root: string;
let projectsDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  projectsDir = path.join(root, 'projects');
  const dir = path.join(projectsDir, 'DEMO-1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    project: { name: 'DEMO-1', project_type: 'side-project' },
    pipeline: { current_tier: 'execution', source_control: { branch: 'x', worktree_path: '/w', auto_commit: 'always', auto_pr: 'always' } },
    graph: { nodes: { a: { status: 'completed' } } },
  }));
  fs.writeFileSync(path.join(dir, 'DEMO-1-REQUIREMENTS.md'), '');
  fs.writeFileSync(path.join(dir, 'DEMO-1-MASTER-PLAN.md'), '');
  fs.writeFileSync(path.join(dir, 'DEMO-1-ERROR-LOG.md'), '');
  fs.mkdirSync(path.join(projectsDir, '_archive'), { recursive: true });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('project derivation', () => {
  it('lists project folders, skipping underscore-prefixed dirs', () => {
    expect(listProjectNames(projectsDir)).toEqual(['DEMO-1']);
  });
  it('derives metadata, docs slots, and projectType from state.json', () => {
    const p = deriveProject('DEMO-1', { projectsDir, worktreesDir: path.join(root, 'worktrees'), exec: () => '' });
    expect(p?.kind).toBe('project');
    expect(p?.id).toBe('DEMO-1');
    expect(p?.dir).toBe(path.join(projectsDir, 'DEMO-1'));
    expect(p?.tier).toBe('execution');
    expect(p?.projectType).toBe('side-project');
    expect(p?.sourceControlInitialized).toBe(true);
    expect(p?.docs.requirements).toBe('DEMO-1-REQUIREMENTS.md');
    expect(p?.docs.masterPlan).toBe('DEMO-1-MASTER-PLAN.md');
    expect(p?.docs.brainstorming).toBeUndefined();
    expect(p?.docs.others).toEqual(['DEMO-1-ERROR-LOG.md']);
  });
  it('defaults projectType to standard when absent and returns null for a missing folder', () => {
    fs.writeFileSync(path.join(projectsDir, 'DEMO-1', 'state.json'), JSON.stringify({ project: { name: 'DEMO-1' }, graph: { nodes: {} } }));
    expect(deriveProject('DEMO-1', { projectsDir, worktreesDir: path.join(root, 'worktrees'), exec: () => '' })?.projectType).toBe('standard');
    expect(deriveProject('GHOST', { projectsDir, worktreesDir: path.join(root, 'worktrees'), exec: () => '' })).toBeNull();
  });
});

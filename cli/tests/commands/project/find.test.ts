import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectFind } from '../../../src/commands/project/find.js';

function makeProject(base: string, name: string, body: unknown) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(body), 'utf8');
}

describe('projectFind core', () => {
  it('scans execution-tier projects, skipping _-prefixed folders, sorted', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    makeProject(base, '_TEMP', { pipeline: { current_tier: 'execution' } });
    makeProject(base, 'BBB', { pipeline: { current_tier: 'execution' }, planning: { steps: [{ name: 'master_plan', doc_path: '/m.md' }] } });
    makeProject(base, 'AAA', { pipeline: { current_tier: 'execution' } });
    makeProject(base, 'CCC', { pipeline: { current_tier: 'brainstorming' } });
    const exec = vi.fn(() => '');
    const r = projectFind({ projectsBasePath: base, repoRoot: '/r', exec });
    expect(r.projects.map((p) => p.name)).toEqual(['AAA', 'BBB']);
  });

  it('lookup-mode returns the project regardless of tier, single-element array on hit', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    makeProject(base, 'P', { pipeline: { current_tier: 'planning' } });
    const exec = vi.fn(() => '');
    const r = projectFind({ projectsBasePath: base, repoRoot: '/r', projectName: 'P', exec });
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0]!.currentTier).toBe('planning');
  });

  it('lookup-mode returns empty array when project not found', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    const exec = vi.fn(() => '');
    expect(projectFind({ projectsBasePath: base, repoRoot: '/r', projectName: 'NOPE', exec }).projects).toEqual([]);
  });
});

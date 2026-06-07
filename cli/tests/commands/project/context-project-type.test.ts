import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectContext } from '../../../src/commands/project/context.js';

const stubExec = () => '';

function withProjectsHome(projectName: string, projectType: string | null | 'no-field'): () => void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-ptype-'));
  const orig = os.homedir;
  (os as { homedir: () => string }).homedir = () => home;
  const projDir = path.join(home, '.radorc', 'projects', projectName);
  fs.mkdirSync(projDir, { recursive: true });
  const project: Record<string, unknown> = { name: projectName, created: 'c', updated: 'u' };
  if (projectType !== 'no-field') project.project_type = projectType;
  fs.writeFileSync(path.join(projDir, 'state.json'), JSON.stringify({ project }));
  return () => { (os as { homedir: () => string }).homedir = orig; fs.rmSync(home, { recursive: true, force: true }); };
}

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('projectContext — project_type', () => {
  it('returns the stored side-project kind', () => {
    cleanups.push(withProjectsHome('P', 'side-project'));
    expect(projectContext({ projectName: 'P', exec: stubExec }).projectType).toBe('side-project');
  });
  it('returns standard when the field is stored as standard', () => {
    cleanups.push(withProjectsHome('P', 'standard'));
    expect(projectContext({ projectName: 'P', exec: stubExec }).projectType).toBe('standard');
  });
  it('defaults to standard when the field is absent (backward-compatible)', () => {
    cleanups.push(withProjectsHome('P', 'no-field'));
    expect(projectContext({ projectName: 'P', exec: stubExec }).projectType).toBe('standard');
  });
});

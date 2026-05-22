import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enrichActionContext } from '../lib/context-enrichment';

function makeTmpRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-'));
  const skillDir = path.join(root, 'packages/x/skills/demo');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
    '---\nname: demo\ndescription: a demo skill\n---\nbody\n', 'utf8');
  return root;
}

describe('context-enrichment skills block', () => {
  it('spawn_requirements enrichment emits Repository Skills Available block (no subprocess hop)', () => {
    const root = makeTmpRepo();
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const r = enrichActionContext({
        action: 'spawn_requirements',
        walkerContext: {},
        state: { graph: { nodes: {} }, pipeline: {} },
        config: { limits: { max_phases: 10, max_tasks_per_phase: 8 } },
        cliContext: {},
        scriptsDir: '/unused-after-fold',
      });
      expect(r.repository_skills_block).toMatch(/## Repository Skills Available/);
      expect(r.repository_skills_block).toMatch(/"name": "demo"/);
      expect(r.repository_skills_block).toMatch(/Entries above are a catalog\./);
    } finally { process.chdir(cwd); }
  });

  it('empty manifest yields empty string', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-empty-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const r = enrichActionContext({
        action: 'spawn_requirements',
        walkerContext: {},
        state: { graph: { nodes: {} }, pipeline: {} },
        config: { limits: { max_phases: 10, max_tasks_per_phase: 8 } },
        cliContext: {},
        scriptsDir: '/unused-after-fold',
      });
      expect(r.repository_skills_block).toBe('');
    } finally { process.chdir(cwd); }
  });
});

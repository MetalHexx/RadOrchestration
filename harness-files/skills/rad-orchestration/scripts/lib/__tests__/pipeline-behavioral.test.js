import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enrichActionContext } from '../context-enrichment.js';

function makeTmpRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-'));
  const skillDir = path.join(root, 'packages/x/skills/demo');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
    '---\nname: demo\ndescription: a demo skill\n---\nbody\n', 'utf8');
  return root;
}

test('spawn_requirements enrichment: repository_skills_block shape validation (NFR-4)', async (t) => {
  await t.test('emits Repository Skills Available block when skills exist', () => {
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

      // NFR-4: repository_skills_block must be either '' or start with exact literal
      const isEmptyString = r.repository_skills_block === '';
      const startsWithHeader = typeof r.repository_skills_block === 'string' &&
        r.repository_skills_block.startsWith('\n\n## Repository Skills Available\n\n');

      assert.ok(
        isEmptyString || startsWithHeader,
        `repository_skills_block shape invalid. Got: ${JSON.stringify(r.repository_skills_block)}`
      );
    } finally {
      process.chdir(cwd);
    }
  });

  await t.test('emits empty string when no skills', () => {
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

      // NFR-4: must be either '' or start with the header
      const isEmptyString = r.repository_skills_block === '';
      const startsWithHeader = typeof r.repository_skills_block === 'string' &&
        r.repository_skills_block.startsWith('\n\n## Repository Skills Available\n\n');

      assert.ok(
        isEmptyString || startsWithHeader,
        `repository_skills_block shape invalid. Got: ${JSON.stringify(r.repository_skills_block)}`
      );
    } finally {
      process.chdir(cwd);
    }
  });
});

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const reqWf = readFileSync(path.join(repoRoot, '.claude/skills/rad-create-plans/references/requirements/workflow.md'), 'utf8');
const mpWf  = readFileSync(path.join(repoRoot, '.claude/skills/rad-create-plans/references/master-plan/workflow.md'), 'utf8');
for (const [label, text] of [['requirements', reqWf], ['master-plan', mpWf]]) {
  assert.match(text, /## Repository Skills Available/, `${label} workflow must reference the literal heading`);
  assert.match(text, /no Grep\/Glob hunt|no Grep\/Glob|do not Grep|absolute `path` directly/i, `${label} workflow must instruct the planner to read the absolute path directly`);
  assert.match(text, /Absence of the section/i, `${label} workflow must teach the absent-section-is-normal rule`);
  // The consultation lives inside the existing inputs/discovery step, not as its own top-level section.
  assert.equal(text.match(/^## .*Repository Skills/m), null, `${label} workflow must NOT introduce a top-level section for the manifest consultation`);
}
console.log('workflow consultation step assertions passed');

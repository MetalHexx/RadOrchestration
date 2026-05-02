import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const groupA = ['brainstorm', 'code-review', 'configure-system', 'create-agent', 'create-skill'];
for (const oldName of groupA) {
  const newName = `rad-${oldName}`;
  const oldDir = path.join(repoRoot, '.claude/skills', oldName);
  const newDir = path.join(repoRoot, '.claude/skills', newName);
  assert.equal(existsSync(oldDir), false, `${oldDir} must not exist after rename`);
  assert.equal(existsSync(newDir), true, `${newDir} must exist after rename`);
  const fm = readFileSync(path.join(newDir, 'SKILL.md'), 'utf8').slice(0, 600);
  assert.match(fm, new RegExp(`^name:\\s*${newName}\\s*$`, 'm'), `${newName}/SKILL.md frontmatter must declare name: ${newName}`);
}
console.log('group-A rename assertions passed');

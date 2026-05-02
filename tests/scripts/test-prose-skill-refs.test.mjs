import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
function walk(dir, out=[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules','.git','dist','build','out','coverage','installer','ui','tests'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md') && !p.includes('CHANGELOG')) out.push(p);
  }
  return out;
}
const oldNames = ['brainstorm','code-review','configure-system','create-agent','create-skill','execute-coding-task','log-error','run-tests','source-control'];
// Backtick-fenced occurrences only — prose like "we run tests" is not a skill ref.
const errors = [];
for (const f of walk(repoRoot)) {
  const text = readFileSync(f, 'utf8');
  for (const old of oldNames) {
    const re = new RegExp('`' + old + '`', 'g');
    if (re.test(text)) errors.push(`${path.relative(repoRoot, f)}: backtick reference to old name \`${old}\``);
  }
}
assert.deepEqual(errors, [], 'prose still contains old skill backtick refs:\n  - ' + errors.join('\n  - '));
// Reserved-namespace doc presence.
const createSkill = readFileSync(path.join(repoRoot, '.agents/skills/rad-create-skill/SKILL.md'), 'utf8');
assert.match(createSkill, /reserved.*rad-/i, 'rad-create-skill/SKILL.md must carry a reserved-namespace note');
console.log('prose skill refs assertions passed');

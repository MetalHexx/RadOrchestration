import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const agentsDir = path.join(repoRoot, '.claude/agents');
const FORBIDDEN = ['brainstorm', 'code-review', 'configure-system', 'create-agent', 'create-skill', 'execute-coding-task', 'log-error', 'orchestration', 'run-tests', 'source-control'];
for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md'))) {
  const text = readFileSync(path.join(agentsDir, file), 'utf8');
  const fmEnd = text.indexOf('\n---', 3);
  const fm = text.slice(0, fmEnd);
  const skillsBlock = fm.match(/^skills:\s*\n((?:\s*-\s*\S.*\n)+)/m);
  if (!skillsBlock) continue;
  for (const line of skillsBlock[1].split('\n')) {
    const m = line.match(/^\s*-\s*(\S+)\s*$/);
    if (!m) continue;
    const ref = m[1];
    assert.equal(FORBIDDEN.includes(ref), false, `${file}: skill ref \`${ref}\` is an old unprefixed name; must be \`rad-${ref}\``);
  }
}
console.log('agent skill refs assertions passed');

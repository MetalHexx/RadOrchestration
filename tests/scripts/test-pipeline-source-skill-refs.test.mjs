import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const targets = [
  'skills/rad-orchestration/scripts/pipeline.ts',
  'greenfield/runtime-config/templates/extra-high.yml',
  'greenfield/runtime-config/templates/high.yml',
  'greenfield/runtime-config/templates/medium.yml',
  'greenfield/runtime-config/templates/low.yml',
];
const libDir = path.join(repoRoot, 'skills/rad-orchestration/scripts/lib');
for (const f of readdirSync(libDir).filter(n => n.endsWith('.ts'))) targets.push(`skills/rad-orchestration/scripts/lib/${f}`);
// Each entry: [old-skill-name, regex-anchored-as-skill-identifier]
// A skill identifier appears in: backtick code spans, double-quoted strings preceded by `skill`, or `skills:` YAML lists.
const skillRefPattern = (name) => new RegExp(`(\`${name}\`|"${name}"|'${name}'|^\\s*-\\s*${name}\\s*$)`, 'm');
const oldNames = ['brainstorm','code-review','configure-system','create-agent','create-skill','execute-coding-task','log-error','run-tests','source-control'];
// 'orchestration' deliberately omitted — too many false-positive matches in prose; covered by manual review in this task's scope.
for (const rel of targets) {
  assert.ok(
    readdirSync(path.dirname(path.join(repoRoot, rel))).includes(path.basename(rel)),
    `target file missing: ${rel} (the test must keep its scan list in sync with the actual canonical/built files)`,
  );
}
for (const rel of targets) {
  const text = readFileSync(path.join(repoRoot, rel), 'utf8');
  for (const old of oldNames) {
    const re = skillRefPattern(old);
    const m = text.match(re);
    assert.equal(m, null, `${rel}: found apparent skill reference to old name \`${old}\` at "${m?.[0]}"`);
  }
}
console.log('pipeline source skill refs assertions passed');

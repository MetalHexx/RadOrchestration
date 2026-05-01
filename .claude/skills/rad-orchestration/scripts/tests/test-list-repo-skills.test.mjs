import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
// Windows-safe: fileURLToPath avoids the leading '/' that pathname produces on Windows
const scriptPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'list-repo-skills.mjs');
const root = mkdtempSync(path.join(tmpdir(), 'list-repo-skills-'));
function writeSkill(rel, name, description, extras = '') {
  const dir = path.join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n${extras}---\nbody\n`);
}
writeSkill('.claude/skills/rad-orchestration', 'rad-orchestration', 'system skill — must be excluded');
writeSkill('.claude/skills/eligible-inside', 'eligible-inside', 'eligible inside .claude');
writeSkill('packages/foo/skills/eligible-outside', 'eligible-outside', 'eligible outside .claude');
writeSkill('.claude/skills/no-invoke', 'no-invoke', 'has disable-model-invocation true', 'disable-model-invocation: true\n');
mkdirSync(path.join(root, 'node_modules/skip'), { recursive: true });
writeFileSync(path.join(root, 'node_modules/skip/SKILL.md'), '---\nname: should-be-skipped\ndescription: under node_modules\n---\n');
const res = spawnSync(process.execPath, [scriptPath], { cwd: root, encoding: 'utf8' });
assert.equal(res.status, 0, `script exited non-zero: ${res.stderr}`);
const arr = JSON.parse(res.stdout);
assert.equal(arr.length, 2, `expected 2 eligible entries, got ${arr.length}: ${JSON.stringify(arr)}`);
assert.deepEqual(arr.map(x => x.name).sort(), ['eligible-inside', 'eligible-outside']);
for (const entry of arr) {
  assert.ok(path.isAbsolute(entry.path), `path must be absolute: ${entry.path}`);
  assert.ok(entry.path.endsWith('SKILL.md'), `path must end with SKILL.md: ${entry.path}`);
}
// Determinism — sorted by name.
assert.deepEqual(arr.map(x => x.name), [...arr.map(x => x.name)].sort());
rmSync(root, { recursive: true, force: true });
console.log('list-repo-skills assertions passed');

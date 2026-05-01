import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Windows-safe: fileURLToPath avoids the leading '/' that pathname produces on Windows
const scriptPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'list-repo-skills.mjs');
const res = spawnSync(process.execPath, [scriptPath, '--self-test'], { encoding: 'utf8' });
assert.equal(res.status, 0, `self-test exited non-zero: ${res.stderr}`);
const lines = res.stdout.trim().split(/\r?\n/);
const summaryLine = lines[lines.length - 1];
const summary = JSON.parse(summaryLine);
assert.equal(typeof summary.passed, 'number', 'summary.passed is a number');
assert.equal(typeof summary.failed, 'number', 'summary.failed is a number');
assert.ok(Array.isArray(summary.cases), 'summary.cases is an array');
assert.equal(summary.failed, 0, `expected 0 failed cases, got ${summary.failed}`);
// Coverage: must include cases for both filter criteria, missing fields, malformed YAML, varying depth (FR-6).
const caseNames = summary.cases.map(c => c.name);
for (const required of ['rad-prefix-skipped', 'disable-model-invocation-skipped', 'missing-name-skipped', 'malformed-yaml-skipped', 'eligible-deep-path']) {
  assert.ok(caseNames.includes(required), `self-test missing required case \`${required}\`: got ${JSON.stringify(caseNames)}`);
}
console.log('list-repo-skills self-test assertions passed');

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const skillsDir = path.join(repoRoot, 'harness-files', 'skills');

// Canonical form: node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" <subcommand> ...
const CANONICAL = /node\s+"\$\{PLUGIN_ROOT\}\/skills\/rad-orchestration\/scripts\/radorch\.mjs"\s+\S+/;
// Lines that mention "radorch" or "radorch.mjs" and look like an invocation candidate.
const CANDIDATE = /\bnode\b.*radorch(\.mjs)?\b/;

const offenders = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else if (entry.isFile()) {
      if (entry.name === 'SKILL.md') checkSkill(abs);
      else if (abs.includes(path.sep + 'references' + path.sep) && entry.name.endsWith('.md')) checkSkill(abs);
    }
  }
}
function checkSkill(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (!CANDIDATE.test(line)) return;
    if (CANONICAL.test(line)) return;
    // Diagnose the four malformed classes.
    let why = 'malformed radorch invocation (expected: node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" <subcommand> ...)';
    if (/\$\{SKILLS_ROOT\}/.test(line)) why = 'uses ${SKILLS_ROOT} — must use ${PLUGIN_ROOT}';
    else if (/radorch\.mjs/.test(line) && !/skills\/rad-orchestration\/scripts\/radorch\.mjs/.test(line)) why = 'wrong bundle path — must be skills/rad-orchestration/scripts/radorch.mjs';
    else if (/\$\{PLUGIN_ROOT\}/.test(line) && !/"\$\{PLUGIN_ROOT\}/.test(line)) why = '${PLUGIN_ROOT} not double-quoted at the call site';
    else if (CANDIDATE.test(line) && !/radorch\.mjs"?\s+\S/.test(line)) why = 'missing or malformed subcommand chain after radorch.mjs';
    offenders.push({ file: path.relative(repoRoot, file), line: i + 1, content: line.trim(), why });
  });
}
walk(skillsDir);

if (offenders.length > 0) {
  const msg = offenders.map((o) => `  ${o.file}:${o.line} — ${o.why}\n    > ${o.content}`).join('\n');
  assert.fail(`Malformed radorch call sites:\n${msg}`);
}
console.log('skill call-form assertions passed');

// FR-12 fixture: a references/*.md with a malformed invocation must be caught.
function walkFixture(root) {
  const offendersLocal = [];
  function rec(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) rec(abs);
      else if (entry.isFile() && (entry.name === 'SKILL.md' || (abs.includes(path.sep + 'references' + path.sep) && entry.name.endsWith('.md')))) {
        const text = readFileSync(abs, 'utf8');
        text.split('\n').forEach((line, i) => {
          if (!CANDIDATE.test(line)) return;
          if (CANONICAL.test(line)) return;
          offendersLocal.push({ file: abs, line: i + 1, content: line.trim() });
        });
      }
    }
  }
  rec(root);
  return offendersLocal;
}

const tmp = mkdtempSync(path.join(tmpdir(), 'callform-'));
try {
  mkdirSync(path.join(tmp, 'skills', 'demo', 'references'), { recursive: true });
  writeFileSync(path.join(tmp, 'skills', 'demo', 'SKILL.md'), '# demo\n', 'utf8');
  writeFileSync(
    path.join(tmp, 'skills', 'demo', 'references', 'workflow.md'),
    'Run this:\nnode ${SKILLS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs project context\n',
    'utf8',
  );
  const caught = walkFixture(tmp);
  assert.ok(caught.length === 1, `FR-12: expected 1 offender in references fixture, got ${caught.length}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log('reference-walker fixture assertion passed');

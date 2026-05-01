#!/usr/bin/env node
// Repo-skill manifest for the planner-spawn flow.
// Zero npm deps, Node builtins only. Reads frontmatter; never reads SKILL.md bodies.
// Usage:
//   node list-repo-skills.mjs            → JSON array on stdout
//   node list-repo-skills.mjs --self-test → PASS/FAIL lines + JSON summary; exit 0 on pass

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage']);

function* walkSkillFiles(root) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        stack.push(path.join(dir, e.name));
      } else if (e.isFile() && e.name === 'SKILL.md') {
        yield path.join(dir, e.name);
      }
    }
  }
}

function parseFrontmatter(text, sourcePath) {
  if (!text.startsWith('---')) return { error: 'no frontmatter block' };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { error: 'frontmatter not terminated' };
  const raw = text.slice(3, end);
  const fm = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) return { error: `malformed line: ${line}` };
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    fm[m[1]] = value;
  }
  return { frontmatter: fm };
}

export function buildManifest(root) {
  const out = [];
  for (const file of walkSkillFiles(root)) {
    let text;
    try { text = readFileSync(file, 'utf8'); }
    catch (err) { process.stderr.write(`warn: ${file}: ${err.message}\n`); continue; }
    const { frontmatter, error } = parseFrontmatter(text, file);
    if (error) { process.stderr.write(`warn: ${file}: ${error}\n`); continue; }
    const name = frontmatter.name;
    const description = frontmatter.description;
    if (typeof name !== 'string' || !name) { process.stderr.write(`warn: ${file}: missing name\n`); continue; }
    if (typeof description !== 'string' || !description) { process.stderr.write(`warn: ${file}: missing description\n`); continue; }
    if (name.startsWith('rad-')) continue;                              // FR-3, AD-4
    if (frontmatter['disable-model-invocation'] === true) continue;     // FR-3, AD-4
    out.push({ name, description, path: path.resolve(file) });          // FR-5
  }
  out.sort((a, b) => a.name.localeCompare(b.name));                     // FR-4, NFR-4
  return out;
}

function runSelfTest() {
  // Self-test wired in P02-T02; this stub exits 0 with an empty summary so the eligibility test
  // doesn't shell-out to a missing branch when invoked without --self-test. Real fixture cases live in T02.
  const summary = { passed: 0, failed: 0, cases: [], note: 'self-test cases registered in T02' };
  console.log(JSON.stringify(summary));
  process.exit(0);
}

if (process.argv[2] === '--self-test') runSelfTest();
else process.stdout.write(JSON.stringify(buildManifest(process.cwd()), null, 2) + '\n');  // DD-1

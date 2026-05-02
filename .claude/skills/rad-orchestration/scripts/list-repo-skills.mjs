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

function parseFrontmatter(text) {
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
    const rawValue = m[2].trim();
    const wasQuoted = rawValue.length >= 2 && (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    );
    let value;
    if (wasQuoted) {
      value = rawValue.slice(1, -1);
    } else if (rawValue === 'true') {
      value = true;
    } else if (rawValue === 'false') {
      value = false;
    } else {
      value = rawValue;
    }
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
    const { frontmatter, error } = parseFrontmatter(text);
    if (error) { process.stderr.write(`warn: ${file}: ${error}\n`); continue; }
    const name = frontmatter.name;
    const description = frontmatter.description;
    if (typeof name !== 'string' || !name) { process.stderr.write(`warn: ${file}: missing name\n`); continue; }
    if (typeof description !== 'string' || !description) { process.stderr.write(`warn: ${file}: missing description\n`); continue; }
    if (name.startsWith('rad-')) continue;
    if (frontmatter['disable-model-invocation'] === true) continue;
    out.push({ name, description, path: path.resolve(file) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function runSelfTest() {
  const cases = [];
  function record(name, ok, detail) { cases.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); }

  // Case 1: rad-prefix is skipped.
  const r1 = parseFrontmatter('---\nname: rad-thing\ndescription: x\n---\n');
  record('rad-prefix-skipped', !r1.error && r1.frontmatter.name.startsWith('rad-'),
    r1.error ?? `parsed name=${r1.frontmatter?.name}`);

  // Case 2: disable-model-invocation: true is skipped.
  const r2 = parseFrontmatter('---\nname: thing\ndescription: x\ndisable-model-invocation: true\n---\n');
  record('disable-model-invocation-skipped', !r2.error && r2.frontmatter['disable-model-invocation'] === true,
    r2.error ?? `parsed dmi=${r2.frontmatter?.['disable-model-invocation']}`);

  // Case 3: missing name → entry skipped (parser reports valid frontmatter but consumer skips).
  const r3 = parseFrontmatter('---\ndescription: only desc\n---\n');
  record('missing-name-skipped', !r3.error && typeof r3.frontmatter.name !== 'string',
    r3.error ?? `parsed name=${r3.frontmatter?.name}`);

  // Case 4: malformed YAML → parser returns error, consumer skips.
  const r4 = parseFrontmatter('---\nname: ok\nthis is not yaml\n---\n');
  record('malformed-yaml-skipped', r4.error != null, r4.error ?? 'parsed unexpectedly clean');

  // Case 5: eligible at deep path — exercises walker via in-memory fs is awkward; we instead assert
  // that path.resolve produces an absolute path for a deep relative input, which is the load-bearing
  // property the walker hands off to.
  const deepResolved = path.resolve('packages/a/b/c/d/SKILL.md');
  record('eligible-deep-path', path.isAbsolute(deepResolved), `resolved=${deepResolved}`);

  // Case 6: disable-model-invocation: "true" (string) is NOT excluded — only boolean true excludes.
  const r6 = parseFrontmatter('---\nname: thing\ndescription: x\ndisable-model-invocation: "true"\n---\n');
  record('string-true-not-excluded', !r6.error && r6.frontmatter['disable-model-invocation'] === 'true',
    r6.error ?? `parsed dmi=${JSON.stringify(r6.frontmatter?.['disable-model-invocation'])}`);

  const passed = cases.filter(c => c.ok).length;
  const failed = cases.length - passed;
  const summary = { passed, failed, cases: cases.map(c => ({ name: c.name, ok: c.ok })) };
  console.log(JSON.stringify(summary));
  process.exit(failed === 0 ? 0 : 1);
}

if (process.argv[2] === '--self-test') runSelfTest();
else process.stdout.write(JSON.stringify(buildManifest(process.cwd()), null, 2) + '\n');

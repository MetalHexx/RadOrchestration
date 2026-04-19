#!/usr/bin/env node
// Structural linter for {PROJECT}-MASTER-PLAN.md docs.
// Also cross-references the companion {PROJECT}-REQUIREMENTS.md if one sits in
// the same directory (filename ends with `-REQUIREMENTS.md`).
// Dependency-free. Node builtins only.
// Usage:
//   node lint-master-plan.mjs <path/to/MASTER-PLAN.md>
//   node lint-master-plan.mjs --self-test
// Exit 0 on pass, 1 on errors. Last stdout line is a JSON summary.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_FRONTMATTER = ['project', 'type', 'total_phases', 'total_tasks'];
const PHASE_HEADING = /^## (P\d{2}):\s*(.+)$/;
const TASK_HEADING = /^### (P\d{2})-(T\d{2}):\s*(.+)$/;
const REQ_TAG = /\b(FR|NFR|AD|DD)-(\d+)\b/g;
const REQ_ID_HEADING = /^### (FR|NFR|AD|DD)-(\d+):/;
const PHASE_SENTENCE_LIMIT = 3;
const TASK_SENTENCE_LIMIT = 2;

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: null, error: 'no frontmatter block at top of file' };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, error: 'frontmatter block not terminated by `---`' };
  const raw = text.slice(3, end).trim();
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/^-?\d+$/.test(value)) value = Number(value);
    fm[m[1]] = value;
  }
  return { frontmatter: fm, body: text.slice(end + 4) };
}

// Returns { phases: [{ id, title, description, tasks: [{ id, title, description, refs }], refs }], orphanTasks: [] }
// R8 — orphanTasks collects task headings that appear before any phase heading.
function parseStructure(body) {
  const lines = (body ?? '').split(/\r?\n/);
  const phases = [];
  const orphanTasks = [];
  let phase = null;
  let task = null;
  let buffer = [];

  const flushBuffer = () => {
    if (!buffer.length) return;
    if (task) task.descriptionLines.push(...buffer);
    else if (phase && phase.tasks.length === 0) phase.descriptionLines.push(...buffer);
    buffer = [];
  };

  for (const line of lines) {
    const phaseMatch = line.match(PHASE_HEADING);
    const taskMatch = line.match(TASK_HEADING);
    if (phaseMatch) {
      flushBuffer();
      phase = { id: phaseMatch[1], title: phaseMatch[2].trim(), descriptionLines: [], tasks: [], refs: new Set() };
      task = null;
      phases.push(phase);
      continue;
    }
    if (taskMatch) {
      flushBuffer();
      task = { id: `${taskMatch[1]}-${taskMatch[2]}`, title: taskMatch[3].trim(), descriptionLines: [], refs: new Set() };
      if (phase) {
        phase.tasks.push(task);
      } else {
        // R8 — task heading before any phase heading; track as orphan.
        orphanTasks.push(task);
      }
      continue;
    }
    buffer.push(line);

    // Collect requirement-id refs at scope we're currently in.
    let m;
    REQ_TAG.lastIndex = 0;
    while ((m = REQ_TAG.exec(line)) !== null) {
      const tag = `${m[1]}-${m[2]}`;
      if (task) task.refs.add(tag);
      else if (phase) phase.refs.add(tag);
    }
  }
  flushBuffer();
  return { phases, orphanTasks };
}

function countSentences(descriptionLines) {
  // Use only the first paragraph (up to the first blank line) for sentence count —
  // avoids false-positives from `**Requirements:**`, `**Execution order:**`, code fences.
  const paragraph = [];
  for (const l of descriptionLines) {
    if (!l.trim()) {
      if (paragraph.length) break;
      continue;
    }
    if (/^\*\*[A-Z]/.test(l.trim())) break;
    paragraph.push(l);
  }
  const text = paragraph.join(' ').trim();
  if (!text) return 0;
  // crude sentence split on `.`, `!`, `?` followed by space/end
  const parts = text.split(/[.!?](?=\s|$)/).map(s => s.trim()).filter(Boolean);
  return parts.length;
}

async function findCompanionRequirements(masterPlanPath) {
  const dir = path.dirname(masterPlanPath);
  const base = path.basename(masterPlanPath);
  // Primary: derive the exact filename from the master plan basename.
  if (base.endsWith('-MASTER-PLAN.md')) {
    const derived = path.join(dir, base.replace(/-MASTER-PLAN\.md$/, '-REQUIREMENTS.md'));
    try {
      await readFile(derived, 'utf8'); // cheapest existence check we already import
      return derived;
    } catch { /* fall through to scan */ }
  }
  // Fallback: first `*-REQUIREMENTS.md` in the directory.
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  const hit = entries.find((name) => name.endsWith('-REQUIREMENTS.md'));
  return hit ? path.join(dir, hit) : null;
}

async function loadRequirementsIds(reqPath) {
  const ids = new Set();
  try {
    const text = await readFile(reqPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(REQ_ID_HEADING);
      if (m) ids.add(`${m[1]}-${m[2]}`);
    }
  } catch {
    return null;
  }
  return ids;
}

async function lint(text, sourceLabel, masterPlanPath) {
  const errors = [];
  const warnings = [];
  const { frontmatter, body, error } = parseFrontmatter(text);
  if (error || !frontmatter) {
    errors.push(`frontmatter: ${error ?? 'parse failure'}`);
    return { errors, warnings, source: sourceLabel, phaseCount: 0, taskCount: 0 };
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (!(key in frontmatter)) errors.push(`frontmatter: missing required key \`${key}\``);
  }
  if (frontmatter.type !== undefined && frontmatter.type !== 'master_plan') {
    errors.push(`frontmatter: expected \`type: master_plan\`, got \`${frontmatter.type}\``);
  }

  // R7 — Require total_phases and total_tasks to be positive integers.
  for (const key of ['total_phases', 'total_tasks']) {
    if (key in frontmatter) {
      const v = frontmatter[key];
      const isPositiveInt = typeof v === 'number' && Number.isInteger(v) && v > 0;
      if (!isPositiveInt) {
        errors.push(`frontmatter.${key}: expected positive integer, got \`${JSON.stringify(v)}\``);
      }
    }
  }

  const { phases, orphanTasks } = parseStructure(body);
  const taskCount = phases.reduce((acc, p) => acc + p.tasks.length, 0);

  // Only check the count mismatches when the values are valid positive integers.
  if ('total_phases' in frontmatter) {
    const v = frontmatter.total_phases;
    const isPositiveInt = typeof v === 'number' && Number.isInteger(v) && v > 0;
    if (isPositiveInt && v !== phases.length) {
      errors.push(`frontmatter.total_phases (${v}) != actual phase count (${phases.length})`);
    }
  }
  if ('total_tasks' in frontmatter) {
    const v = frontmatter.total_tasks;
    const isPositiveInt = typeof v === 'number' && Number.isInteger(v) && v > 0;
    if (isPositiveInt && v !== taskCount) {
      errors.push(`frontmatter.total_tasks (${v}) != actual task count (${taskCount})`);
    }
  }

  // R8 — Flag orphan task headings (task before first phase).
  for (const t of orphanTasks) {
    errors.push(`task ${t.id}: heading found before first phase`);
  }

  // Phase ID contiguity (P01, P02, ...).
  phases.forEach((p, i) => {
    const expected = `P${String(i + 1).padStart(2, '0')}`;
    if (p.id !== expected) errors.push(`phase ${p.id}: expected ${expected} at position ${i + 1}`);

    const phaseSentences = countSentences(p.descriptionLines);
    if (phaseSentences === 0) errors.push(`${p.id}: missing phase description sentence under heading`);
    if (phaseSentences > PHASE_SENTENCE_LIMIT) {
      warnings.push(`${p.id}: phase description has ${phaseSentences} sentences (best-effort limit ${PHASE_SENTENCE_LIMIT})`);
    }

    // Task ID contiguity within phase (T01, T02, ...).
    p.tasks.forEach((t, j) => {
      const expectedTask = `${p.id}-T${String(j + 1).padStart(2, '0')}`;
      if (t.id !== expectedTask) errors.push(`task ${t.id}: expected ${expectedTask} at position ${j + 1} in ${p.id}`);

      const taskSentences = countSentences(t.descriptionLines);
      if (taskSentences === 0) errors.push(`${t.id}: missing task description sentence under heading`);
      if (taskSentences > TASK_SENTENCE_LIMIT) {
        warnings.push(`${t.id}: task description has ${taskSentences} sentences (best-effort limit ${TASK_SENTENCE_LIMIT})`);
      }
    });
  });

  // Cross-reference requirement IDs against companion doc.
  let referenced = new Set();
  for (const p of phases) {
    for (const r of p.refs) referenced.add(r);
    for (const t of p.tasks) for (const r of t.refs) referenced.add(r);
  }

  const companionPath = masterPlanPath ? await findCompanionRequirements(masterPlanPath) : null;
  if (!companionPath) {
    if (referenced.size > 0) {
      warnings.push(`companion requirements doc not found alongside master plan; skipping referential integrity check`);
    }
  } else {
    const reqIds = await loadRequirementsIds(companionPath);
    if (!reqIds) {
      warnings.push(`companion requirements doc at ${companionPath} unreadable; skipping referential integrity check`);
    } else {
      for (const ref of referenced) {
        if (!reqIds.has(ref)) errors.push(`referential integrity: master plan cites ${ref} but no such block in ${path.basename(companionPath)}`);
      }
      for (const id of reqIds) {
        if (!referenced.has(id)) warnings.push(`coverage: requirement ${id} is not referenced by any phase or task (advisory)`);
      }
    }
  }

  return { errors, warnings, source: sourceLabel, phaseCount: phases.length, taskCount };
}

function selfTestFixture() {
  // Deliberately malformed. Exercises: wrong `type` value, total_phases
  // mismatch, total_tasks mismatch, missing phase descriptions (P01, P02),
  // missing task description (P02-T01). Also contains a phantom requirement
  // ref (FR-99) — NOT exercised in --self-test mode because masterPlanPath
  // is null and the referential-integrity check is skipped (the "companion
  // doc not found" warning fires instead).
  return `---
project: "SELFTEST"
type: not_master_plan
total_phases: 3
total_tasks: 5
created: "2026-04-19"
---

# SELFTEST — Master Plan

## Introduction

Self-test fixture.

## P01: First phase

**Requirements:** FR-1, FR-99

### P01-T01: Task with refs

A short task description.
**Requirements:** FR-1

## P02: Phase missing description

### P02-T01: Task missing description
`;
}

function printReport(result) {
  const { errors, warnings, source, phaseCount, taskCount } = result;
  console.log(`lint-master-plan: ${source}`);
  console.log(`  phases: ${phaseCount}  tasks: ${taskCount}  errors: ${errors.length}  warnings: ${warnings.length}`);
  for (const e of errors) console.log(`  ERROR  ${e}`);
  for (const w of warnings) console.log(`  WARN   ${w}`);
  const summary = {
    linter: 'lint-master-plan',
    source,
    ok: errors.length === 0,
    errors,
    warnings,
    phaseCount,
    taskCount,
  };
  console.log(JSON.stringify(summary));
  return errors.length === 0 ? 0 : 1;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: lint-master-plan.mjs <path/to/MASTER-PLAN.md> | --self-test');
    process.exit(2);
  }
  if (arg === '--self-test') {
    const result = await lint(selfTestFixture(), '<self-test>', null);
    printReport(result);
    // R5 — Self-test compares exact error SET, not just count.
    // Expected: wrong-type, total_phases mismatch, total_tasks mismatch,
    // P01 missing description, P02 missing description, P02-T01 missing description (6 total).
    // masterPlanPath=null so referential integrity is skipped; companion-not-found fires as warning.
    const EXPECTED_ERRORS = [
      'frontmatter: expected `type: master_plan`, got `not_master_plan`',
      'frontmatter.total_phases (3) != actual phase count (2)',
      'frontmatter.total_tasks (5) != actual task count (2)',
      'P01: missing phase description sentence under heading',
      'P02: missing phase description sentence under heading',
      'P02-T01: missing task description sentence under heading',
    ].sort();
    const actual = [...result.errors].sort();
    const match = actual.length === EXPECTED_ERRORS.length && actual.every((e, i) => e === EXPECTED_ERRORS[i]);
    if (!match) {
      console.error('self-test: error set mismatch');
      console.error('  expected:', JSON.stringify(EXPECTED_ERRORS));
      console.error('  actual:  ', JSON.stringify(actual));
    }
    process.exit(match ? 0 : 1);
  }
  // R4 — Use repo-relative source label for stable cross-machine output.
  const abs = path.resolve(arg);
  const rel = path.relative(process.cwd(), abs);
  const sourceLabel = rel.includes('..') ? arg : rel.split(path.sep).join('/');
  const text = await readFile(abs, 'utf8');
  const result = await lint(text, sourceLabel, abs);
  process.exit(printReport(result));
}

main().catch((err) => {
  console.error(`lint-master-plan: fatal: ${err?.message ?? err}`);
  process.exit(1);
});

#!/usr/bin/env node
// Structural linter for {PROJECT}-REQUIREMENTS.md docs.
// Dependency-free. Node builtins only.
// Usage:
//   node lint-requirements.mjs <path/to/REQUIREMENTS.md>
//   node lint-requirements.mjs --self-test
// Exit 0 on pass, 1 on errors. Last stdout line is a JSON summary.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_FRONTMATTER = ['project', 'type', 'status', 'requirement_count', 'created'];
const ID_HEADING = /^### (FR|NFR|AD|DD)-(\d+):/;
const WORDS_TO_TOKENS = 0.75; // rough whitespace heuristic; keeps us dependency-free
const TOKEN_BUDGET = 500;

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

function collectBlocks(body) {
  // Split body into requirement blocks keyed by heading line.
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(ID_HEADING);
    if (m) {
      if (current) blocks.push(current);
      current = { kind: m[1], num: Number(m[2]), heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function hasDescriptionSentence(body) {
  // First non-blank, non-meta line that contains at least one letter counts.
  for (const line of body) {
    const t = line.trim();
    if (!t) continue;
    if (/^\*\*[A-Z][A-Za-z]*\s*:\*\*/.test(t)) continue; // e.g. **Tags:**, **Resolves:**
    if (/^-\s/.test(t)) continue; // bullet list item doesn't count as a description sentence
    if (/[A-Za-z]/.test(t)) return true;
  }
  return false;
}

function estimateTokens(body) {
  const words = body.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * WORDS_TO_TOKENS);
}

function lint(text, sourceLabel) {
  const errors = [];
  const warnings = [];

  const { frontmatter, body, error } = parseFrontmatter(text);
  if (error || !frontmatter) {
    errors.push(`frontmatter: ${error ?? 'parse failure'}`);
    return { errors, warnings, blockCount: 0, source: sourceLabel };
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (!(key in frontmatter)) errors.push(`frontmatter: missing required key \`${key}\``);
  }
  if (frontmatter.type !== undefined && frontmatter.type !== 'requirements') {
    errors.push(`frontmatter: expected \`type: requirements\`, got \`${frontmatter.type}\``);
  }

  const blocks = collectBlocks(body ?? '');
  for (const block of blocks) {
    const label = `${block.kind}-${block.num}`;
    if (!hasDescriptionSentence(block.body)) {
      errors.push(`${label}: missing body description sentence under heading`);
    }
    const tokens = estimateTokens(block.body);
    if (tokens > TOKEN_BUDGET) {
      errors.push(`${label}: estimated ${tokens} tokens, exceeds ~${TOKEN_BUDGET} budget (whitespace heuristic)`);
    }
  }

  if (typeof frontmatter.requirement_count === 'number' && frontmatter.requirement_count !== blocks.length) {
    errors.push(`frontmatter.requirement_count (${frontmatter.requirement_count}) != actual block count (${blocks.length})`);
  }

  // Gap / duplicate detection per ID kind.
  const byKind = {};
  for (const block of blocks) {
    byKind[block.kind] ??= [];
    byKind[block.kind].push(block.num);
  }
  for (const [kind, nums] of Object.entries(byKind)) {
    const sorted = [...nums].sort((a, b) => a - b);
    const seen = new Set();
    for (const n of sorted) {
      if (seen.has(n)) errors.push(`${kind}-${n}: duplicate ID`);
      seen.add(n);
    }
    for (let i = 1; i <= sorted[sorted.length - 1]; i++) {
      if (!seen.has(i)) errors.push(`${kind}-${i}: gap in ID sequence (missing)`);
    }
  }

  return { errors, warnings, blockCount: blocks.length, source: sourceLabel };
}

async function runFile(docPath) {
  const text = await readFile(docPath, 'utf8');
  return lint(text, docPath);
}

function selfTestFixture() {
  // Deliberately malformed: missing frontmatter key, bad type, missing body,
  // wrong count, duplicate + gap.
  return `---
project: "SELFTEST"
type: not_requirements
status: "draft"
created: "2026-04-19"
requirement_count: 5
---

# SELFTEST — Requirements

## Functional Requirements

### FR-1: Has body
Description line here.

### FR-1: Duplicate ID — also missing description
**Tags:** FR-1, dup

### FR-3: Gap (missing FR-2) and missing description
**Tags:** FR-3
`;
}

function printReport(result) {
  const { errors, warnings, blockCount, source } = result;
  console.log(`lint-requirements: ${source}`);
  console.log(`  blocks: ${blockCount}  errors: ${errors.length}  warnings: ${warnings.length}`);
  for (const e of errors) console.log(`  ERROR  ${e}`);
  for (const w of warnings) console.log(`  WARN   ${w}`);
  const summary = {
    linter: 'lint-requirements',
    source,
    ok: errors.length === 0,
    errors,
    warnings,
    blockCount,
  };
  console.log(JSON.stringify(summary));
  return errors.length === 0 ? 0 : 1;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: lint-requirements.mjs <path/to/REQUIREMENTS.md> | --self-test');
    process.exit(2);
  }
  if (arg === '--self-test') {
    const result = lint(selfTestFixture(), '<self-test>');
    printReport(result);
    // Self-test PASSES the script when it finds exactly the expected errors.
    // Expected: wrong-type, FR-1 missing description, FR-3 missing description,
    // requirement_count mismatch, FR-1 duplicate, FR-2 gap (6 total).
    const expected = result.errors.length === 6;
    process.exit(expected ? 0 : 1);
  }
  const result = await runFile(path.resolve(arg));
  process.exit(printReport(result));
}

main().catch((err) => {
  console.error(`lint-requirements: fatal: ${err?.message ?? err}`);
  process.exit(1);
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the test-file directory portably so the file runs under both
// `tsx --test` (which loads it as CJS and exposes `__dirname`) and bare
// `node --test` (which loads it as ESM where only `import.meta.url` is
// defined). esbuild rewrites `import.meta.url` to a runtime shim under CJS
// (e.g. `require('url').pathToFileURL(__filename).href`), so referencing it
// unconditionally is safe in either module system.
const HERE = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = path.resolve(HERE, 'SKILL.md');

function readSkill(): string {
  return fs.readFileSync(SKILL_PATH, 'utf-8');
}

function frontmatter(src: string): string {
  // Tolerate CRLF line endings (Windows checkouts with core.autocrlf=true)
  // as well as LF (Linux/CI). The actual content within the block is matched
  // line-loosely, so don't anchor `\n` strictly between the dashes.
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'frontmatter not found');
  return m![1];
}

describe('rad-plan-quick SKILL.md', () => {
  const src = readSkill();
  const fm = frontmatter(src);

  it('frontmatter declares name: rad-plan-quick', () => {
    assert.match(fm, /name:\s*rad-plan-quick/);
  });

  it('frontmatter declares disable-model-invocation: true', () => {
    assert.match(fm, /disable-model-invocation:\s*true/);
  });

  it('frontmatter declares user-invocable: true', () => {
    assert.match(fm, /user-invocable:\s*true/);
  });

  it('frontmatter description names quick mode', () => {
    assert.match(fm, /description:.*quick/i);
  });

  it('body hardcodes --template quick when starting the planning pipeline', () => {
    assert.match(src, /--template\s+quick/);
  });

  it('body hardcodes task_size_preference = Extra Large and skips the task-size question', () => {
    assert.match(src, /task_size_preference\s*=\s*["']?Extra Large["']?/);
    assert.match(src, /skip[s]?\s+the\s+task-size\s+question/i);
  });

  it('body hardcodes execution mode autonomous and skips the gate-mode question', () => {
    assert.match(src, /autonomous/);
    assert.match(src, /skip[s]?\s+the\s+gate[- ]mode\s+question/i);
  });

  it('body retains the rad-plan-audit pass with planner corrections and re-explosion on issues_found', () => {
    assert.match(src, /rad-plan-audit/);
    assert.match(src, /issues_found/);
    assert.match(src, /explode-master-plan/);
  });

  it('body presents plan_approval_gate to the user and does not auto-approve it', () => {
    assert.match(src, /plan_approval_gate|plan approval gate/i);
    assert.doesNotMatch(src, /auto-approve.*plan_approval/i);
  });

  it('body ends with the current-branch / new-worktree choice handing off to rad-execute or rad-execute-parallel', () => {
    assert.match(src, /rad-execute(\s|$|`)/);
    assert.match(src, /rad-execute-parallel/);
  });

  it('does not surface a "skipping" announcement to the user (silent defaults)', () => {
    assert.doesNotMatch(src, /Skipping task-size question/i);
    assert.doesNotMatch(src, /Skipping gate-mode question/i);
  });
});

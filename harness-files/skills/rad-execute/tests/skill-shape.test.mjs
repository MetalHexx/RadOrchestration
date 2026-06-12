import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../SKILL.md');
const body = fs.readFileSync(SKILL, 'utf8');

test('frontmatter declares user-invocable rad-execute', () => {
  assert.match(body, /^---[\s\S]*?\nname:\s*rad-execute\b/);
  assert.match(body, /^---[\s\S]*?\nuser-invocable:\s*true/m);
});

test('locate is the sole run-mode classifier (FR-3, AD-2)', () => {
  assert.match(body, /radorch\.mjs"?\s+project locate/);
  // Two execution paths keyed off locate kind — launch vs in-place.
  assert.match(body, /main-clone/);
  assert.match(body, /\bworktree\b/);
  // No five-case routing table carried over from the retired skill.
  assert.doesNotMatch(body, /Case [A-E]\b/);
  assert.doesNotMatch(body, /five-case/i);
});

test('single combined up-front question, no mid-run setup prompts (FR-6, FR-10, DD-1)', () => {
  assert.match(body, /askUserQuestion|askQuestions/);
  // The eight-option launch menu is gone — flavor options are bounded.
  assert.doesNotMatch(body, /Do nothing/);
});

test('conventions are derived, not asked (FR-7)', () => {
  assert.match(body, /\{repoParent\}\/\{repoName\}-worktrees\/\{projectName\}/);
  assert.match(body, /origin\/main/);
});

test('leans on ambient source-control config (FR-8)', () => {
  assert.match(body, /preamble|ambient/i);
});

test('in-place confirmation reads as a location check (FR-5, DD-2)', () => {
  assert.match(body, /run here\?/i);
});

test('worktree create + launch CLI calls inlined (FR-4, AD-3)', () => {
  assert.match(body, /worktree create/);
  assert.match(body, /worktree launch/);
  assert.match(body, /--permission-mode/);
});

test('persists resolved commit/PR via source-control init flags (FR-22, AD-7)', () => {
  assert.match(body, /source-control init/);
  assert.match(body, /--auto-commit/);
  assert.match(body, /--auto-pr/);
  // The skill resolves `ask` up front and never passes it to init.
  assert.match(body, /never pass `?ask`?/i);
});

test('does not reference the retired parallel skill (FR-1)', () => {
  assert.doesNotMatch(body, /rad-execute-parallel/);
});

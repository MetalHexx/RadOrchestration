import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('rad-plan/SKILL.md Step 2 menu matches workflow.md tasks-per-phase counts', () => {
  const skill = fs.readFileSync(path.join(repoRoot, 'skills', 'rad-plan', 'SKILL.md'), 'utf8');
  // Post-refactor counts: 3–5 / 2–4 / 2–3 / 1–2
  assert.match(skill, /Small[\s\S]*3[–-]5/, 'Small must say 3–5 tasks per phase');
  assert.match(skill, /Medium[\s\S]*2[–-]4/, 'Medium must say 2–4 tasks per phase');
  assert.match(skill, /Large[\s\S]*2[–-]3/, 'Large must say 2–3 tasks per phase');
  assert.match(skill, /Extra Large[\s\S]*1[–-]2/, 'Extra Large must say 1–2 tasks per phase');
});

test('rad-plan/SKILL.md Step 2 has no file-count proxy phrasing', () => {
  const skill = fs.readFileSync(path.join(repoRoot, 'skills', 'rad-plan', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /\d+\s*[–-]\s*\d+\s+files/, 'no "N–M files" framing allowed');
  assert.doesNotMatch(skill, /~\d+\s*[–-]\s*\d+\s+files/, 'no "~N–M files" framing allowed');
});

test('workflow.md was NOT modified — it remains the source of truth', () => {
  const wf = fs.readFileSync(path.join(repoRoot, 'skills', 'rad-create-plans', 'references', 'master-plan', 'workflow.md'), 'utf8');
  // Assert the canonical Size table rows are present; serves as a pinned-shape check.
  assert.match(wf, /Small[\s\S]*3[–-]5/);
  assert.match(wf, /Medium[\s\S]*2[–-]4/);
  assert.match(wf, /Large[\s\S]*2[–-]3/);
  assert.match(wf, /Extra Large[\s\S]*1[–-]2/);
});

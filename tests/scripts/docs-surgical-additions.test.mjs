import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('getting-started.md mentions /plugin install rad-orchestration', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'getting-started.md'), 'utf8');
  assert.match(text, /\/plugin install rad-orchestration/);
  assert.match(text, /plugins\.md/);
});

test('harnesses.md Claude Code row mentions plugin install option', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'harnesses.md'), 'utf8');
  assert.match(text, /Claude Code[\s\S]*plugin/i);
});

test('skills.md has a rad-ui section with the namespaced slash form', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'skills.md'), 'utf8');
  assert.match(text, /rad-ui-start/);
  assert.match(text, /\/rad-orchestration:rad-ui-start/);
});

// rad-ui-start slash command documentation moved to docs/plugins.md per FR-24; dashboard.md no longer carries it
test('configuration.md limits section notes consolidate-rather-than-overflow', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'configuration.md'), 'utf8');
  assert.match(text, /consolidat(e|es)/);
  assert.match(text, /max_phases|max_tasks_per_phase/);
});

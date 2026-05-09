import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

function rg(pattern, paths) {
  try {
    return execSync(`rg -n --no-heading "${pattern}" ${paths.join(' ')}`, { cwd: REPO_ROOT, encoding: 'utf-8' });
  } catch (err) {
    if (err.status === 1) return ''; // rg returns 1 when no matches
    throw err;
  }
}

test('no prompt-test orchestration.yml uses default_template: default | quick | full', () => {
  const out = rg('default_template:\\s*\\"?(default|quick|full)\\"?', ['prompt-tests']);
  assert.equal(out.trim(), '', `Found legacy default_template values:\n${out}`);
});

test('no UI test fixture hardcodes template_id: default | quick | full as a generic shape', () => {
  // Allowlist: tests in skills/rad-orchestration/scripts/tests/ that
  // exercise resolver remap explicitly (e2e-template-selection.test.ts,
  // template-resolver.test.ts) keep legacy values as INPUTS.
  const out = rg("template_id:\\s*['\\\"](default|quick|full)['\\\"]", ['ui']);
  assert.equal(out.trim(), '', `Found legacy template_id in UI tests:\n${out}`);
});

test('no UI source or test loads a retired template YAML by filename', () => {
  // template-layout.test.ts and template-serializer.test.ts read the
  // template fixture from disk via readFileSync('templates/<name>.yml').
  // Once default.yml / quick.yml / full.yml are deleted in P01-T01, these
  // reads throw ENOENT — they must point at a tier file instead.
  const out = rg("templates/(default|quick|full)\\.yml", ['ui']);
  assert.equal(out.trim(), '', `Found UI references to retired template YAML files:\n${out}`);
});

test('no UI production fallback target is the literal "default"', () => {
  // template-selector.tsx historically falls back to 'default' for unknown
  // ids. After the rename that target is invalid; the fallback must point
  // at a tier name (extra-high). Match the ternary shape produced by the
  // current source so the audit fails meaningfully if the rename slipped.
  const out = rg(":\\s*'default';", ['ui/components/process-editor']);
  assert.equal(out.trim(), '', `Found 'default' as a production fallback target:\n${out}`);
});

test('no prompt-test template.yml snapshot uses template.id: default | quick | full', () => {
  const out = rg('id:\\s*(default|quick|full)\\b', ['prompt-tests']);
  assert.equal(out.trim(), '', `Found legacy template.id values in prompt-test snapshots:\n${out}`);
});

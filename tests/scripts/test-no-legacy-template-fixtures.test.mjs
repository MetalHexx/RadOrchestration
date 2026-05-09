import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next']);

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  return files;
}

// Node-based grep replacement so the audit is self-contained and works in CI
// environments without ripgrep on PATH. Mirrors `rg -n --no-heading` output
// shape (`<relpath>:<line>:<text>`) so error messages stay readable.
function rg(pattern, searchPaths) {
  const re = new RegExp(pattern);
  const lines = [];
  for (const searchPath of searchPaths) {
    const absPath = path.join(REPO_ROOT, searchPath);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    const files = stat.isDirectory() ? walkFiles(absPath) : [absPath];
    for (const file of files) {
      let content;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }
      const split = content.split(/\r?\n/);
      for (let i = 0; i < split.length; i++) {
        if (re.test(split[i])) {
          lines.push(`${path.relative(REPO_ROOT, file).replace(/\\/g, '/')}:${i + 1}:${split[i]}`);
        }
      }
    }
  }
  return lines.length === 0 ? '' : lines.join('\n') + '\n';
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

test('prompt-tests has the renamed extra-high-pipeline-e2e folder, no legacy plan-pipeline-e2e folder', () => {
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'prompt-tests', 'extra-high-pipeline-e2e')), 'extra-high-pipeline-e2e folder is missing');
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'prompt-tests', 'plan-pipeline-e2e')), 'plan-pipeline-e2e folder still exists');
});

test('prompt-tests has the renamed low-pipeline-e2e folder, no legacy quick-pipeline-e2e folder', () => {
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'prompt-tests', 'low-pipeline-e2e')), 'low-pipeline-e2e folder is missing');
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'prompt-tests', 'quick-pipeline-e2e')), 'quick-pipeline-e2e folder still exists');
});

test('renamed prompt-test runners reference the new tier names, not legacy template names', () => {
  const ehRunner = fs.readFileSync(path.join(REPO_ROOT, 'prompt-tests', 'extra-high-pipeline-e2e', '_runner.md'), 'utf-8');
  assert.ok(!/--template\s+default/.test(ehRunner), 'extra-high _runner.md still has --template default');
  assert.ok(/--template\s+extra-high/.test(ehRunner), 'extra-high _runner.md missing --template extra-high');
  const lowRunner = fs.readFileSync(path.join(REPO_ROOT, 'prompt-tests', 'low-pipeline-e2e', '_runner.md'), 'utf-8');
  assert.ok(!/--template\s+quick/.test(lowRunner), 'low _runner.md still has --template quick');
  assert.ok(/--template\s+low/.test(lowRunner), 'low _runner.md missing --template low');
});

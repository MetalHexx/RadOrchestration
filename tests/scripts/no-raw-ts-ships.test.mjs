// tests/scripts/no-raw-ts-ships.test.mjs
//
// Anti-regression guard: asserts that neither the installer source tree nor the
// plugin dist tree ships raw TypeScript source, bundler infra, or dev-only
// directories.  Any of these shipping to end users indicates a delivery-path
// regression — either sync-source.js or build-plugin.js started including files
// it should filter out.
//
// The test skips (rather than fails) when either tree is absent, so it runs
// cleanly in a cold worktree that hasn't executed sync-source.js or
// build-plugin.js yet.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const INSTALLER_SCRIPTS_DIR = path.join(
  repoRoot,
  'installer', 'src', 'claude', 'skills', 'rad-orchestration', 'scripts',
);

const PLUGIN_SCRIPTS_DIR = path.join(
  repoRoot,
  'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration',
  'skills', 'rad-orchestration', 'scripts',
);

const FORBIDDEN_EXTENSIONS = ['.ts'];
const FORBIDDEN_FILENAMES = [
  'bundle.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vitest.config.ts',
  'env.d.ts',
];
const FORBIDDEN_DIRS = ['lib', 'tests'];

/**
 * Walk a directory recursively and collect all entries (files and directories)
 * relative to the root.
 */
function walkDir(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    results.push({ rel, name: entry.name, isDir: entry.isDirectory() });
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base));
    }
  }
  return results;
}

/**
 * Assert that the given scripts directory does not contain forbidden entries.
 * Returns an array of violation strings (empty = clean).
 */
function collectViolations(scriptsDir) {
  const entries = walkDir(scriptsDir);
  const violations = [];
  for (const { rel, name, isDir } of entries) {
    if (isDir) {
      if (FORBIDDEN_DIRS.includes(name)) {
        violations.push(`forbidden directory: ${rel}`);
      }
    } else {
      const ext = path.extname(name);
      if (FORBIDDEN_EXTENSIONS.includes(ext)) {
        violations.push(`forbidden .ts file: ${rel}`);
      }
      if (FORBIDDEN_FILENAMES.includes(name)) {
        violations.push(`forbidden file: ${rel}`);
      }
    }
  }
  return violations;
}

test('installer/src/claude scripts tree ships no raw .ts, bundler infra, or dev directories', (t) => {
  if (!fs.existsSync(INSTALLER_SCRIPTS_DIR)) {
    t.skip('installer/src/claude/skills/rad-orchestration/scripts/ absent — run sync-source.js first');
    return;
  }
  const violations = collectViolations(INSTALLER_SCRIPTS_DIR);
  assert.deepEqual(
    violations,
    [],
    `installer scripts tree contains forbidden entries:\n  ${violations.join('\n  ')}`,
  );
});

test('plugin dist scripts tree ships no raw .ts, bundler infra, or dev directories', (t) => {
  if (!fs.existsSync(PLUGIN_SCRIPTS_DIR)) {
    t.skip('cli/dist/marketplaces/claude/plugins/.../scripts/ absent — run build:plugin first');
    return;
  }
  const violations = collectViolations(PLUGIN_SCRIPTS_DIR);
  assert.deepEqual(
    violations,
    [],
    `plugin dist scripts tree contains forbidden entries:\n  ${violations.join('\n  ')}`,
  );
});

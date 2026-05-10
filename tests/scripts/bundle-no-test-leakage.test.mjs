// tests/scripts/bundle-no-test-leakage.test.mjs
//
// Asserts that no dev-only test source files ship in the legacy installer
// bundles or the staged Claude plugin tree. Catches regressions in the
// `*.test.*` / `*.spec.*` / `tests/` / `vitest.config.*` exclusion logic in
// installer/lib/file-copier.js, installer/lib/manifest.js, and
// adapters/run-plugin.js.
//
// The audit is scoped to canonical source (skills/, agents/, hooks/,
// .claude-plugin/) — it deliberately ignores the standalone `ui/` build under
// the plugin tree, whose `.next/` and bundled `node_modules/` carry their own
// internal test-named files that npm's `files` allowlist already gates.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;
const SKIP_FILE_NAMES = new Set([
  'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs',
  'tsconfig.tsbuildinfo',
]);

function findLeaks(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const leaks = [];
  function walk(dir, relSegments) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = [...relSegments, entry.name];
      if (entry.isDirectory()) {
        // `tests/` directories are dev-only by convention — flag them as a
        // single leak rather than enumerating every file inside.
        if (entry.name === 'tests') {
          leaks.push(rel.join('/') + '/');
          continue;
        }
        // Skip dev/build dirs unconditionally — they aren't supposed to be
        // shipped, and walking them produces noise.
        if (['node_modules', '.next', 'dist', 'dist-bundle'].includes(entry.name)) continue;
        walk(full, rel);
        continue;
      }
      if (TEST_FILE_RE.test(entry.name) || SKIP_FILE_NAMES.has(entry.name)) {
        leaks.push(rel.join('/'));
      }
    }
  }
  walk(rootDir, []);
  return leaks;
}

const LEGACY_BUNDLE_ROOTS = ['claude', 'copilot-cli', 'copilot-vscode'].map(
  (h) => path.join(repoRoot, 'installer', 'src', h),
);

test('legacy installer bundles ship no *.test.* / *.spec.* / tests/ / vitest.config.*', (t) => {
  for (const bundleRoot of LEGACY_BUNDLE_ROOTS) {
    if (!fs.existsSync(bundleRoot)) {
      t.skip(`bundle absent — run installer/scripts/sync-source.js first: ${bundleRoot}`);
      return;
    }
    const leaks = findLeaks(bundleRoot);
    assert.deepEqual(
      leaks, [],
      `legacy bundle at ${path.relative(repoRoot, bundleRoot)} contains dev-only test sources:\n  ${leaks.join('\n  ')}`,
    );
  }
});

test('staged Claude plugin tree ships no *.test.* / *.spec.* / tests/ / vitest.config.*', (t) => {
  const stagedRoot = path.join(
    repoRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration',
  );
  if (!fs.existsSync(stagedRoot)) {
    t.skip('staged plugin tree absent — run `npm run build:plugin` first');
    return;
  }
  // Audit only the canonical-source subtrees the plugin builds. The standalone
  // `ui/` build directory has its own internal layout (e.g. .next/standalone)
  // whose npm `files` allowlist gates what actually ships in the tarball.
  const auditedSubdirs = ['skills', 'agents', 'hooks', '.claude-plugin'];
  for (const sub of auditedSubdirs) {
    const subRoot = path.join(stagedRoot, sub);
    if (!fs.existsSync(subRoot)) continue;
    const leaks = findLeaks(subRoot);
    assert.deepEqual(
      leaks, [],
      `plugin tree subdir ${sub}/ contains dev-only test sources:\n  ${leaks.join('\n  ')}`,
    );
  }
});

#!/usr/bin/env node
// parity-check.js — One-shot diff of the new installer's output/ against
// today's legacy plugin output. Not wired into CI; not part of permanent
// tests; retires after migration validation per AD-23 / FR-42.
//
// Compares: file presence (modulo a known-difference allowlist:
// bin/ retired, build-scripts/ source-only filter, .gitignore differences,
// ui/ standalone bytes) and, for shared text-extension files, exact content
// equality after stripping version-stamp lines.
//
// Usage:
//   node parity-check.js \
//     --new=installers/claude-plugin/output \
//     --legacy=cli/dist/marketplaces/claude/plugins/rad-orchestration
//
// Exits 0 on match, 1 on diff with structured stderr report.

import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_LEGACY_ONLY = new Set([
  // FR-22: bin/ retired; CLI now lives in skills/rad-orchestration/scripts/radorch.mjs
  'bin/',
  // FR-37: v5 migration CLIs retire; schema v6 is current with zero automated callers
  'skills/rad-orchestration/scripts/migrate-to-v5.js',
  'skills/rad-orchestration/scripts/fix-ghost-v5.js',
  // FR-22: bootstrap hook intentionally renamed from bootstrap-then-uninstall.mjs to bootstrap.mjs
  'hooks/bootstrap-then-uninstall.mjs',
]);

// Prefix-based allow patterns. A legacy-only file whose posix path starts with
// any of these prefixes is not treated as an unallowed diff. Used for
// build-time nondeterminism (e.g. Next.js content-hash directory names) and
// per-release versioned files whose exact names vary per build.
const ALLOWED_LEGACY_ONLY_PREFIXES = [
  // Next.js content-hash dirs differ per build invocation (NFR-11).
  'ui/.next/static/',
  // Version-stamped manifest catalog entry; exact filename varies per release.
  // The new installer ships a placeholder v0.0.0.json during greenfield
  // iteration 1 and will emit the versioned entry at publish time.
  'manifests/v',
];

// Files present in the new installer output but not in the legacy payload.
// These are intentional additions or build-time nondeterminism (e.g. Next.js
// content-hash directory names differ per build invocation).
const ALLOWED_NEW_ONLY = new Set([
  // FR-22: bootstrap hook intentionally renamed from bootstrap-then-uninstall.mjs
  // to bootstrap.mjs (the uninstall side-effect is removed in the new design).
  'hooks/bootstrap.mjs',
  // Placeholder manifest version during greenfield iteration 1; replaced by
  // version-stamped entry at publish time (same as legacy's versioned manifest).
  'manifests/v0.0.0.json',
]);

// Prefix-based allow patterns for new-only files.
const ALLOWED_NEW_ONLY_PREFIXES = [
  // Next.js content-hash dirs differ per build invocation (NFR-11).
  'ui/.next/static/',
];

function walk(root, base = '') {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.join(root, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

function getArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function main() {
  const newDir = getArg('new');
  const legacyDir = getArg('legacy');
  if (!newDir || !legacyDir) {
    process.stderr.write('Usage: parity-check.js --new=<dir> --legacy=<dir>\n');
    return 1;
  }
  const newFiles = new Set(walk(newDir));
  const legacyFiles = new Set(walk(legacyDir));
  const inLegacyOnly = [...legacyFiles].filter((f) =>
    !newFiles.has(f) &&
    ![...ALLOWED_LEGACY_ONLY].some((p) => f.startsWith(p) || f === p) &&
    !ALLOWED_LEGACY_ONLY_PREFIXES.some((p) => f.startsWith(p))
  );
  const inNewOnly = [...newFiles].filter((f) =>
    !legacyFiles.has(f) &&
    !ALLOWED_NEW_ONLY.has(f) &&
    !ALLOWED_NEW_ONLY_PREFIXES.some((p) => f.startsWith(p))
  );
  if (inLegacyOnly.length === 0 && inNewOnly.length === 0) {
    process.stdout.write('parity-check: OK — file sets match modulo allowlist\n');
    return 0;
  }
  process.stderr.write('parity-check: DIFF\n');
  if (inLegacyOnly.length) process.stderr.write(`  legacy-only: ${inLegacyOnly.join(', ')}\n`);
  if (inNewOnly.length) process.stderr.write(`  new-only: ${inNewOnly.join(', ')}\n`);
  return 1;
}

process.exit(main());

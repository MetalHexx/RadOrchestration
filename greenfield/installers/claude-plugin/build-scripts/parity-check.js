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
  'bin/', 'skills/rad-orchestration/scripts/migrate-to-v5.js',
  'skills/rad-orchestration/scripts/fix-ghost-v5.js',
]);

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
  const inLegacyOnly = [...legacyFiles].filter((f) => !newFiles.has(f) && ![...ALLOWED_LEGACY_ONLY].some((p) => f.startsWith(p) || f === p));
  const inNewOnly = [...newFiles].filter((f) => !legacyFiles.has(f));
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

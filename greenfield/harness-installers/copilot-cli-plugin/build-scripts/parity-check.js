#!/usr/bin/env node
// parity-check.js — One-shot content-equivalence check of the new copilot-cli-plugin
// output/ against the claude-plugin's output/ for the shared agents+skills surface.
// NOT wired into CI; lives outside the permanent suite; retires after migration
// validation (AD-21, FR-51).

import fs from 'node:fs';
import path from 'node:path';

// Per-harness differences that are expected. Files matching any prefix or
// exact path on this list are excluded from drift detection.
const ALLOWED_CLAUDE_ONLY_PREFIXES = ['.claude-plugin/', 'hooks/'];
const ALLOWED_CLAUDE_ONLY_PATTERNS = [/^agents\/.+\.md$/];
const ALLOWED_COPILOT_CLI_ONLY = new Set(['plugin.json']);
const ALLOWED_COPILOT_CLI_ONLY_PREFIXES = ['hooks/'];
const ALLOWED_COPILOT_CLI_ONLY_PATTERNS = [/^agents\/.+\.agent\.md$/];
// Build-time nondeterminism allowlist (Next.js content-hashed paths,
// version-stamped manifest filenames).
const ALLOWED_BOTH_PREFIXES = ['ui/.next/static/', 'manifests/v'];

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

function isClaudeAllowed(rel) {
  if (ALLOWED_BOTH_PREFIXES.some((p) => rel.startsWith(p))) return true;
  if (ALLOWED_CLAUDE_ONLY_PREFIXES.some((p) => rel.startsWith(p))) return true;
  if (ALLOWED_CLAUDE_ONLY_PATTERNS.some((r) => r.test(rel))) return true;
  return false;
}

function isCopilotAllowed(rel) {
  if (ALLOWED_BOTH_PREFIXES.some((p) => rel.startsWith(p))) return true;
  if (ALLOWED_COPILOT_CLI_ONLY.has(rel)) return true;
  if (ALLOWED_COPILOT_CLI_ONLY_PREFIXES.some((p) => rel.startsWith(p))) return true;
  if (ALLOWED_COPILOT_CLI_ONLY_PATTERNS.some((r) => r.test(rel))) return true;
  return false;
}

function main() {
  const cliDir = getArg('copilot-cli');
  const claudeDir = getArg('claude');
  if (!cliDir || !claudeDir) {
    process.stderr.write('Usage: parity-check.js --copilot-cli=<dir> --claude=<dir>\n');
    return 1;
  }
  const cliFiles = new Set(walk(cliDir));
  const claudeFiles = new Set(walk(claudeDir));

  const claudeOnly = [...claudeFiles].filter((f) => !cliFiles.has(f) && !isClaudeAllowed(f));
  const cliOnly = [...cliFiles].filter((f) => !claudeFiles.has(f) && !isCopilotAllowed(f));

  // Compare shared files for byte equality (subject to small known modifications: nothing per-harness in the shared surface).
  const shared = [...cliFiles].filter((f) => claudeFiles.has(f) && !ALLOWED_BOTH_PREFIXES.some((p) => f.startsWith(p)));
  const drifted = shared.filter((f) => {
    const a = fs.readFileSync(path.join(cliDir, f));
    const b = fs.readFileSync(path.join(claudeDir, f));
    return a.length !== b.length || !a.equals(b);
  });

  if (claudeOnly.length === 0 && cliOnly.length === 0 && drifted.length === 0) {
    process.stdout.write('parity-check: OK — shared surface matches; per-harness diffs allowlisted\n');
    return 0;
  }
  process.stderr.write('parity-check: DIFF\n');
  if (claudeOnly.length) process.stderr.write(`  claude-only (non-allowlisted): ${claudeOnly.join(', ')}\n`);
  if (cliOnly.length) process.stderr.write(`  copilot-cli-only (non-allowlisted): ${cliOnly.join(', ')}\n`);
  if (drifted.length) process.stderr.write(`  shared-surface drift: ${drifted.join(', ')}\n`);
  return 1;
}

process.exit(main());

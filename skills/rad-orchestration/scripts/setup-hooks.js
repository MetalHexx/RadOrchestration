// setup-hooks.js — DEV-ONLY hook installer for v3 contributors.
//
// This is NOT run on end-user installs. It is invoked manually by v3 repo
// contributors (see README "Development" section). It writes
// `.githooks/pre-commit` and points `core.hooksPath` at it so the
// orchestration scripts get type-checked before each commit.
//
// Usage (from the v3 repo root):
//   node skills/rad-orchestration/scripts/setup-hooks.js
//
// Or simply set the hooks path manually (the pre-commit file is already
// committed at .githooks/pre-commit):
//   git config core.hooksPath .githooks

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Walk upward from the script directory to find the repo root (.git/)
function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root without finding .git
      return null;
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);

if (!repoRoot) {
  console.log('[setup-hooks] No .git directory found — skipping hook setup');
  process.exit(0);
}

const hooksDir = path.join(repoRoot, '.githooks');
const preCommitPath = path.join(hooksDir, 'pre-commit');

const preCommitContent = `#!/bin/sh
# Pre-commit hook — runs tsc --noEmit on scripts folder
# Exit 0 = commit proceeds, Exit 1 = commit blocked
# Always runs regardless of which files are staged

SCRIPTS_DIR="skills/rad-orchestration/scripts"

cd "$SCRIPTS_DIR" || { echo "[type-check] ERROR: Could not cd into $SCRIPTS_DIR"; exit 1; }

echo "[type-check] Running TypeScript type check..."

npx tsc --noEmit

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[type-check] TypeScript OK (0 errors)"
  exit 0
else
  echo "[type-check] ✗ Type error(s) found. Commit blocked."
  echo "[type-check] Run 'npm run typecheck' in scripts/ to see full details."
  echo "[type-check] To bypass (emergency only): git commit --no-verify"
  exit 1
fi
`;

// Create .githooks/ directory if it doesn't exist
fs.mkdirSync(hooksDir, { recursive: true });

// Write the pre-commit hook (overwrite silently if it already exists)
fs.writeFileSync(preCommitPath, preCommitContent, 'utf8');

// Set executable permissions (POSIX — no-op on Windows)
fs.chmodSync(preCommitPath, 0o755);

// Configure Git to use our hooks directory
execSync('git config core.hooksPath .githooks', { cwd: repoRoot, stdio: 'pipe' });

console.log('[setup-hooks] Pre-commit hook installed at .githooks/pre-commit');

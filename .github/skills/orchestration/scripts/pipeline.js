#!/usr/bin/env node
// pipeline.js — JIT dependency installer and entry point
//
// Checks whether node_modules exists in the scripts directory. If missing
// (e.g. first run in a fresh worktree), runs `npm ci` to install
// dependencies, then delegates to main.ts with all original arguments.
// All CLI arguments are passed through transparently — adding new flags
// to main.ts requires no changes here.
//
// Usage:
//   node {orchRoot}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [...]

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeModulesDir = join(__dirname, 'node_modules');

// ── JIT install ───────────────────────────────────────────────────────────────

if (!existsSync(nodeModulesDir)) {
  const lockFile = join(__dirname, 'package-lock.json');
  const command = existsSync(lockFile) ? 'ci' : 'install';

  process.stderr.write(
    `[bootstrap] node_modules not found — running npm ${command}...\n`,
  );

  try {
    execSync(`npm ${command}`, {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    process.stderr.write('[bootstrap] Dependencies installed.\n');
  } catch (err) {
    process.stderr.write(
      `[bootstrap] npm ${command} failed:\n${err.stderr?.toString() ?? err.message}\n`,
    );
    process.exitCode = 1;
    // Emit a valid pipeline-shaped error so the Orchestrator can handle it
    process.stdout.write(
      JSON.stringify(
        {
          success: false,
          action: null,
          context: { error: `npm ${command} failed` },
          mutations_applied: [],
          orchRoot: '.github',
          error: {
            message: `npm ${command} failed: ${err.stderr?.toString() ?? err.message}`,
            event: 'unknown',
          },
        },
        null,
        2,
      ) + '\n',
    );
    process.exit(1);
  }
}

// ── Delegate to main.ts ──────────────────────────────────────────────────────

const pipelineScript = join(__dirname, 'main.ts');
const tsxArgs = [pipelineScript, ...process.argv.slice(2)];

try {
  const result = execFileSync('npx', ['tsx', ...tsxArgs], {
    cwd: process.cwd(), // preserve caller's working directory
    stdio: ['inherit', 'pipe', 'inherit'],
    // On Windows, npx is a cmd script — shell: true is required
    shell: process.platform === 'win32',
  });
  process.stdout.write(result);
} catch (err) {
  // execFileSync throws on non-zero exit codes — forward output and code
  if (err.stdout) process.stdout.write(err.stdout);
  process.exitCode = err.status ?? 1;
}

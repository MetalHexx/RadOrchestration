/**
 * ONE-TIME MIGRATION SCRIPT — fix-ghost-v5.ts
 * Re-migrates "ghost v5" state files (files with $schema "orchestration-state-v5"
 * but no valid graph section) by stripping $schema and re-running migrateState().
 * This script was needed during the DAG-PIPELINE-2 v4→v5 transition and is not
 * part of the regular pipeline runtime. Safe to archive after all projects are migrated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeState } from './lib/state-io.js';
import { migrateState } from './migrate-to-v5.js';
import type { PipelineState } from './lib/types.js';

// ── Terminal Colors ───────────────────────────────────────────────────────────

const C = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

// ── CLI Args ──────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes('--dry-run');
const basePath = process.cwd();

// ── Ghost-v5 Detection ────────────────────────────────────────────────────────

/**
 * A ghost-v5 file has $schema === "orchestration-state-v5" but no valid `graph` section.
 * This occurs when state files were manually labeled as v5 before the migration system existed.
 */
function isGhostV5(raw: Record<string, unknown>): boolean {
  return (
    raw.$schema === 'orchestration-state-v5' &&
    (typeof raw.graph !== 'object' || raw.graph === null)
  );
}

function isProperV5(raw: Record<string, unknown>): boolean {
  return (
    raw.$schema === 'orchestration-state-v5' &&
    typeof raw.graph === 'object' &&
    raw.graph !== null
  );
}

// ── Summary Counters ──────────────────────────────────────────────────────────

let fixedCount = 0;
let okCount = 0;
let skippedCount = 0;
let errorCount = 0;

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(
  `${C.bold}fix-ghost-v5${C.reset} — ${dryRun ? `${C.yellow}DRY RUN${C.reset} — no files will be written` : 'live mode'}\n`,
);
console.log(`Base path: ${basePath}\n`);

const entries = fs.readdirSync(basePath, { withFileTypes: true });
const projectDirs = entries
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .map((e) => e.name)
  .sort();

for (const projectName of projectDirs) {
  const projectDir = path.join(basePath, projectName);
  const statePath = path.join(projectDir, 'state.json');

  if (!fs.existsSync(statePath)) {
    // No state file — skip silently
    skippedCount++;
    continue;
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (err) {
    console.log(`  ${C.red}[ERROR]${C.reset} ${projectName} — failed to parse state.json: ${err}`);
    errorCount++;
    continue;
  }

  if (isProperV5(raw)) {
    console.log(`  ${C.cyan}[OK]${C.reset}   ${projectName}`);
    okCount++;
  } else if (isGhostV5(raw)) {
    if (dryRun) {
      console.log(`  ${C.yellow}[FIX]${C.reset}  ${projectName} ${C.yellow}(dry-run — would reset $schema to v4 and re-migrate)${C.reset}`);
      fixedCount++;
    } else {
      try {
        raw.$schema = 'orchestration-state-v4';
        const v5State: PipelineState = migrateState(raw, projectName);
        writeState(projectDir, v5State);
        console.log(`  ${C.green}[FIX]${C.reset}  ${projectName} — migrated to proper v5`);
        fixedCount++;
      } catch (err) {
        console.log(`  ${C.red}[ERROR]${C.reset} ${projectName} — migration failed: ${err}`);
        errorCount++;
      }
    }
  } else {
    // Non-ghost, non-v5 file (v4 or unknown schema) — not our responsibility here
    console.log(`  ${C.yellow}[SKIP]${C.reset} ${projectName} — schema: ${raw.$schema ?? '(none)'}`);
    skippedCount++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`${C.bold}Summary${dryRun ? ' (dry-run)' : ''}:${C.reset}`);
console.log(`  ${C.green}Fixed:${C.reset}   ${fixedCount}`);
console.log(`  ${C.cyan}OK:${C.reset}      ${okCount}`);
console.log(`  ${C.yellow}Skipped:${C.reset} ${skippedCount}`);
console.log(`  ${C.red}Errors:${C.reset}  ${errorCount}`);

if (errorCount > 0) {
  console.log(`\n${C.red}${C.bold}STOPPING: ${errorCount} error(s) encountered. Review output above.${C.reset}`);
  process.exit(1);
}

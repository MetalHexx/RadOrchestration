#!/usr/bin/env node
/**
 * One-time dogfood-only cleanup script.
 *
 * Walks the user's local orchestration-projects directory and reconciles
 * each project's state.graph.template_id with the new tier vocabulary.
 * Idempotent and safe to re-run.
 *
 * Usage: npx tsx scripts/cleanup-tiers.ts [--base-path C:\\dev\\orchestration-projects]
 *
 * This script is committed during implementation for review traceability
 * and `git rm`'d before merge — see scripts/cleanup-tiers/README is omitted
 * intentionally; this is implementation scaffolding, not a deliverable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_ID_REMAP: Record<string, string> = {
  default: 'extra-high',
  quick: 'low',
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FULL_BAK_PATH = path.join(HERE, 'cleanup-tiers', 'full.yml.bak');
const DEFAULT_BASE_PATH = 'C:\\dev\\orchestration-projects';

function parseArgs(argv: string[]): { basePath: string } {
  let basePath = DEFAULT_BASE_PATH;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-path') basePath = argv[++i];
  }
  return { basePath };
}

function isProjectDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'state.json'));
}

function reconcileProject(projectDir: string, fullBakContent: string): { changed: boolean; reason: string } {
  const statePath = path.join(projectDir, 'state.json');
  let state: any;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (err) {
    return { changed: false, reason: `unreadable state.json: ${(err as Error).message}` };
  }
  const tid = state?.graph?.template_id;
  if (typeof tid !== 'string') return { changed: false, reason: 'no template_id' };

  let changed = false;

  if (tid === 'default' || tid === 'quick') {
    const next = TEMPLATE_ID_REMAP[tid];
    state.graph.template_id = next;
    // Bump project.updated by 1ms-style timestamp to avoid collision with engine writes.
    const now = new Date().toISOString();
    state.project.updated = now;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    changed = true;
    return { changed, reason: `template_id ${tid} → ${next}` };
  }

  if (tid === 'full') {
    const snapshotPath = path.join(projectDir, 'template.yml');
    if (!fs.existsSync(snapshotPath)) {
      fs.writeFileSync(snapshotPath, fullBakContent);
      changed = true;
      return { changed, reason: `wrote missing template.yml snapshot for full-template project` };
    }
    return { changed: false, reason: 'full project already has snapshot' };
  }

  return { changed: false, reason: `template_id ${tid} requires no action` };
}

function main(): void {
  const { basePath } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(basePath)) {
    console.error(`Base path does not exist: ${basePath}`);
    process.exit(1);
  }
  const fullBakContent = fs.readFileSync(FULL_BAK_PATH, 'utf-8');
  const entries = fs.readdirSync(basePath, { withFileTypes: true }).filter(e => e.isDirectory());
  let changedCount = 0;
  let skippedCount = 0;
  for (const entry of entries) {
    const projectDir = path.join(basePath, entry.name);
    if (!isProjectDir(projectDir)) {
      skippedCount++;
      continue;
    }
    const result = reconcileProject(projectDir, fullBakContent);
    console.log(`[${entry.name}] ${result.changed ? 'CHANGED' : 'no-op'}: ${result.reason}`);
    if (result.changed) changedCount++;
  }
  console.log(`\nSummary: ${changedCount} changed, ${entries.length - changedCount - skippedCount} no-op, ${skippedCount} non-project entries.`);
}

main();

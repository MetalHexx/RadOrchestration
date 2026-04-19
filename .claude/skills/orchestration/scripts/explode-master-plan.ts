#!/usr/bin/env node
/**
 * CLI wrapper for the explosion script.
 *
 * Usage:
 *   node explode-master-plan.ts \
 *     --project-dir <path> \
 *     --master-plan <path> \
 *     --project-name <name>
 *
 * Exit codes:
 *   0  success — emitted phases + tasks, seeded state.json.
 *   1  real failure — filesystem / write / frontmatter error on emitted doc.
 *      The orchestrator surfaces these via the log-error skill (halt).
 *   2  parse failure — malformed Master Plan input. The orchestrator
 *      dispatches `explosion_failed` with the structured parse_error.
 */
import { explodeMasterPlan, ParseError } from './lib/explode-master-plan.js';

interface Args {
  projectDir?: string;
  masterPlanPath?: string;
  projectName?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--project-dir':
        out.projectDir = next;
        i++;
        break;
      case '--master-plan':
        out.masterPlanPath = next;
        i++;
        break;
      case '--project-name':
        out.projectName = next;
        i++;
        break;
    }
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.projectDir || !args.masterPlanPath || !args.projectName) {
    console.error(JSON.stringify({
      success: false,
      type: 'real_error',
      error: 'Missing required argument(s). Usage: --project-dir <path> --master-plan <path> --project-name <name>',
    }, null, 2));
    process.exit(1);
    return;
  }

  try {
    const result = explodeMasterPlan({
      projectDir: args.projectDir,
      masterPlanPath: args.masterPlanPath,
      projectName: args.projectName,
    });
    console.log(JSON.stringify({
      success: true,
      emittedPhases: result.emittedPhaseFiles.length,
      emittedTasks: result.emittedTaskFiles.length,
      backupDir: result.backupDir,
    }, null, 2));
    process.exit(0);
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(JSON.stringify({
        success: false,
        type: 'parse_error',
        error: err.toDetail(),
      }, null, 2));
      process.exit(2);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      success: false,
      type: 'real_error',
      error: message,
    }, null, 2));
    process.exit(1);
  }
}

const scriptName = process.argv[1] ?? '';
if (scriptName.endsWith('explode-master-plan.ts') || scriptName.endsWith('explode-master-plan.js')) {
  main();
}

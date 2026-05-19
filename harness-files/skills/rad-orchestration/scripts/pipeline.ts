import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { processEvent } from './lib/engine.js';
import {
  readState,
  writeState,
  readConfig,
  readDocument,
  ensureDirectories,
} from './lib/state-io.js';
import type { EventContext, IOAdapter, PathContext, PipelineResult } from './lib/types.js';

// Resolve the three filesystem roots from this file's own location. `pipeline.ts`
// sits at `scripts/pipeline.ts` in source AND `scripts/pipeline.js` in the esbuild
// bundle — same level — so the relative-path math is correct in both runtimes.
// Library code under `scripts/lib/` receives these values through the PathContext
// parameter rather than recomputing them; the bundle output sits one level above
// `scripts/lib/`, so any file-relative walk from there would land at the wrong
// directory at runtime.
export function resolvePathContext(): PathContext {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  // templatesDir points at ~/.radorch/templates/ — the single canonical home
  // for both orchestration.yml and templates/ in the user-data root. The
  // repo-side canonical source lives at runtime-config/; the skill
  // folder no longer hosts these files at any point in the pipeline.
  const templatesDir = path.join(os.homedir(), '.radorch', 'templates');
  const orchRoot = path.resolve(scriptsDir, '..', '..', '..');
  return { scriptsDir, templatesDir, orchRoot };
}

// The pipeline runtime ships in the plugin cache but reads its config from
// the user-data root. One canonical reader, one canonical location.
export function resolveDiscoveredConfigPath(): string {
  return path.join(os.homedir(), '.radorch', 'orchestration.yml');
}

// ── Argument Parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length - 1; i += 2) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1] ?? '';
    }
  }
  return args;
}

const HELP_TEXT = `Usage: pipeline.js --event <event-name> --project-dir <path> [options]

Required:
  --event <name>          Pipeline event signal (see list below)
  --project-dir <path>    Path to the project directory

Common events:
  start, requirements_started, requirements_completed,
  master_plan_started, master_plan_completed,
  explosion_started, explosion_completed, explosion_failed,
  plan_approved, plan_rejected,
  execution_started, code_review_started, code_review_completed,
  task_completed, commit_started, commit_completed,
  pr_requested, pr_created,
  phase_review_started, phase_review_completed,
  final_review_started, final_review_completed,
  gate_mode_set, gate_approved, gate_rejected,
  source_control_init

Common flags:
  --doc-path <path>       Document path (for *_completed events)
  --phase <n> --task <n>  Phase/task selectors
  --gate-mode task|phase|autonomous
  --verdict approved|changes_requested|rejected
  --branch <name>         Branch name (source-control events)
  --commit-hash <hash>    Commit hash (commit_completed)
  --pr-url <url>          PR URL (pr_created)
  --parse-error '<json>'  Parse error payload (explosion_failed)
  --reason <text>         Rejection reason (gate_rejected)
  --config <path>         Override default orchestration.yml location

Returns a JSON envelope on stdout. Exit code 0 on success, 1 on failure.

For the full event reference and behaviour, see
references/action-event-reference.md in the rad-orchestration skill folder.
`;

function makeErrorResult(message: string, event: string, orchRoot: string): PipelineResult {
  return {
    success: false,
    action: null,
    context: { error: message },
    mutations_applied: [],
    orchRoot,
    error: { message, event },
  };
}

// ── CLI Entry ─────────────────────────────────────────────────────────────────

export function run(argv: string[]): void {
  // --help / -h short-circuit — print usage to stdout and exit 0 before any
  // event/project-dir validation. Default behaviour (no help flag) is unchanged
  // and still returns the JSON envelope on stdout.
  if (argv.includes('--help') || argv.includes('-h')) {
    process.exitCode = 0;
    process.stdout.write(HELP_TEXT);
    return;
  }

  const args = parseArgs(argv);
  const event = args['event'];
  const pathContext = resolvePathContext();
  const { orchRoot, scriptsDir } = pathContext;

  try {
    const projectDir = args['project-dir'];
    let configPath = args['config'];

    if (!configPath) {
      const discovered = resolveDiscoveredConfigPath();
      if (fs.existsSync(discovered)) {
        configPath = discovered;
      }
    }

    if (!event) {
      process.exitCode = 1;
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --event', 'unknown', orchRoot), null, 2) + '\n');
      return;
    }
    if (!projectDir) {
      process.exitCode = 1;
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --project-dir', 'unknown', orchRoot), null, 2) + '\n');
      return;
    }

    // Parse --phase and --task as numbers
    const phaseStr = args['phase'];
    const taskStr = args['task'];

    let phase: number | undefined;
    let task: number | undefined;

    if (phaseStr !== undefined) {
      phase = Number(phaseStr);
      if (!Number.isFinite(phase) || phase < 1) {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(makeErrorResult(`Invalid value for --phase: ${phaseStr}`, event, orchRoot), null, 2) + '\n');
        return;
      }
    }

    if (taskStr !== undefined) {
      task = Number(taskStr);
      if (!Number.isFinite(task) || task < 1) {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(makeErrorResult(`Invalid value for --task: ${taskStr}`, event, orchRoot), null, 2) + '\n');
        return;
      }
    }

    // Build EventContext — only include optional fields that were provided
    const context: Partial<EventContext> = {};
    if (args['doc-path'] !== undefined) context.doc_path = args['doc-path'];
    if (args['branch'] !== undefined) context.branch = args['branch'];
    if (args['gate-mode'] !== undefined) context.gate_mode = args['gate-mode'];
    if (args['step'] !== undefined) context.step = args['step'];
    if (phase !== undefined) context.phase = phase;
    if (task !== undefined) context.task = task;
    if (args['verdict'] !== undefined) context.verdict = args['verdict'];
    if (args['base-branch'] !== undefined) context.base_branch = args['base-branch'];
    if (args['worktree-path'] !== undefined) context.worktree_path = args['worktree-path'];
    if (args['auto-commit'] !== undefined) context.auto_commit = args['auto-commit'];
    if (args['auto-pr'] !== undefined) context.auto_pr = args['auto-pr'];
    if (args['gate-type'] !== undefined) context.gate_type = args['gate-type'];
    if (args['reason'] !== undefined) context.reason = args['reason'];
    if (args['commit-hash'] !== undefined) context.commit_hash = args['commit-hash'];
    if (args['pushed'] !== undefined) context.pushed = args['pushed'];
    if (args['remote-url'] !== undefined) context.remote_url = args['remote-url'];
    if (args['compare-url'] !== undefined) context.compare_url = args['compare-url'];
    if (args['pr-url'] !== undefined) context.pr_url = args['pr-url'];
    if (args['template'] !== undefined) context.template = args['template'];

    if (args['parse-error'] !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(args['parse-error']);
      } catch (e) {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(makeErrorResult(
          `Invalid JSON for --parse-error: ${(e as Error).message}`, event, orchRoot), null, 2) + '\n');
        return;
      }
      if (parsed === null || typeof parsed !== 'object') {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(makeErrorResult(
          `Invalid --parse-error shape: expected an object, got ${parsed === null ? 'null' : typeof parsed}`,
          event, orchRoot), null, 2) + '\n');
        return;
      }
      const parsedRecord = parsed as Record<string, unknown>;
      if (!Number.isInteger(parsedRecord.line) || (parsedRecord.line as number) < 1 || typeof parsedRecord.expected !== 'string' ||
          typeof parsedRecord.found !== 'string' || typeof parsedRecord.message !== 'string') {
        process.exitCode = 1;
        process.stdout.write(JSON.stringify(makeErrorResult(
          `Invalid --parse-error shape: expected { line: positive integer, expected: string, found: string, message: string }`,
          event, orchRoot), null, 2) + '\n');
        return;
      }
      context.parse_error = {
        line: parsedRecord.line as number,
        expected: parsedRecord.expected as string,
        found: parsedRecord.found as string,
        message: parsedRecord.message as string,
      };
    }

    // Build IOAdapter from state-io named exports
    const io: IOAdapter = {
      readState,
      writeState,
      readConfig,
      readDocument,
      ensureDirectories,
    };

    const result = processEvent(event, projectDir, context, io, pathContext, configPath);
    process.exitCode = result.success ? 0 : 1;
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback: PipelineResult = {
      success: false,
      action: null,
      context: { error: message },
      mutations_applied: [],
      orchRoot,
      error: { message, event: event ?? 'unknown' },
    };
    process.exitCode = 1;
    process.stdout.write(JSON.stringify(fallback, null, 2) + '\n');
  }
}

// ── Invoke when run directly ──────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2));
}

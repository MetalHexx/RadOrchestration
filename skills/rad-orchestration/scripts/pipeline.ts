import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
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
import { detectOrchRoot } from './lib/orch-root.js';
import type { EventContext, IOAdapter, PipelineResult } from './lib/types.js';

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

function makeErrorResult(message: string, event: string, orchRoot: string = detectOrchRoot()): PipelineResult {
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
  const args = parseArgs(argv);
  const event = args['event'];
  let orchRoot = detectOrchRoot(); // fallback until config is read

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectDir = args['project-dir'];
    let configPath = args['config'];

    if (!configPath) {
      const discovered = path.resolve(__dirname, '../config/orchestration.yml');
      if (fs.existsSync(discovered)) {
        configPath = discovered;
      }
    }

    if (!event) {
      process.exitCode = 1;
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --event', 'unknown'), null, 2) + '\n');
      return;
    }
    if (!projectDir) {
      process.exitCode = 1;
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --project-dir', 'unknown'), null, 2) + '\n');
      return;
    }

    // Resolve orchRoot from config early so validation errors report the correct value
    try {
      orchRoot = readConfig(configPath).system.orch_root;
    } catch { /* config unreadable — orchRoot stays as default */ }

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

    const result = processEvent(event, projectDir, context, io, configPath);
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

import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { processEvent } from './lib/engine.js';
import {
  readState,
  writeState,
  readConfig,
  readDocument,
  ensureDirectories,
} from './lib/state-io.js';
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

function makeErrorResult(message: string, event: string, orchRoot: string = '.github'): PipelineResult {
  return {
    success: false,
    action: null,
    context: {},
    mutations_applied: [],
    orchRoot,
    error: { message, event },
  };
}

// ── CLI Entry ─────────────────────────────────────────────────────────────────

export function run(argv: string[]): void {
  const args = parseArgs(argv);
  const event = args['event'];
  let orchRoot = '.github'; // fallback until config is read

  try {
    const projectDir = args['project-dir'];
    const configPath = args['config'];

    if (!event) {
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --event', 'unknown')));
      return;
    }
    if (!projectDir) {
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --project-dir', 'unknown')));
      return;
    }
    if (!configPath) {
      process.stdout.write(JSON.stringify(makeErrorResult('Missing required argument: --config', 'unknown')));
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
        process.stdout.write(JSON.stringify(makeErrorResult(`Invalid value for --phase: ${phaseStr}`, event, orchRoot)));
        return;
      }
    }

    if (taskStr !== undefined) {
      task = Number(taskStr);
      if (!Number.isFinite(task) || task < 1) {
        process.stdout.write(JSON.stringify(makeErrorResult(`Invalid value for --task: ${taskStr}`, event, orchRoot)));
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

    // Build IOAdapter from state-io named exports
    const io: IOAdapter = {
      readState,
      writeState,
      readConfig,
      readDocument,
      ensureDirectories,
    };

    const result = processEvent(event, projectDir, context, io, configPath);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback: PipelineResult = {
      success: false,
      action: null,
      context: {},
      mutations_applied: [],
      orchRoot,
      error: { message, event: event ?? 'unknown' },
    };
    process.stdout.write(JSON.stringify(fallback));
  }
}

// ── Invoke when run directly ──────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2));
}

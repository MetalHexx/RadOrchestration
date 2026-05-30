// session-preamble.mjs — Shared preamble hook shim.
// Runs the bundled CLI's `session-context` subcommand, parses the canonical
// envelope { ok, data, error }, and returns an additionalContext payload for
// the harness session-start hook contract.
//
// Resolves radorch.mjs two ways (AD-10):
//   1. Plugin delivery: ${CLAUDE_PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs
//   2. Standard delivery: ~/.claude/skills/rad-orchestration/scripts/radorch.mjs
//
// On ok:true  → additionalContext carries data.preamble (FR-16, FR-17)
// On ok:false, non-zero status, or unparseable stdout → clear notice that
//   ambient awareness did not load; never throws (FR-16, FR-17).
//
// Authored once here; consumed by both plugin and standard delivery (AD-8).

import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const NOTICE_PREFIX = 'rad-orchestration ambient awareness did not load';

function resolveRadorch() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    return path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  }
  // Standard-install manifest destination: ~/.claude/skills/rad-orchestration/scripts/radorch.mjs
  return path.join(os.homedir(), '.claude', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
}

function defaultRun() {
  try {
    const radorch = resolveRadorch();
    return spawnSync(process.execPath, [radorch, 'session-context'], { encoding: 'utf8' });
  } catch (err) {
    return { status: 1, stdout: '' };
  }
}

/**
 * Pure function: accepts an injectable { run } for testability.
 * `run` defaults to spawning the bundled CLI's `session-context` subcommand.
 * Returns { additionalContext: string }.
 *
 * @param {{ run?: () => { status: number, stdout: string } }} [opts]
 * @returns {{ additionalContext: string }}
 */
export function buildHookOutput(opts = {}) {
  const run = opts.run ?? defaultRun;
  try {
    const result = run();
    if (result.status !== 0) {
      // Try to extract error message from the envelope even on non-zero exit
      let detail = '';
      try {
        const parsed = JSON.parse(result.stdout);
        if (parsed?.error?.message) detail = ` — ${parsed.error.message}`;
      } catch { /* unparseable; no detail */ }
      return { additionalContext: `${NOTICE_PREFIX}${detail}.` };
    }
    let envelope;
    try {
      envelope = JSON.parse(result.stdout);
    } catch {
      return { additionalContext: `${NOTICE_PREFIX} (could not parse CLI output).` };
    }
    if (!envelope?.ok) {
      const detail = envelope?.error?.message ? ` — ${envelope.error.message}` : '';
      return { additionalContext: `${NOTICE_PREFIX}${detail}.` };
    }
    return { additionalContext: envelope.data.preamble };
  } catch {
    return { additionalContext: `${NOTICE_PREFIX}.` };
  }
}

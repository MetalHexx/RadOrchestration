// session-preamble.mjs — Shared preamble hook shim.
// Runs the bundled CLI's `session-context` subcommand, parses the canonical
// envelope { ok, data, error }, and returns an additionalContext payload for
// the harness session-start hook contract.
//
// Resolves radorch.mjs two ways (AD-10):
//   1. Plugin delivery: ${CLAUDE_PLUGIN_ROOT|COPILOT_PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs
//   2. Standard delivery: <harnessRoot>/skills/rad-orchestration/scripts/radorch.mjs
//      where <harnessRoot> is derived from this hook file's own location (../ from hooks/).
// Copilot CLI launches the hook with COPILOT_PLUGIN_ROOT set (not
// CLAUDE_PLUGIN_ROOT), so both env vars are honored (FR-16).
//
// On ok:true  → additionalContext carries data.preamble (FR-16, FR-17)
// On ok:false, non-zero status, or unparseable stdout → clear notice that
//   ambient awareness did not load; never throws (FR-16, FR-17).
//
// Authored once here; consumed by both plugin and standard delivery (AD-8).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const NOTICE_PREFIX = 'rad-orchestration ambient awareness did not load';

export function resolveRadorch() {
  // CLAUDE_PLUGIN_ROOT (Claude / Copilot-VSCode harnesses) or COPILOT_PLUGIN_ROOT
  // (Copilot CLI harness) — both place radorch.mjs under the same plugin layout.
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? process.env.COPILOT_PLUGIN_ROOT;
  if (pluginRoot) {
    return path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
  }
  // Standard-install: hook ships at <harnessRoot>/hooks/session-preamble.mjs.
  // Derive <harnessRoot> from this file's own location (one level up from
  // hooks/) so the same hook works under any harness root (e.g. ~/.copilot or
  // ~/.claude).
  const hookDir = path.dirname(fileURLToPath(import.meta.url));
  const harnessRoot = path.resolve(hookDir, '..');
  return path.join(harnessRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
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

/**
 * Serializes the hook output for stdout, mirroring the existing SessionStart
 * drift-check hook: the raw context text is written straight to stdout, where
 * the harness injects it as conversation context (the `additionalContext`
 * channel — see the harness context-channel contract). Returns the exact
 * string the main-execution block writes.
 *
 * @param {{ additionalContext: string }} out
 * @returns {string}
 */
export function emitHookResult(out) {
  return out?.additionalContext ?? '';
}

// Main-execution block: only fires when this module is run as the entry point
// (e.g. `node .../session-preamble.mjs` from the harness SessionStart hook).
// Soft-failing by contract — it must never throw and never block session start.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const out = buildHookOutput();
    const payload = emitHookResult(out);
    if (payload) process.stdout.write(`${payload}\n`);
  } catch {
    /* never throw from the hook entry point */
  }
}

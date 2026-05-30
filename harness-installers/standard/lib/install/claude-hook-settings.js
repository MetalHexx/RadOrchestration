// harness-installers/standard/lib/install/claude-hook-settings.js —
// Surgical, marker-tagged merge of the preamble hook into Claude's user-owned
// settings.json on install, and removal of exactly that marked entry on
// uninstall, leaving all other user settings intact.
//
// The stable marker substring "rad-orc-preamble" is embedded in the hook
// command string so that idempotency checks and removal can locate the entry
// without any extra metadata field.
//
// Exports:
//   - mergePreambleHook({ settingsPath, hookCommand })
//       Reads settings.json (treating a missing file as {}), ensures
//       hooks.SessionStart is an array, and inserts a single SessionStart
//       entry whose command carries the "rad-orc-preamble" marker.  Idempotent:
//       skips when a marked entry already exists.  Preserves every other key.
//       Writes atomically via tmp+rename (NFR-2 pattern, AD-9).
//
//   - removePreambleHook({ settingsPath })
//       Filters out exactly the marked entry from hooks.SessionStart, leaving
//       all other SessionStart entries and all other settings untouched.
//       Writes atomically via tmp+rename (NFR-2 pattern, AD-9).

import fs from 'node:fs';
import path from 'node:path';

/** Stable marker substring embedded in the hook command (AD-9). */
const MARKER = 'rad-orc-preamble';

/**
 * Read settings.json at `settingsPath`.  Returns `{}` when the file is
 * missing, unreadable, or malformed JSON.
 *
 * @param {string} settingsPath
 * @returns {object}
 */
function readSettings(settingsPath) {
  try {
    if (!fs.existsSync(settingsPath)) return {};
    const text = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Atomic write: serialize → temp file → rename (NFR-2, AD-9).
 *
 * @param {string} settingsPath
 * @param {object} value
 */
function writeSettings(settingsPath, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, settingsPath);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

/**
 * Returns true when the given SessionStart group entry carries the stable
 * "rad-orc-preamble" marker in any of its hook commands.
 *
 * @param {object} entry  — a SessionStart group object
 * @returns {boolean}
 */
function isMarkedEntry(entry) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h) => typeof h.command === 'string' && h.command.includes(MARKER),
  );
}

/**
 * Build the SessionStart group entry for the preamble hook.
 * The hookCommand is embedded verbatim; the MARKER is appended as a
 * comment-style suffix so the entry is always identifiable.
 *
 * Claude's settings.json SessionStart hook format:
 *   { hooks: [ { type: 'command', command: '<cmd>' } ] }
 *
 * @param {string} hookCommand
 * @returns {object}
 */
function buildMarkedEntry(hookCommand) {
  return {
    hooks: [
      {
        type: 'command',
        command: `${hookCommand} # ${MARKER}`,
      },
    ],
  };
}

/**
 * Merge the preamble hook into Claude's settings.json (FR-18, AD-9, AD-10).
 *
 * - Reads the file at `settingsPath` (treats missing as `{}`).
 * - Ensures `hooks.SessionStart` is an array.
 * - Inserts a single marked entry when none exists (idempotent).
 * - Preserves every other key and every other SessionStart entry.
 * - Writes atomically via tmp+rename (NFR-2).
 *
 * @param {{ settingsPath: string, hookCommand: string }} opts
 */
export function mergePreambleHook({ settingsPath, hookCommand }) {
  const settings = readSettings(settingsPath);

  // Ensure the hooks namespace and SessionStart array exist.
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {};
  }
  if (!Array.isArray(settings.hooks.SessionStart)) {
    settings.hooks.SessionStart = [];
  }

  // Idempotency guard — skip if a marked entry already exists.
  if (settings.hooks.SessionStart.some(isMarkedEntry)) {
    return;
  }

  settings.hooks.SessionStart.push(buildMarkedEntry(hookCommand));
  writeSettings(settingsPath, settings);
}

/**
 * Remove the marked preamble hook entry from Claude's settings.json (FR-18,
 * AD-9).
 *
 * - Reads the file at `settingsPath`.  No-ops when the file is absent.
 * - Filters out exactly the marked entry from `hooks.SessionStart`.
 * - Leaves all other SessionStart entries and all other settings untouched.
 * - Writes atomically via tmp+rename (NFR-2).
 *
 * @param {{ settingsPath: string }} opts
 */
export function removePreambleHook({ settingsPath }) {
  const settings = readSettings(settingsPath);

  if (
    !settings.hooks ||
    !Array.isArray(settings.hooks.SessionStart)
  ) {
    return;
  }

  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (entry) => !isMarkedEntry(entry),
  );

  // Only write back when something was actually removed.
  if (settings.hooks.SessionStart.length !== before) {
    writeSettings(settingsPath, settings);
  }
}

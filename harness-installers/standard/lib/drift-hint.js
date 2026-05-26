// harness-installers/standard/lib/drift-hint.js — Cross-channel
// version-drift hint computed from ~/.radorc/install.json (AD-15, FR-9).
//
// AD-15 fixes the drift source: the standard installer and the plugin channel
// both record themselves in `install.json` under `harnesses.<key>`. Drift is
// the simple cross-channel comparison between the `claude` entry (written by
// the standard installer) and the `claude-plugin` entry (written by the
// plugin installer). No separate state file, no plugin-registry read.
//
// Defensive on every edge case (NFR-4): missing file, malformed JSON, missing
// `harnesses` key, missing either channel, non-string versions, identical
// versions — all return `null`. Only a (claude, claude-plugin) pair at
// different versions produces a truthy hint.
//
// Return shape matches what summary.js consumes:
//   `{ installedVersion: string, pluginVersion: string }`
// where `installedVersion` is the standard installer's `claude` entry version
// and `pluginVersion` is the plugin channel's `claude-plugin` entry version.

import fs from 'node:fs';
import path from 'node:path';

import { userDataPaths } from './install/user-data-paths.js';

/**
 * @typedef {Object} DriftHint
 * @property {string} installedVersion - Standard installer's `claude` entry version
 * @property {string} pluginVersion    - Plugin channel's `claude-plugin` entry version
 */

/**
 * Reads the cross-channel install record and returns a drift hint when the
 * `claude` and `claude-plugin` entries disagree on version. Returns `null` in
 * every other case (missing file, malformed JSON, missing entries, identical
 * versions). Never throws.
 *
 * @param {{ installJsonPath?: string }} [opts]
 *   `installJsonPath` is optional; defaults to `userDataPaths().installJson`
 *   resolved lazily inside the function so tests can override HOME before
 *   calling.
 * @returns {DriftHint | null}
 */
export function computeDriftHint({ installJsonPath } = {}) {
  try {
    const jsonPath = installJsonPath ?? userDataPaths().installJson;
    if (!fs.existsSync(jsonPath)) return null;
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const harnesses = parsed?.harnesses;
    if (!harnesses || typeof harnesses !== 'object') return null;
    const standard = harnesses['claude'];
    const plugin = harnesses['claude-plugin'];
    if (!standard || !plugin) return null;
    if (typeof standard.version !== 'string' || typeof plugin.version !== 'string') return null;
    if (standard.version === plugin.version) return null;
    return { installedVersion: standard.version, pluginVersion: plugin.version };
  } catch {
    return null;
  }
}

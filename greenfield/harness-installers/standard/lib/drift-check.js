// greenfield/harness-installers/standard/lib/drift-check.js — Cross-channel
// version-drift detection.
//
// When the user upgrades rad-orchestration through the standard installer
// (`npx rad-orchestration`) but their Claude Code plugin is at a different
// version, the system drifts: the plugin's bundled agents/skills are stale
// against the new ~/.radorch/. This helper warns at the moment of drift
// creation by reading Claude Code's own plugin registry.
//
// Detection source: ~/.claude/plugins/installed_plugins.json — Claude Code's
// authoritative record of installed plugins. Survives installer upgrades
// because the installer never touches it.
//
// Defensive on every edge case (file missing, malformed JSON, no entries):
// returns `{ drift: false, plugins: [] }` rather than throwing (NFR-4).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * @typedef {Object} DriftEntry
 * @property {string} key             - "<plugin-name>@<marketplace-name>" key from registry
 * @property {string} version         - The plugin install entry's version
 * @property {string} [installPath]   - Optional install path from the registry
 */

/**
 * @typedef {Object} DriftResult
 * @property {boolean} drift          - true iff at least one rad-orchestration plugin entry mismatches `installedVersion`
 * @property {DriftEntry[]} plugins   - One entry per mismatching install
 */

/**
 * Detects version drift between the installer's just-installed version and
 * any installed rad-orchestration Claude Code plugin entries.
 *
 * @param {string} installedVersion - The version the installer just bootstrapped
 * @param {{ homeDir?: string }} [opts]
 * @returns {DriftResult}
 */
export function detectPluginDrift(installedVersion, opts = {}) {
  const homeDir = opts.homeDir ?? os.homedir();
  const registryPath = path.join(homeDir, '.claude', 'plugins', 'installed_plugins.json');

  if (!fs.existsSync(registryPath)) return { drift: false, plugins: [] };

  let raw;
  try {
    raw = fs.readFileSync(registryPath, 'utf8');
  } catch {
    return { drift: false, plugins: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { drift: false, plugins: [] };
  }

  const plugins = parsed?.plugins;
  if (!plugins || typeof plugins !== 'object') return { drift: false, plugins: [] };

  const mismatches = [];
  for (const [key, entries] of Object.entries(plugins)) {
    // Keys look like "rad-orchestration@<marketplace-name>". Match the
    // plugin-name part exactly so unrelated plugins don't get caught.
    const namePart = key.split('@')[0];
    if (namePart !== 'rad-orchestration') continue;

    const entryList = Array.isArray(entries) ? entries : [entries];
    for (const entry of entryList) {
      if (!entry || typeof entry !== 'object') continue;
      const version = typeof entry.version === 'string' ? entry.version : undefined;
      if (!version) continue;
      if (version !== installedVersion) {
        mismatches.push({
          key,
          version,
          installPath: typeof entry.installPath === 'string' ? entry.installPath : undefined,
        });
      }
    }
  }

  return { drift: mismatches.length > 0, plugins: mismatches };
}

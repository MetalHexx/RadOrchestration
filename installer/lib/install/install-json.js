// installer/lib/install/install-json.js — Read/write ~/.radorch/install.json,
// the v6 multi-harness registry, lazy migration from v5, conflict helpers, and
// a semver-aware comparator. Independent JS port of
// cli/src/lib/install-json.ts + cli/src/lib/config.ts (the install.json bits).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Four valid v6 install-keys. See Section 6 of the smoke-test plan. */
export const INSTALL_KEYS = ['claude', 'claude-plugin', 'copilot-cli', 'copilot-vscode'];

const FOLDER_MUTEX_PARTNER = {
  'copilot-cli': 'copilot-vscode',
  'copilot-vscode': 'copilot-cli',
};

const CHANNEL_OVERLAP_PARTNER = {
  'claude': 'claude-plugin',
  'claude-plugin': 'claude',
};

export function readInstallJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

export function writeInstallJson(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n');
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

export function isInstallJsonV6(ij) {
  return !!ij && ij.state_schema_version === 'v6' && typeof ij.harnesses === 'object';
}

export function isInstallKey(value) {
  return INSTALL_KEYS.includes(value);
}

/**
 * Lazy migration from v5 (flat single-record) to v6 (multi-harness registry).
 * If the input is already v6 it is returned as-is. For v5 inputs, builds a
 * single v6 entry under `activeKey` using the v5 record's fields and the
 * supplied `channel`.
 */
export function migrateInstallJson(ij, activeKey, channel) {
  if (isInstallJsonV6(ij)) return ij;
  const v5 = ij ?? {};
  const version = v5.package_version ?? 'unknown';
  const installed_at = v5.installed_at ?? new Date().toISOString();
  const last_writer_version = v5.last_writer_version ?? version;
  return {
    state_schema_version: 'v6',
    harnesses: {
      [activeKey]: {
        version,
        channel,
        installed_at,
        last_writer_version,
      },
    },
  };
}

/**
 * Folder-shared mutual exclusion: copilot-cli ↔ copilot-vscode share
 * ~/.copilot/. If writing one variant while the other is registered, the
 * prior partner is removed from the registry. Returns the removed key (if
 * any) so the caller can emit the mutex notification.
 *
 * Mutates `harnesses` in place. claude ↔ claude-plugin are not folder-mutex
 * partners (they coexist) — see `detectChannelOverlap`.
 */
export function resolveFolderConflict(harnesses, installKey) {
  const partner = FOLDER_MUTEX_PARTNER[installKey];
  if (!partner) return {};
  const existing = harnesses[partner];
  if (!existing) return {};
  const removed = { key: partner, entry: existing };
  delete harnesses[partner];
  return { removed };
}

/**
 * Cross-channel coexistence detector: claude ↔ claude-plugin coexist on disk
 * (both write into ~/.claude/) but the writer surfaces a one-line stderr
 * warning recommending consolidation. Returns the partner key if present so
 * the caller can emit the channel-specific warning text. Does NOT mutate.
 */
export function detectChannelOverlap(harnesses, installKey) {
  const partner = CHANNEL_OVERLAP_PARTNER[installKey];
  if (!partner) return undefined;
  return harnesses[partner] ? partner : undefined;
}

/**
 * Channel-detection heuristic for migration: presence of
 * ~/.claude/plugins/rad-orchestration/ implies the plugin is loaded → 'plugin'.
 * Otherwise, if ~/.radorch/ exists, presume 'legacy-installer'. Fallback
 * 'unknown' if both signals absent.
 */
export function detectChannelHeuristic(opts) {
  const home = (opts && opts.home) || os.homedir();
  const pluginDir = path.join(home, '.claude', 'plugins', 'rad-orchestration');
  try {
    if (fs.existsSync(pluginDir)) return 'plugin';
  } catch {
    // ignore filesystem errors
  }
  try {
    if (fs.existsSync(path.join(home, '.radorch'))) return 'legacy-installer';
  } catch {
    // ignore
  }
  return 'unknown';
}

/**
 * Resolve the active harness key for v5→v6 migration.
 * Order: ~/.radorch/.harness pointer → ~/.radorch/config.yml default_active_harness.
 * Returns undefined if neither is present or parseable.
 */
export function resolveActiveHarnessKey(opts) {
  const home = (opts && opts.home) || os.homedir();
  const harnessPointer = path.join(home, '.radorch', '.harness');
  try {
    if (fs.existsSync(harnessPointer)) {
      const raw = fs.readFileSync(harnessPointer, 'utf8').trim();
      if (isInstallKey(raw)) return raw;
    }
  } catch {
    // fall through
  }
  const configYml = path.join(home, '.radorch', 'config.yml');
  try {
    if (fs.existsSync(configYml)) {
      const text = fs.readFileSync(configYml, 'utf8');
      const m = text.match(/^\s*default_active_harness:\s*([a-z0-9-]+)\s*$/m);
      if (m && isInstallKey(m[1])) return m[1];
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Semver-aware comparator that respects pre-release precedence (SemVer §11):
 * a normal release > any pre-release of the same main version
 * (e.g. 1.0.0 > 1.0.0-alpha.8). Returns -1 / 0 / +1.
 */
export function cmpSemver(a, b) {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === 'number') {
      return 1;
    } else if (typeof y === 'number') {
      return -1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

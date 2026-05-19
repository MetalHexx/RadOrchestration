import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInstallJson, writeInstallJson } from './config.js';
import type { InstallJson, InstallEntry, InstallKey, InstallChannel } from './config.js';
import { pathExists } from './fs-helpers.js';

// install.json multi-harness/multi-channel registry — single structural shape.
//
// Four valid install-keys:
//  - `claude`         (legacy installer claude harness)
//  - `claude-plugin`  (Claude Code plugin install)
//  - `copilot-cli`    (legacy installer copilot-cli harness)
//  - `copilot-vscode` (legacy installer copilot-vscode harness)
//
// Conflict semantics:
//  - copilot-cli ↔ copilot-vscode share ~/.copilot/: mutually exclusive
//    (`resolveFolderConflict` removes the prior partner before write).
//  - claude ↔ claude-plugin both touch ~/.claude/: coexist in the registry;
//    `detectChannelOverlap` returns the partner key for warning surfaces.
export const INSTALL_KEYS = ['claude', 'claude-plugin', 'copilot-cli', 'copilot-vscode'] as const;

const FOLDER_MUTEX_PARTNER: Partial<Record<InstallKey, InstallKey>> = {
  'copilot-cli': 'copilot-vscode',
  'copilot-vscode': 'copilot-cli',
};

const CHANNEL_OVERLAP_PARTNER: Partial<Record<InstallKey, InstallKey>> = {
  'claude': 'claude-plugin',
  'claude-plugin': 'claude',
};

/**
 * Folder-shared mutual exclusion: copilot-cli ↔ copilot-vscode share ~/.copilot/.
 * If writing one variant while the other is registered, the prior partner is
 * removed from the registry. Returns the removed key (if any) so the caller can
 * emit the mutex notification.
 *
 * Mutates `harnesses` in place. claude ↔ claude-plugin are not folder-mutex
 * partners (they coexist) — see `detectChannelOverlap`.
 */
export function resolveFolderConflict(
  harnesses: InstallJson['harnesses'],
  installKey: InstallKey,
): { removed?: { key: InstallKey; entry: InstallEntry } } {
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
 * (both write into ~/.claude/) but the writer surfaces a one-line stderr warning
 * recommending consolidation. Returns the partner key if present so the caller
 * can emit the channel-specific warning text. Does NOT mutate the registry.
 */
export function detectChannelOverlap(
  harnesses: InstallJson['harnesses'],
  installKey: InstallKey,
): InstallKey | undefined {
  const partner = CHANNEL_OVERLAP_PARTNER[installKey];
  if (!partner) return undefined;
  return harnesses[partner] ? partner : undefined;
}

/**
 * Channel-detection heuristic. The plugin and the legacy installer both write
 * install.json to the same path, so we cannot tell them apart from file content
 * alone. Signal: presence of ~/.claude/plugins/rad-orchestration/ implies the
 * plugin is loaded → 'plugin'. Otherwise, if the install root exists, presume
 * 'legacy-installer'. If both signals are absent, fall back to 'unknown'.
 */
export function detectChannelHeuristic(opts?: { home?: string }): InstallChannel {
  const home = opts?.home ?? os.homedir();
  const pluginDir = path.join(home, '.claude', 'plugins', 'rad-orchestration');
  try {
    if (fs.existsSync(pluginDir)) return 'plugin';
  } catch {
    // ignore filesystem errors and fall through
  }
  // The presence of ~/.radorch/ at all signals a legacy install — fresh systems
  // have neither, and we return 'unknown'.
  try {
    if (fs.existsSync(path.join(home, '.radorch'))) return 'legacy-installer';
  } catch {
    // ignore
  }
  return 'unknown';
}

export function isInstallKey(value: string): value is InstallKey {
  return (INSTALL_KEYS as readonly string[]).includes(value);
}

// Semver-aware comparator that respects pre-release precedence (SemVer §11):
// a normal release > any pre-release of the same main version (e.g. 1.0.0 > 1.0.0-alpha.8).
// Returns -1 / 0 / +1 in the usual sign convention.
export function cmpSemver(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    // Side that ran out of tokens: if the other side's next token is a string,
    // it's a pre-release tag — the side without one is the release and wins.
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === 'number') {
      // numeric token meets pre-release tag at same position: release > pre-release
      return 1;
    } else if (typeof y === 'number') {
      return -1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** Returns the latest `last_writer_version` across all harness entries, or
 * undefined if the registry is empty. */
export function readLastWriterVersion(ij: InstallJson): string | undefined {
  let latest: string | undefined;
  for (const entry of Object.values(ij.harnesses)) {
    if (!entry) continue;
    if (!latest || cmpSemver(entry.last_writer_version, latest) > 0) {
      latest = entry.last_writer_version;
    }
  }
  return latest;
}

export async function stampLastWriter(installJsonPath: string, version: string): Promise<void> {
  if (!(await pathExists(installJsonPath))) return;
  const ij = await readInstallJson(installJsonPath);
  // Bump every harness entry's last_writer_version (best-effort: when the
  // CLI runs, it represents whatever install loaded it).
  let mutated = false;
  for (const key of Object.keys(ij.harnesses) as InstallKey[]) {
    const entry = ij.harnesses[key];
    if (!entry) continue;
    if (!entry.last_writer_version || cmpSemver(version, entry.last_writer_version) >= 0) {
      entry.last_writer_version = version;
      mutated = true;
    }
  }
  if (mutated) await writeInstallJson(installJsonPath, ij);
}

export async function checkVersionSkew(opts: {
  installJsonPath: string;
  localVersion: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await pathExists(opts.installJsonPath))) return { ok: true };
  const ij = await readInstallJson(opts.installJsonPath);
  const lastWriter = readLastWriterVersion(ij);
  // No-op fallback: if last_writer_version is absent (empty registry),
  // skip the check.
  if (!lastWriter) return { ok: true };
  if (cmpSemver(opts.localVersion, lastWriter) < 0) {
    return {
      ok: false,
      message: `state was last written by radorch ${lastWriter} in another harness's plugin; this plugin has ${opts.localVersion} — update via /plugin update rad-orchestration in the harness that wrote it`,
    };
  }
  return { ok: true };
}

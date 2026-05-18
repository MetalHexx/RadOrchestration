// greenfield/harness-installers/standard/lib/install/install-json.js —
// Reads/writes ~/.radorch/install.json (structural single-shape; no schema
// version field). The standard installer writes structurally from the first
// install (AD-1) — it never migrates from a prior shape.
//
// Exports:
//   - readInstallJson(file)
//   - writeInstallJson(file, value)        — atomic tmp+rename; strips state_schema_version (NFR-3, AD-1)
//   - isCurrentShape(ij)                   — structural-lift: harnesses-is-object → true
//   - loadRegistry(installJsonPath)        — structural-lift; missing/non-conforming → { harnesses: {} }
//   - INSTALL_KEYS                         — the four valid install keys (AD-10)
//   - cmpSemver(a, b)                      — semver-aware comparator (release > pre-release per §11) [lifted from installer/lib/install/install-json.js lines 159–179]
//   - resolveFolderConflict(harnesses, k)  — mutates harnesses, returns { removed: { key, entry } } | {} (FR-11, AD-12)
//   - detectChannelOverlap(harnesses, k)   — claude ↔ claude-plugin coexistence detector (AD-15)

import fs from 'node:fs';
import path from 'node:path';

/** Four valid install-keys. */
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

/**
 * Atomic write: serialize → temp file → rename. Strips any
 * `state_schema_version` field before writing so the on-disk shape stays
 * structural (AD-1, NFR-3).
 *
 * @param {string} file
 * @param {object} value
 */
export function writeInstallJson(file, value) {
  const { state_schema_version, ...rest } = value ?? {};
  void state_schema_version; // explicitly dropped
  const content = JSON.stringify(rest, null, 2) + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

/**
 * Structural-lift current-shape predicate: `ij.harnesses` must be a (non-null)
 * object. Returns false for null/undefined/primitives and for legacy shapes
 * that lack a `harnesses` object.
 */
export function isCurrentShape(ij) {
  return (
    !!ij &&
    typeof ij === 'object' &&
    typeof ij.harnesses === 'object' &&
    ij.harnesses !== null
  );
}

export function isInstallKey(value) {
  return INSTALL_KEYS.includes(value);
}

/**
 * Structural-lift loader. Returns `{ harnesses: {} }` when the file is
 * missing, unreadable, malformed JSON, or fails `isCurrentShape`.
 */
export function loadRegistry(installJsonPath) {
  try {
    if (!fs.existsSync(installJsonPath)) return { harnesses: {} };
    const ij = readInstallJson(installJsonPath);
    if (!isCurrentShape(ij)) return { harnesses: {} };
    return ij;
  } catch {
    return { harnesses: {} };
  }
}

/**
 * Folder-shared mutual exclusion: copilot-cli ↔ copilot-vscode share
 * ~/.copilot/. If installing one variant while the other is registered, the
 * prior partner is removed from the registry. Returns `{ removed: { key, entry } }`
 * or `{}` if no partner exists. Mutates `harnesses` in place.
 *
 * claude ↔ claude-plugin are NOT folder-mutex partners (they coexist) — see
 * `detectChannelOverlap`.
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
 * (both write into ~/.claude/) but warrant a one-line warning recommending
 * consolidation. Returns the partner key if present (or `undefined`). Does
 * NOT mutate.
 */
export function detectChannelOverlap(harnesses, installKey) {
  const partner = CHANNEL_OVERLAP_PARTNER[installKey];
  if (!partner) return undefined;
  return harnesses[partner] ? partner : undefined;
}

/**
 * Semver-aware comparator that respects pre-release precedence (SemVer §11):
 * a normal release > any pre-release of the same main version
 * (e.g. 1.0.0 > 1.0.0-alpha.8). Returns -1 / 0 / +1.
 *
 * Lifted verbatim from installer/lib/install/install-json.js (lines 159–179).
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

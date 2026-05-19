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
//   - resolveFolderConflict(harnesses, k)  — mutates harnesses, returns { removed: [{ key, entry }, …] } | {} (FR-11, AD-12)
//   - detectFolderConflicts(harnesses, k)  — pure look-up variant (no mutation) for pre-install confirmation
//   - detectChannelOverlap(harnesses, k)   — same-UI different-channel coexistence detector (AD-15)

import fs from 'node:fs';
import path from 'node:path';

/**
 * Six valid install-keys. Each UI (claude, copilot-vscode, copilot-cli) has a
 * legacy-installer slug and a plugin-channel slug; the plugin slugs are
 * reserved here for forward-compat with the upcoming plugin installers — the
 * standard installer itself never writes plugin entries.
 */
export const INSTALL_KEYS = [
  'claude',
  'claude-plugin',
  'copilot-cli',
  'copilot-cli-plugin',
  'copilot-vscode',
  'copilot-vscode-plugin',
];

/**
 * Folder-mutex relationships. Two slugs are mutex partners when their on-disk
 * agent files live in the same harness folder but encode incompatible UI
 * targets — installing one overwrites the other's files. All vscode-flavored
 * slugs (legacy + plugin) mutex against all cli-flavored slugs.
 */
const FOLDER_MUTEX_PARTNERS = {
  'copilot-cli':           ['copilot-vscode', 'copilot-vscode-plugin'],
  'copilot-cli-plugin':    ['copilot-vscode', 'copilot-vscode-plugin'],
  'copilot-vscode':        ['copilot-cli',    'copilot-cli-plugin'],
  'copilot-vscode-plugin': ['copilot-cli',    'copilot-cli-plugin'],
};

/**
 * Channel-overlap relationships. Two slugs overlap when they target the same
 * UI through different install channels (legacy installer vs plugin) — both
 * write to the same harness folder but their agent files are compatible with
 * the same UI. Most-recent-install wins on disk; both registry entries
 * coexist with a coexistence WARNING.
 */
const CHANNEL_OVERLAP_PARTNER = {
  'claude':                'claude-plugin',
  'claude-plugin':         'claude',
  'copilot-vscode':        'copilot-vscode-plugin',
  'copilot-vscode-plugin': 'copilot-vscode',
  'copilot-cli':           'copilot-cli-plugin',
  'copilot-cli-plugin':    'copilot-cli',
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
 * Folder-shared mutual exclusion across UI variants. Any vscode-flavored slug
 * (legacy or plugin) mutexes against any cli-flavored slug — installing one
 * overwrites the other's on-disk agent files. All matching partners are
 * removed from the registry; returns `{ removed: [{ key, entry }, …] }` (or
 * `{}` if there's nothing to evict). Mutates `harnesses` in place.
 *
 * claude ↔ claude-plugin are NOT folder-mutex partners (they coexist) — see
 * `detectChannelOverlap`.
 */
export function resolveFolderConflict(harnesses, installKey) {
  const partners = FOLDER_MUTEX_PARTNERS[installKey];
  if (!partners) return {};
  const removed = [];
  for (const partner of partners) {
    const existing = harnesses[partner];
    if (!existing) continue;
    removed.push({ key: partner, entry: existing });
    delete harnesses[partner];
  }
  return removed.length > 0 ? { removed } : {};
}

/**
 * Pure look-up variant of `resolveFolderConflict` — returns the list of
 * partner slugs currently registered that would be evicted by installing
 * `installKey`. Does NOT mutate. Used by the wizard to surface a pre-install
 * confirmation prompt with accurate text.
 *
 * @param {Record<string, { version: string } & object>} harnesses
 * @param {string} installKey
 * @returns {Array<{ key: string, entry: object }>}
 */
export function detectFolderConflicts(harnesses, installKey) {
  const partners = FOLDER_MUTEX_PARTNERS[installKey];
  if (!partners) return [];
  const conflicts = [];
  for (const partner of partners) {
    const existing = harnesses[partner];
    if (existing) conflicts.push({ key: partner, entry: existing });
  }
  return conflicts;
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

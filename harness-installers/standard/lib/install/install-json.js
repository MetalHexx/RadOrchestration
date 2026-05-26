// harness-installers/standard/lib/install/install-json.js —
// Reads/writes ~/.radorc/install.json (structural single-shape; no schema
// version field). The standard installer writes structurally from the first
// install (AD-1) — it never migrates from a prior shape.
//
// Exports:
//   - readInstallJson(file)
//   - writeInstallJson(file, value)        — atomic tmp+rename; strips state_schema_version (NFR-3, AD-1)
//   - isCurrentShape(ij)                   — structural-lift: harnesses-is-object → true
//   - loadRegistry(installJsonPath)        — structural-lift; missing/non-conforming → { harnesses: {} }
//   - INSTALL_KEYS                         — the six valid install keys (AD-10)
//   - cmpSemver(a, b)                      — semver-aware comparator (release > pre-release per §11) [lifted from installer/lib/install/install-json.js lines 159–179]
//   - resolveFolderConflict(harnesses, k)  — mutates harnesses (legacy↔legacy only), returns { removed: [{ key, entry }, …] } | {} (FR-11, AD-12)
//   - detectFolderConflicts(harnesses, k)  — pure look-up variant (no mutation) for pre-install confirmation
//   - detectPluginCoexistence(harnesses, k, opts)
//                                          — plugin-partner detector across registry AND on-disk plugin roots.
//                                            Plugin entries are NEVER evicted from the registry by the standard
//                                            installer — coexistence is surfaced via a yellow + Y/N prompt
//                                            pre-install (wizard) and an stderr notice post-install (headless).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Six valid install-keys. Each UI (claude, copilot-vscode, copilot-cli) has a
 * standard-installer slug and a plugin-channel slug; the plugin slugs are
 * reserved here for forward-compat with the plugin installers — the standard
 * installer itself never writes plugin entries.
 *
 * The `channel` value the standard installer writes into each registry entry
 * is `'standard'` (formerly `'legacy-installer'`). On-disk entries written by
 * older builds keep the old value until their next install rewrites it — the
 * field is metadata, no code branches on it.
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
 * Folder-mutex relationships, LEGACY-ONLY. Two legacy slugs are mutex partners
 * when their on-disk agent files live in the same harness folder but encode
 * incompatible UI targets — installing one overwrites the other's files and
 * the standard installer evicts the partner from the registry.
 *
 * Plugin slugs deliberately do NOT appear in this map — the standard installer
 * must never delete a plugin entry from install.json. Cross-channel
 * coexistence (legacy ↔ plugin in the same folder) is handled by
 * `detectPluginCoexistence` below: the plugin registry entry is preserved and
 * the user is warned via a yellow + Y/N prompt (interactive) or stderr notice
 * (headless).
 */
const FOLDER_MUTEX_PARTNERS = {
  'copilot-cli':    ['copilot-vscode'],
  'copilot-vscode': ['copilot-cli'],
};

/**
 * Plugin partners that coexist with a legacy installKey in the same on-disk
 * harness folder. When ANY of these is present (registry OR disk), the wizard
 * surfaces a yellow + Y/N confirmation pre-install. Registry entries for these
 * partners are ALWAYS preserved across legacy installs — the plugin owns its
 * own registry lifecycle.
 *
 * Same-UI partners come first so disk-fallback detection (which cannot
 * distinguish which plugin lives on disk) reports the most likely canonical
 * partner.
 */
const PLUGIN_COEXIST_PARTNERS = {
  'claude':         ['claude-plugin'],
  'copilot-cli':    ['copilot-cli-plugin', 'copilot-vscode-plugin'],
  'copilot-vscode': ['copilot-vscode-plugin', 'copilot-cli-plugin'],
};

/**
 * Plugin leaf-directory names probed on disk. Both the current `rad-orc`
 * greenfield name and the pre-rename names are accepted so that prior installs
 * are still detected. Mirrors detectChannelHeuristic in
 * cli/src/lib/install-json.ts.
 */
const CLAUDE_PLUGIN_LEAVES = ['rad-orc', 'rad-orchestration'];
const COPILOT_PLUGIN_LEAVES = ['rad-orc', 'rad-orchestration-copilot-cli'];

function probeClaudePluginOnDisk(home) {
  const root = path.join(home, '.claude', 'plugins');
  return CLAUDE_PLUGIN_LEAVES.some((leaf) => fs.existsSync(path.join(root, leaf)));
}

function probeCopilotPluginOnDisk(home) {
  const root = path.join(home, '.copilot', 'installed-plugins');
  if (!fs.existsSync(root)) return false;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return false; }
  for (const marketplaceDir of entries) {
    if (!marketplaceDir.isDirectory()) continue;
    for (const leaf of COPILOT_PLUGIN_LEAVES) {
      if (fs.existsSync(path.join(root, marketplaceDir.name, leaf))) return true;
    }
  }
  return false;
}

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
 * True when the entry carries every canonical field; false when missing or
 * shape-drifted. Used by the NOOP path to decide whether install.json needs
 * an upsert even though no file work is required.
 *
 * Channel value is intentionally not checked — old standard installs may
 * carry `channel: 'legacy-installer'` and that's metadata-only per AD-10.
 */
export function isEntryCurrent(entry, version) {
  if (!entry || typeof entry !== 'object') return false;
  return entry.version === version
    && typeof entry.channel === 'string'
    && typeof entry.installed_at === 'string'
    && entry.last_writer_version === version;
}

/**
 * Folder-shared mutual exclusion, LEGACY-ONLY. The two legacy Copilot variants
 * (`copilot-cli` ↔ `copilot-vscode`) share `~/.copilot/` with incompatible
 * agent content — installing one overwrites the other's on-disk agent files,
 * so we evict the partner from the registry. Plugin partners are intentionally
 * absent from the mutex map: plugin registry entries are preserved across
 * legacy installs (see `detectPluginCoexistence`).
 *
 * Returns `{ removed: [{ key, entry }, …] }` (or `{}` if there's nothing to
 * evict). Mutates `harnesses` in place.
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
 * Plugin-partner coexistence detector. Returns the list of plugin partner
 * installKeys that share the on-disk harness folder with `installKey`. A
 * partner is reported when EITHER its registry entry is present, OR a plugin
 * directory exists on disk under the corresponding harness plugin root.
 *
 * Each entry carries its source so callers can tailor prompt text — registry
 * hits include the `entry` (with version, etc.); disk hits do not.
 *
 * Disk-fallback only fires when no registry partner was found, and reports
 * the same-UI canonical partner (cross-UI plugin is indistinguishable from
 * disk alone).
 *
 * Does NOT mutate.
 *
 * @param {Record<string, object>} harnesses
 * @param {string} installKey
 * @param {{ home?: string }} [opts]
 * @returns {Array<{ partner: string, source: 'registry' | 'disk', entry?: object }>}
 */
export function detectPluginCoexistence(harnesses, installKey, opts = {}) {
  const home = opts.home ?? os.homedir();
  const partners = PLUGIN_COEXIST_PARTNERS[installKey] ?? [];
  const found = [];
  for (const partner of partners) {
    if (harnesses[partner]) {
      found.push({ partner, source: 'registry', entry: harnesses[partner] });
    }
  }
  if (found.length > 0) return found;

  const diskHit =
    (installKey === 'claude' && probeClaudePluginOnDisk(home)) ||
    ((installKey === 'copilot-cli' || installKey === 'copilot-vscode') && probeCopilotPluginOnDisk(home));
  if (diskHit) {
    const canonical = partners[0];
    if (canonical) found.push({ partner: canonical, source: 'disk' });
  }
  return found;
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

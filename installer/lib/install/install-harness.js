// installer/lib/install/install-harness.js — Orchestrator for a single
// harness's install. State machine:
//
//   install.json absent                → fresh-install
//   install.json present, key absent   → fresh-install (preserves siblings)
//   present, version == delivering     → noop
//   present, prior < delivering        → upgrade-complete (remove prior, install new)
//   present, prior > delivering        → downgrade-refused (point at in-skill upgrade)
//
// Section 6: the install.json registry is keyed by install-key (one of
// 'claude' | 'copilot-cli' | 'copilot-vscode' for this legacy-installer
// channel — the plugin channel writes 'claude-plugin' via runPluginBootstrap).
// Read-modify-write preserves entries other than the install-key being touched.
//
// Deliberately leaner than runPluginBootstrap: no bootstrap lock, no sha256
// modified-file confirmation, no install log. Those belong to the in-skill
// `radorch upgrade` flow that runs from inside the installed system.

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import { loadBundledManifest } from './catalog.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';
import {
  readInstallJson,
  writeInstallJson,
  cmpSemver,
  isInstallJsonV6,
  migrateInstallJson,
  detectChannelHeuristic,
  resolveFolderConflict,
  detectChannelOverlap,
} from './install-json.js';
import { writeBaseFiles } from './base-files.js';

const LEGACY_CHANNEL = 'legacy-installer';

/** Derive the v6 install-key from the harness name. Legacy installer only —
 *  plugin channel ('claude-plugin') is owned by runPluginBootstrap. */
function deriveInstallKey(harness) {
  // The four valid install-keys are: claude, claude-plugin, copilot-cli,
  // copilot-vscode. The legacy installer writes claude/copilot-cli/copilot-vscode
  // (never claude-plugin).
  return harness;
}

function emitCrossChannelWarning(installKey, partner) {
  if (installKey === 'claude' && partner === 'claude-plugin') {
    process.stderr.write(
      'WARNING: A Claude Code plugin install of rad-orchestration is already registered (claude-plugin).\n' +
      'The plugin is the recommended install channel. The legacy installer\'s `claude` harness will\n' +
      'coexist with the plugin in ~/.claude/ — the most recent install\'s files will be on disk.\n' +
      '\n' +
      'To use only the plugin (recommended), cancel this install and remove the legacy install you\n' +
      'were about to create. To use only the legacy installer, first run `/plugin uninstall\n' +
      'rad-orchestration` inside Claude Code, then re-run this installer.\n' +
      '\n' +
      'Continuing legacy install of `claude` harness.\n',
    );
  }
}

function emitFolderMutexNotice(installKey, installingVersion, removed) {
  process.stderr.write(
    `[install] Replaced ${removed.key} (${removed.entry.version}) with ${installKey} (${installingVersion}) — both share ~/.copilot/, only one can be registered at a time.\n`,
  );
}

function buildEntry(version) {
  return {
    version,
    channel: LEGACY_CHANNEL,
    installed_at: new Date().toISOString(),
    last_writer_version: version,
  };
}

/** Load the v6 registry, lazily migrating v5 → v6 if needed. The install-key
 *  becomes the migration default when the v5 record represents this install. */
function loadRegistry(installJsonPath, installKey) {
  if (!fs.existsSync(installJsonPath)) {
    return { state_schema_version: 'v6', harnesses: {} };
  }
  const raw = readInstallJson(installJsonPath);
  if (isInstallJsonV6(raw)) return raw;
  const channel = detectChannelHeuristic();
  return migrateInstallJson(raw, installKey, channel);
}

/**
 * Performs the install/upgrade for one harness. The caller (installer/index.js)
 * loops over selected harnesses and calls this once each.
 *
 * @param {{ pluginRoot: string, sharedRoot?: string, harness: string }} opts
 * @returns {Promise<{ action: string, code: number, deliveringVersion: string, installedVersion?: string, message?: string }>}
 */
export async function installHarness(opts) {
  const paths = userDataPaths();
  const sharedRoot = opts.sharedRoot ?? opts.pluginRoot;
  const pkgPath = path.join(opts.pluginRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`installHarness: bundle package.json missing at ${pkgPath}`);
  }
  const pluginPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deliveringVersion = pluginPkg.version;
  const installKey = deriveInstallKey(opts.harness);
  const haveInstallJson = fs.existsSync(paths.installJson);

  // Fresh install — no prior install.json at all.
  if (!haveInstallJson) {
    return doFreshInstall({ paths, opts, sharedRoot, deliveringVersion, installKey });
  }

  const registry = loadRegistry(paths.installJson, installKey);
  const existingEntry = registry.harnesses[installKey];

  // Sentinel check — if the prior install's CLI sentinel is missing, treat as
  // fresh (the user may have wiped their harness root manually).
  const expectedSentinel = path.join(
    opts.pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
  );
  if (!existingEntry || !fs.existsSync(expectedSentinel)) {
    const installedVersion = existingEntry?.version;
    return doFreshInstall({ paths, opts, sharedRoot, deliveringVersion, installKey, installedVersion, existingRegistry: registry });
  }

  const installedVersion = existingEntry.version;
  const cmp = cmpSemver(deliveringVersion, installedVersion);

  if (cmp === 0) {
    return {
      action: 'noop',
      code: 0,
      deliveringVersion,
      installedVersion,
    };
  }

  if (cmp < 0) {
    return {
      action: 'downgrade-refused',
      code: 0,
      deliveringVersion,
      installedVersion,
      message:
        `Installed v${installedVersion} is newer than delivering v${deliveringVersion}; ` +
        `installer refuses to downgrade. To downgrade, run \`radorch uninstall\` from the ` +
        `installed skill and re-install.`,
    };
  }

  // Upgrade: clean prior manifest, install delivering manifest, update install.json.
  fs.mkdirSync(paths.projects, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });
  fs.mkdirSync(paths.runtime, { recursive: true });
  await writeBaseFilesAsync(paths.root, opts.harness);

  // Load prior manifest from the BUNDLE catalog (manifests/v<prior>.json must
  // be preserved in the bundle's catalog — see installer/.gitignore).
  let priorManifest;
  try {
    priorManifest = loadBundledManifest(opts.pluginRoot, installedVersion);
  } catch (err) {
    // Prior manifest missing — degrade gracefully to a clobber-style install.
    console.warn(
      `[install] Prior manifest for v${installedVersion} not in bundle catalog — ` +
      `proceeding with clobber-style upgrade. Orphan files from the previous ` +
      `install may remain. Run \`radorch doctor\` to check.\n` +
      `Original error: ${err.message}`,
    );
    priorManifest = null;
  }
  if (priorManifest) {
    removeManifestFiles(priorManifest, opts.harness);
  }

  const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);
  installManifestFiles(newManifest, opts.pluginRoot, opts.harness, { sharedRoot });

  // Folder mutex (copilot-cli ↔ copilot-vscode). Done after install of files
  // so that even on a partial failure mid-mutate, the prior partner's entry
  // stays in the registry until the new install actually completes.
  const mutexResult = resolveFolderConflict(registry.harnesses, installKey);
  if (mutexResult.removed) {
    emitFolderMutexNotice(installKey, deliveringVersion, mutexResult.removed);
  }
  // Cross-channel coexistence warning (claude ↔ claude-plugin).
  const overlap = detectChannelOverlap(registry.harnesses, installKey);
  if (overlap) {
    emitCrossChannelWarning(installKey, overlap);
  }
  // Preserve installed_at on upgrade; bump version + last_writer_version.
  registry.harnesses[installKey] = {
    version: deliveringVersion,
    channel: LEGACY_CHANNEL,
    installed_at: existingEntry.installed_at,
    last_writer_version: deliveringVersion,
  };
  writeInstallJson(paths.installJson, registry);

  return {
    action: 'upgrade-complete',
    code: 0,
    deliveringVersion,
    installedVersion,
  };
}

function doFreshInstall({ paths, opts, sharedRoot, deliveringVersion, installKey, installedVersion, existingRegistry }) {
  const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);

  fs.mkdirSync(paths.projects, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });
  fs.mkdirSync(paths.runtime, { recursive: true });

  installManifestFiles(newManifest, opts.pluginRoot, opts.harness, { sharedRoot });

  // Read-modify-write to preserve other harness entries when the registry
  // already exists. `existingRegistry` is passed in when the caller already
  // loaded it (sentinel-missing path); otherwise we load fresh.
  const registry = existingRegistry ?? loadRegistry(paths.installJson, installKey);

  // Folder mutex: remove partner copilot variant if registered.
  const mutexResult = resolveFolderConflict(registry.harnesses, installKey);
  if (mutexResult.removed) {
    emitFolderMutexNotice(installKey, deliveringVersion, mutexResult.removed);
  }
  // Cross-channel coexistence warning (claude ↔ claude-plugin).
  const overlap = detectChannelOverlap(registry.harnesses, installKey);
  if (overlap) {
    emitCrossChannelWarning(installKey, overlap);
  }
  registry.harnesses[installKey] = buildEntry(deliveringVersion);
  writeInstallJson(paths.installJson, registry);

  // base-files is sync-only.
  writeBaseFiles(paths.root, opts.harness);

  return {
    action: 'fresh-install',
    code: 0,
    deliveringVersion,
    installedVersion,
  };
}

// Tiny await-friendly wrapper so the orchestrator surface stays uniform with
// the CLI's async equivalents.
async function writeBaseFilesAsync(root, harness) {
  writeBaseFiles(root, harness);
}

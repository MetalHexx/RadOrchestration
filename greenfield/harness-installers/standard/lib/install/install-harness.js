// greenfield/harness-installers/standard/lib/install/install-harness.js —
// Top-level orchestrator for a single harness's install. Single-shape only
// (AD-1) — there is no v5 union or migration logic; the standard installer
// writes structurally from the first install.
//
// State machine (AD-11):
//   install.json absent OR entry missing OR sentinel missing → fresh-install
//   entry present, version == delivering, sentinel present   → noop
//   entry present, prior < delivering                        → upgrade-complete
//   entry present, prior > delivering                        → downgrade-refused (non-zero exit code)
//
// After any write action (fresh / upgrade / self-heal):
//   - Folder mutex (FR-11, AD-12): copilot-cli ↔ copilot-vscode share ~/.copilot/.
//     The partner is removed from the registry and a single-line notice is
//     emitted on stderr.
//   - Cross-channel coexistence (FR-13, AD-15): claude and claude-plugin can
//     coexist on disk, but a multi-line WARNING is emitted to encourage
//     consolidation. Text is verbatim from installer/lib/install/install-harness.js
//     lines 50–60.
//
// NFR-4 (best-effort): the mutex + cross-channel emit is wrapped in a single
// try/catch. If stderr write fails, the install still completes.

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import { harnessRoot } from './harness-paths.js';
import { loadBundledManifest } from './catalog.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';
import {
  writeInstallJson,
  loadRegistry,
  cmpSemver,
  resolveFolderConflict,
  detectChannelOverlap,
} from './install-json.js';

const LEGACY_CHANNEL = 'legacy-installer';

/**
 * Install or upgrade a single harness. The caller (P04's index.js) loops over
 * selected harnesses and invokes this once each; sibling harnesses are never
 * rolled back on a per-harness failure (AD-11).
 *
 * @param {{
 *   bundleRoot: string,
 *   sharedRoot?: string,
 *   harness: string,
 *   stderr?: { write(s: string): unknown },
 * }} opts
 * @returns {Promise<{
 *   action: 'fresh-install' | 'upgrade-complete' | 'noop' | 'downgrade-refused',
 *   code: number,
 *   deliveringVersion: string,
 *   installedVersion?: string,
 *   message?: string,
 * }>}
 */
export async function installHarness(opts) {
  const paths = userDataPaths();
  const sharedRoot = opts.sharedRoot ?? opts.bundleRoot;
  const stderr = opts.stderr ?? process.stderr;

  // 1. Resolve delivering version from bundle/package.json.
  const pkgPath = path.join(opts.bundleRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`installHarness: bundle package.json missing at ${pkgPath}`);
  }
  const bundlePkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deliveringVersion = bundlePkg.version;

  // 2. Load registry (single-shape; missing/malformed → empty harnesses object).
  const registry = loadRegistry(paths.installJson);

  // 3. Install-key equals the harness name for the standard installer (AD-10).
  const installKey = opts.harness;
  const existingEntry = registry.harnesses[installKey];

  // 4. Sentinel check — the CLI sentinel must be present in the harness root.
  const sentinelPath = path.join(
    harnessRoot(opts.harness),
    'skills/rad-orchestration/scripts/radorch.mjs',
  );
  const sentinelPresent = fs.existsSync(sentinelPath);

  // 5. Action decision (AD-11).
  if (!existingEntry) {
    return doFreshInstall({
      paths, opts, sharedRoot, deliveringVersion, installKey, registry, stderr,
    });
  }

  if (!sentinelPresent) {
    // NFR-11: sentinel-missing is a loud fresh-install — emit a notice but
    // return the action as 'fresh-install' (no special action name).
    safeWrite(stderr, '[install] sentinel missing — forcing fresh install\n');
    return doFreshInstall({
      paths, opts, sharedRoot, deliveringVersion, installKey, registry, stderr,
      installedVersion: existingEntry.version,
    });
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
    const message =
      `Installed v${installedVersion} of harness '${opts.harness}' is newer than ` +
      `delivering v${deliveringVersion}; refusing to downgrade.\n` +
      `To downgrade, uninstall first, then install the older tarball.\n`;
    safeWrite(stderr, message);
    return {
      action: 'downgrade-refused',
      code: 1,
      deliveringVersion,
      installedVersion,
      message,
    };
  }

  // 6. Upgrade path.
  return doUpgrade({
    paths, opts, sharedRoot, deliveringVersion, installedVersion,
    installKey, existingEntry, registry, stderr,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function doFreshInstall({
  paths, opts, sharedRoot, deliveringVersion, installKey, registry, stderr,
  installedVersion,
}) {
  // Ensure ~/.radorch/ skeleton exists.
  fs.mkdirSync(paths.root, { recursive: true });

  // Copy the delivering manifest's files.
  const newManifest = loadBundledManifest(opts.bundleRoot, opts.harness, deliveringVersion);
  installManifestFiles(newManifest, opts.bundleRoot, opts.harness, { sharedRoot });

  // Folder mutex + cross-channel emission, best-effort (NFR-4).
  emitPostInstallNotices({ registry, installKey, deliveringVersion, stderr });

  // Update registry entry. Preserve installed_at if it happens to exist
  // (defensive — fresh-install usually has no prior entry, but the
  // sentinel-self-heal branch lands here too).
  const priorInstalledAt = registry.harnesses[installKey]?.installed_at;
  registry.harnesses[installKey] = {
    version: deliveringVersion,
    channel: LEGACY_CHANNEL,
    installed_at: priorInstalledAt ?? new Date().toISOString(),
    last_writer_version: deliveringVersion,
  };
  writeInstallJson(paths.installJson, registry);

  return {
    action: 'fresh-install',
    code: 0,
    deliveringVersion,
    installedVersion,
  };
}

function doUpgrade({
  paths, opts, sharedRoot, deliveringVersion, installedVersion,
  installKey, existingEntry, registry, stderr,
}) {
  fs.mkdirSync(paths.root, { recursive: true });

  // Remove prior manifest, then install delivering. Prior manifest must be
  // bundled (AD-4) — let `loadBundledManifest` throw if absent.
  const priorManifest = loadBundledManifest(opts.bundleRoot, opts.harness, installedVersion);
  removeManifestFiles(priorManifest, opts.harness);

  const newManifest = loadBundledManifest(opts.bundleRoot, opts.harness, deliveringVersion);
  installManifestFiles(newManifest, opts.bundleRoot, opts.harness, { sharedRoot });

  emitPostInstallNotices({ registry, installKey, deliveringVersion, stderr });

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

/**
 * Folder mutex (FR-11, AD-12) + cross-channel coexistence (FR-13, AD-15)
 * emission, wrapped in a single try/catch so that stderr write failures do
 * not abort the install (NFR-4). Mutates `registry.harnesses` in place
 * (mutex partner removal) regardless of stderr success.
 */
function emitPostInstallNotices({ registry, installKey, deliveringVersion, stderr }) {
  try {
    const mutexResult = resolveFolderConflict(registry.harnesses, installKey);
    if (mutexResult.removed) {
      const { key, entry } = mutexResult.removed;
      stderr.write(
        `[install] Replaced ${key} (${entry.version}) with ${installKey} (${deliveringVersion}) — both share ~/.copilot/, only one can be registered at a time.\n`,
      );
    }
    const overlap = detectChannelOverlap(registry.harnesses, installKey);
    if (overlap) {
      emitCrossChannelWarning(installKey, overlap, stderr);
    }
  } catch {
    /* NFR-4: best-effort — swallow stderr failures and continue. */
  }
}

/**
 * Cross-channel coexistence WARNING. Text is verbatim from the legacy
 * installer's emitCrossChannelWarning at installer/lib/install/install-harness.js
 * lines 50–60.
 */
function emitCrossChannelWarning(installKey, partner, stderr) {
  if (installKey === 'claude' && partner === 'claude-plugin') {
    stderr.write(
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

/** Best-effort stderr write that swallows write failures (NFR-4). */
function safeWrite(stderr, text) {
  try {
    stderr.write(text);
  } catch {
    /* swallow */
  }
}

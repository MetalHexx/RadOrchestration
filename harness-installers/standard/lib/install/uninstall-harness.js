// harness-installers/standard/lib/install/uninstall-harness.js —
// Reverse of installHarness. Removes the per-harness on-disk files exactly
// as recorded by the manifest that shipped with the user's installed version,
// then drops the harnesses[<key>] entry from ~/.radorc/install.json. The
// install.json FILE itself is preserved (an empty { "harnesses": {} } is the
// residual shape when the last harness is uninstalled). ~/.radorc/ itself —
// orchestration.yml, templates/, projects/, logs/, ui/ — is never touched
// (user direction; see plan).
//
// Safety contract:
//   - Manifest-scoped: only files explicitly listed in the harness's manifest
//     are removed. Files the rad installer didn't create stay.
//   - Containment check: every resolved target path must start with
//     harnessRoot(harness). If a future manifest-shape bug ever produced an
//     absolute path outside that root, we throw instead of removing anything
//     unexpected.
//   - Empty parent directories under the harness root are pruned by
//     removeManifestFiles, but only if actually empty after removal.
//   - The harness root itself (~/.copilot/ or ~/.claude/) is never removed.

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import { harnessRoot } from './harness-paths.js';
import { loadBundledManifest } from './catalog.js';
import { removeManifestFiles } from './remove-files.js';
import { expandDestinationTokens } from './expand-tokens.js';
import { loadRegistry, writeInstallJson } from './install-json.js';

/**
 * @typedef {Object} UninstallResult
 * @property {'uninstalled' | 'not-installed'} action
 * @property {string} [removedVersion]
 * @property {number} [removedCount]
 * @property {number} [prunedDirs]
 */

/**
 * Uninstall a single harness.
 *
 * @param {{ bundleRoot: string, harness: string }} opts
 *   bundleRoot — the per-harness payload root inside the unpacked tarball
 *                (e.g. .../node_modules/rad-orchestration/output/copilot-vscode/).
 *                Used only to look up the bundled manifest for the version
 *                the user has installed; no files are read from it for
 *                removal.
 *   harness    — install-key of the harness to remove (claude | copilot-vscode
 *                | copilot-cli).
 * @returns {Promise<UninstallResult>}
 */
export async function uninstallHarness({ bundleRoot, harness }) {
  const paths = userDataPaths();
  const registry = loadRegistry(paths.installJson);
  const entry = registry.harnesses?.[harness];

  if (!entry) {
    return { action: 'not-installed' };
  }

  const installedVersion = entry.version;
  const manifest = loadBundledManifest(bundleRoot, harness, installedVersion);

  // Defensive containment: every resolved destination path must live under
  // the harness root. Throws if a future manifest-shape bug ever produced an
  // absolute path outside that scope; this never triggers under normal
  // operation but guards against catastrophic deletion if it ever did.
  const root = harnessRoot(harness);
  for (const file of manifest.files ?? []) {
    const resolved = expandDestinationTokens(file.destinationPath, harness);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error(
        `uninstall safety: manifest entry '${file.bundlePath}' resolves to '${resolved}', ` +
        `which is outside the harness root '${root}'. Refusing to proceed.`,
      );
    }
  }

  const { removedCount, prunedDirs } = removeManifestFiles(manifest, harness);

  // Drop the registry entry; keep the install.json file itself.
  delete registry.harnesses[harness];
  writeInstallJson(paths.installJson, registry);

  return {
    action: 'uninstalled',
    removedVersion: installedVersion,
    removedCount,
    prunedDirs: prunedDirs.length,
  };
}

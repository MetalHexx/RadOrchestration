// cli/src/lib/upgrade/catalog.ts — Read-only access to the plugin-bundled
// per-version manifest catalog at <pluginRoot>/manifests/.
//
// No metadata is ever written into the user's data paths (NFR-1). The CLI
// reads the version from the installed plugin and calls loadBundledManifest()
// to get the corresponding manifest from the catalog shipped inside the
// plugin payload itself (FR-9, AD-14).

import fs from 'node:fs';
import path from 'node:path';

export interface ManifestEntry {
  readonly bundlePath: string;
  /**
   * Templated absolute destination, e.g. "${HARNESS_ROOT}/skills/foo" or
   * "${RAD_HOME}/ui/server.js". Single source of truth for "where does this
   * file go on the user's machine." Owned by adapters/destination-routing.js
   * at build time; consumed by install/remove/hash-check via expandDestinationTokens.
   */
  readonly destinationPath: string;
  readonly sourcePath?: string;
  readonly ownership?: string;
  readonly version?: string;
  readonly harness?: string;
  readonly sha256?: string;
}

export interface BundledManifest {
  readonly harness: string;
  readonly version: string;
  readonly files: ManifestEntry[];
}

/**
 * Computes the absolute path to a per-version manifest in the plugin's
 * bundled catalog. Pure — no filesystem access.
 *
 * Reads from `<pluginRoot>/manifests/v<version>.json` — the plugin payload's
 * own catalog, NOT installer/src/<harness>/manifests/.
 *
 * @param pluginRoot - Absolute path to the installed plugin root
 * @param version - Package version string (e.g. "1.2.3")
 */
export function manifestPathForVersion(pluginRoot: string, version: string): string {
  return path.join(pluginRoot, 'manifests', `v${version}.json`);
}

/**
 * Reads and parses the per-version manifest from the plugin's bundled catalog.
 * Throws a structured Error when the version's manifest is not present.
 *
 * @param pluginRoot - Absolute path to the installed plugin root
 * @param version - Package version string
 */
export function loadBundledManifest(pluginRoot: string, version: string): BundledManifest {
  const p = manifestPathForVersion(pluginRoot, version);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Manifest for version '${version}' not found in bundled catalog at ${p}`,
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as BundledManifest;
}

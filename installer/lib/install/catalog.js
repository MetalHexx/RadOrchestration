// installer/lib/install/catalog.js — Read-only access to the bundled
// per-version manifest catalog at <pluginRoot>/manifests/. Independent JS
// port of cli/src/lib/upgrade/catalog.ts.

import fs from 'node:fs';
import path from 'node:path';

export function manifestPathForVersion(pluginRoot, version) {
  return path.join(pluginRoot, 'manifests', `v${version}.json`);
}

/**
 * Reads and parses the per-version manifest from the bundle's catalog.
 * Throws a structured error if the version's manifest is not present.
 */
export function loadBundledManifest(pluginRoot, version) {
  const p = manifestPathForVersion(pluginRoot, version);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Manifest for version '${version}' not found in bundled catalog at ${p}`,
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

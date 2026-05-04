// installer/lib/catalog.js — Read-only access to the npm-package-bundled
// per-version manifest catalog at installer/src/<harness>/manifests/.
//
// No metadata is ever written into the user's orchRoot (NFR-1). The
// installer reads `package_version` from the user's orchestration.yml and
// calls loadBundledManifest() to get the corresponding manifest from the
// catalog shipped inside the npm package itself (AD-1, AD-6).

import fs from 'node:fs';
import path from 'node:path';

/** Mirror of installer/lib/manifest.js HARNESS_BUNDLE_DIR. */
const HARNESS_BUNDLE_DIR = {
  'claude-code': 'claude',
  'copilot-vscode': 'copilot-vscode',
  'copilot-cli': 'copilot-cli',
};

/**
 * Computes the absolute path to a per-version manifest in the bundled
 * catalog. Pure — no filesystem access.
 * @param {string} installerRoot - Absolute path to the installer package root
 * @param {'claude-code'|'copilot-vscode'|'copilot-cli'} tool
 * @param {string} packageVersion - Value from orchestration.yml package_version
 * @returns {string}
 */
export function manifestPathForHarnessAndVersion(installerRoot, tool, packageVersion) {
  const bundleDir = HARNESS_BUNDLE_DIR[tool];
  if (!bundleDir) {
    throw new Error(`unknown harness tool '${tool}'`);
  }
  return path.join(installerRoot, 'src', bundleDir, 'manifests', `v${packageVersion}.json`);
}

/**
 * Reads + parses the per-version manifest from the bundled catalog.
 * Throws a structured Error when the version's manifest is not present.
 * @param {string} installerRoot - Absolute path to the installer package root
 * @param {'claude-code'|'copilot-vscode'|'copilot-cli'} tool
 * @param {string} packageVersion
 * @returns {{ harness: string, version: string, files: Array<{ bundlePath: string, sourcePath: string, ownership: string, version: string, harness: string, sha256: string }> }}
 */
export function loadBundledManifest(installerRoot, tool, packageVersion) {
  const p = manifestPathForHarnessAndVersion(installerRoot, tool, packageVersion);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Manifest for version '${packageVersion}' (harness '${tool}') not found in bundled catalog at ${p}`,
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

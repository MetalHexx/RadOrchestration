// installer/lib/install/install-harness.js — Orchestrator for a single
// harness's install. State machine:
//
//   install.json absent                → fresh-install
//   present, version == delivering     → noop
//   present, prior < delivering        → upgrade-complete (remove prior, install new)
//   present, prior > delivering        → downgrade-refused (point at in-skill upgrade)
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
import { readInstallJson, writeInstallJson, cmpSemver } from './install-json.js';
import { writeBaseFiles } from './base-files.js';

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
  const haveInstallJson = fs.existsSync(paths.installJson);

  // Fresh install — no prior install.json.
  if (!haveInstallJson) {
    return doFreshInstall({ paths, opts, sharedRoot, deliveringVersion });
  }

  const ij = readInstallJson(paths.installJson);
  const installedVersion = ij.package_version;

  // Sentinel check — if the prior install's CLI sentinel is missing, treat as
  // fresh (the user may have wiped their harness root manually).
  const expectedSentinel = path.join(
    opts.pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
  );
  if (!fs.existsSync(expectedSentinel)) {
    return doFreshInstall({ paths, opts, sharedRoot, deliveringVersion, installedVersion });
  }

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
    // The user installed an old version whose manifest isn't shipped in the
    // current bundle's catalog. Log it, then proceed with the delivering
    // manifest only (orphan files from the old version may remain).
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

  writeInstallJson(paths.installJson, {
    ...ij,
    package_version: deliveringVersion,
    last_writer_version: deliveringVersion,
  });

  return {
    action: 'upgrade-complete',
    code: 0,
    deliveringVersion,
    installedVersion,
  };
}

async function doFreshInstall({ paths, opts, sharedRoot, deliveringVersion, installedVersion }) {
  const newManifest = loadBundledManifest(opts.pluginRoot, deliveringVersion);

  fs.mkdirSync(paths.projects, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });
  fs.mkdirSync(paths.runtime, { recursive: true });

  installManifestFiles(newManifest, opts.pluginRoot, opts.harness, { sharedRoot });

  writeInstallJson(paths.installJson, {
    package_version: deliveringVersion,
    installed_at: new Date().toISOString(),
    last_writer_version: deliveringVersion,
    state_schema_version: 'v5',
  });

  await writeBaseFilesAsync(paths.root, opts.harness);

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

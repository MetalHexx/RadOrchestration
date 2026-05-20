import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import {
  loadRegistry, writeInstallJson, buildClaudePluginEntry,
} from './install-json.js';
import { loadManifest } from './catalog.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';
import { appendInstallLog } from './install-log.js';

const INSTALL_KEY = 'claude-plugin';

function cmpSemver(a, b) {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i]; const y = pb[i];
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') { if (x !== y) return x < y ? -1 : 1; }
    else if (typeof x === 'number') return 1;
    else if (typeof y === 'number') return -1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function emitCoexistenceWarning(stderr, partner) {
  stderr(
    `WARNING: A ${partner} install of rad-orchestration is already registered alongside claude-plugin.\n` +
    `Both keys coexist in ~/.radorch/install.json so neither install clobbers the other's metadata,\n` +
    `but the plugin install is now the recommended channel. Consider removing the ${partner} install once\n` +
    `the plugin is verified working.\n`,
  );
}

/** @param {{ pluginRoot: string, radHome?: string, force?: boolean, stderr?: (msg:string)=>void }} opts */
export async function runInstall(opts) {
  const stderr = opts.stderr ?? ((msg) => process.stderr.write(msg));
  const paths = userDataPaths({ radHome: opts.radHome });
  // Pre-flight I/O (package.json read, install.json read+migrate) now runs
  // inside the same try as the destructive install steps so any failure
  // appends a single 'error' log entry. Values are captured into `let`
  // bindings so the catch can log whatever was discovered before the throw.
  let deliveringVersion = null;
  let installedVersionBefore = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(opts.pluginRoot, 'package.json'), 'utf8'));
    deliveringVersion = pkg.version;
    const sentinel = path.join(opts.pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs');

    fs.mkdirSync(paths.projects, { recursive: true });
    fs.mkdirSync(paths.logs, { recursive: true });

    const ij = loadRegistry(paths.installJson);
    const prior = ij.harnesses[INSTALL_KEY];
    installedVersionBefore = prior?.version ?? null;
    const sentinelPresent = fs.existsSync(sentinel);

    // Coexistence warning when the other channel is also registered.
    if (ij.harnesses.claude) emitCoexistenceWarning(stderr, 'legacy (claude) installer');

    // Same-version fast path with sentinel self-heal.
    if (prior && installedVersionBefore === deliveringVersion && sentinelPresent && !opts.force) {
      appendInstallLog(paths.installLog, { action: 'noop', deliveringVersion, installedVersionBefore });
      return { action: 'noop', deliveringVersion, installedVersionBefore };
    }

    // Downgrade-noop.
    if (prior && cmpSemver(deliveringVersion, installedVersionBefore) < 0 && !opts.force) {
      stderr(`[install] Delivering v${deliveringVersion} is older than installed v${installedVersionBefore}; downgrade accepted as no-op.\n`);
      appendInstallLog(paths.installLog, { action: 'downgrade-noop', deliveringVersion, installedVersionBefore });
      return { action: 'downgrade-noop', deliveringVersion, installedVersionBefore };
    }

    // Upgrade or fresh install — remove prior manifest entries (skip user-config), install new.
    if (prior && installedVersionBefore !== deliveringVersion) {
      try {
        const priorManifest = loadManifest(opts.pluginRoot, installedVersionBefore);
        removeManifestFiles(priorManifest, { radHome: opts.radHome });
      } catch { /* prior manifest may be unavailable — clobber install acceptable */ }
    }
    const manifest = loadManifest(opts.pluginRoot, deliveringVersion);
    installManifestFiles(manifest, opts.pluginRoot, { radHome: opts.radHome });

    const pluginUiDir = path.join(opts.pluginRoot, 'ui');
    if (fs.existsSync(pluginUiDir)) {
      // Wipe prior UI payload first — cpSync overwrites but won't remove
      // files that existed in the old payload and were dropped from the new.
      fs.rmSync(paths.ui, { recursive: true, force: true });
      fs.cpSync(pluginUiDir, paths.ui, { recursive: true });
    }

    ij.harnesses[INSTALL_KEY] = buildClaudePluginEntry(deliveringVersion);
    writeInstallJson(paths.installJson, ij);

    // Sentinel-missing is a self-heal: treat as fresh-install regardless of
    // prior version record so callers know a full re-hydration occurred.
    const action = (installedVersionBefore && sentinelPresent) ? 'upgrade-complete' : 'fresh-install';
    appendInstallLog(paths.installLog, { action, deliveringVersion, installedVersionBefore });
    return { action, deliveringVersion, installedVersionBefore };
  } catch (err) {
    appendInstallLog(paths.installLog, { action: 'error', deliveringVersion, installedVersionBefore });
    throw err;
  }
}

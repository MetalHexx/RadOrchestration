import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { userDataPaths } from './user-data-paths.js';
import {
  loadRegistry, writeInstallJson, buildCopilotCliPluginEntry,
} from './install-json.js';
import { loadManifest } from './catalog.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';
import { appendInstallLog } from './install-log.js';

const INSTALL_KEY = 'copilot-cli-plugin';
const COEXISTENCE_PARTNERS = ['copilot-cli', 'copilot-vscode'];

function cmpSemver(a, b) {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i]; const y = pb[i];
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') { if (x !== y) return x < y ? -1 : 1; }
    // SemVer §11.4.3: numeric identifiers always have lower precedence than non-numeric ones.
    else if (typeof x === 'number') return -1;
    else if (typeof y === 'number') return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function readDeliveringVersion(pluginRoot) {
  const pluginJsonPath = path.join(pluginRoot, 'plugin.json');
  if (fs.existsSync(pluginJsonPath)) {
    const pj = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    if (pj.version) return pj.version;
  }
  const pkgJsonPath = path.join(pluginRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  return pkg.version;
}

function emitCoexistenceWarning(stderr, partnersPresent) {
  const partnerList = partnersPresent.join(' and ');
  stderr(
    `WARNING: A standard-installer ${partnerList} install of rad-orchestration is already registered\n` +
    `alongside copilot-cli-plugin. All keys coexist in ~/.radorch/install.json so neither install\n` +
    `clobbers the other's metadata, but the standard-installer's user-level files at ~/.copilot/\n` +
    `will shadow plugin-shipped agents and skills per Copilot CLI's documented load order.\n` +
    `Consider removing the standard-installer (${partnerList}) install if the plugin is the canonical channel.\n`,
  );
}

/** @param {{ pluginRoot: string, radHome?: string, force?: boolean, stderr?: (msg:string)=>void }} opts */
export async function runInstall(opts) {
  const stderr = opts.stderr ?? ((msg) => process.stderr.write(msg));
  const paths = userDataPaths({ radHome: opts.radHome });
  let deliveringVersion = null;
  let installedVersionBefore = null;
  try {
    deliveringVersion = readDeliveringVersion(opts.pluginRoot);
    const sentinel = path.join(opts.pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs');

    fs.mkdirSync(paths.projects, { recursive: true });
    fs.mkdirSync(paths.logs, { recursive: true });

    const ij = loadRegistry(paths.installJson);
    const prior = ij.harnesses[INSTALL_KEY];
    installedVersionBefore = prior?.version ?? null;
    const sentinelPresent = fs.existsSync(sentinel);

    // FR-19 bidirectional coexistence: name every partner present.
    const partnersPresent = COEXISTENCE_PARTNERS.filter((k) => ij.harnesses[k]);
    if (partnersPresent.length > 0) emitCoexistenceWarning(stderr, partnersPresent);

    // Same-version fast path with sentinel self-heal.
    if (prior && installedVersionBefore === deliveringVersion && sentinelPresent && !opts.force) {
      appendInstallLog(paths.installLog, { action: 'noop', deliveringVersion, installedVersionBefore });
      return { action: 'noop', deliveringVersion, installedVersionBefore };
    }

    // Downgrade-noop (FR-21).
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

    // UI ships as a gzipped tarball (ui.tgz) so node_modules/ and .next/
    // survive the satellite `.gitignore` and `npm pack`'s hardcoded
    // node_modules strip. Extract it wholesale into ~/.radorch/ui/.
    const pluginUiTarball = path.join(opts.pluginRoot, '_install-source/ui.tgz');
    if (fs.existsSync(pluginUiTarball)) {
      fs.rmSync(paths.ui, { recursive: true, force: true });
      fs.mkdirSync(paths.ui, { recursive: true });
      await tar.x({ file: pluginUiTarball, cwd: paths.ui });
    }

    ij.harnesses[INSTALL_KEY] = buildCopilotCliPluginEntry(deliveringVersion);
    writeInstallJson(paths.installJson, ij);

    const action = (installedVersionBefore && sentinelPresent) ? 'upgrade-complete' : 'fresh-install';
    appendInstallLog(paths.installLog, { action, deliveringVersion, installedVersionBefore });
    return { action, deliveringVersion, installedVersionBefore };
  } catch (err) {
    appendInstallLog(paths.installLog, { action: 'error', deliveringVersion, installedVersionBefore });
    throw err;
  } finally {
    // Unconditional shadow-cleanup. Runs on every exit path (noop,
    // downgrade-noop, fresh-install, upgrade-complete, error) so the plugin
    // install root never carries a copy of ~/.radorch/ state. Sweeps both
    // the current-format staging dir (_install-source/) and the legacy
    // top-level shadows (templates/, orchestration.yml, ui/) left by
    // pre-relocation payloads on existing installs.
    try {
      fs.rmSync(path.join(opts.pluginRoot, '_install-source'), { recursive: true, force: true });
      fs.rmSync(path.join(opts.pluginRoot, 'templates'), { recursive: true, force: true });
      fs.rmSync(path.join(opts.pluginRoot, 'orchestration.yml'), { force: true });
      fs.rmSync(path.join(opts.pluginRoot, 'ui'), { recursive: true, force: true });
    } catch { /* best-effort cleanup — do not mask the primary outcome */ }
  }
}

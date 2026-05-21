import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import {
  loadRegistry, writeInstallJson, buildCopilotVscodePluginEntry,
} from './install-json.js';
import { loadManifest } from './catalog.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';
import { appendInstallLog } from './install-log.js';

const INSTALL_KEY = 'copilot-vscode-plugin';
const COEXISTENCE_PARTNERS = ['copilot-vscode', 'copilot-cli', 'copilot-cli-plugin'];

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
  const partnerList = partnersPresent.join(', ');
  const cliPluginPresent = partnersPresent.includes('copilot-cli-plugin');
  const extra = cliPluginPresent
    ? `\nNote: the copilot-cli-plugin partner is auto-discovered by VS Code via one-way cross-discovery\n` +
      `from ~/.copilot/installed-plugins/. Its agent files carry CLI-shape model identifiers that\n` +
      `VS Code's model resolver does not recognize. Load-order ambiguity means either plugin's agent\n` +
      `files may win at runtime; uninstalling the CLI plugin resolves the precedence.\n`
    : '';
  stderr(
    `WARNING: rad-orchestration is already registered under ${partnerList} alongside copilot-vscode-plugin.\n` +
    `All install-keys coexist in ~/.radorch/install.json so neither install clobbers the other's metadata,\n` +
    `but the standard-installer's ~/.copilot/ writes can shadow plugin-shipped agents and skills per\n` +
    `VS Code's documented load order. The copilot-vscode-plugin ships correctly-shaped model identifiers\n` +
    `for VS Code's resolver and is the recommended canonical channel for VS-Code-heavy users.\n${extra}`,
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

    // Three-partner bidirectional coexistence: name every partner present.
    const partnersPresent = COEXISTENCE_PARTNERS.filter((k) => ij.harnesses[k]);
    if (partnersPresent.length > 0) emitCoexistenceWarning(stderr, partnersPresent);

    // Same-version fast path with sentinel self-heal (FR-15).
    if (prior && installedVersionBefore === deliveringVersion && sentinelPresent && !opts.force) {
      appendInstallLog(paths.installLog, { action: 'noop', deliveringVersion, installedVersionBefore });
      return { action: 'noop', deliveringVersion, installedVersionBefore };
    }

    // Downgrade-noop (FR-23).
    if (prior && cmpSemver(deliveringVersion, installedVersionBefore) < 0 && !opts.force) {
      stderr(`[install] Delivering v${deliveringVersion} is older than installed v${installedVersionBefore}; downgrade accepted as no-op.\n`);
      appendInstallLog(paths.installLog, { action: 'downgrade-noop', deliveringVersion, installedVersionBefore });
      return { action: 'downgrade-noop', deliveringVersion, installedVersionBefore };
    }

    // Upgrade or fresh install — remove prior manifest entries (skip user-config), install new (FR-16).
    if (prior && installedVersionBefore !== deliveringVersion) {
      try {
        const priorManifest = loadManifest(opts.pluginRoot, installedVersionBefore);
        removeManifestFiles(priorManifest, { radHome: opts.radHome });
      } catch { /* prior manifest may be unavailable — clobber install acceptable */ }
    }
    const manifest = loadManifest(opts.pluginRoot, deliveringVersion);
    installManifestFiles(manifest, opts.pluginRoot, { radHome: opts.radHome });

    // UI hydration: full directory wipe-and-copy from the plugin payload root.
    const pluginUiDir = path.join(opts.pluginRoot, 'ui');
    if (fs.existsSync(pluginUiDir)) {
      fs.rmSync(paths.ui, { recursive: true, force: true });
      fs.cpSync(pluginUiDir, paths.ui, { recursive: true });
    }

    ij.harnesses[INSTALL_KEY] = buildCopilotVscodePluginEntry(deliveringVersion);
    writeInstallJson(paths.installJson, ij);

    const action = (installedVersionBefore && sentinelPresent) ? 'upgrade-complete' : 'fresh-install';
    appendInstallLog(paths.installLog, { action, deliveringVersion, installedVersionBefore });
    return { action, deliveringVersion, installedVersionBefore };
  } catch (err) {
    appendInstallLog(paths.installLog, { action: 'error', deliveringVersion, installedVersionBefore });
    throw err;
  }
}

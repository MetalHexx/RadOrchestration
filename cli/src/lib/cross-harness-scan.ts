import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InstallChannel, InstallKey, InstallJson, InstallEntry } from './config.js';
import { INSTALL_KEYS } from './install-json.js';

/**
 * Copilot CLI plugin-install segments. `COPILOT_CLI_PLUGIN_MARKETPLACE` is
 * the kebab-case form Copilot CLI derives from the `OWNER/REPO` slug the
 * plugin was added from. `COPILOT_CLI_PLUGIN_MARKETPLACES` is the probe
 * list — a single marketplace today, probed as a list because the
 * detection helper below supports more than one.
 */
export const COPILOT_CLI_PLUGIN_MARKETPLACE = 'MetalHexx-RadOrchestration';
export const COPILOT_CLI_PLUGIN_MARKETPLACES: readonly string[] = [
  COPILOT_CLI_PLUGIN_MARKETPLACE,
];
export const COPILOT_CLI_PLUGIN_NAME = 'rad-orc';

/**
 * Probes `~/.copilot/installed-plugins/<marketplace>/<plugin>/` for Copilot CLI
 * plugin presence. Unlike the Claude side (which can also gate on
 * `CLAUDE_PLUGIN_ROOT`), the Copilot CLI side has no plugin-root env var, so
 * path-inspection is the sole detection signal.
 *
 * With no `marketplace` override, every candidate in
 * `COPILOT_CLI_PLUGIN_MARKETPLACES` is probed and the first hit wins.
 * Passing an explicit `marketplace` narrows the probe to exactly that one
 * location.
 */
export function detectCopilotCliPlugin(opts?: {
  home?: string;
  marketplace?: string;
  pluginName?: string;
}): boolean {
  const home = opts?.home ?? os.homedir();
  const pluginName = opts?.pluginName ?? COPILOT_CLI_PLUGIN_NAME;
  const marketplaces = opts?.marketplace != null ? [opts.marketplace] : COPILOT_CLI_PLUGIN_MARKETPLACES;
  for (const marketplace of marketplaces) {
    const pluginDir = path.join(home, '.copilot', 'installed-plugins', marketplace, pluginName);
    try {
      if (fs.existsSync(pluginDir)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * VS Code Copilot plugin `<org>/<repo>` segments. `COPILOT_VSCODE_PLUGIN_SOURCES`
 * is the probe list — a single `{ org, repo }` source today, probed as a
 * list because the detection helper below supports more than one.
 */
export const COPILOT_VSCODE_PLUGIN_ORG = 'MetalHexx';
export const COPILOT_VSCODE_PLUGIN_REPO = 'RadOrchestration';
export const COPILOT_VSCODE_PLUGIN_SOURCES: readonly { org: string; repo: string }[] = [
  { org: COPILOT_VSCODE_PLUGIN_ORG, repo: COPILOT_VSCODE_PLUGIN_REPO },
];

/**
 * Probes the OS-specific `agentPlugins/github.com/<org>/<repo>/` install
 * paths for VS Code Copilot plugin presence. macOS / Linux / Windows each
 * have their own `Code/` user-data root; the probe builds the platform-
 * matched root once and returns true on the first `<org>/<repo>` candidate
 * that exists.
 *
 * With no `org` / `repo` override, every source in
 * `COPILOT_VSCODE_PLUGIN_SOURCES` is probed under that root. Passing an
 * explicit `org` and/or `repo` narrows the probe to exactly that one pair —
 * tests use this to swap in fake segments. The actual derivation rule VS
 * Code uses in production may differ from this convention; that gap is a
 * known watch-item.
 */
export function detectCopilotVscodePlugin(opts?: {
  home?: string;
  org?: string;
  repo?: string;
}): boolean {
  const home = opts?.home ?? os.homedir();
  let userDataRoot: string;
  if (process.platform === 'darwin') {
    userDataRoot = path.join(home, 'Library', 'Application Support', 'Code');
  } else if (process.platform === 'linux') {
    userDataRoot = path.join(home, '.config', 'Code');
  } else {
    // Windows: %APPDATA% defaults to ~/AppData/Roaming when not explicitly set.
    const appData = opts?.home != null ? path.join(home, 'AppData', 'Roaming') : (process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'));
    userDataRoot = path.join(appData, 'Code');
  }

  const sources = opts?.org != null || opts?.repo != null
    ? [{ org: opts?.org ?? COPILOT_VSCODE_PLUGIN_ORG, repo: opts?.repo ?? COPILOT_VSCODE_PLUGIN_REPO }]
    : COPILOT_VSCODE_PLUGIN_SOURCES;

  for (const { org, repo } of sources) {
    const candidate = path.join(userDataRoot, 'agentPlugins', 'github.com', org, repo);
    try {
      if (fs.existsSync(candidate)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * doctor reads ~/.radorc/install.json directly and emits one row per
 * install-key in the registry.
 */
export interface HarnessInstallReport {
  installKey: InstallKey;
  installed: boolean;
  packageVersion?: string;
  channel?: InstallChannel;
}

export function scanUserLevelHarnesses(): HarnessInstallReport[] {
  const home = os.homedir();
  const installJson = path.join(home, '.radorc', 'install.json');
  const reports: HarnessInstallReport[] = [];

  let registry: InstallJson | undefined;
  if (fs.existsSync(installJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(installJson, 'utf8')) as Record<string, unknown>;
      if (typeof parsed.harnesses === 'object' && parsed.harnesses !== null) {
        registry = { harnesses: parsed.harnesses as InstallJson['harnesses'] };
      } else {
        registry = { harnesses: {} };
      }
    } catch {
      // Unreadable / malformed — treat as no registry. Every key emits
      // not-installed below.
      registry = undefined;
    }
  }

  for (const key of INSTALL_KEYS) {
    const entry: InstallEntry | undefined = registry?.harnesses[key];
    if (!entry) {
      reports.push({ installKey: key, installed: false });
      continue;
    }
    reports.push({
      installKey: key,
      installed: true,
      packageVersion: entry.version,
      channel: entry.channel,
    });
  }
  return reports;
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InstallChannel, InstallKey, InstallJson, InstallEntry } from './config.js';
import { INSTALL_KEYS } from './install-json.js';

/**
 * Default Copilot CLI plugin-install segments derived from the conventional
 * kebab-case form Copilot CLI produces from the `OWNER/REPO` slug.
 */
export const COPILOT_CLI_PLUGIN_MARKETPLACE = 'MetalHexx-RadOrchestration';
export const COPILOT_CLI_PLUGIN_NAME = 'rad-orc';

/**
 * Probes `~/.copilot/installed-plugins/<marketplace>/<plugin>/` for Copilot CLI
 * plugin presence. Unlike the Claude side (which can also gate on
 * `CLAUDE_PLUGIN_ROOT`), the Copilot CLI side has no plugin-root env var, so
 * path-inspection is the sole detection signal.
 */
export function detectCopilotCliPlugin(opts?: {
  home?: string;
  marketplace?: string;
  pluginName?: string;
}): boolean {
  const home = opts?.home ?? os.homedir();
  const marketplace = opts?.marketplace ?? COPILOT_CLI_PLUGIN_MARKETPLACE;
  const pluginName = opts?.pluginName ?? COPILOT_CLI_PLUGIN_NAME;
  const pluginDir = path.join(home, '.copilot', 'installed-plugins', marketplace, pluginName);
  try {
    return fs.existsSync(pluginDir);
  } catch {
    return false;
  }
}

/**
 * doctor reads ~/.radorch/install.json directly and emits one row per
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
  const installJson = path.join(home, '.radorch', 'install.json');
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

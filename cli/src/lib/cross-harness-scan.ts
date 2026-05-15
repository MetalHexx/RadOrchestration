import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InstallChannel, InstallKey, InstallJson, InstallJsonV5, InstallJsonV6, InstallEntry } from './config.js';
import { INSTALL_KEYS, isInstallJsonV6, migrateInstallJson, detectChannelHeuristic, resolveActiveHarnessKey } from './install-json.js';

/**
 * Section 6: doctor reads ~/.radorch/install.json directly and emits one row per
 * install-key in the v6 registry. v5-shape install.json is migrated in memory
 * via the channel and active-harness heuristics so old installs render through
 * the same table.
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

  let registry: InstallJsonV6 | undefined;
  if (fs.existsSync(installJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(installJson, 'utf8')) as InstallJson;
      if (isInstallJsonV6(parsed)) {
        registry = parsed;
      } else {
        // v5 → v6 in memory only (we do not write back here — read path).
        const v5 = parsed as InstallJsonV5;
        const activeKey = resolveActiveHarnessKey({ home }) ?? 'claude';
        const channel = detectChannelHeuristic({ home });
        registry = migrateInstallJson(v5, activeKey, channel);
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

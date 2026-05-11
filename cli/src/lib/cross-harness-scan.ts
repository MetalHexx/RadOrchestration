import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HarnessName } from './upgrade/harness-paths.js';

export interface HarnessInstallReport {
  harness: HarnessName;
  installed: boolean;
  packageVersion?: string;
}

const HARNESS_TO_FOLDER: Record<HarnessName, string> = {
  'claude': '.claude',
  'copilot-vscode': '.copilot',
  'copilot-cli': '.copilot',
};

export function scanUserLevelHarnesses(): HarnessInstallReport[] {
  const out: HarnessInstallReport[] = [];
  for (const harness of ['claude', 'copilot-vscode', 'copilot-cli'] as HarnessName[]) {
    const folder = path.join(os.homedir(), HARNESS_TO_FOLDER[harness]);
    const installJson = path.join(folder, 'install.json');
    if (!fs.existsSync(installJson)) {
      out.push({ harness, installed: false });
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(installJson, 'utf8'));
      out.push({ harness, installed: true, packageVersion: parsed.package_version });
    } catch {
      out.push({ harness, installed: false });
    }
  }
  return out;
}

import os from 'node:os';
import path from 'node:path';

export type HarnessName = 'claude' | 'copilot-vscode' | 'copilot-cli';

const HARNESS_FOLDER: Record<HarnessName, string> = {
  'claude': '.claude',
  'copilot-vscode': '.copilot',
  'copilot-cli': '.copilot',
};

export function harnessRoot(harness: HarnessName): string {
  const folder = HARNESS_FOLDER[harness];
  if (!folder) throw new Error(`unknown harness '${harness}'`);
  return path.join(os.homedir(), folder);
}

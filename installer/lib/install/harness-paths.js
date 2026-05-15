// installer/lib/install/harness-paths.js — Maps a harness name to its
// home-relative install root. Independent JS port of
// cli/src/lib/upgrade/harness-paths.ts.

import os from 'node:os';
import path from 'node:path';

const HARNESS_FOLDER = {
  'claude': '.claude',
  'copilot-vscode': '.copilot',
  'copilot-cli': '.copilot',
};

export function harnessRoot(harness) {
  const folder = HARNESS_FOLDER[harness];
  if (!folder) throw new Error(`unknown harness '${harness}'`);
  return path.join(os.homedir(), folder);
}

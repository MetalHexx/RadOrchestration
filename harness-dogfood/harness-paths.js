// harness-dogfood/harness-paths.js — Maps a harness name to its home-relative
// install root for the dogfood build. Decoupled from installer/lib/install/
// per AD-2 — kept minimal: only the three day-one adapters need to resolve.

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

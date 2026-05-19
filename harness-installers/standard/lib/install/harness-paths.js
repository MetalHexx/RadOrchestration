// harness-installers/standard/lib/install/harness-paths.js —
// Maps a harness install-key to its home-relative install root.
// `claude` → ~/.claude; both copilot variants → ~/.copilot.
// Lifted verbatim from installer/lib/install/harness-paths.js (lines 8–18).

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

// greenfield/harness-installers/standard/lib/install/remove-files.js —
// Removes manifest entries from their resolved destinations. Directories are
// intentionally left in place even when they become empty: per user direction,
// removing files is acceptable but pruning installer-created directories
// feels too sweeping and risks any user-adjacent state we don't anticipate.
// projects/ entries are skipped unconditionally (idempotent symmetry with
// install-files.js).

import fs from 'node:fs';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string, sha256?: string }> }} manifest
 * @param {string} harness
 * @returns {{ removedCount: number }}
 */
export function removeManifestFiles(manifest, harness) {
  const projectsRoot = userDataPaths().projects;
  let removedCount = 0;

  for (const entry of manifest.files) {
    const abs = expandDestinationTokens(entry.destinationPath, harness);

    if (abs.startsWith(projectsRoot)) {
      console.warn(`[remove] skipping projects/ entry '${entry.bundlePath}'`);
      continue;
    }

    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { force: true });
      removedCount++;
    }
  }

  return { removedCount };
}

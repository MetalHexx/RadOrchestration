// harness-installers/standard/lib/install/remove-files.js —
// Removes manifest entries from their resolved destinations and prunes any
// ancestor directories that end up empty (contents-aware): an ancestor that
// still contains a user-authored file — anything not in the manifest — is
// preserved. The harness root itself is never pruned. projects/ entries are
// skipped unconditionally (idempotent symmetry with install-files.js).

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { harnessRoot } from './harness-paths.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string, sha256?: string }> }} manifest
 * @param {string} harness
 * @returns {{ removedCount: number, prunedDirs: string[] }}
 */
export function removeManifestFiles(manifest, harness) {
  const projectsRoot = userDataPaths().projects;
  const root = harnessRoot(harness);
  let removedCount = 0;
  const dirsTouched = new Set();

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

    // Walk every ancestor up to (but not including) the harness root.
    let parent = path.dirname(abs);
    while (parent.startsWith(root) && parent !== root) {
      dirsTouched.add(parent);
      const next = path.dirname(parent);
      if (next === parent) break;
      parent = next;
    }
  }

  // Innermost dirs first. Each is removed only when its readdir returns
  // empty — any user-authored file inside (or any unrelated content) keeps
  // the ancestor (and everything above it) alive.
  const pruned = [];
  const sorted = [...dirsTouched].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    if (!fs.existsSync(dir)) continue;
    try {
      const children = fs.readdirSync(dir);
      if (children.length === 0) {
        fs.rmdirSync(dir);
        pruned.push(dir);
      }
    } catch {
      /* race or permission — leave it */
    }
  }

  return { removedCount, prunedDirs: pruned };
}

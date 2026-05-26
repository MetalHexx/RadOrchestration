// harness-dogfood/remove-files.js — Minimal manifest-driven remove library
// used by the dogfood build only. Decoupled from installer/lib/install/ per
// AD-2. Removes manifest entries from their resolved destinations and prunes
// emptied parent directories, never crossing above ~/.radorc/ or the harness
// root. The AD-7 `projects/` skip remains.

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string }> }} manifest
 * @param {string} harness
 * @returns {{ removedCount: number, prunedDirs: string[] }}
 */
export function removeManifestFiles(manifest, harness) {
  const projectsRoot = userDataPaths().projects;
  const radOrchRoot = userDataPaths().root;
  let removedCount = 0;
  const dirsTouched = new Set();

  for (const entry of manifest.files) {
    const abs = expandDestinationTokens(entry.destinationPath, harness);

    if (abs.startsWith(projectsRoot)) {
      console.warn(
        `[remove] AD-7: skipping projects/ entry '${entry.bundlePath}' — projects directory is untouchable`,
      );
      continue;
    }

    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { force: true });
      removedCount++;
    }

    let parent = path.dirname(abs);
    while (
      (parent.startsWith(radOrchRoot) || parent.startsWith(path.dirname(radOrchRoot))) &&
      parent !== radOrchRoot &&
      parent !== path.dirname(radOrchRoot)
    ) {
      dirsTouched.add(parent);
      parent = path.dirname(parent);
    }
  }

  const pruned = [];
  const sorted = [...dirsTouched].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    if (fs.existsSync(dir)) {
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
  }

  return { removedCount, prunedDirs: pruned };
}

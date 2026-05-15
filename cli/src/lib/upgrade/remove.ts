// cli/src/lib/upgrade/remove.ts — Single shared removal path.
//   - Uses expandDestinationTokens(entry.destinationPath, harness) for path
//     resolution — destinationPath is baked into the manifest by adapters/.
//   - Hard AD-7 guard: any entry resolving under userDataPaths().projects is
//     skipped with a debug warning — never deleted.
//
// Drives entirely off a manifest fetched from the bundled catalog. The
// user's data paths are never enumerated to discover files — manifest is the
// only source of truth (NFR-1).

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';
import type { HarnessName } from './harness-paths.js';

export interface RemoveManifest {
  readonly files: ReadonlyArray<{ readonly bundlePath: string; readonly destinationPath: string }>;
}

export interface RemoveResult {
  readonly removedCount: number;
  readonly prunedDirs: string[];
}

/**
 * Removes every file the manifest lists from the harness-routed locations,
 * then prunes empty parent directories.
 *
 * AD-7 hard guard: if `resolveBundleTarget(entry.bundlePath, harness)` starts
 * with `userDataPaths().projects`, the entry is skipped unconditionally and a
 * debug warning is emitted — the projects directory is never deleted from.
 *
 * @param manifest - Manifest with files array
 * @param harness - Target harness name for path resolution
 */
export function removeManifestFiles(manifest: RemoveManifest, harness: HarnessName): RemoveResult {
  const projectsRoot = userDataPaths().projects;
  let removedCount = 0;
  const dirsTouched = new Set<string>();

  for (const entry of manifest.files) {
    const abs = expandDestinationTokens(entry.destinationPath, harness);

    // AD-7: hard guard — never delete anything under projects/
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

    // Track parent dirs from the file upward; use projectsRoot as the limit anchor
    // but the real anchor is the radorch root (one level above projects/).
    const radOrchRoot = userDataPaths().root;
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

  // Prune deepest-first so emptied parents become candidates for pruning.
  const pruned: string[] = [];
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
        // Race or permission — leave it; non-fatal.
      }
    }
  }

  return { removedCount, prunedDirs: pruned };
}

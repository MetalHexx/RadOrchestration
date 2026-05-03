// installer/lib/remove.js — The single shared removal path. Used by:
//   - `radorch uninstall` (direct invocation)
//   - the upgrade flow's uninstall-then-install composition
//   - the cross-harness switch cleanup against the prior orchRoot
//
// Drives entirely off a manifest fetched from the bundled catalog. The
// user's orchRoot is never enumerated to discover "what looks like an
// orchestration file" — manifest is the only source of truth (NFR-1, AD-1).

import fs from 'node:fs';
import path from 'node:path';

/**
 * Removes every file the manifest lists from the resolved orchRoot, then
 * prunes empty parent directories created by the install (skill folders,
 * `agents/`, `skills/`).
 *
 * @param {{ files: Array<{ bundlePath: string }> }} manifest
 * @param {string} resolvedOrchRoot
 * @returns {{ removedCount: number, prunedDirs: string[] }}
 */
export function removeManifestFiles(manifest, resolvedOrchRoot) {
  let removedCount = 0;
  const dirsTouched = new Set();
  for (const entry of manifest.files) {
    const abs = path.join(resolvedOrchRoot, entry.bundlePath);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { force: true });
      removedCount++;
    }
    // Track parent dirs from the file up to (but not including) orchRoot.
    let parent = path.dirname(abs);
    while (parent.startsWith(resolvedOrchRoot) && parent !== resolvedOrchRoot) {
      dirsTouched.add(parent);
      parent = path.dirname(parent);
    }
  }
  // Prune deepest-first so emptied parents become candidates for pruning.
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
        // Race or permission — leave it; non-fatal.
      }
    }
  }
  return { removedCount, prunedDirs: pruned };
}

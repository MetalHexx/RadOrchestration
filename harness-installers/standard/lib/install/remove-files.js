// harness-installers/standard/lib/install/remove-files.js —
// Removes manifest entries from their resolved destinations and prunes any
// ancestor directories that end up empty (contents-aware): an ancestor that
// still contains a user-authored file — anything not in the manifest — is
// preserved. The harness root itself is never pruned. projects/ entries are
// skipped unconditionally (idempotent symmetry with install-files.js).
//
// FR-20 defensive guard: scans the manifest before the per-entry removal
// loop and throws if any entry targets a path under
// ${RAD_HOME}/action-events/custom/ other than the canonical
// custom/README.md. Belt-and-suspenders against future manifest-shape drift;
// the build-time filter is the primary guarantee that the manifest never
// lists user-authored custom payloads.

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

  // FR-20 defensive guard: refuse any manifest entry that targets a user
  // payload under action-events/custom/. Only the canonical
  // custom/README.md is permitted; everything else is a manifest drift bug
  // and aborts the uninstall before any file work.
  const customSegment = `${path.sep}action-events${path.sep}custom${path.sep}`;
  const allowedCustomAbs = expandDestinationTokens(
    '${RAD_HOME}/action-events/custom/README.md',
    harness,
  );
  for (const entry of manifest.files ?? []) {
    const resolved = expandDestinationTokens(entry.destinationPath, harness);
    if (resolved.includes(customSegment) && resolved !== allowedCustomAbs) {
      throw new Error(
        `uninstall safety: manifest entry '${entry.bundlePath}' targets an action-events/custom/ ` +
        `payload. Only the shipped custom/README.md may be listed. Refusing to proceed.`,
      );
    }
  }

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

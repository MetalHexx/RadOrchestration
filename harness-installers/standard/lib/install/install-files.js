// harness-installers/standard/lib/install/install-files.js —
// Copies manifest entries to their per-entry destinationPath.
//
// AD-9: when `sharedRoot` is provided, entries whose bundlePath starts with
// `ui/` resolve from `sharedRoot` instead of `bundleRoot`. (The legacy
// installer keeps shared assets one level up from per-harness payloads.)
//
// AD-13: any entry whose resolved target falls under ~/.radorc/projects/ is
// skipped unconditionally — projects/ is sacred user data. A one-line
// `[install] skipping projects/ entry '<bundlePath>'` log is emitted per skip.
//
// NFR-6: after copying skills/rad-orchestration/scripts/radorch.mjs, chmod
// 0o755 on POSIX (try/catch — silent no-op on Windows).

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string, sha256?: string }> }} manifest
 * @param {string} bundleRoot
 * @param {string} harness
 * @param {{ sharedRoot?: string }} [opts]
 * @returns {{ copiedCount: number, skippedCount: number }}
 */
export function installManifestFiles(manifest, bundleRoot, harness, opts = {}) {
  const sharedRoot = opts.sharedRoot ?? bundleRoot;
  const projectsRoot = userDataPaths().projects;
  let copiedCount = 0;
  let skippedCount = 0;

  for (const entry of manifest.files) {
    const target = expandDestinationTokens(entry.destinationPath, harness);

    if (target.startsWith(projectsRoot)) {
      console.warn(`[install] skipping projects/ entry '${entry.bundlePath}'`);
      skippedCount++;
      continue;
    }

    const normalized = entry.bundlePath.split(/[\\/]/).join('/');
    const sourceRoot = normalized.startsWith('ui/') ? sharedRoot : bundleRoot;
    const source = path.join(sourceRoot, entry.bundlePath);
    const targetDir = path.dirname(target);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, target);

    if (normalized === 'skills/rad-orchestration/scripts/radorch.mjs') {
      try {
        fs.chmodSync(target, 0o755);
      } catch {
        /* NFR-6: chmod is best-effort; Windows has no POSIX mode bits. */
      }
    }

    copiedCount++;
  }

  return { copiedCount, skippedCount };
}

// installer/lib/install/install-files.js — Copies manifest entries to their
// per-entry destinationPath. Independent JS port of
// cli/src/lib/upgrade/install.ts.
//
// AD-3: when `sharedRoot` is provided, entries whose bundlePath starts with
// `ui/` resolve from `sharedRoot` instead of `pluginRoot`. (Legacy installer
// keeps shared assets one level up from per-harness payloads.)
//
// AD-7: any entry whose resolved target falls under ~/.radorch/projects/ is
// skipped unconditionally — projects/ is sacred user data.
//
// NFR-6: after copying the CLI bundle file, chmod 0o755 on POSIX (no-op on Windows).

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string }> }} manifest
 * @param {string} pluginRoot
 * @param {string} harness
 * @param {{ sharedRoot?: string }} [opts]
 * @returns {{ copiedCount: number, skippedCount: number }}
 */
export function installManifestFiles(manifest, pluginRoot, harness, opts = {}) {
  const sharedRoot = opts.sharedRoot ?? pluginRoot;
  const projectsRoot = userDataPaths().projects;
  let copiedCount = 0;
  let skippedCount = 0;

  for (const entry of manifest.files) {
    const target = expandDestinationTokens(entry.destinationPath, harness);

    if (target.startsWith(projectsRoot)) {
      console.warn(
        `[install] AD-7: skipping projects/ entry '${entry.bundlePath}' — projects directory is untouchable`,
      );
      skippedCount++;
      continue;
    }

    const normalized = entry.bundlePath.split(/[\\/]/).join('/');
    const sourceRoot = normalized.startsWith('ui/') ? sharedRoot : pluginRoot;
    const source = path.join(sourceRoot, entry.bundlePath);
    const targetDir = path.dirname(target);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, target);

    if (normalized === 'skills/rad-orchestration/scripts/radorch.mjs') {
      try {
        fs.chmodSync(target, 0o755);
      } catch {
        /* chmod is best-effort; Windows has no POSIX mode bits. */
      }
    }

    copiedCount++;
  }

  return { copiedCount, skippedCount };
}

// harness-dogfood/install-files.js — Minimal manifest-driven copy library used
// by the dogfood build only. Decoupled from installer/lib/install/ per AD-2.
//
// Scope: the dogfood build emits only agents + skills (and optional
// templates/orchestration.yml when present); ui/ is never staged here. The
// `sharedRoot` parameter and the ui/ bundlePath branch from the installer
// library are dropped. The AD-7 `projects/` skip remains. A best-effort
// chmod on skills/rad-orchestration/scripts/radorch.mjs is preserved for
// parity — it is harmless when that file is absent from a dogfood deploy.

import fs from 'node:fs';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * @param {{ files: Array<{ bundlePath: string, destinationPath: string }> }} manifest
 * @param {string} pluginRoot
 * @param {string} harness
 * @returns {{ copiedCount: number, skippedCount: number }}
 */
export function installManifestFiles(manifest, pluginRoot, harness) {
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
    const source = path.join(pluginRoot, entry.bundlePath);
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

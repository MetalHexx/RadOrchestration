// cli/src/lib/upgrade/install.ts — Copy bundle files to their routed targets.
//
// Driven entirely off a manifest. Each entry is read from
// path.join(pluginRoot, entry.bundlePath) and written to
// resolveBundleTarget(entry.bundlePath, harness), creating intermediate
// directories as needed.
//
// AD-7 hard guard: any entry whose resolved target path falls under
// userDataPaths().projects is skipped unconditionally — the projects
// directory is never written to by the install path.

import fs from 'node:fs';
import path from 'node:path';
import { resolveBundleTarget } from './route.js';
import { userDataPaths } from './user-data-paths.js';
import type { HarnessName } from './harness-paths.js';

export interface InstallManifest {
  readonly files: ReadonlyArray<{ readonly bundlePath: string }>;
}

export interface InstallResult {
  readonly copiedCount: number;
  readonly skippedCount: number;
}

/**
 * Copies each manifest entry from `<pluginRoot>/<bundlePath>` to its
 * harness-routed target, creating intermediate directories automatically.
 *
 * AD-7 hard guard: entries whose resolved target path falls under
 * `userDataPaths().projects` are skipped unconditionally.
 *
 * @param manifest - Manifest with files array
 * @param pluginRoot - Absolute path to the installed plugin root (source)
 * @param harness - Target harness name for path resolution
 */
export function installManifestFiles(
  manifest: InstallManifest,
  pluginRoot: string,
  harness: HarnessName,
): InstallResult {
  const projectsRoot = userDataPaths().projects;
  let copiedCount = 0;
  let skippedCount = 0;

  for (const entry of manifest.files) {
    const target = resolveBundleTarget(entry.bundlePath, harness);

    // AD-7: hard guard — never write anything under projects/
    if (target.startsWith(projectsRoot)) {
      console.warn(
        `[install] AD-7: skipping projects/ entry '${entry.bundlePath}' — projects directory is untouchable`,
      );
      skippedCount++;
      continue;
    }

    const source = path.join(pluginRoot, entry.bundlePath);
    const targetDir = path.dirname(target);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, target);
    copiedCount++;
  }

  return { copiedCount, skippedCount };
}

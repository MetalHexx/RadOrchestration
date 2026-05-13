// cli/src/lib/upgrade/install.ts — Copy bundle files to their routed targets.
//
// Driven entirely off a manifest. Each entry is read from a source path
// (resolved per-entry: ui/ from `sharedRoot`, everything else from
// `pluginRoot`) and written to resolveBundleTarget(entry.bundlePath, harness),
// creating intermediate directories as needed.
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

export interface InstallOpts {
  /**
   * AD-3: when provided, entries whose `bundlePath` begins with `ui/` resolve
   * from `sharedRoot` instead of `pluginRoot`. The legacy installer passes
   * this (its shared-asset tree lives one level up from the per-harness
   * payload); the plugin channel omits it (single bundle root). When omitted,
   * `sharedRoot` defaults to `pluginRoot` so the call sites that don't care
   * stay unchanged.
   */
  readonly sharedRoot?: string;
}

/**
 * Copies each manifest entry from a per-entry-resolved source path to its
 * harness-routed target, creating intermediate directories automatically.
 *
 * Source resolution (AD-3):
 *   - bundlePath starts with `ui/` → source = `<sharedRoot>/<bundlePath>`
 *   - everything else → source = `<pluginRoot>/<bundlePath>`
 *   - when `sharedRoot` is omitted it defaults to `pluginRoot`.
 *
 * AD-7 hard guard: entries whose resolved target path falls under
 * `userDataPaths().projects` are skipped unconditionally.
 *
 * NFR-6: after copying the CLI bundle
 * (`skills/rad-orchestration/scripts/radorch.mjs`), chmod 0o755 on POSIX so
 * the file is directly executable. On Windows the chmod is a no-op.
 *
 * @param manifest - Manifest with files array
 * @param pluginRoot - Absolute path to the installed plugin root (default source)
 * @param harness - Target harness name for path resolution
 * @param opts - Optional install options (e.g. `sharedRoot` for shared assets)
 */
export function installManifestFiles(
  manifest: InstallManifest,
  pluginRoot: string,
  harness: HarnessName,
  opts: InstallOpts = {},
): InstallResult {
  const sharedRoot = opts.sharedRoot ?? pluginRoot;
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

    const normalized = entry.bundlePath.split(/[\\/]/).join('/');
    const sourceRoot = normalized.startsWith('ui/') ? sharedRoot : pluginRoot;
    const source = path.join(sourceRoot, entry.bundlePath);
    const targetDir = path.dirname(target);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, target);

    // NFR-6: ensure the CLI bundle is executable on POSIX. No-op on Windows.
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

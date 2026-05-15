// cli/src/lib/upgrade/hash-check.ts — Symmetric content-hash detect primitive.
//   - Uses expandDestinationTokens(entry.destinationPath, harness) for path
//     resolution — destinationPath is baked into the manifest by adapters/.
//   - Explicit AD-7 skip: entries resolving under userDataPaths().projects
//     are never enumerated
//   - ownership: 'user-config' skip rule preserved verbatim
//
// plugin-bootstrap is always headless (runs from hooks + scripted install
// flows). detectModifiedFiles returns the path list for informational logging
// only — there is no prompt/confirm flow in this codebase.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { expandDestinationTokens } from './expand-tokens.js';
import { userDataPaths } from './user-data-paths.js';
import type { HarnessName } from './harness-paths.js';
import type { ManifestEntry } from './catalog.js';

export interface DetectManifest {
  readonly files: ReadonlyArray<Pick<ManifestEntry, 'bundlePath' | 'destinationPath' | 'sha256' | 'ownership'>>;
}

/**
 * Hex-encoded SHA-256 of a byte buffer.
 */
export function hexSha256OfBytes(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Returns the alphabetically-sorted list of bundlePaths whose on-disk
 * sha256 differs from the manifest. Files missing on disk are ignored.
 *
 * Entries marked `ownership: 'user-config'` are skipped — these are files
 * the installer rewrites with user-specific content after copying the
 * bundle (e.g. orchestration.yml), so on-disk bytes diverge from bundled
 * bytes by design on every install.
 *
 * AD-7 invariant: any entry whose resolved path falls under
 * `userDataPaths().projects` is skipped — the projects directory is
 * untouchable user data and must never be scanned.
 *
 * @param manifest - Manifest with files array
 * @param harness - Target harness name for path resolution
 * @returns Sorted bundlePaths whose on-disk content was modified
 */
export function detectModifiedFiles(manifest: DetectManifest, harness: HarnessName): string[] {
  const projectsRoot = userDataPaths().projects;
  const modified: string[] = [];

  for (const entry of manifest.files) {
    // Preserve verbatim ownership: 'user-config' skip rule from installer
    if (entry.ownership === 'user-config') continue;

    const abs = expandDestinationTokens(entry.destinationPath, harness);

    // AD-7: never enumerate anything under projects/
    if (abs.startsWith(projectsRoot)) continue;

    if (!fs.existsSync(abs)) continue;

    const actual = hexSha256OfBytes(fs.readFileSync(abs));
    if (actual !== entry.sha256) {
      modified.push(entry.bundlePath);
    }
  }

  return modified.sort();
}


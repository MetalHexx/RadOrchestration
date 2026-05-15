// cli/src/lib/upgrade/expand-tokens.ts — Consumer-side helper that takes a
// templated destination path from a manifest entry (e.g.
// "${HARNESS_ROOT}/skills/foo") and resolves the absolute path on disk.
//
// The producer side (adapters/destination-routing.js) is shared between the
// legacy installer build and the plugin build. This consumer is the CLI's
// independent implementation; the legacy installer has its own paired copy
// at installer/lib/install/expand-tokens.js to keep the installer free of
// `cli/` imports.

import path from 'node:path';
import { harnessRoot } from './harness-paths.js';
import { userDataPaths } from './user-data-paths.js';
import type { HarnessName } from './harness-paths.js';

/**
 * Replaces `${HARNESS_ROOT}` and `${RAD_HOME}` tokens in a templated
 * destination path with their concrete OS paths, then normalises path
 * separators (mixed `/` and `\` collapse to OS-native via `path.normalize`).
 *
 * @param templatedPath - A destinationPath value from a manifest entry, e.g.
 *   "${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs"
 * @param harness - Active harness; selects which folder ${HARNESS_ROOT} expands to
 */
export function expandDestinationTokens(templatedPath: string, harness: HarnessName): string {
  const expanded = templatedPath
    .replaceAll('${HARNESS_ROOT}', harnessRoot(harness))
    .replaceAll('${RAD_HOME}', userDataPaths().root);
  return path.normalize(expanded);
}

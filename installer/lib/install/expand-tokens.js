// installer/lib/install/expand-tokens.js — Consumer-side helper that takes a
// templated destination path from a manifest entry (e.g.
// "${HARNESS_ROOT}/skills/foo") and resolves the absolute path on disk.
//
// Paired with cli/src/lib/upgrade/expand-tokens.ts — same algorithm, kept
// independent so the installer has no `cli/` imports.

import path from 'node:path';
import { harnessRoot } from './harness-paths.js';
import { userDataPaths } from './user-data-paths.js';

/**
 * Replaces ${HARNESS_ROOT} and ${RAD_HOME} tokens with concrete paths, then
 * normalises separators so Windows mixed-separator strings collapse to OS-native.
 *
 * @param {string} templatedPath
 * @param {string} harness
 */
export function expandDestinationTokens(templatedPath, harness) {
  const expanded = templatedPath
    .replaceAll('${HARNESS_ROOT}', harnessRoot(harness))
    .replaceAll('${RAD_HOME}', userDataPaths().root);
  return path.normalize(expanded);
}

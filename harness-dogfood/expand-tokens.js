// harness-dogfood/expand-tokens.js — Consumer-side helper that takes a
// templated destination path from a manifest entry (e.g.
// "${HARNESS_ROOT}/skills/foo") and resolves the absolute path on disk.
// Decoupled from installer/lib/install/ per AD-2; kept in lockstep with the
// installer's expand-tokens algorithm but lives entirely inside the dogfood
// folder so the dogfood build has no installer/ imports.

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

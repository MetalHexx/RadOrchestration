// installer/lib/cross-harness-scan.js — Cross-harness switch detection.
//
// Scans a small fixed set of well-known orchRoot locations under the
// workspace (.claude/, .github/) and returns any prior install whose
// orchRoot differs from the one the user just chose. Per AD-7: no
// per-user global record (no ~/.config/radorch/installs.json) — keeping
// detection filesystem-local and per-workspace matches the project's
// "no out-of-repo state" sentiment.

import path from 'node:path';
import { readInstalledPackageVersion } from './installed-version.js';

/** Well-known orchRoot folder names under the workspace. */
const WELL_KNOWN_ORCH_ROOTS = ['.claude', '.github'];

/**
 * Infers the harness tool from a well-known orchRoot folder name.
 *
 * Mapping:
 *   .claude  → 'claude-code'
 *   .github  → 'copilot-vscode'
 *
 * Limitation: copilot-cli is treated as 'copilot-vscode' here because both
 * variants share the same manifest file-path shape (.agent.md extensions).
 * If the user originally installed with copilot-cli, cleanup still removes
 * the correct set of files. True disambiguation would require storing the tool
 * name in orchestration.yml, which is a future enhancement.
 *
 * @param {string} orchRootName - The basename of the orchRoot folder (e.g. '.claude')
 * @returns {string} Harness tool identifier
 */
function inferToolFromOrchRoot(orchRootName) {
  if (orchRootName === '.claude') return 'claude-code';
  return 'copilot-vscode';
}

/**
 * Returns details of a prior install at a well-known orchRoot whose path
 * differs from the chosen one. Pre-manifest installs (no package_version)
 * are skipped — those follow the DD-1 manual migration path.
 *
 * @param {string} workspaceDir - Absolute path to the workspace
 * @param {string} chosenOrchRoot - Relative folder name OR absolute path the user chose
 * @returns {null | { orchRoot: string, packageVersion: string, tool: string }}
 */
export function findPriorInstallAtOtherOrchRoot(workspaceDir, chosenOrchRoot) {
  // Absolute-path overrides are not auto-detected (AD-7) — only well-known
  // relative-folder installs under the workspace are scanned.
  const chosenAbsolute = path.isAbsolute(chosenOrchRoot)
    ? chosenOrchRoot
    : path.join(workspaceDir, chosenOrchRoot);
  for (const candidateName of WELL_KNOWN_ORCH_ROOTS) {
    const candidateAbs = path.join(workspaceDir, candidateName);
    if (candidateAbs === chosenAbsolute) continue;
    const installed = readInstalledPackageVersion(candidateAbs);
    if (installed && installed.packageVersion) {
      return {
        orchRoot: candidateAbs,
        packageVersion: installed.packageVersion,
        tool: inferToolFromOrchRoot(candidateName),
      };
    }
  }
  return null;
}

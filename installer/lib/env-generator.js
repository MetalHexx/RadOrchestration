/** @import { InstallerConfig } from './types.js' */

/**
 * Generates .env.local content for the UI.
 * @param {string} workspaceDir - Absolute path to workspace root
 * @param {string} orchRoot - Orchestration root folder name (e.g., '.github') or absolute path
 * @returns {string} - File content: WORKSPACE_ROOT=... and ORCH_ROOT=...
 */
export function generateEnvLocal(workspaceDir, orchRoot) {
  return `WORKSPACE_ROOT=${workspaceDir}\nORCH_ROOT=${orchRoot}\n`;
}

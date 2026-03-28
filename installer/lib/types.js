// installer/lib/types.js — JSDoc type definitions (no runtime code)

/**
 * @typedef {Object} InstallerConfig
 * @property {'copilot'} tool - Selected AI tool (v1: copilot only)
 * @property {string} workspaceDir - Absolute path to target workspace
 * @property {string} orchRoot - Orchestration root folder name or absolute path
 * @property {string} projectsBasePath - Relative or absolute path for project storage
 * @property {'SCREAMING_CASE'|'lowercase'|'numbered'} projectsNaming - Folder naming convention
 * @property {number} maxPhases - Maximum phases per project
 * @property {number} maxTasksPerPhase - Maximum tasks per phase
 * @property {number} maxRetriesPerTask - Auto-retries before escalation
 * @property {number} maxConsecutiveReviewRejections - Review rejects before human escalation
 * @property {'ask'|'phase'|'task'|'autonomous'} executionMode - Human gate execution mode
 * @property {'always'|'ask'|'never'} autoCommit - Auto-commit behavior for source control
 * @property {'always'|'ask'|'never'} autoPr - Auto-PR behavior for source control
 * @property {'github'} provider - Source control provider (v1: github only)
 * @property {boolean} installUi - Whether to install the monitoring dashboard
 * @property {string} [uiDir] - Absolute path to UI installation directory (when installUi is true)
 * @property {boolean} skipConfirmation - Whether --yes flag was passed
 */

/**
 * @typedef {Object} ManifestCategory
 * @property {string} name - Display name for progress/summary (e.g., "Agents")
 * @property {string} sourceDir - Relative path from repo root to source directory
 * @property {string} targetDir - Relative path from orch root in target workspace
 * @property {string[]} [excludeDirs] - Directory names to exclude from copy
 * @property {string[]} [excludeFiles] - File names/patterns to exclude from copy
 * @property {boolean} [recursive] - Whether to copy recursively (default: true)
 */

/**
 * @typedef {Object} Manifest
 * @property {ManifestCategory[]} categories - Ordered list of file categories to copy
 * @property {string[]} globalExcludes - Patterns excluded from all categories
 */

/**
 * @typedef {Object} CopyResult
 * @property {string} category - Category name
 * @property {number} fileCount - Number of files copied
 * @property {boolean} success - Whether the copy succeeded
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} UiBuildResult
 * @property {boolean} copySuccess - Whether UI source files were copied
 * @property {boolean} installSuccess - Whether npm install succeeded
 * @property {boolean} buildSuccess - Whether npm run build succeeded
 * @property {number} fileCount - Number of UI source files copied
 * @property {string} [error] - Error message if any step failed
 */

export {};

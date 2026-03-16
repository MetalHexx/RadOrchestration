import path from 'node:path';

/**
 * Resolve the workspace root path from the WORKSPACE_ROOT environment variable.
 * Throws Error if WORKSPACE_ROOT is not set.
 */
export function getWorkspaceRoot(): string {
  const root = process.env.WORKSPACE_ROOT;
  if (!root) {
    throw new Error(
      'WORKSPACE_ROOT environment variable is not set. ' +
      'Set it in ui/.env.local to the absolute path of the workspace root.'
    );
  }
  return root;
}

/**
 * Resolve the absolute path to the projects base directory.
 * Combines workspace root with the base_path from orchestration.yml.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @returns Absolute path to the projects base directory
 */
export function resolveBasePath(workspaceRoot: string, basePath: string): string {
  return path.resolve(workspaceRoot, basePath);
}

/**
 * Resolve a project directory path.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @param projectName - Project name (e.g., "MONITORING-UI")
 * @returns Absolute path: {workspaceRoot}/{basePath}/{projectName}
 */
export function resolveProjectDir(
  workspaceRoot: string,
  basePath: string,
  projectName: string
): string {
  return path.resolve(workspaceRoot, basePath, projectName);
}

/**
 * Resolve a document path relative to its project directory.
 * Document paths in state.json are relative to the project folder.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @param projectName - Project name
 * @param relativePath - Document path relative to project dir (e.g., "tasks/MONITORING-UI-TASK-P01-T01.md")
 * @returns Absolute filesystem path
 *
 * Example: resolveDocPath('/workspace', '.github/projects', 'VALIDATOR', 'tasks/VALIDATOR-TASK-P01-T01.md')
 *        → '/workspace/.github/projects/VALIDATOR/tasks/VALIDATOR-TASK-P01-T01.md'
 */
export function resolveDocPath(
  workspaceRoot: string,
  basePath: string,
  projectName: string,
  relativePath: string
): string {
  const prefix = basePath + '/' + projectName + '/';
  const normalizedPrefix = prefix.replace(/\\/g, '/');
  const normalizedRelPath = relativePath.replace(/\\/g, '/');

  const strippedPath = normalizedRelPath.startsWith(normalizedPrefix)
    ? normalizedRelPath.slice(normalizedPrefix.length)
    : relativePath;

  return path.resolve(workspaceRoot, basePath, projectName, strippedPath);
}

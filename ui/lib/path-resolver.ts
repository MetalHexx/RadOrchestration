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
 * In Docker, PROJECTS_DIR env var provides the container-mapped path directly.
 * Otherwise, combines workspace root with the base_path from orchestration.yml.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param basePath - Base path from orchestration.yml (relative or absolute)
 * @returns Absolute path to the projects base directory
 */
export function resolveBasePath(workspaceRoot: string, basePath: string): string {
  if (process.env.PROJECTS_DIR) {
    return process.env.PROJECTS_DIR;
  }
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
  return path.join(resolveBasePath(workspaceRoot, basePath), projectName);
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

  let strippedPath: string;
  if (normalizedRelPath.startsWith(normalizedPrefix)) {
    // Path already contains the full relative prefix (e.g. "orchestration-projects/PROJ/file.md")
    strippedPath = normalizedRelPath.slice(normalizedPrefix.length);
  } else {
    // Fallback: strip any host-absolute prefix by locating "/<projectName>/" anywhere in the path.
    // This handles state.json doc_path values that are absolute host paths
    // (e.g. "C:/test/orchestration-projects/PROJ/file.md") when running inside Docker
    // where PROJECTS_DIR differs from the host path stored in state.json.
    const marker = '/' + projectName + '/';
    const markerIdx = normalizedRelPath.indexOf(marker);
    strippedPath = markerIdx !== -1
      ? normalizedRelPath.slice(markerIdx + marker.length)
      : relativePath;
  }

  return path.join(resolveBasePath(workspaceRoot, basePath), projectName, strippedPath);
}

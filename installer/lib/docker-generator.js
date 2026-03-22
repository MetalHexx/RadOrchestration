// installer/lib/docker-generator.js — Pure function: generates docker-compose.yml content

import { toDockerPath } from './path-utils.js';

/**
 * Generates docker-compose.yml content with resolved volume mounts.
 * On Windows, paths are converted to Docker-compatible format via toDockerPath().
 * @param {Object} options
 * @param {string} options.uiDir - Absolute path to UI directory
 * @param {string} options.workspaceDir - Absolute path to workspace root
 * @param {string} options.orchRoot - Orchestration root folder name (e.g., '.github')
 * @param {string} options.projectsDir - Absolute path to the projects directory
 * @returns {string} - Complete docker-compose.yml content
 */
export function generateDockerCompose({ uiDir, workspaceDir, orchRoot, projectsDir }) {
  const dockerUiDir = toDockerPath(uiDir);
  const dockerWorkspaceDir = toDockerPath(workspaceDir);
  const dockerProjectsDir = toDockerPath(projectsDir);

  return `name: RadOrchestration
services:
  radorch-ui:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "3000:3000"
    volumes:
      - ${dockerUiDir}:/app
      - ${dockerWorkspaceDir}:/workspace
      - ${dockerProjectsDir}:/projects
    environment:
      - WORKSPACE_ROOT=/workspace
      - ORCH_ROOT=${orchRoot}
      - PROJECTS_DIR=/projects
    command: sh -c "npm start"
`;
}

// installer/lib/docker-generator.js — Pure function: generates docker-compose.yml content

import { toDockerPath } from './path-utils.js';

/**
 * Generates docker-compose.yml content with resolved volume mounts.
 * On Windows, paths are converted to Docker-compatible format via toDockerPath().
 * @param {Object} options
 * @param {string} options.uiDir - Absolute path to UI directory
 * @param {string} options.workspaceDir - Absolute path to workspace root
 * @param {string} options.orchRoot - Orchestration root folder name (e.g., '.github')
 * @returns {string} - Complete docker-compose.yml content
 */
export function generateDockerCompose({ uiDir, workspaceDir, orchRoot }) {
  const dockerUiDir = toDockerPath(uiDir);
  const dockerWorkspaceDir = toDockerPath(workspaceDir);

  return `services:
  radorch-ui:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "3000:3000"
    volumes:
      - ${dockerUiDir}:/app
      - ${dockerWorkspaceDir}:/workspace
    environment:
      - WORKSPACE_ROOT=/workspace
      - ORCH_ROOT=${orchRoot}
    command: sh -c "npm start"
`;
}

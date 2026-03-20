// installer/lib/path-utils.js — Path utility functions for the installer

import path from 'node:path';

/**
 * Converts a Windows absolute path to Docker volume mount format.
 * e.g., 'C:\Users\dev\project' → '/c/Users/dev/project'
 * Returns the path unchanged if it is not a Windows drive-letter path.
 * @param {string} absolutePath
 * @returns {string}
 */
export function toDockerPath(absolutePath) {
  const match = absolutePath.match(/^([a-zA-Z]):[/\\]/);
  if (!match) return absolutePath;
  const driveLetter = match[1].toLowerCase();
  // Slice off the drive letter + colon (2 chars), then replace all backslashes
  const rest = absolutePath.slice(2).replace(/\\/g, '/');
  return `/${driveLetter}${rest}`;
}

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Validates a folder name for use as orchestration root.
 * Allows absolute paths (detected via path.isAbsolute).
 * Rejects empty names, illegal path characters, reserved Windows device names, '.' and '..'.
 * @param {string} name
 * @returns {true|string} - true if valid, error message string if invalid
 */
export function isValidFolderName(name) {
  if (!name || name.trim() === '') {
    return 'Folder name cannot be empty.';
  }
  if (path.isAbsolute(name)) {
    return true;
  }
  if (/[/\\]/.test(name)) {
    return 'Folder name cannot contain path separator characters (/ or \\).';
  }
  if (/[<>:"|?*]/.test(name)) {
    return 'Folder name contains illegal filesystem characters.';
  }
  if (RESERVED_NAMES.test(name)) {
    return `"${name}" is a reserved Windows device name and cannot be used as a folder name.`;
  }
  if (name === '.' || name === '..') {
    return 'Folder name cannot be "." or "..".';
  }
  return true;
}

/**
 * Resolves the orchestration root to an absolute path.
 * If orchRoot is already absolute, returns it directly.
 * Otherwise, joins workspaceDir + orchRoot.
 * @param {string} workspaceDir - Absolute path to the workspace directory
 * @param {string} orchRoot - Relative folder name or absolute path
 * @returns {string}
 */
export function resolveOrchRoot(workspaceDir, orchRoot) {
  if (path.isAbsolute(orchRoot)) {
    return orchRoot;
  }
  return path.join(workspaceDir, orchRoot);
}

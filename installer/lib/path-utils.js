// installer/lib/path-utils.js — Path utility functions for the installer

import path from 'node:path';

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

/**
 * Normalizes a user-entered path for storage in orchestration.yml.
 * - Replaces all backslashes with forward slashes
 * - Collapses consecutive forward slashes to a single slash
 * - Strips trailing slash (unless the entire value is '/')
 * Does NOT strip leading slashes — absolute paths are valid.
 * @param {string} value
 * @returns {string}
 */
export function normalizePath(value) {
  let result = value.replace(/\\/g, '/');
  result = result.replace(/\/+/g, '/');
  if (result.length > 1) {
    result = result.replace(/\/$/, '');
  }
  return result;
}

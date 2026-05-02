'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Check if a path exists (file or directory).
 * @param {string} filePath
 * @returns {boolean} true if path exists, false otherwise. Never throws.
 */
function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory.
 * @param {string} dirPath
 * @returns {boolean} true if path exists and is a directory, false otherwise. Never throws.
 */
function isDirectory(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * List files in a directory matching a suffix pattern.
 * @param {string} dirPath - Absolute path to directory
 * @param {string} [suffix] - File suffix to match (e.g., '.agent.md'). Empty string = all files.
 * @returns {string[]} Array of filenames (not full paths). Empty array if directory doesn't exist.
 */
function listFiles(dirPath, suffix) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let files = entries.filter(dirent => dirent.isFile()).map(dirent => dirent.name);
    if (suffix) {
      files = files.filter(name => name.endsWith(suffix));
    }
    return files;
  } catch {
    return [];
  }
}

/**
 * List subdirectories in a directory.
 * @param {string} dirPath - Absolute path to directory
 * @returns {string[]} Array of directory names (not full paths). Empty array if parent doesn't exist.
 */
function listDirs(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
  } catch {
    return [];
  }
}

/**
 * Read a file's content as UTF-8 string.
 * @param {string} filePath
 * @returns {string|null} File content, or null if the file doesn't exist or can't be read. Never throws.
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

module.exports = { exists, isDirectory, listFiles, listDirs, readFile };

'use strict';

const path = require('path');
const { exists, isDirectory } = require('../utils/fs-helpers');

/**
 * Check that the required .github/ directories and files exist.
 * @param {string} basePath - Absolute path to the workspace root (parent of .github/)
 * @param {object} context  - Shared discovery context (not populated by this module)
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: {expected: string, found: string, context?: string}}>>}
 */
async function checkStructure(basePath, context, _config, orchRoot) {
  try {
    const root = orchRoot || '.github';
    const results = [];
    const ghDir = path.join(basePath, root);

    const requiredDirs = [
      { name: root, path: ghDir, check: 'isDirectory' },
      { name: `${root}/agents`, path: path.join(ghDir, 'agents'), check: 'isDirectory' },
      { name: `${root}/skills`, path: path.join(ghDir, 'skills'), check: 'isDirectory' },
      { name: `${root}/instructions`, path: path.join(ghDir, 'instructions'), check: 'isDirectory' },
      { name: `${root}/prompts`, path: path.join(ghDir, 'prompts'), check: 'isDirectory', optional: true },
    ];

    const requiredFiles = [
      { name: `${root}/skills/orchestration/config/orchestration.yml`, path: path.join(ghDir, 'skills', 'orchestration', 'config', 'orchestration.yml'), check: 'exists' },
      { name: `${root}/copilot-instructions.md`, path: path.join(ghDir, 'copilot-instructions.md'), check: 'exists' },
    ];

    for (const entry of requiredDirs) {
      const found = isDirectory(entry.path);
      if (found) {
        results.push({
          category: 'structure',
          name: entry.name,
          status: 'pass',
          message: `Directory exists: ${entry.name}`,
        });
      } else if (entry.optional) {
        results.push({
          category: 'structure',
          name: entry.name,
          status: 'warn',
          message: `Optional directory missing: ${entry.name}`,
          detail: {
            expected: 'Directory to exist',
            found: 'Directory not found',
          },
        });
      } else {
        results.push({
          category: 'structure',
          name: entry.name,
          status: 'fail',
          message: `Required directory missing: ${entry.name}`,
          detail: {
            expected: 'Directory to exist',
            found: 'Directory not found',
          },
        });
      }
    }

    for (const entry of requiredFiles) {
      const found = exists(entry.path);
      if (found) {
        results.push({
          category: 'structure',
          name: entry.name,
          status: 'pass',
          message: `File exists: ${entry.name}`,
        });
      } else {
        results.push({
          category: 'structure',
          name: entry.name,
          status: 'fail',
          message: `Required file missing: ${entry.name}`,
          detail: {
            expected: 'File to exist',
            found: 'File not found',
          },
        });
      }
    }

    return results;
  } catch (err) {
    return [
      {
        category: 'structure',
        name: 'structure-check-error',
        status: 'fail',
        message: err.message,
        detail: {
          expected: 'No errors during structure check',
          found: err.message,
        },
      },
    ];
  }
}

module.exports = checkStructure;

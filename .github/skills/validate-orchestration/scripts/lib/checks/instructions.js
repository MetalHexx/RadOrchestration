'use strict';

const path = require('path');
const { listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY = 'instructions';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Check if the project-docs instruction file's applyTo glob matches the configured base_path.
 *
 * @param {string} filename - instruction filename being checked
 * @param {object} frontmatter - parsed frontmatter with applyTo field
 * @param {object} config - parsed orchestration.yml config (null if not available)
 * @returns {object|null} - validation result object, or null if check doesn't apply
 */
function checkApplyToSync(filename, frontmatter, config) {
  if (filename !== 'project-docs.instructions.md') return null;
  if (!config || !config.projects || !config.projects.base_path) return null;

  const basePath = config.projects.base_path;
  const applyTo = frontmatter.applyTo;
  const expectedPrefix = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const actualPrefix = applyTo.replace(/\/?\*\*$/, '').replace(/\/+$/, '');

  if (actualPrefix !== expectedPrefix) {
    const expectedApplyTo = basePath.replace(/\\/g, '/').replace(/\/+$/, '') + '/**';
    return {
      category: CATEGORY,
      name: filename,
      status: 'warn',
      message: `applyTo pattern '${applyTo}' does not match configured base_path '${basePath}'. Update applyTo to '${expectedApplyTo}' or run the configure-system prompt to sync automatically.`,
    };
  }
  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate all .instructions.md files in .github/instructions/.
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @param {object} [config] - Parsed orchestration.yml config (optional; needed for applyTo sync check)
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
async function checkInstructions(basePath, context, config) {
  try {
    const results = [];
    const instrDir = path.join(basePath, '.github', 'instructions');

    // Discover instruction files
    const files = listFiles(instrDir, '.instructions.md');

    // Initialize context.instructions
    context.instructions = [];

    if (files.length === 0) {
      return results;
    }

    for (const filename of files) {
      let hasFails = false;

      // Read file content
      const content = readFile(path.join(instrDir, filename));
      if (content === null) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: 'Could not read file',
          detail: {
            expected: 'Readable instruction file',
            found: 'File could not be read'
          }
        });
        // Still push to context for cross-ref discovery
        context.instructions.push({ filename, frontmatter: null });
        continue;
      }

      // Extract frontmatter
      const { frontmatter } = extractFrontmatter(content);
      if (frontmatter === null) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: 'No valid frontmatter found',
          detail: {
            expected: 'Valid YAML frontmatter block',
            found: 'No parseable frontmatter'
          }
        });
        context.instructions.push({ filename, frontmatter: null });
        continue;
      }

      // Validate applyTo field — must be present and non-empty string
      if (!frontmatter.applyTo || (typeof frontmatter.applyTo === 'string' && frontmatter.applyTo.trim() === '')) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: 'Missing or empty required field: applyTo',
          detail: {
            expected: "non-empty 'applyTo' glob pattern",
            found: frontmatter.applyTo === undefined ? 'undefined' : `"${frontmatter.applyTo}"`
          }
        });
        hasFails = true;
      }

      // Push to context regardless of validation outcome
      context.instructions.push({ filename, frontmatter });

      // If all validations passed, emit pass result
      if (!hasFails) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'pass',
          message: `Instruction file "${filename}" is valid`
        });
      }

      // Check applyTo sync with configured base_path
      if (frontmatter && frontmatter.applyTo) {
        const syncResult = checkApplyToSync(filename, frontmatter, config);
        if (syncResult) results.push(syncResult);
      }
    }

    return results;
  } catch (err) {
    return [
      {
        category: CATEGORY,
        name: 'instruction-check-error',
        status: 'fail',
        message: err.message,
        detail: {
          expected: 'No errors during instruction check',
          found: err.message,
        },
      }
    ];
  }
}

module.exports = checkInstructions;

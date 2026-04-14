'use strict';

const path = require('path');
const { listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS } = require('../utils/constants');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY = 'prompts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate tool entries for a prompt file.
 * @param {string[]} tools
 * @param {string} filename
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function validateTools(tools, filename) {
  const results = [];

  for (const entry of tools) {
    if (!VALID_TOOLSETS.includes(entry) && !VALID_NAMESPACED_TOOLS.includes(entry)) {
      results.push({
        category: CATEGORY,
        name: filename,
        status: 'fail',
        message: `Invalid tool: "${entry}"`,
        detail: {
          expected: 'a valid toolset or namespaced tool',
          found: entry,
          context: `Valid toolsets: ${VALID_TOOLSETS.join(', ')}. Valid namespaced: ${VALID_NAMESPACED_TOOLS.join(', ')}`
        }
      });
    }
  }

  return results;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate all .prompt.md files in .github/prompts/.
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
async function checkPrompts(basePath, context, _config, orchRoot) {
  try {
    const root = orchRoot || '.github';
    const results = [];
    const promptsDir = path.join(basePath, root, 'prompts');

    // Discover prompt files
    const files = listFiles(promptsDir, '.prompt.md');

    // Initialize context.prompts
    context.prompts = [];

    if (files.length === 0) {
      return results;
    }

    for (const filename of files) {
      let hasFails = false;

      // Read file content
      const content = readFile(path.join(promptsDir, filename));
      if (content === null) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: 'Could not read file',
          detail: {
            expected: 'Readable prompt file',
            found: 'File could not be read'
          }
        });
        context.prompts.push({ filename, frontmatter: null });
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
        context.prompts.push({ filename, frontmatter: null });
        continue;
      }

      // Validate description field (FR-15) — must be present
      if (!frontmatter.description || (typeof frontmatter.description === 'string' && frontmatter.description.trim() === '')) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: 'Missing required field: description',
          detail: {
            expected: 'Non-empty string for "description"',
            found: frontmatter.description === undefined ? 'undefined' : `"${frontmatter.description}"`
          }
        });
        hasFails = true;
      }

      // Validate tools array (FR-15) — optional, but if present must be valid
      let tools = frontmatter.tools;
      if (tools !== undefined && tools !== null) {
        if (typeof tools === 'string') {
          tools = [tools];
        } else if (!Array.isArray(tools)) {
          results.push({
            category: CATEGORY,
            name: filename,
            status: 'fail',
            message: 'Invalid tools field: expected an array',
            detail: {
              expected: 'Array of tool names',
              found: typeof tools
            }
          });
          hasFails = true;
          tools = [];
        }

        // Validate each tool entry
        const toolResults = validateTools(tools, filename);
        if (toolResults.length > 0) {
          hasFails = true;
          results.push(...toolResults);
        }
      }

      // Push to context regardless of validation outcome
      context.prompts.push({ filename, frontmatter });

      // If all validations passed, emit pass result
      if (!hasFails) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'pass',
          message: `Prompt file "${filename}" is valid`
        });
      }
    }

    return results;
  } catch (err) {
    return [
      {
        category: CATEGORY,
        name: 'prompt-check-error',
        status: 'fail',
        message: err.message,
        detail: {
          expected: 'No errors during prompt check',
          found: err.message,
        },
      }
    ];
  }
}

module.exports = checkPrompts;

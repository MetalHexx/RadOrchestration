'use strict';

const path = require('path');
const { exists, isDirectory, listDirs, listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY = 'skills';

/** Skills that don't require a templates/ subdirectory */
const TEMPLATES_EXEMPT = ['run-tests', 'validate-orchestration', 'create-skill'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse template links from SKILL.md body text.
 * Matches markdown links targeting ./templates/ paths.
 * @param {string} body
 * @returns {string[]} Array of relative link targets (e.g., ['./templates/PRD.md'])
 */
function parseTemplateLinks(body) {
  const links = [];
  if (!body || typeof body !== 'string') return links;

  const pattern = /\[([^\]]*)\]\(\.\/templates\/([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    links.push(`./templates/${match[2]}`);
  }

  return links;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate all skill directories in .github/skills/.
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
async function checkSkills(basePath, context, _config, orchRoot) {
  try {
    const root = orchRoot || '.github';
    const results = [];
    const skillsDir = path.join(basePath, root, 'skills');

    // Discover skill subdirectories
    const dirs = listDirs(skillsDir);

    // Initialize context.skills
    if (!(context.skills instanceof Map)) {
      context.skills = new Map();
    }

    // ── Anomaly: bare files in skills directory ──
    const bareFiles = listFiles(skillsDir);
    for (const fileName of bareFiles) {
      results.push({
        category: CATEGORY,
        name: fileName,
        status: 'warn',
        message: `Bare file in skills directory (expected a subdirectory with SKILL.md)`,
        detail: {
          expected: 'Skill directory containing SKILL.md',
          found: `Bare file: ${fileName}`
        }
      });
    }

    if (dirs.length === 0) {
      return results;
    }

    for (const dirName of dirs) {
      let hasFails = false;

      // ── Check SKILL.md exists ──
      const skillMdPath = path.join(skillsDir, dirName, 'SKILL.md');
      const content = readFile(skillMdPath);
      if (content === null) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'Missing SKILL.md',
          detail: {
            expected: 'SKILL.md file in skill directory',
            found: 'File not found or unreadable'
          }
        });
        continue;
      }

      // ── Extract and validate frontmatter ──
      const { frontmatter, body } = extractFrontmatter(content);
      if (frontmatter === null) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'No frontmatter found in SKILL.md',
          detail: {
            expected: 'Valid YAML frontmatter block',
            found: 'No parseable frontmatter'
          }
        });
        continue;
      }

      // Check name field
      if (!frontmatter.name || (typeof frontmatter.name === 'string' && frontmatter.name.trim() === '')) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'Missing required field: name',
          detail: {
            expected: 'Non-empty string for "name"',
            found: frontmatter.name === undefined ? 'undefined' : `"${frontmatter.name}"`
          }
        });
        hasFails = true;
      }

      // Check description field
      if (!frontmatter.description || (typeof frontmatter.description === 'string' && frontmatter.description.trim() === '')) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'Missing required field: description',
          detail: {
            expected: 'Non-empty string for "description"',
            found: frontmatter.description === undefined ? 'undefined' : `"${frontmatter.description}"`
          }
        });
        hasFails = true;
      }

      // Check name-folder match
      if (frontmatter.name && typeof frontmatter.name === 'string' && frontmatter.name.trim() !== '' && frontmatter.name !== dirName) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'Skill name does not match folder name',
          detail: {
            expected: dirName,
            found: frontmatter.name
          }
        });
        hasFails = true;
      }

      // Check description length
      if (frontmatter.description && typeof frontmatter.description === 'string' && frontmatter.description.trim() !== '') {
        const descLen = frontmatter.description.length;
        if (descLen < 50 || descLen > 200) {
          results.push({
            category: CATEGORY,
            name: dirName,
            status: 'warn',
            message: 'Description length outside recommended range (50-200 chars)',
            detail: {
              expected: '50-200 characters',
              found: `${descLen} characters`
            }
          });
        }
      }

      // ── Check templates/ subdirectory ──
      const templatesPath = path.join(skillsDir, dirName, 'templates');
      const hasTemplates = isDirectory(templatesPath);

      if (!TEMPLATES_EXEMPT.includes(dirName) && !hasTemplates) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'fail',
          message: 'Missing templates/ subdirectory',
          detail: {
            expected: 'templates/ directory in skill folder',
            found: 'Directory not found'
          }
        });
        hasFails = true;
      }

      // ── Resolve template links ──
      const templateLinks = parseTemplateLinks(body);

      for (const linkTarget of templateLinks) {
        const resolvedPath = path.join(skillsDir, dirName, linkTarget);
        if (!exists(resolvedPath)) {
          results.push({
            category: CATEGORY,
            name: dirName,
            status: 'fail',
            message: 'Broken template link',
            detail: {
              expected: 'file exists',
              found: linkTarget
            }
          });
          hasFails = true;
        }
      }

      // ── Build SkillInfo and push pass result ──
      const skillInfo = {
        folderName: dirName,
        frontmatter,
        hasTemplates,
        templateLinks
      };
      context.skills.set(dirName, skillInfo);

      if (!hasFails) {
        results.push({
          category: CATEGORY,
          name: dirName,
          status: 'pass',
          message: 'Valid skill'
        });
      }
    }

    return results;
  } catch (err) {
    return [
      {
        category: CATEGORY,
        name: 'skill-check-error',
        status: 'fail',
        message: err.message,
        detail: {
          expected: 'No errors during skill check',
          found: err.message,
        },
      }
    ];
  }
}

module.exports = checkSkills;

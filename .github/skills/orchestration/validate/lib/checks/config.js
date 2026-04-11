'use strict';

const path = require('path');
const { readFile } = require('../utils/fs-helpers');
const { parseYaml } = require('../utils/yaml-parser');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY = 'config';

const REQUIRED_SECTIONS = ['version', 'projects', 'limits', 'human_gates'];

const REQUIRED_LIMIT_FIELDS = ['max_phases', 'max_tasks_per_phase', 'max_retries_per_task', 'max_consecutive_review_rejections'];

const ENUM_RULES = {
  'projects.naming': ['SCREAMING_CASE', 'lowercase', 'numbered'],
  'human_gates.execution_mode': ['ask', 'phase', 'task', 'autonomous']
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a dotted key path against a config object.
 * @param {object} config
 * @param {string} dottedKey - e.g. 'projects.naming'
 * @returns {{ parent: object|null, value: any }}
 */
function resolveDottedKey(config, dottedKey) {
  const parts = dottedKey.split('.');
  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object') {
      return { parent: null, value: undefined };
    }
    current = current[parts[i]];
  }
  if (current == null || typeof current !== 'object') {
    return { parent: null, value: undefined };
  }
  return { parent: current, value: current[parts[parts.length - 1]] };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate orchestration.yml configuration.
 * @param {string} basePath - Absolute path to workspace root
 * @param {object} context  - Shared DiscoveryContext
 * @param {object|null} _config - Parsed config (passed by entry point, unused — checkConfig reads its own copy)
 * @param {string} [orchRoot='.github'] - Orchestration root folder name
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
module.exports = async function checkConfig(basePath, context, _config, orchRoot) {
  const root = orchRoot || '.github';
  try {
    const results = [];
    const configPath = path.join(basePath, root, 'skills', 'orchestration', 'config', 'orchestration.yml');

    // ── Read file ──────────────────────────────────────────────────────
    const content = readFile(configPath);
    if (content === null) {
      context.config = null;
      return [{
        category: CATEGORY,
        name: 'orchestration.yml',
        status: 'fail',
        message: 'Could not read orchestration.yml',
        detail: {
          expected: 'Readable orchestration.yml file',
          found: 'File could not be read'
        }
      }];
    }

    // ── Parse YAML ─────────────────────────────────────────────────────
    const config = parseYaml(content);
    if (config === null) {
      context.config = null;
      return [{
        category: CATEGORY,
        name: 'orchestration.yml',
        status: 'fail',
        message: 'Failed to parse orchestration.yml',
        detail: {
          expected: 'Valid YAML content',
          found: 'Parse returned null'
        }
      }];
    }

    context.config = config;

    // ── Validate system.orch_root (optional section) ──────────────────────
    if (config.system && config.system.orch_root !== undefined) {
      const sysRoot = config.system.orch_root;
      if (typeof sysRoot !== 'string' || sysRoot.trim() === '') {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml — system.orch_root',
          status: 'fail',
          message: 'system.orch_root must be a non-empty string',
          detail: {
            expected: 'Non-empty string (e.g. ".github", ".agents", or absolute path)',
            found: String(sysRoot)
          }
        });
      } else if (!path.isAbsolute(sysRoot) && (sysRoot.includes('/') || sysRoot.includes('\\'))) {
        // Path separator check applies ONLY to relative paths.
        // Absolute paths like /shared/orch or C:\orch naturally contain separators.
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml — system.orch_root',
          status: 'fail',
          message: 'system.orch_root must be a single folder name (relative) or an absolute path',
          detail: {
            expected: 'Single folder name (no separators) or absolute path',
            found: sysRoot
          }
        });
      } else {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'pass',
          message: 'Valid system.orch_root'
        });
      }
    }

    // ── Validate required sections (FR-9) ──────────────────────────────
    for (const section of REQUIRED_SECTIONS) {
      if (config[section] === undefined || config[section] === null) {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'fail',
          message: `Missing required section: ${section}`,
          detail: {
            expected: `Section '${section}' present`,
            found: 'Section missing'
          }
        });
      }
    }

    // ── Validate version (FR-10) ───────────────────────────────────────
    if (config.version === '1.0') {
      results.push({
        category: CATEGORY,
        name: 'orchestration.yml',
        status: 'pass',
        message: 'Valid version'
      });
    } else {
      results.push({
        category: CATEGORY,
        name: 'orchestration.yml',
        status: 'fail',
        message: 'Invalid version',
        detail: {
          expected: '1.0',
          found: String(config.version)
        }
      });
    }

    // ── Validate enum fields (FR-10) ───────────────────────────────────
    for (const [key, allowed] of Object.entries(ENUM_RULES)) {
      const { parent, value } = resolveDottedKey(config, key);

      // If parent section is missing, skip (already caught above)
      if (parent === null) continue;

      if (allowed.includes(value)) {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'pass',
          message: `Valid ${key}`
        });
      } else {
        results.push({
          category: CATEGORY,
          name: `orchestration.yml — ${key}`,
          status: 'fail',
          message: `Invalid value for ${key}`,
          detail: {
            expected: `One of: ${allowed.join(', ')}`,
            found: String(value)
          }
        });
      }
    }

    // ── Validate limit fields (FR-10) ──────────────────────────────────
    if (config.limits) {
      for (const field of REQUIRED_LIMIT_FIELDS) {
        const value = config.limits[field];

        if (value === undefined || value === null) {
          results.push({
            category: CATEGORY,
            name: 'orchestration.yml',
            status: 'fail',
            message: `Missing required limit: ${field}`,
            detail: {
              expected: 'Positive integer',
              found: 'undefined'
            }
          });
        } else if (!Number.isInteger(value) || value <= 0) {
          results.push({
            category: CATEGORY,
            name: 'orchestration.yml',
            status: 'fail',
            message: `Invalid limit value: ${field}`,
            detail: {
              expected: 'Positive integer',
              found: String(value)
            }
          });
        } else {
          results.push({
            category: CATEGORY,
            name: 'orchestration.yml',
            status: 'pass',
            message: `Valid limit: ${field}`
          });
        }
      }
    }

    // ── Enforce human gate hard gates (FR-12) ──────────────────────────
    if (config.human_gates) {
      if (config.human_gates.after_planning !== true) {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'fail',
          message: 'Human gate violation: after_planning must be true',
          detail: {
            expected: 'true',
            found: String(config.human_gates.after_planning)
          }
        });
      }

      if (config.human_gates.after_final_review !== true) {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'fail',
          message: 'Human gate violation: after_final_review must be true',
          detail: {
            expected: 'true',
            found: String(config.human_gates.after_final_review)
          }
        });
      }

      if (config.human_gates.after_planning === true && config.human_gates.after_final_review === true) {
        results.push({
          category: CATEGORY,
          name: 'orchestration.yml',
          status: 'pass',
          message: 'Human gate hard gates enforced'
        });
      }
    }

    return results;

  } catch (err) {
    context.config = null;
    return [{
      category: CATEGORY,
      name: 'orchestration.yml',
      status: 'fail',
      message: `Unexpected error: ${err.message}`,
      detail: {
        expected: 'No errors',
        found: err.message
      }
    }];
  }
};

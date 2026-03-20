'use strict';

const path = require('path');
const { exists } = require('../utils/fs-helpers');

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY = 'cross-references';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate that every agent referenced in the Orchestrator's agents[] array
 * corresponds to a real agent discovered in context.agents.
 * @param {Map<string, object>} agents
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function checkOrchestratorAgentRefs(agents) {
  const results = [];

  // Find the Orchestrator agent
  let orchestrator = null;
  let orchestratorFilename = null;
  for (const [filename, info] of agents) {
    if (info.frontmatter && info.frontmatter.name === 'Orchestrator') {
      orchestrator = info;
      orchestratorFilename = filename;
      break;
    }
  }

  if (!orchestrator) {
    results.push({
      category: CATEGORY,
      name: 'orchestrator',
      status: 'warn',
      message: 'No Orchestrator agent found — cannot validate agent references',
    });
    return results;
  }

  const agentRefs = Array.isArray(orchestrator.agents) ? orchestrator.agents : [];

  for (const refName of agentRefs) {
    // Search context.agents for any agent whose frontmatter.name matches
    let found = false;
    for (const [, info] of agents) {
      if (info.frontmatter && info.frontmatter.name === refName) {
        found = true;
        break;
      }
    }

    if (found) {
      results.push({
        category: CATEGORY,
        name: orchestratorFilename,
        status: 'pass',
        message: `Orchestrator → ${refName} reference valid`,
      });
    } else {
      const knownNames = [];
      for (const [, info] of agents) {
        if (info.frontmatter && info.frontmatter.name) {
          knownNames.push(info.frontmatter.name);
        }
      }
      results.push({
        category: CATEGORY,
        name: orchestratorFilename,
        status: 'fail',
        message: `Orchestrator references unknown agent: ${refName}`,
        detail: {
          expected: `A name from discovered agents: ${knownNames.join(', ')}`,
          found: refName,
        },
      });
    }
  }

  return results;
}

/**
 * Validate that every skill referenced in an agent's referencedSkills[] array
 * exists as a key in context.skills.
 * @param {Map<string, object>} agents
 * @param {Map<string, object>} skills
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function checkAgentSkillRefs(agents, skills) {
  const results = [];

  for (const [filename, info] of agents) {
    const refs = Array.isArray(info.referencedSkills) ? info.referencedSkills : [];
    for (const skillName of refs) {
      if (skills.has(skillName)) {
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'pass',
          message: `${filename} → skill "${skillName}" reference valid`,
        });
      } else {
        const validNames = Array.from(skills.keys());
        results.push({
          category: CATEGORY,
          name: filename,
          status: 'fail',
          message: `${filename} references unknown skill: "${skillName}"`,
          detail: {
            expected: `A valid skill name from: ${validNames.join(', ')}`,
            found: skillName,
          },
        });
      }
    }
  }

  return results;
}

/**
 * Validate that the config projects.base_path resolves to an existing directory.
 * @param {string} basePath
 * @param {object|null} config
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function checkConfigPaths(basePath, config) {
  const results = [];

  if (config == null) {
    return results;
  }

  const configBasePath = config.projects && config.projects.base_path;
  if (!configBasePath) {
    return results;
  }

  const resolvedConfigPath = path.resolve(basePath, configBasePath);
  if (exists(resolvedConfigPath)) {
    results.push({
      category: CATEGORY,
      name: 'orchestration.yml',
      status: 'pass',
      message: 'Config projects.base_path resolves to existing path',
    });
  } else {
    results.push({
      category: CATEGORY,
      name: 'orchestration.yml',
      status: 'warn',
      message: 'Config projects.base_path does not resolve to existing directory',
      detail: {
        expected: 'Existing directory',
        found: resolvedConfigPath,
      },
    });
  }

  return results;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate cross-references between orchestration files.
 * Reads from the shared DiscoveryContext (does NOT write to it).
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Shared DiscoveryContext (read-only for this module)
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
module.exports = async function checkCrossRefs(basePath, context, _config, orchRoot) {
  try {
    const root = orchRoot || '.github';
    const results = [];

    // Gracefully handle null/empty context sections (do NOT mutate context)
    const agents = (context.agents instanceof Map) ? context.agents : new Map();
    const skills = (context.skills instanceof Map) ? context.skills : new Map();
    const config = context.config;

    // 1. Orchestrator → agent references
    results.push(...checkOrchestratorAgentRefs(agents));

    // 2. Agent → skill references
    results.push(...checkAgentSkillRefs(agents, skills));

    // 3. Config path validation
    results.push(...checkConfigPaths(basePath, config));

    return results;
  } catch (err) {
    return [{
      category: CATEGORY,
      name: 'cross-refs',
      status: 'fail',
      message: `Unexpected error during cross-reference checks: ${err.message}`,
      detail: {
        expected: 'No errors',
        found: err.message,
      },
    }];
  }
};

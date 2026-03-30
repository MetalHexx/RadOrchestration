'use strict';

const path = require('path');
const { listFiles, readFile } = require('../utils/fs-helpers');
const { extractFrontmatter } = require('../utils/frontmatter');
const { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS } = require('../utils/constants');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse referenced skill names from the ## Skills section of the agent body.
 * Matches lines like: - **`skill-name`**: description
 * @param {string} body
 * @returns {string[]}
 */
function parseReferencedSkills(body) {
  const skills = [];
  if (!body || typeof body !== 'string') return skills;

  // Find the ## Skills section
  const skillsSectionMatch = body.match(/^## Skills\b/m);
  if (!skillsSectionMatch) return skills;

  const sectionStart = skillsSectionMatch.index + skillsSectionMatch[0].length;
  const rest = body.slice(sectionStart);

  // Stop at the next ## heading or end of body
  const nextSection = rest.match(/^## /m);
  const section = nextSection ? rest.slice(0, nextSection.index) : rest;

  // Match **`skill-name`** patterns
  const pattern = /\*\*`([^`]+)`\*\*/g;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    skills.push(match[1]);
  }

  return skills;
}

/**
 * Validate tool entries for an agent.
 * @param {string[]} tools
 * @param {string} filename
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function validateTools(tools, filename) {
  const results = [];

  for (const entry of tools) {
    if (DEPRECATED_TOOLS.includes(entry)) {
      results.push({
        category: 'agents',
        name: filename,
        status: 'warn',
        message: `Deprecated tool: "${entry}"`,
        detail: {
          expected: 'a current tool name',
          found: entry,
          context: `Deprecated tools list: ${DEPRECATED_TOOLS.join(', ')}`
        }
      });
    } else if (!VALID_TOOLSETS.includes(entry) && !VALID_NAMESPACED_TOOLS.includes(entry)) {
      results.push({
        category: 'agents',
        name: filename,
        status: 'fail',
        message: `Invalid tool: "${entry}"`,
        detail: {
          expected: 'a valid toolset or namespaced tool',
          found: entry,
          context: `Valid toolsets: ${VALID_TOOLSETS.join(', ')}`
        }
      });
    }
  }

  return results;
}

/**
 * Validate the agents array for an agent.
 * @param {string[]} agents
 * @param {string[]} tools
 * @param {string} agentName
 * @param {string} filename
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function validateAgentsArray(agents, tools, agentName, filename) {
  const results = [];

  if (agents.length > 0 && !tools.includes('agent')) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Non-empty agents array requires "agent" in tools',
      detail: {
        expected: '"agent" toolset in tools array',
        found: `tools: [${tools.join(', ')}]`,
        context: 'Agents array is non-empty but "agent" toolset is missing from tools'
      }
    });
  }

  if (agents.length > 0 && agentName.toLowerCase() !== 'orchestrator') {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Only the orchestrator may have a non-empty agents array',
      detail: {
        expected: 'Empty agents array for non-orchestrator agents',
        found: `Agent "${agentName}" has agents: [${agents.join(', ')}]`,
        context: 'Only the orchestrator agent may reference other agents'
      }
    });
  }

  return results;
}

/**
 * Validate a single agent file.
 * @param {string} filePath - Full path to the agent file
 * @param {string} filename - Just the filename
 * @param {object} context  - Shared discovery context
 * @returns {Array<{category: string, name: string, status: string, message: string, detail?: object}>}
 */
function validateAgent(filePath, filename, context) {
  const results = [];

  // Read file content
  const content = readFile(filePath);
  if (content === null) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Could not read file',
      detail: {
        expected: 'Readable agent file',
        found: 'File could not be read'
      }
    });
    return results;
  }

  // Extract frontmatter
  const { frontmatter, body } = extractFrontmatter(content);
  if (frontmatter === null) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'No valid frontmatter found',
      detail: {
        expected: 'Valid YAML frontmatter block',
        found: 'No parseable frontmatter'
      }
    });
    return results;
  }

  let hasRequiredFieldErrors = false;

  // Validate required field: name
  if (!frontmatter.name || (typeof frontmatter.name === 'string' && frontmatter.name.trim() === '')) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Missing or empty required field: name',
      detail: {
        expected: 'Non-empty string for "name"',
        found: frontmatter.name === undefined ? 'undefined' : `"${frontmatter.name}"`
      }
    });
    hasRequiredFieldErrors = true;
  }

  // Validate required field: description
  if (!frontmatter.description || (typeof frontmatter.description === 'string' && frontmatter.description.trim() === '')) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Missing or empty required field: description',
      detail: {
        expected: 'Non-empty string for "description"',
        found: frontmatter.description === undefined ? 'undefined' : `"${frontmatter.description}"`
      }
    });
    hasRequiredFieldErrors = true;
  }

  // Validate required field: tools
  let tools = frontmatter.tools;
  if (tools === undefined || tools === null) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Missing or empty required field: tools',
      detail: {
        expected: 'Array with at least one tool entry',
        found: 'undefined'
      }
    });
    hasRequiredFieldErrors = true;
    tools = [];
  } else if (typeof tools === 'string') {
    tools = [tools];
  } else if (!Array.isArray(tools)) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Invalid tools field: expected an array',
      detail: {
        expected: 'Array of tool names',
        found: typeof tools
      }
    });
    hasRequiredFieldErrors = true;
    tools = [];
  } else if (tools.length === 0) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'fail',
      message: 'Missing or empty required field: tools',
      detail: {
        expected: 'Array with at least one tool entry',
        found: 'Empty array'
      }
    });
    hasRequiredFieldErrors = true;
  }

  // agents field is optional; treat missing or null as empty array
  let agents = frontmatter.agents;
  if (agents === undefined || agents === null) {
    agents = [];
  } else if (typeof agents === 'string') {
    agents = [agents];
  } else if (!Array.isArray(agents)) {
    agents = [];
  }

  // Validate tool entries
  const toolResults = validateTools(tools, filename);
  results.push(...toolResults);

  // Validate agents array consistency
  const agentName = frontmatter.name || '';
  const agentsArrayResults = validateAgentsArray(agents, tools, agentName, filename);
  results.push(...agentsArrayResults);

  // Parse referenced skills from body
  const referencedSkills = parseReferencedSkills(body);

  // Populate context.agents
  context.agents.set(filename, {
    filename,
    frontmatter,
    tools,
    agents,
    referencedSkills
  });

  // If all required fields are valid and no required-field errors, push a pass result
  if (!hasRequiredFieldErrors) {
    results.push({
      category: 'agents',
      name: filename,
      status: 'pass',
      message: `Agent "${frontmatter.name}" is valid`
    });
  }

  return results;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validate all .agent.md files in .github/agents/.
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @returns {Promise<Array<{category: string, name: string, status: string, message: string, detail?: object}>>}
 */
async function checkAgents(basePath, context, _config, orchRoot) {
  try {
    const root = orchRoot || '.github';
    const results = [];
    const agentsDir = path.join(basePath, root, 'agents');

    // Discover agent files
    const agentFiles = listFiles(agentsDir, '.agent.md');

    // Initialize context.agents
    context.agents = new Map();

    if (agentFiles.length === 0) {
      return results;
    }

    for (const filename of agentFiles) {
      const filePath = path.join(agentsDir, filename);
      const agentResults = validateAgent(filePath, filename, context);
      results.push(...agentResults);
    }

    return results;
  } catch (err) {
    return [
      {
        category: 'agents',
        name: 'agent-check-error',
        status: 'fail',
        message: err.message,
        detail: {
          expected: 'No errors during agent check',
          found: err.message,
        },
      }
    ];
  }
}

module.exports = checkAgents;

'use strict';

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('../validate/lib/utils/yaml-parser');
const { DAG_NODE_TYPES, NEXT_ACTIONS } = require('./constants');

// Pre-compute valid sets for validation lookups
const VALID_NODE_TYPES = new Set(Object.values(DAG_NODE_TYPES));
const VALID_ACTIONS = new Set(Object.values(NEXT_ACTIONS));

/**
 * Load a pipeline template by name. Searches built-in templates first,
 * then user-custom templates.
 *
 * Built-in: {orchRoot}/skills/orchestration/templates/{name}.yml
 * Custom:   {orchRoot}/templates/{name}.yml
 *
 * @param {string} templateName - template name (e.g., 'full', 'quick')
 * @param {string} orchRoot - absolute path to orchestration root (e.g., '.github')
 * @returns {{ template: Object | null, error: string | null }}
 */
function loadTemplate(templateName, orchRoot) {
  const builtinPath = path.join(orchRoot, 'skills', 'orchestration', 'templates', templateName + '.yml');
  const customPath = path.join(orchRoot, 'templates', templateName + '.yml');

  let resolvedPath = null;
  if (fs.existsSync(builtinPath)) {
    resolvedPath = builtinPath;
  } else if (fs.existsSync(customPath)) {
    resolvedPath = customPath;
  }

  if (!resolvedPath) {
    return {
      template: null,
      error: `Template "${templateName}" not found. Searched:\n  - ${builtinPath}\n  - ${customPath}`
    };
  }

  const yamlContent = fs.readFileSync(resolvedPath, 'utf-8');
  const parsed = parseYaml(yamlContent);

  if (parsed === null) {
    return {
      template: null,
      error: `Failed to parse template "${templateName}": invalid YAML`
    };
  }

  // Post-parse shape assertions — catch malformed parser output early
  if (Array.isArray(parsed.nodes)) {
    const shapeError = validateNodeShapes(parsed.nodes, templateName);
    if (shapeError) {
      return { template: null, error: shapeError };
    }
  }

  return { template: parsed, error: null };
}

/**
 * Validate a template's structural and graph integrity:
 * - All required fields present per node type
 * - All depends_on references resolve to existing node IDs
 * - No cycles in the dependency graph (Kahn's algorithm)
 * - All node types are known (DAG_NODE_TYPES values)
 * - All action values are known (NEXT_ACTIONS values)
 * - Container nodes (for_each_*, conditional, parallel) have valid body/branches
 *
 * Error strings always include the specific node ID and field name.
 *
 * @param {Object} template - parsed template object
 * @returns {string[]} errors - empty array if valid
 */
function validateTemplate(template) {
  const errors = [];

  // ── Top-level required fields ───────────────────────────────────────────
  if (!template.name || typeof template.name !== 'string') {
    errors.push('Missing required field: name');
  }

  if (!template.nodes) {
    errors.push('Missing required field: nodes');
    return errors; // Can't continue without nodes
  }

  if (!Array.isArray(template.nodes) || template.nodes.length === 0) {
    errors.push('Field "nodes" must be a non-empty array');
    return errors;
  }

  // ── Validate top-level nodes ────────────────────────────────────────────
  const topLevelIds = new Set();
  validateNodeList(template.nodes, topLevelIds, errors, null);

  // ── Dependency reference validation (top-level) ─────────────────────────
  validateDependencyRefs(template.nodes, topLevelIds, errors, null);

  // ── Cycle detection (top-level, Kahn's algorithm) ───────────────────────
  detectCycles(template.nodes, errors);

  return errors;
}

/**
 * Validate a list of nodes, collecting IDs and checking fields.
 * @param {Array} nodes - array of node objects
 * @param {Set} idSet - set to collect node IDs into
 * @param {string[]} errors - error accumulator
 * @param {string|null} parentId - parent node ID for body context, null for top-level
 */
function validateNodeList(nodes, idSet, errors, parentId) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const prefix = parentId ? `Node "${parentId}" > body node` : 'Node';

    // ── Required: id ──────────────────────────────────────────────────────
    if (!node.id || typeof node.id !== 'string') {
      if (parentId) {
        errors.push(`${prefix} at index ${i}: missing required field "id"`);
      } else {
        errors.push(`Node at index ${i}: missing required field "id"`);
      }
      continue; // Can't validate further without an ID
    }

    const nodeId = node.id;
    const nodePrefix = parentId ? `Node "${parentId}" > body node "${nodeId}"` : `Node "${nodeId}"`;

    // ── Duplicate ID check ────────────────────────────────────────────────
    if (idSet.has(nodeId)) {
      errors.push(`Duplicate node ID: "${nodeId}"`);
    } else {
      idSet.add(nodeId);
    }

    // ── Required: type ────────────────────────────────────────────────────
    if (!node.type || typeof node.type !== 'string') {
      errors.push(`${nodePrefix}: missing required field "type"`);
      continue;
    }

    // ── Type must be valid ────────────────────────────────────────────────
    if (!VALID_NODE_TYPES.has(node.type)) {
      errors.push(`${nodePrefix}: unknown type "${node.type}". Valid types: step, gate, for_each_phase, for_each_task, conditional, parallel`);
      continue;
    }

    // ── Type-specific validation ──────────────────────────────────────────
    validateNodeByType(node, nodePrefix, errors, parentId);
  }
}

/**
 * Validate type-specific required fields for a node.
 * @param {Object} node - node object
 * @param {string} prefix - error message prefix (includes node ID)
 * @param {string[]} errors - error accumulator
 * @param {string|null} parentId - parent node ID for body context
 */
function validateNodeByType(node, prefix, errors, parentId) {
  switch (node.type) {
    case 'step':
      if (!node.action || typeof node.action !== 'string') {
        errors.push(`${prefix}: step node missing required field "action"`);
      } else if (!VALID_ACTIONS.has(node.action)) {
        errors.push(`${prefix}: unknown action "${node.action}". Must be a valid NEXT_ACTIONS value`);
      }
      if (!(node.events && typeof node.events === 'object'
          && node.events.completed && typeof node.events.completed === 'string')) {
        errors.push(`${prefix}: step node missing required field "events.completed"`);
      }
      break;

    case 'gate':
      if (!node.gate_type || typeof node.gate_type !== 'string') {
        errors.push(`${prefix}: gate node missing required field "gate_type"`);
      }
      if (!node.gate_action || typeof node.gate_action !== 'string') {
        errors.push(`${prefix}: gate node missing required field "gate_action"`);
      }
      break;

    case 'for_each_phase':
      if (!Array.isArray(node.body) || node.body.length === 0) {
        errors.push(`${prefix}: for_each_phase node missing required field "body"`);
      } else {
        const bodyIds = new Set();
        validateNodeList(node.body, bodyIds, errors, node.id);
        validateDependencyRefs(node.body, bodyIds, errors, node.id);
      }
      break;

    case 'for_each_task':
      if (!Array.isArray(node.body) || node.body.length === 0) {
        errors.push(`${prefix}: for_each_task node missing required field "body"`);
      } else {
        const bodyIds = new Set();
        validateNodeList(node.body, bodyIds, errors, node.id);
        validateDependencyRefs(node.body, bodyIds, errors, node.id);
      }
      break;

    case 'conditional':
      if (!node.condition || typeof node.condition !== 'string') {
        errors.push(`${prefix}: conditional node missing required field "condition"`);
      }
      if (!Array.isArray(node.body) || node.body.length === 0) {
        errors.push(`${prefix}: conditional node missing required field "body"`);
      } else {
        const bodyIds = new Set();
        validateNodeList(node.body, bodyIds, errors, node.id);
        validateDependencyRefs(node.body, bodyIds, errors, node.id);
      }
      break;

    case 'parallel':
      if (!Array.isArray(node.branches) || node.branches.length === 0) {
        errors.push(`${prefix}: parallel node missing required field "branches"`);
      } else {
        for (let bi = 0; bi < node.branches.length; bi++) {
          const branch = node.branches[bi];
          if (!Array.isArray(branch) || branch.length === 0) {
            errors.push(`${prefix}: branch at index ${bi} must be a non-empty array of nodes`);
            continue;
          }
          const branchIds = new Set();
          validateNodeList(branch, branchIds, errors, node.id);
          validateDependencyRefs(branch, branchIds, errors, node.id);
        }
      }
      break;
  }
}

/**
 * Validate that all depends_on references point to existing node IDs within scope.
 * @param {Array} nodes - array of node objects
 * @param {Set} validIds - set of valid node IDs in this scope
 * @param {string[]} errors - error accumulator
 * @param {string|null} parentId - parent node ID for body context
 */
function validateDependencyRefs(nodes, validIds, errors, parentId) {
  for (const node of nodes) {
    if (!node.id || !node.depends_on) continue;
    const deps = Array.isArray(node.depends_on) ? node.depends_on : [node.depends_on];
    const prefix = parentId ? `Node "${parentId}" > body node "${node.id}"` : `Node "${node.id}"`;
    for (const depId of deps) {
      if (!validIds.has(depId)) {
        errors.push(`${prefix}: depends_on references unknown node "${depId}"`);
      }
    }
  }
}

/**
 * Detect cycles in the top-level node dependency graph using Kahn's algorithm.
 * @param {Array} nodes - array of top-level node objects
 * @param {string[]} errors - error accumulator
 */
function detectCycles(nodes, errors) {
  // Build adjacency list and in-degree map
  const nodeIds = [];
  const inDegree = new Map();
  const adjacency = new Map();

  for (const node of nodes) {
    if (!node.id) continue;
    nodeIds.push(node.id);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const node of nodes) {
    if (!node.id || !node.depends_on) continue;
    const deps = Array.isArray(node.depends_on) ? node.depends_on : [node.depends_on];
    for (const depId of deps) {
      if (adjacency.has(depId)) {
        adjacency.get(depId).push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue = [];
  for (const id of nodeIds) {
    if (inDegree.get(id) === 0) {
      queue.push(id);
    }
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    visited++;
    for (const neighbor of adjacency.get(current)) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visited < nodeIds.length) {
    const remaining = nodeIds.filter(id => inDegree.get(id) > 0);
    errors.push(`Dependency cycle detected involving nodes: ${remaining.join(', ')}`);
  }
}

/**
 * Recursively validate that parsed nodes have correct shapes for nested fields.
 * Returns the first error message found, or null if all shapes are valid.
 * @param {Array} nodes - array of node objects
 * @param {string} templateName - template name for error messages
 * @returns {string|null} error message or null
 */
function validateNodeShapes(nodes, templateName) {
  for (const node of nodes) {
    if (!node.id) continue;
    const nodeId = node.id;

    if (node.events !== undefined && typeof node.events === 'string') {
      return `Failed to parse template "${templateName}": parser produced invalid structure for node "${nodeId}" — "events" is not an object`;
    }
    if (node.depends_on !== undefined && typeof node.depends_on === 'string') {
      return `Failed to parse template "${templateName}": parser produced invalid structure for node "${nodeId}" — "depends_on" is not an array`;
    }
    const containerTypes = new Set(['for_each_phase', 'for_each_task', 'conditional']);
    if (containerTypes.has(node.type) && node.body !== undefined && typeof node.body === 'string') {
      return `Failed to parse template "${templateName}": parser produced invalid structure for node "${nodeId}" — "body" is not an array`;
    }

    // Recurse into body and branches
    if (Array.isArray(node.body)) {
      const bodyError = validateNodeShapes(node.body, templateName);
      if (bodyError) return bodyError;
    }
    if (Array.isArray(node.branches)) {
      // Parallel nodes: branches is array-of-arrays
      if (node.type === 'parallel') {
        for (const branch of node.branches) {
          if (Array.isArray(branch)) {
            const branchError = validateNodeShapes(branch, templateName);
            if (branchError) return branchError;
          }
        }
      } else {
        const branchError = validateNodeShapes(node.branches, templateName);
        if (branchError) return branchError;
      }
    }
  }
  return null;
}

/**
 * Collect all node IDs from a template's node tree (top-level + nested body/branches).
 * @param {Object[]} nodes - array of template nodes
 * @param {Set<string>} [ids] - accumulator set
 * @returns {Set<string>}
 */
function collectAllNodeIds(nodes, ids = new Set()) {
  for (const node of nodes) {
    if (node.id) ids.add(node.id);
    if (Array.isArray(node.body)) collectAllNodeIds(node.body, ids);
    if (Array.isArray(node.branches)) {
      for (const branch of node.branches) {
        if (Array.isArray(branch)) collectAllNodeIds(branch, ids);
      }
    }
  }
  return ids;
}

/**
 * Find a node by ID in a template node tree (top-level + nested body/branches).
 * @param {Object[]} nodes - array of template nodes
 * @param {string} nodeId - target node ID
 * @returns {Object|null}
 */
function findNodeById(nodes, nodeId) {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (Array.isArray(node.body)) {
      const found = findNodeById(node.body, nodeId);
      if (found) return found;
    }
    if (Array.isArray(node.branches)) {
      const found = findNodeById(node.branches, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Check each node scope for orphaned nodes after a set of nodes is disabled.
 * A node is orphaned if it is not disabled but ALL of its depends_on entries
 * are disabled (i.e. no alternative dependency path remains).
 * @param {Object[]} nodes - array of (cloned) template nodes
 * @param {Set<string>} disabledIds - node IDs disabled by the override
 * @returns {string[]} error messages
 */
function detectOrphansInScope(nodes, disabledIds) {
  const errors = [];
  for (const node of nodes) {
    if (node.enabled !== false && Array.isArray(node.depends_on) && node.depends_on.length > 0) {
      const disabledDeps = node.depends_on.filter(dep => disabledIds.has(dep));
      if (disabledDeps.length === node.depends_on.length) {
        errors.push(
          `Disabling node "${disabledDeps[0]}" would orphan downstream node "${node.id}" which has no alternative dependency path`
        );
      }
    }
    if (Array.isArray(node.body)) {
      errors.push(...detectOrphansInScope(node.body, disabledIds));
    }
    if (Array.isArray(node.branches)) {
      errors.push(...detectOrphansInScope(node.branches, disabledIds));
    }
  }
  return errors;
}

/**
 * Apply per-project overrides to a base template. Overrides can:
 * - Disable nodes by ID: { nodes: { node_id: { enabled: false } } }
 * - Set conditional flags: { flags: { flag_name: value } }
 * - Change gate mode: { nodes: { node_id: { mode: 'auto' } } }
 *
 * Validates that all override targets exist in the base template.
 * Validates that disabling nodes does not orphan downstream dependents.
 *
 * @param {Object} template - parsed base template (from loadTemplate)
 * @param {Object} overrides - per-project overrides from config.pipeline.overrides
 * @param {Object} [overrides.nodes] - per-node overrides keyed by template node ID
 * @param {boolean} [overrides.nodes.<id>.enabled] - false to disable the node
 * @param {string} [overrides.nodes.<id>.mode] - gate mode override ('auto', 'ask', etc.)
 * @param {Object} [overrides.flags] - conditional flags for conditional node evaluation
 * @returns {{ template: Object, errors: string[] }}
 */
function applyOverrides(template, overrides) {
  // Same-reference optimization for empty/null/undefined overrides
  if (overrides == null || Object.keys(overrides).length === 0) {
    return { template, errors: [] };
  }

  const errors = [];

  // Validate that all override node targets exist in the template
  if (overrides.nodes) {
    const allIds = collectAllNodeIds(template.nodes || []);
    for (const nodeId of Object.keys(overrides.nodes)) {
      if (!allIds.has(nodeId)) {
        errors.push(`Override target "${nodeId}" does not exist in template "${template.name}"`);
      }
    }
    if (errors.length > 0) {
      return { template, errors };
    }
  }

  // Deep-clone the template before mutation
  const cloned = JSON.parse(JSON.stringify(template));

  // Apply per-node overrides (enabled, mode, etc.)
  if (overrides.nodes) {
    for (const [nodeId, props] of Object.entries(overrides.nodes)) {
      const node = findNodeById(cloned.nodes, nodeId);
      if (node) {
        Object.assign(node, props);
      }
    }
  }

  // Apply flags overrides
  if (overrides.flags) {
    cloned.flags = { ...overrides.flags };
  }

  // Orphan detection: ensure no non-disabled node loses all its dependencies
  if (overrides.nodes) {
    const disabledIds = new Set(
      Object.entries(overrides.nodes)
        .filter(([, props]) => props.enabled === false)
        .map(([nodeId]) => nodeId)
    );
    if (disabledIds.size > 0) {
      const orphanErrors = detectOrphansInScope(cloned.nodes, disabledIds);
      if (orphanErrors.length > 0) {
        return { template, errors: orphanErrors };
      }
    }
  }

  return { template: cloned, errors: [] };
}

module.exports = { loadTemplate, validateTemplate, applyOverrides };

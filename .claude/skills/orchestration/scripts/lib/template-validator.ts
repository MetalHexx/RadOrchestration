import type { PipelineTemplate, ValidationResult, TemplateValidationError, NodeDef } from './types.js';
import { NODE_KINDS } from './constants.js';

const VALID_KINDS = Object.values(NODE_KINDS);

function makeError(
  subtype: TemplateValidationError['subtype'],
  templateId: string,
  message: string,
  detail: Record<string, unknown>,
): TemplateValidationError {
  return {
    type: 'template_validation_error',
    subtype,
    template_id: templateId,
    message,
    detail,
  };
}

function validateScope(
  nodes: NodeDef[],
  templateId: string,
  errors: TemplateValidationError[],
  warnings: TemplateValidationError[],
): void {
  const scopeIds = new Set(nodes.map(n => n.id));

  // 1. Invalid kind check
  for (const node of nodes) {
    if (!(VALID_KINDS as string[]).includes(node.kind)) {
      errors.push(makeError(
        'invalid_kind',
        templateId,
        `Template validation failed: invalid node kind.\n  Node '${node.id}' has kind: '${node.kind}'\n  Valid kinds: step, gate, for_each_phase, for_each_task, conditional, parallel\n  Fix: change the kind to one of the valid values above.`,
        { node_id: node.id, invalid_kind: node.kind, valid_kinds: [...VALID_KINDS] },
      ));
    }
  }

  // 2. Dangling reference check
  for (const node of nodes) {
    for (const ref of node.depends_on ?? []) {
      if (!scopeIds.has(ref)) {
        errors.push(makeError(
          'dangling_ref',
          templateId,
          `Template validation failed: dangling node reference.\n  Node '${node.id}' depends on '${ref}', which is not defined in this scope.\n  Fix: add a node with id '${ref}', or remove it from ${node.id}.depends_on.`,
          { node_id: node.id, missing_ref: ref },
        ));
      }
    }
  }

  // 3. Cycle detection via Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const node of nodes) {
    const deps = (node.depends_on ?? []).filter(dep => scopeIds.has(dep));
    inDegree.set(node.id, deps.length);
    for (const dep of deps) {
      adjacency.get(dep)!.push(node.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    processed++;
    for (const dependent of adjacency.get(nodeId)!) {
      const newDeg = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (processed < nodes.length) {
    const cycleNodes = nodes
      .filter(n => inDegree.get(n.id)! > 0)
      .map(n => n.id);
    const nodeList = cycleNodes.join(', ');
    errors.push(makeError(
      'cycle_detected',
      templateId,
      `Template validation failed: cycle detected in node dependencies.\n  Nodes in cycle: ${nodeList}\n  Fix: break the cycle by removing a depends_on reference.`,
      { cycle_nodes: cycleNodes },
    ));
  }

  // 4. Unreachable node detection
  const referencedIds = new Set<string>();
  for (const node of nodes) {
    for (const ref of node.depends_on ?? []) {
      referencedIds.add(ref);
    }
  }

  for (const node of nodes) {
    const deps = node.depends_on ?? [];
    if (deps.length > 0 && !referencedIds.has(node.id)) {
      errors.push(makeError(
        'unreachable_node',
        templateId,
        `Template validation failed: unreachable node.\n  Node '${node.id}' has no incoming depends_on references and is not a root node.\n  Fix: add '${node.id}' to another node's depends_on, or remove it from the template.`,
        { node_id: node.id },
      ));
    }
  }

  // 5. Recurse into nested scopes
  for (const node of nodes) {
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      validateScope(node.body, templateId, errors, warnings);
    } else if (node.kind === 'conditional') {
      validateScope(node.branches.true, templateId, errors, warnings);
      validateScope(node.branches.false, templateId, errors, warnings);
    } else if (node.kind === 'parallel') {
      validateScope(node.children, templateId, errors, warnings);
    }
  }
}

/**
 * Validates a parsed template for structural correctness.
 * Checks: cycles (Kahn's algorithm), dangling refs, invalid kinds, unreachable nodes.
 * Returns a ValidationResult — valid is true only when errors is empty.
 */
export function validateTemplate(
  template: PipelineTemplate,
  templateId: string,
): ValidationResult {
  // Deprecated templates skip validation — their action/event references may
  // point at removed handlers, but they're kept on disk for legacy state.json
  // rendering only (never dispatched for new projects).
  if (template.template.status === 'deprecated') {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors: TemplateValidationError[] = [];
  const warnings: TemplateValidationError[] = [];

  // id_mismatch check (warning only)
  if (template.template.id !== templateId) {
    warnings.push(makeError(
      'id_mismatch',
      templateId,
      `Template validation warning: template id mismatch.\n  Expected: '${templateId}', found: '${template.template.id}'\n  This is a warning — the template will still load.`,
      { expected_id: templateId, actual_id: template.template.id },
    ));
  }

  validateScope(template.nodes, templateId, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

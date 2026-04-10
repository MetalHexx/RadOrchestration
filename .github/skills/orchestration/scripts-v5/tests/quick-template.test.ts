import { describe, it, expect } from 'vitest';
import { loadTemplate } from '../lib/template-loader.js';
import { NEXT_ACTIONS } from '../lib/constants.js';
import type { NodeDef } from '../lib/types.js';

const QUICK_YML_PATH = new URL('../templates/quick.yml', import.meta.url)
  .pathname.replace(/^\/([A-Za-z]:)/, '$1');

const FULL_YML_PATH = new URL('../templates/full.yml', import.meta.url)
  .pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Recursively collect all node IDs from a NodeDef array. */
function collectIds(nodes: NodeDef[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if ('body' in node && Array.isArray(node.body)) {
      ids.push(...collectIds(node.body as NodeDef[]));
    }
    if ('branches' in node && node.branches) {
      const branches = node.branches as { true?: NodeDef[]; false?: NodeDef[] };
      if (Array.isArray(branches.true)) ids.push(...collectIds(branches.true));
      if (Array.isArray(branches.false)) ids.push(...collectIds(branches.false));
    }
    if ('children' in node && Array.isArray(node.children)) {
      ids.push(...collectIds(node.children as NodeDef[]));
    }
  }
  return ids;
}

/** Recursively collect all action / action_if_needed values from a NodeDef array. */
function collectActions(nodes: NodeDef[]): string[] {
  const actions: string[] = [];
  for (const node of nodes) {
    if ('action' in node && typeof node.action === 'string') {
      actions.push(node.action);
    }
    if ('action_if_needed' in node && typeof node.action_if_needed === 'string') {
      actions.push(node.action_if_needed);
    }
    if ('body' in node && Array.isArray(node.body)) {
      actions.push(...collectActions(node.body as NodeDef[]));
    }
    if ('branches' in node && node.branches) {
      const branches = node.branches as { true?: NodeDef[]; false?: NodeDef[] };
      if (Array.isArray(branches.true)) actions.push(...collectActions(branches.true));
      if (Array.isArray(branches.false)) actions.push(...collectActions(branches.false));
    }
    if ('children' in node && Array.isArray(node.children)) {
      actions.push(...collectActions(node.children as NodeDef[]));
    }
  }
  return actions;
}

/** Recursively find a node by ID in a NodeDef array. */
function findNode(nodes: NodeDef[], id: string): NodeDef | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if ('body' in node && Array.isArray(node.body)) {
      const found = findNode(node.body as NodeDef[], id);
      if (found) return found;
    }
    if ('branches' in node && node.branches) {
      const branches = node.branches as { true?: NodeDef[]; false?: NodeDef[] };
      if (Array.isArray(branches.true)) {
        const found = findNode(branches.true, id);
        if (found) return found;
      }
      if (Array.isArray(branches.false)) {
        const found = findNode(branches.false, id);
        if (found) return found;
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      const found = findNode(node.children as NodeDef[], id);
      if (found) return found;
    }
  }
  return undefined;
}

describe('quick template', () => {
  it('loads through loadTemplate() without errors', () => {
    expect(() => loadTemplate(QUICK_YML_PATH)).not.toThrow();
  });

  it('header fields are correct', () => {
    const result = loadTemplate(QUICK_YML_PATH);
    expect(result.template.template.id).toBe('quick');
    expect(result.template.template.version).toBe('1.0.0');
    expect(result.template.template.description).toBeTruthy();
  });

  it('omits exactly prd, design, phase_report, phase_review', () => {
    const quickResult = loadTemplate(QUICK_YML_PATH);
    const fullResult = loadTemplate(FULL_YML_PATH);

    const quickIds = new Set(collectIds(quickResult.template.nodes));
    const fullIds = new Set(collectIds(fullResult.template.nodes));

    const omittedInQuick = ['prd', 'design', 'phase_report', 'phase_review'];

    // Each omitted ID is absent from quick
    for (const id of omittedInQuick) {
      expect(quickIds.has(id), `"${id}" should be absent from quick template`).toBe(false);
    }

    // The set difference is exactly the 4 omitted IDs
    const diff = [...fullIds].filter(id => !quickIds.has(id)).sort();
    expect(diff).toEqual([...omittedInQuick].sort());
  });

  it('all actions are in NEXT_ACTIONS', () => {
    const result = loadTemplate(QUICK_YML_PATH);
    const actions = collectActions(result.template.nodes);
    const validActions = new Set(Object.values(NEXT_ACTIONS));

    for (const action of actions) {
      expect(
        validActions.has(action as (typeof NEXT_ACTIONS)[keyof typeof NEXT_ACTIONS]),
        `action "${action}" is not in NEXT_ACTIONS`
      ).toBe(true);
    }
  });

  it('architecture depends_on is [research]', () => {
    const result = loadTemplate(QUICK_YML_PATH);
    const architecture = findNode(result.template.nodes, 'architecture');
    expect(architecture).toBeDefined();
    expect(architecture!.depends_on).toEqual(['research']);
  });

  it('phase_gate depends_on is [task_loop]', () => {
    const result = loadTemplate(QUICK_YML_PATH);
    const phaseGate = findNode(result.template.nodes, 'phase_gate');
    expect(phaseGate).toBeDefined();
    expect(phaseGate!.depends_on).toEqual(['task_loop']);
  });
});

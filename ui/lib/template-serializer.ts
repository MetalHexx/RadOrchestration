import { parseYaml, stringifyYaml } from '@/lib/yaml-parser';
import type {
  TemplateDefinition,
  TemplateGraph,
  TemplateGraphEdge,
  TemplateGraphNode,
  TemplateNodeKind,
  TemplateYamlNode,
} from '@/types/template';

const STRUCTURAL_FIELDS = new Set(['id', 'kind', 'label', 'depends_on', 'body', 'branches']);

function extractMeta(node: TemplateYamlNode): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    if (STRUCTURAL_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    meta[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return meta;
}

function mapKindToType(kind: TemplateNodeKind): 'templateNode' | 'templateGroup' {
  return kind === 'for_each_phase' || kind === 'for_each_task' ? 'templateGroup' : 'templateNode';
}

function walkNodes(
  yamlNodes: TemplateYamlNode[],
  parentId: string | undefined,
  nodes: TemplateGraphNode[],
  edges: TemplateGraphEdge[],
): void {
  for (const node of yamlNodes) {
    const graphNode: TemplateGraphNode = {
      id: node.id,
      type: mapKindToType(node.kind),
      position: { x: 0, y: 0 },
      data: {
        id: node.id,
        kind: node.kind,
        label: node.label,
        meta: extractMeta(node),
      },
    };
    if (parentId !== undefined) {
      graphNode.parentId = parentId;
      graphNode.extent = 'parent';
    }
    nodes.push(graphNode);

    for (const dep of node.depends_on) {
      edges.push({
        id: `e-${dep}-${node.id}`,
        source: dep,
        target: node.id,
        type: 'smoothstep',
        markerEnd: { type: 'arrowclosed' },
        animated: false,
      });
    }

    if ((node.kind === 'for_each_phase' || node.kind === 'for_each_task') && node.body) {
      walkNodes(node.body, node.id, nodes, edges);
    }

    if (node.kind === 'conditional' && node.branches) {
      const { true: trueBranch, false: falseBranch } = node.branches;

      const hasBranchChildren =
        (trueBranch && trueBranch.length > 0) ||
        (falseBranch && falseBranch.length > 0);

      if (hasBranchChildren) {
        graphNode.type = 'templateGroup';
      }

      if (trueBranch && trueBranch.length > 0) {
        walkNodes(trueBranch, node.id, nodes, edges);
        for (const child of trueBranch) {
          edges.push({
            id: `e-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' },
            label: 'true',
            animated: false,
          });
        }
      }

      if (falseBranch && falseBranch.length > 0) {
        walkNodes(falseBranch, node.id, nodes, edges);
        for (const child of falseBranch) {
          edges.push({
            id: `e-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' },
            label: 'false',
            animated: false,
          });
        }
      }
    }
  }
}

/**
 * Parse a template YAML string into ReactFlow graph state (nodes + edges).
 *
 * - Each TemplateYamlNode becomes a TemplateGraphNode.
 * - Loop nodes (for_each_phase, for_each_task) become type:'templateGroup' nodes;
 *   their body children get parentId set to the loop node's id.
 * - Conditional branches (true/false) become child nodes with parentId.
 * - depends_on arrays become directed edges (source=dependency, target=dependent).
 * - Positions are initialized to {x:0, y:0} — caller runs layout separately.
 *
 * @param yamlContent - Raw YAML string of a template file
 * @returns TemplateGraph with nodes and edges arrays
 * @throws Error if YAML is unparseable or missing required structure
 */
export function parseTemplateToGraph(yamlContent: string): TemplateGraph {
  const definition = parseYaml<TemplateDefinition>(yamlContent);

  if (!definition.nodes || !Array.isArray(definition.nodes)) {
    throw new Error('Invalid template: missing or invalid nodes array');
  }

  const nodes: TemplateGraphNode[] = [];
  const edges: TemplateGraphEdge[] = [];

  walkNodes(definition.nodes, undefined, nodes, edges);

  // Deduplicate edges by id — a conditional branch child that also has depends_on
  // targeting the conditional node produces duplicate edge IDs; keep the last
  // occurrence (the branch edge with the label).
  // Note: branch edges (labeled 'true'/'false') intentionally override any
  // explicit depends_on edge from child to parent conditional — the branch
  // edge already establishes execution order.
  const edgeMap = new Map<string, TemplateGraphEdge>();
  for (const edge of edges) {
    edgeMap.set(edge.id, edge);
  }

  return { nodes, edges: Array.from(edgeMap.values()) };
}

/**
 * Restore typed values from YAML string representation using a JSON.parse-first strategy.
 *
 * Each meta value is attempted as JSON.parse first; if parsing succeeds the parsed
 * value is used, otherwise the original string is kept.
 *
 * Known limitation: string values that happen to be valid JSON literals (e.g. "42",
 * "true") will be coerced to their parsed types (number, boolean). This is acceptable
 * for the current schema where meta string fields are non-parseable descriptive text.
 */
function restoreMeta(meta: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function buildDependsOn(nodeId: string, edges: TemplateGraphEdge[]): string[] {
  return edges
    .filter(e => e.target === nodeId && e.label === undefined)
    .map(e => e.source);
}

function buildYamlNodes(
  nodeIds: string[],
  nodeMap: Map<string, TemplateGraphNode>,
  childrenMap: Map<string, string[]>,
  edges: TemplateGraphEdge[],
): TemplateYamlNode[] {
  return nodeIds.map(nodeId => {
    const graphNode = nodeMap.get(nodeId);
    if (!graphNode) throw new Error(`serializeGraphToYaml: node not found: ${nodeId}`);
    const { id, kind, label, meta } = graphNode.data;

    const yamlNode = Object.assign(
      {
        id,
        kind,
        label,
        depends_on: buildDependsOn(nodeId, edges),
      } as TemplateYamlNode,
      restoreMeta(meta),
    );

    if (kind === 'for_each_phase' || kind === 'for_each_task') {
      const childIds = childrenMap.get(nodeId) ?? [];
      yamlNode.body = buildYamlNodes(childIds, nodeMap, childrenMap, edges);
    }

    if (kind === 'conditional') {
      const childIds = childrenMap.get(nodeId) ?? [];

      if (childIds.length > 0) {
        const trueBranchIds: string[] = [];
        const falseBranchIds: string[] = [];

        for (const childId of childIds) {
          const hasTrue = edges.some(e => e.source === nodeId && e.target === childId && e.label === 'true');
          const hasFalse = edges.some(e => e.source === nodeId && e.target === childId && e.label === 'false');
          if (hasTrue) trueBranchIds.push(childId);
          if (hasFalse) falseBranchIds.push(childId);
        }

        yamlNode.branches = {
          true: buildYamlNodes(trueBranchIds, nodeMap, childrenMap, edges),
          false: buildYamlNodes(falseBranchIds, nodeMap, childrenMap, edges),
        };
      }
    }

    return yamlNode;
  });
}

/**
 * Convert ReactFlow graph state back into a template YAML string.
 *
 * - Reconstructs TemplateYamlNode[] from flat node list using parentId relationships.
 * - Rebuilds depends_on arrays from edge list.
 * - Strips x/y positions (not persisted to YAML).
 * - Preserves all kind-specific fields stored in node.data.meta.
 *
 * @param graph - TemplateGraph with nodes and edges
 * @param templateMeta - Template-level metadata (id, version, description)
 * @returns YAML string ready to write to disk
 */
export function serializeGraphToYaml(
  graph: TemplateGraph,
  templateMeta: { id: string; version: string; description: string },
): string {
  const nodeMap = new Map<string, TemplateGraphNode>(graph.nodes.map(n => [n.id, n]));

  const childrenMap = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.parentId !== undefined) {
      const children = childrenMap.get(node.parentId) ?? [];
      children.push(node.id);
      childrenMap.set(node.parentId, children);
    }
  }

  const topLevelNodeIds = graph.nodes.filter(n => n.parentId === undefined).map(n => n.id);

  const definition = {
    template: {
      id: templateMeta.id,
      version: templateMeta.version,
      description: templateMeta.description,
    },
    nodes: buildYamlNodes(topLevelNodeIds, nodeMap, childrenMap, graph.edges),
  };

  return stringifyYaml(definition);
}

import { parseYaml } from '@/lib/yaml-parser';
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

  return { nodes, edges };
}

export function serializeGraphToYaml(): never {
  throw new Error('Not implemented — see Task T02');
}

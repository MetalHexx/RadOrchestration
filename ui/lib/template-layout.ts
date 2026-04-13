import dagre from '@dagrejs/dagre';
import type { TemplateGraphEdge, TemplateGraphNode } from '@/types/template';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const PAD_LEFT = 40;
const PAD_RIGHT = 40;
const PAD_TOP = 60;
const PAD_BOTTOM = 40;

/**
 * Compute dagre layout for template graph nodes.
 *
 * - Uses top-to-bottom (TB) rank direction.
 * - Group nodes (templateGroup) are sized to contain their children.
 * - Child nodes are positioned relative to their parent origin.
 * - Returns a new array of nodes with updated position.x and position.y.
 * - Edges are returned unchanged.
 */
export function computeTemplateLayout(
  nodes: TemplateGraphNode[],
  edges: TemplateGraphEdge[]
): { nodes: TemplateGraphNode[]; edges: TemplateGraphEdge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  // Separate top-level nodes (no parentId) from child nodes (have parentId)
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  const childNodes = nodes.filter((n) => n.parentId);
  const topLevelIds = new Set(topLevelNodes.map((n) => n.id));

  // Build and run the top-level dagre graph
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of topLevelNodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  // Read back positions from dagre for top-level nodes (center → top-left)
  const topLevelPositioned = new Map<string, { x: number; y: number }>();
  for (const node of topLevelNodes) {
    const dn = graph.node(node.id);
    topLevelPositioned.set(node.id, {
      x: dn.x - NODE_WIDTH / 2,
      y: dn.y - NODE_HEIGHT / 2,
    });
  }

  // For each group node, lay out its children and compute group dimensions
  const groupStyles = new Map<string, { width: number; height: number }>();
  const childPositioned = new Map<string, { x: number; y: number }>();

  for (const groupNode of topLevelNodes.filter((n) => n.type === 'templateGroup')) {
    const children = childNodes.filter((n) => n.parentId === groupNode.id);
    if (children.length === 0) continue;

    // Run a separate dagre layout scoped to this group's children
    const childGraph = new dagre.graphlib.Graph();
    childGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
    childGraph.setDefaultEdgeLabel(() => ({}));

    const childIds = new Set(children.map((n) => n.id));

    for (const child of children) {
      childGraph.setNode(child.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const edge of edges) {
      if (childIds.has(edge.source) && childIds.has(edge.target)) {
        childGraph.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(childGraph);

    // Read back child absolute positions in the sub-graph (center → top-left)
    const childAbsPositions = children.map((child) => {
      const dn = childGraph.node(child.id);
      return { id: child.id, x: dn.x - NODE_WIDTH / 2, y: dn.y - NODE_HEIGHT / 2 };
    });

    // Compute bounding box of children
    const minX = Math.min(...childAbsPositions.map((c) => c.x));
    const minY = Math.min(...childAbsPositions.map((c) => c.y));
    const maxX = Math.max(...childAbsPositions.map((c) => c.x + NODE_WIDTH));
    const maxY = Math.max(...childAbsPositions.map((c) => c.y + NODE_HEIGHT));

    // Size the group to contain children with padding
    groupStyles.set(groupNode.id, {
      width: maxX - minX + PAD_LEFT + PAD_RIGHT,
      height: maxY - minY + PAD_TOP + PAD_BOTTOM,
    });

    // Reposition children relative to their parent group's top-left origin
    for (const cp of childAbsPositions) {
      childPositioned.set(cp.id, {
        x: cp.x - minX + PAD_LEFT,
        y: cp.y - minY + PAD_TOP,
      });
    }
  }

  // Build output node arrays — do not mutate inputs
  const outNodes: TemplateGraphNode[] = [
    ...topLevelNodes.map((node) => {
      const pos = topLevelPositioned.get(node.id)!;
      const style = groupStyles.get(node.id);
      return {
        ...node,
        position: pos,
        ...(style !== undefined ? { style: { ...node.style, ...style } } : {}),
      };
    }),
    ...childNodes.map((node) => {
      const pos = childPositioned.get(node.id) ?? node.position;
      return { ...node, position: pos };
    }),
  ];

  return { nodes: outNodes, edges };
}

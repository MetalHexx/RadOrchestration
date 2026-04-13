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

  // Build a parent→children map for all nodes (supports nested groups at any depth)
  const childrenMap = new Map<string, TemplateGraphNode[]>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node);
      childrenMap.set(node.parentId, siblings);
    }
  }

  // Accumulated layout results shared across all recursion levels
  const groupStyles = new Map<string, { width: number; height: number }>();
  const childPositioned = new Map<string, { x: number; y: number }>();

  // Lay out a single group's children, recursing into nested groups first (bottom-up)
  function layoutGroup(groupId: string): void {
    const children = childrenMap.get(groupId) ?? [];
    if (children.length === 0) return;

    // Recurse into nested groups first so their sizes are known before this group's layout
    for (const child of children) {
      if (child.type === 'templateGroup') {
        layoutGroup(child.id);
      }
    }

    // Build a dagre sub-graph for this group's direct children
    const childGraph = new dagre.graphlib.Graph();
    childGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
    childGraph.setDefaultEdgeLabel(() => ({}));

    const childIds = new Set(children.map((n) => n.id));

    for (const child of children) {
      // Use already-computed size for nested groups, otherwise use defaults
      const nestedStyle = groupStyles.get(child.id);
      const w = nestedStyle ? nestedStyle.width : NODE_WIDTH;
      const h = nestedStyle ? nestedStyle.height : NODE_HEIGHT;
      childGraph.setNode(child.id, { width: w, height: h });
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
      const nestedStyle = groupStyles.get(child.id);
      const w = nestedStyle ? nestedStyle.width : NODE_WIDTH;
      const h = nestedStyle ? nestedStyle.height : NODE_HEIGHT;
      return { id: child.id, x: dn.x - w / 2, y: dn.y - h / 2, w, h };
    });

    // Compute bounding box of children using each child's actual width/height
    const minX = Math.min(...childAbsPositions.map((c) => c.x));
    const minY = Math.min(...childAbsPositions.map((c) => c.y));
    const maxX = Math.max(...childAbsPositions.map((c) => c.x + c.w));
    const maxY = Math.max(...childAbsPositions.map((c) => c.y + c.h));

    // Size the group to contain all children with padding
    groupStyles.set(groupId, {
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

  // Process all top-level group nodes recursively (populates groupStyles and childPositioned)
  for (const groupNode of topLevelNodes.filter((n) => n.type === 'templateGroup')) {
    layoutGroup(groupNode.id);
  }

  // Build and run the top-level dagre graph using actual group sizes
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of topLevelNodes) {
    const style = groupStyles.get(node.id);
    const w = style ? style.width : NODE_WIDTH;
    const h = style ? style.height : NODE_HEIGHT;
    graph.setNode(node.id, { width: w, height: h });
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
    const style = groupStyles.get(node.id);
    const w = style ? style.width : NODE_WIDTH;
    const h = style ? style.height : NODE_HEIGHT;
    const dn = graph.node(node.id);
    topLevelPositioned.set(node.id, {
      x: dn.x - w / 2,
      y: dn.y - h / 2,
    });
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
      const style = groupStyles.get(node.id);
      return {
        ...node,
        position: pos,
        ...(style !== undefined ? { style: { ...node.style, ...style } } : {}),
      };
    }),
  ];

  return { nodes: outNodes, edges };
}

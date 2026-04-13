import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState, NodesRecord, NodeState, ForEachPhaseNodeState } from '@/types/state';

export type CompatibleNodeState = StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState;

export function getCommitLinkData(commitHash: string | null | undefined): { href: string; label: string } | null {
  if (commitHash == null || commitHash.length === 0) return null;
  // TODO(DAG-VIEW-3): Replace with real commit URL once repo base URL is available
  return {
    href: `#${commitHash}`,
    label: commitHash.slice(0, 7),
  };
}

export function isLoopNode(node: NodeState): node is Extract<NodeState, { kind: 'for_each_phase' | 'for_each_task' }> {
  return node.kind === 'for_each_phase' || node.kind === 'for_each_task';
}

export function filterCompatibleNodes(
  nodes: NodesRecord
): Array<[string, CompatibleNodeState]> {
  return Object.entries(nodes).filter(
    ([, node]) => !isLoopNode(node)
  ) as Array<[string, CompatibleNodeState]>;
}

/**
 * Converts a snake_case node ID to a human-readable display name.
 * "gate_mode_selection" → "Gate Mode Selection"
 */
export function formatNodeId(nodeId: string): string {
  return nodeId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extracts the leaf segment from a compound node ID and formats it
 * as a human-readable display name.
 *
 * "phase_loop.iter0.phase_planning" → "Phase Planning"
 * "phase_planning"                  → "Phase Planning"
 */
export function getDisplayName(nodeId: string): string {
  const lastDot = nodeId.lastIndexOf('.');
  const leaf = lastDot === -1 ? nodeId : nodeId.slice(lastDot + 1);
  return formatNodeId(leaf);
}

// ─── Section Types ────────────────────────────────────────────────────────────

export type SectionLabel = 'Planning' | 'Gates' | 'Execution' | 'Completion';

export interface SectionGroup {
  label: SectionLabel;
  entries: Array<[string, NodeState]>;
}

// ─── Section Constants ────────────────────────────────────────────────────────

export const NODE_SECTION_MAP: Record<string, SectionLabel> = {
  prd: 'Planning',
  research: 'Planning',
  design: 'Planning',
  architecture: 'Planning',
  master_plan: 'Planning',
  plan_approval_gate: 'Gates',
  gate_mode_selection: 'Gates',
  phase_loop: 'Execution',
  final_review: 'Completion',
  pr_gate: 'Completion',
  final_approval_gate: 'Completion',
};

// ─── Section Helper Functions ─────────────────────────────────────────────────

export function parsePhaseNameFromDocPath(
  docPath: string | null,
  iterationIndex: number
): string {
  const phaseNum = iterationIndex + 1;
  if (!docPath) return `Phase ${phaseNum}`;

  // Match pattern: {anything}-PHASE-{NN}-{TITLE}.md
  const match = docPath.match(/-PHASE-\d+-(.+)\.md$/i);
  if (!match) return `Phase ${phaseNum}`;

  const title = match[1]
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return `Phase ${phaseNum} — ${title}`;
}

export function parseTaskNameFromDocPath(
  docPath: string | null,
  iterationIndex: number
): string {
  const taskNum = iterationIndex + 1;
  if (!docPath) return `Task ${taskNum}`;

  // Match pattern: {anything}-TASK-P{NN}-T{NN}-{TITLE}.md
  const match = docPath.match(/-TASK-P\d+-T\d+-(.+)\.md$/i);
  if (!match) return `Task ${taskNum}`;

  const title = match[1]
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return `Task ${taskNum} — ${title}`;
}

export function groupNodesBySection(nodes: NodesRecord): SectionGroup[] {
  const sectionOrder: SectionLabel[] = ['Planning', 'Gates', 'Execution', 'Completion'];
  const buckets = new Map<SectionLabel, Array<[string, NodeState]>>();

  for (const label of sectionOrder) {
    buckets.set(label, []);
  }

  for (const [nodeId, nodeState] of Object.entries(nodes)) {
    const label = NODE_SECTION_MAP[nodeId];
    if (label) {
      buckets.get(label)!.push([nodeId, nodeState]);
    }
  }

  const groups: SectionGroup[] = [];
  for (const label of sectionOrder) {
    const entries = buckets.get(label)!;
    if (entries.length > 0) {
      groups.push({ label, entries });
    }
  }

  return groups;
}

export function deriveCurrentPhase(
  phaseLoopNode: ForEachPhaseNodeState | undefined
): string | null {
  if (!phaseLoopNode) return null;

  const activeIteration = phaseLoopNode.iterations.find(
    (iter) => iter.status === 'in_progress'
  );
  if (!activeIteration) return null;

  const phasePlanningNode = activeIteration.nodes.phase_planning;
  const docPath =
    phasePlanningNode && 'doc_path' in phasePlanningNode
      ? (phasePlanningNode as { doc_path: string | null }).doc_path
      : null;

  return parsePhaseNameFromDocPath(docPath, activeIteration.index);
}

export function derivePhaseProgress(
  phaseLoopNode: ForEachPhaseNodeState | undefined
): { completed: number; total: number } | null {
  if (!phaseLoopNode || phaseLoopNode.iterations.length === 0) return null;

  const completed = phaseLoopNode.iterations.filter(
    (iter) => iter.status === 'completed'
  ).length;

  return { completed, total: phaseLoopNode.iterations.length };
}

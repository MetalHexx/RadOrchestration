import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState, NodesRecord, NodeState, ForEachPhaseNodeState, GateEvent } from '@/types/state';

export type CompatibleNodeState = StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState;

export function deriveRepoBaseUrl(compareUrl: string | null): string | null {
  if (compareUrl == null) return null;
  if (compareUrl.trim().length === 0) return null;
  const idx = compareUrl.indexOf('/compare/');
  if (idx === -1) return null;
  return compareUrl.slice(0, idx);
}

export function getCommitLinkData(
  commitHash: string | null | undefined,
  repoBaseUrl: string | null
): { href: string | null; label: string } | null {
  if (commitHash == null || commitHash.length === 0) return null;
  return {
    href: repoBaseUrl != null ? repoBaseUrl + '/commit/' + commitHash : null,
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
 * Extracts the leaf segment of a compound node ID — the substring after the
 * last `.`, or the whole string if no `.` is present.
 *
 * "phase_loop.iter0.phase_planning" → "phase_planning"
 * "phase_planning"                  → "phase_planning"
 */
function extractLeaf(nodeId: string): string {
  const lastDot = nodeId.lastIndexOf('.');
  return lastDot === -1 ? nodeId : nodeId.slice(lastDot + 1);
}

/**
 * Extracts the leaf segment from a compound node ID and formats it
 * as a human-readable display name.
 *
 * "phase_loop.iter0.phase_planning" → "Phase Planning"
 * "phase_planning"                  → "Phase Planning"
 */
export function getDisplayName(nodeId: string): string {
  return formatNodeId(extractLeaf(nodeId));
}

// ─── Gate Node Config (single source of truth for approval buttons) ──────────

/**
 * Maps gate node leaf IDs to their corresponding gate event and button label.
 * Only plan-approval and final-approval gates receive approval buttons.
 * `pr_gate`, `gate_mode_selection`, `task_gate`, and `phase_gate` are
 * intentionally absent.
 */
export const GATE_NODE_CONFIG: Record<string, {
  event: GateEvent;
  label: string;
}> = {
  plan_approval_gate: { event: 'plan_approved', label: 'Approve Plan' },
  final_approval_gate: { event: 'final_approved', label: 'Approve Final Review' },
};

/**
 * Resolves a node ID (possibly compound, like `phase_loop.iter0.task_gate`)
 * against `GATE_NODE_CONFIG` by extracting its leaf segment (substring after
 * the last `.`, or the whole string if no `.`). Returns the config or `null`.
 */
export function getGateNodeConfig(
  nodeId: string
): { event: GateEvent; label: string } | null {
  return GATE_NODE_CONFIG[extractLeaf(nodeId)] ?? null;
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
  requirements: 'Planning',
  master_plan: 'Planning',
  explode_master_plan: 'Planning',
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
    .map(w => w === w.toUpperCase() && w.length > 1 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
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
    .map(w => w === w.toUpperCase() && w.length > 1 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
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
    if (!Object.hasOwn(NODE_SECTION_MAP, nodeId)) {
      continue;
    }
    const label = NODE_SECTION_MAP[nodeId];
    buckets.get(label)!.push([nodeId, nodeState]);
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
  const docPath = phasePlanningNode?.kind === 'step' ? phasePlanningNode.doc_path : null;

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

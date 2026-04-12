import { PLANNING_STEP_ORDER } from '@/types/state';
import type { PlanningStepName, ProjectState, ProjectStateV5 } from '@/types/state';
import type { OrderedDoc } from '@/types/components';

const STEP_TITLES: Record<PlanningStepName, string> = {
  research: 'Research',
  prd: 'PRD',
  design: 'Design',
  architecture: 'Architecture',
  master_plan: 'Master Plan',
};

/**
 * Derive the canonical document navigation order from project state.
 *
 * Order: planning docs → per-phase (plan → per-task: handoff → review → … → phase review) →
 *        final review → error log → other docs.
 *
 * Only non-null paths are included.
 */
export function getOrderedDocs(
  state: ProjectState,
  projectName: string,
  allFiles?: string[],
): OrderedDoc[] {
  const docs: OrderedDoc[] = [];
  const seenPaths = new Set<string>();
  const seenBasenames = new Set<string>();
  const basename = (p: string) => p.split(/[\/\\]/).pop() ?? p;

  const push = (path: string, title: string, category: OrderedDoc['category']) => {
    docs.push({ path, title, category });
    seenPaths.add(path);
    seenBasenames.add(basename(path));
  };

  // 1. Planning docs
  const stepMap = new Map(state.planning.steps.map(s => [s.name, s]));
  for (const step of PLANNING_STEP_ORDER) {
    const docPath = stepMap.get(step)?.doc_path;
    if (docPath != null) {
      push(docPath, STEP_TITLES[step], 'planning');
    }
  }

  // 2. Per phase
  for (let i = 0; i < state.execution.phases.length; i++) {
    const phase = state.execution.phases[i];
    const n = i + 1;

    if (phase.docs.phase_plan != null) {
      push(phase.docs.phase_plan, `Phase ${n} Plan`, 'phase');
    }

    for (let j = 0; j < phase.tasks.length; j++) {
      const task = phase.tasks[j];
      const m = j + 1;

      if (task.docs.handoff != null) {
        push(task.docs.handoff, `P${n}-T${m}: ${task.name}`, 'task');
      }
      if (task.docs.review != null) {
        push(task.docs.review, `P${n}-T${m} Review`, 'review');
      }
    }

    if (phase.docs.phase_report != null) {
      push(phase.docs.phase_report, `Phase ${n} Report`, 'phase');
    }

    if (phase.docs.phase_review != null) {
      push(phase.docs.phase_review, `Phase ${n} Review`, 'review');
    }
  }

  // 3. Final review
  if (state.final_review.doc_path != null) {
    push(state.final_review.doc_path, 'Final Review', 'review');
  }

  // 4 & 5. Error log + other docs from allFiles
  if (allFiles) {
    const errorLogPattern = `${projectName}-ERROR-LOG.md`;
    const errorLogFile = allFiles.find((f) => f.endsWith(errorLogPattern));
    if (errorLogFile && !seenPaths.has(errorLogFile)) {
      push(errorLogFile, 'Error Log', 'error-log');
    }

    const otherDocs = allFiles
      .filter((f) => f.endsWith('.md') && !seenBasenames.has(basename(f)))
      .sort();

    for (const filePath of otherDocs) {
      const filename = filePath.split('/').pop() ?? filePath;
      const title = filename.replace(/\.md$/, '');
      push(filePath, title, 'other');
    }
  }

  return docs;
}

/**
 * Find the previous and next documents relative to the current path.
 */
export function getAdjacentDocs(
  docs: OrderedDoc[],
  currentPath: string,
): { prev: OrderedDoc | null; next: OrderedDoc | null; currentIndex: number; total: number } {
  const currentIndex = docs.findIndex((d) => d.path === currentPath);

  if (currentIndex === -1) {
    return { prev: null, next: null, currentIndex: -1, total: docs.length };
  }

  const prev = currentIndex > 0 ? docs[currentIndex - 1] : null;
  const next = currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null;

  return { prev, next, currentIndex, total: docs.length };
}

// ─── v5 helpers ──────────────────────────────────────────────────────────────

const STEP_TITLES_V5: Record<string, string> = {
  research: 'Research Findings',
  prd: 'PRD',
  design: 'Design',
  architecture: 'Architecture',
  master_plan: 'Master Plan',
};

const PLANNING_STEPS_V5 = new Set(['research', 'prd', 'design', 'architecture', 'master_plan']);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function titleForPhaseChild(childId: string, phaseNum: number): string {
  if (childId === 'phase_planning' || childId === 'phase_plan') return `Phase ${phaseNum} Plan`;
  if (childId === 'phase_report') return `Phase ${phaseNum} Report`;
  if (childId === 'phase_review') return `Phase ${phaseNum} Review`;
  return capitalize(childId);
}

function titleForTaskChild(taskNodeId: string, phaseNum: number, taskNum: number): string {
  if (taskNodeId === 'task_handoff') return `P${phaseNum}-T${taskNum} Handoff`;
  if (taskNodeId === 'code_review') return `P${phaseNum}-T${taskNum} Review`;
  return `P${phaseNum}-T${taskNum} ${capitalize(taskNodeId)}`;
}

/**
 * Derive the canonical document navigation order from a v5 project state.
 * Recursively walks graph.nodes, iteration entries, and corrective task entries
 * to collect doc_path values from step nodes.
 *
 * Order: root step nodes → per-phase-iteration (phase step nodes → per-task-iteration
 *        (task step nodes → corrective task step nodes)) → final_review step → error log → other docs.
 */
export function getOrderedDocsV5(
  state: ProjectStateV5,
  projectName: string,
  allFiles?: string[],
): OrderedDoc[] {
  const result: OrderedDoc[] = [];
  const seenPaths = new Set<string>();
  const seenBasenames = new Set<string>();
  const basename = (p: string) => p.split(/[\/\\]/).pop() ?? p;

  const push = (path: string, title: string, category: OrderedDoc['category']) => {
    result.push({ path, title, category });
    seenPaths.add(path);
    seenBasenames.add(basename(path));
  };

  for (const [nodeId, node] of Object.entries(state.graph.nodes)) {
    if (node.kind === 'step' && node.doc_path != null) {
      if (PLANNING_STEPS_V5.has(nodeId)) {
        push(node.doc_path, STEP_TITLES_V5[nodeId], 'planning');
      } else if (nodeId === 'final_review') {
        push(node.doc_path, 'Final Review', 'review');
      }
      // else: skip other step nodes (task_executor, commit, etc.)
    } else if (node.kind === 'for_each_phase') {
      const sortedIterations = [...node.iterations].sort((a, b) => a.index - b.index);
      for (const iteration of sortedIterations) {
        const phaseNum = iteration.index + 1;
        for (const [childId, child] of Object.entries(iteration.nodes)) {
          if (child.kind === 'step' && child.doc_path != null) {
            const category: OrderedDoc['category'] = childId.includes('review') ? 'review' : 'phase';
            push(child.doc_path, titleForPhaseChild(childId, phaseNum), category);
          } else if (child.kind === 'for_each_task') {
            const sortedTaskIters = [...child.iterations].sort((a, b) => a.index - b.index);
            for (const taskIter of sortedTaskIters) {
              const taskNum = taskIter.index + 1;
              for (const [taskNodeId, taskNode] of Object.entries(taskIter.nodes)) {
                if (taskNode.kind === 'step' && taskNode.doc_path != null) {
                  const category: OrderedDoc['category'] = taskNodeId.includes('review') ? 'review' : 'task';
                  push(taskNode.doc_path, titleForTaskChild(taskNodeId, phaseNum, taskNum), category);
                }
              }
              const sortedCTs = [...taskIter.corrective_tasks].sort((a, b) => a.index - b.index);
              for (const ct of sortedCTs) {
                for (const [ctNodeId, ctNode] of Object.entries(ct.nodes)) {
                  if (ctNode.kind === 'step' && ctNode.doc_path != null) {
                    const title = titleForTaskChild(ctNodeId, phaseNum, taskNum) + ' (CT' + ct.index + ')';
                    push(ctNode.doc_path, title, 'task');
                  }
                }
              }
            }
          }
        }
      }
    }
    // gate, conditional, parallel: skip
  }

  if (allFiles) {
    const errorLogPattern = `${projectName}-ERROR-LOG.md`;
    const errorLogFile = allFiles.find((f) => f.endsWith(errorLogPattern));
    if (errorLogFile && !seenPaths.has(errorLogFile)) {
      push(errorLogFile, 'Error Log', 'error-log');
    }

    const otherDocs = allFiles
      .filter((f) => f.endsWith('.md') && !seenBasenames.has(basename(f)))
      .sort();

    for (const filePath of otherDocs) {
      const filename = filePath.split('/').pop() ?? filePath;
      const title = filename.replace(/\.md$/, '');
      push(filePath, title, 'other');
    }
  }

  return result;
}

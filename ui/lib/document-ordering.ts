import { PLANNING_STEP_ORDER } from '@/types/state';
import type { PlanningStepName, ProjectState } from '@/types/state';
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

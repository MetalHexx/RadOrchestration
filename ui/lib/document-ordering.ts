import { PLANNING_STEP_ORDER } from '@/types/state';
import type { PlanningStepName, NormalizedProjectState } from '@/types/state';
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
 * Order: planning docs → per-phase (plan → tasks → report → review) →
 *        final review → error log → other docs.
 *
 * Only non-null paths are included.
 */
export function getOrderedDocs(
  state: NormalizedProjectState,
  projectName: string,
  allFiles?: string[],
): OrderedDoc[] {
  const docs: OrderedDoc[] = [];
  const seenPaths = new Set<string>();

  const push = (path: string, title: string, category: OrderedDoc['category']) => {
    docs.push({ path, title, category });
    seenPaths.add(path);
  };

  // 1. Planning docs
  for (const step of PLANNING_STEP_ORDER) {
    const output = state.planning.steps[step].output;
    if (output != null) {
      push(output, STEP_TITLES[step], 'planning');
    }
  }

  // 2. Per phase
  for (const phase of state.execution.phases) {
    const n = phase.phase_number;

    if (phase.phase_doc != null) {
      push(phase.phase_doc, `Phase ${n} Plan`, 'phase');
    }

    for (const task of phase.tasks) {
      const m = task.task_number;

      if (task.handoff_doc != null) {
        push(task.handoff_doc, `P${n}-T${m}: ${task.title}`, 'task');
      }
      if (task.report_doc != null) {
        push(task.report_doc, `P${n}-T${m} Report`, 'task');
      }
      if (task.review_doc != null) {
        push(task.review_doc, `P${n}-T${m} Review`, 'review');
      }
    }

    if (phase.phase_report != null) {
      push(phase.phase_report, `Phase ${n} Report`, 'phase');
    }
    if (phase.phase_review != null) {
      push(phase.phase_review, `Phase ${n} Review`, 'review');
    }
  }

  // 3. Final review
  if (state.final_review.report_doc != null) {
    push(state.final_review.report_doc, 'Final Review', 'review');
  }

  // 4 & 5. Error log + other docs from allFiles
  if (allFiles) {
    const errorLogPattern = `${projectName}-ERROR-LOG.md`;
    const errorLogFile = allFiles.find((f) => f.endsWith(errorLogPattern));
    if (errorLogFile && !seenPaths.has(errorLogFile)) {
      push(errorLogFile, 'Error Log', 'error-log');
    }

    const otherDocs = allFiles
      .filter((f) => f.endsWith('.md') && !seenPaths.has(f))
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

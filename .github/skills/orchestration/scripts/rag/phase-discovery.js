'use strict';

const STEP_TO_DOC_TYPE = {
  research: 'research',
  prd: 'prd',
  design: 'design',
  architecture: 'architecture',
  master_plan: 'master-plan',
};

function discoverPlanningArtifacts(state) {
  return state.planning.steps
    .filter(step => step.status === 'complete' && step.doc_path)
    .map(step => ({
      doc_path: step.doc_path,
      doc_type: STEP_TO_DOC_TYPE[step.name] || step.name,
    }));
}

function discoverPhaseArtifacts(state, phaseNumber) {
  const phase = state.execution.phases[phaseNumber - 1];
  if (!phase) return [];

  const artifacts = [];

  if (phase.docs.phase_plan) {
    artifacts.push({ doc_path: phase.docs.phase_plan, doc_type: 'phase-plan' });
  }

  for (const task of phase.tasks) {
    if (task.docs.handoff) {
      artifacts.push({ doc_path: task.docs.handoff, doc_type: 'task-handoff' });
    }
    if (task.docs.report) {
      artifacts.push({ doc_path: task.docs.report, doc_type: 'task-report' });
    }
    if (task.docs.review) {
      artifacts.push({ doc_path: task.docs.review, doc_type: 'code-review' });
    }
  }

  if (phase.docs.phase_report) {
    artifacts.push({ doc_path: phase.docs.phase_report, doc_type: 'phase-report' });
  }
  if (phase.docs.phase_review) {
    artifacts.push({ doc_path: phase.docs.phase_review, doc_type: 'phase-review' });
  }

  return artifacts;
}

module.exports = { discoverPlanningArtifacts, discoverPhaseArtifacts };

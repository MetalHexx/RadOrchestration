'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { discoverPhaseArtifacts, discoverPlanningArtifacts } = require('../rag/phase-discovery.js');

function makeState() {
  return {
    project: { name: 'MYAPP' },
    planning: {
      steps: [
        { name: 'research', status: 'complete', doc_path: 'MYAPP-RESEARCH-FINDINGS.md' },
        { name: 'prd', status: 'complete', doc_path: 'MYAPP-PRD.md' },
        { name: 'design', status: 'complete', doc_path: 'MYAPP-DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'MYAPP-ARCHITECTURE.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'MYAPP-MASTER-PLAN.md' },
      ],
    },
    execution: {
      phases: [
        {
          name: 'Phase 1',
          docs: { phase_plan: 'phases/MYAPP-PHASE-P01.md', phase_report: 'reports/MYAPP-PHASE-REPORT-P01.md', phase_review: 'reports/MYAPP-PHASE-REVIEW-P01.md' },
          tasks: [
            { docs: { handoff: 'tasks/MYAPP-TASK-P01-T01.md', report: 'reports/MYAPP-TASK-REPORT-P01-T01.md', review: 'reports/MYAPP-CODE-REVIEW-P01-T01.md' } },
            { docs: { handoff: 'tasks/MYAPP-TASK-P01-T02.md', report: 'reports/MYAPP-TASK-REPORT-P01-T02.md', review: 'reports/MYAPP-CODE-REVIEW-P01-T02.md' } },
          ],
        },
      ],
    },
  };
}

describe('discoverPlanningArtifacts', () => {
  it('returns all planning doc paths with doc types', () => {
    const state = makeState();
    const artifacts = discoverPlanningArtifacts(state);
    assert.equal(artifacts.length, 5);
    assert.deepStrictEqual(artifacts[0], { doc_path: 'MYAPP-RESEARCH-FINDINGS.md', doc_type: 'research' });
    assert.deepStrictEqual(artifacts[4], { doc_path: 'MYAPP-MASTER-PLAN.md', doc_type: 'master-plan' });
  });

  it('skips incomplete steps', () => {
    const state = makeState();
    state.planning.steps[3].status = 'in_progress';
    state.planning.steps[3].doc_path = null;
    state.planning.steps[4].status = 'not_started';
    state.planning.steps[4].doc_path = null;
    const artifacts = discoverPlanningArtifacts(state);
    assert.equal(artifacts.length, 3);
  });
});

describe('discoverPhaseArtifacts', () => {
  it('returns all artifacts for a phase', () => {
    const state = makeState();
    const artifacts = discoverPhaseArtifacts(state, 1);
    const types = artifacts.map(a => a.doc_type);
    assert.ok(types.includes('phase-plan'));
    assert.ok(types.includes('task-handoff'));
    assert.ok(types.includes('task-report'));
    assert.ok(types.includes('code-review'));
    assert.ok(types.includes('phase-report'));
    assert.ok(types.includes('phase-review'));
    assert.equal(artifacts.length, 9); // plan(1) + handoff(2) + task-report(2) + code-review(2) + phase-report(1) + phase-review(1)
  });

  it('skips null doc paths', () => {
    const state = makeState();
    state.execution.phases[0].tasks[1].docs.report = null;
    state.execution.phases[0].tasks[1].docs.review = null;
    const artifacts = discoverPhaseArtifacts(state, 1);
    assert.equal(artifacts.length, 7);
  });
});

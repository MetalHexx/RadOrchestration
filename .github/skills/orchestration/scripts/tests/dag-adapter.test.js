'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapPlanningSteps,
  mapExecution,
  deriveTier,
  computeNestedView,
} = require('../lib/dag-adapter.js');
const { makeDagNode, makeDagState, makeExpandedDag } = require('./helpers/test-helpers.js');
const {
  DAG_NODE_STATUSES,
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PHASE_STATUSES,
  PHASE_STAGES,
  TASK_STATUSES,
  TASK_STAGES,
} = require('../lib/constants.js');

// ─── mapPlanningSteps() ──────────────────────────────────────────────────────

describe('mapPlanningSteps()', () => {
  it('returns correct { name, status, doc_path } shape for each planning step node', () => {
    const nodes = {
      research: makeDagNode({
        id: 'research',
        planning_step: 'research',
        status: 'not_started',
      }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].name, 'research');
    assert.equal(steps[0].status, 'not_started');
    assert.equal(steps[0].doc_path, null);
  });

  it('maps not_started status correctly', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'not_started' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps[0].status, DAG_NODE_STATUSES.NOT_STARTED);
  });

  it('maps in_progress status correctly', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'in_progress' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps[0].status, DAG_NODE_STATUSES.IN_PROGRESS);
  });

  it('maps complete status correctly', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps[0].status, DAG_NODE_STATUSES.COMPLETE);
  });

  it('includes doc_path from node.docs.doc_path when present', () => {
    const nodes = {
      research: makeDagNode({
        id: 'research',
        planning_step: 'research',
        status: 'complete',
        docs: { doc_path: 'projects/TEST/docs/research.md' },
      }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps[0].doc_path, 'projects/TEST/docs/research.md');
  });

  it('returns doc_path: null when node has no docs', () => {
    const nodes = {
      prd: makeDagNode({ id: 'prd', planning_step: 'prd', status: 'not_started' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps[0].doc_path, null);
  });

  it('returns empty array when no nodes have planning_step field', () => {
    const nodes = {
      some_node: makeDagNode({ id: 'some_node', status: 'not_started' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.deepEqual(steps, []);
  });

  it('returns empty array for empty nodes map', () => {
    const steps = mapPlanningSteps({});
    assert.deepEqual(steps, []);
  });

  it('returns multiple steps ordered by insertion', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete', docs: { doc_path: 'r.md' } }),
      prd: makeDagNode({ id: 'prd', planning_step: 'prd', status: 'in_progress' }),
      architecture: makeDagNode({ id: 'architecture', planning_step: 'architecture', status: 'not_started' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps.length, 3);
    assert.equal(steps[0].name, 'research');
    assert.equal(steps[1].name, 'prd');
    assert.equal(steps[2].name, 'architecture');
  });

  it('omits non-planning-step nodes from result', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'not_started' }),
    };
    const steps = mapPlanningSteps(nodes);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].name, 'research');
  });
});

// ─── mapExecution() ──────────────────────────────────────────────────────────

describe('mapExecution()', () => {
  function makePhaseNodes(phaseNum, phaseName, overrides = {}) {
    const base = [
      makeDagNode({
        id: `p${phaseNum}_phase_plan`,
        template_node_id: 'create_phase_plan',
        phase_number: phaseNum,
        phase_name: phaseName,
        status: 'not_started',
      }),
      makeDagNode({
        id: `p${phaseNum}_phase_report`,
        template_node_id: 'generate_phase_report',
        phase_number: phaseNum,
        phase_name: phaseName,
        status: 'not_started',
      }),
      makeDagNode({
        id: `p${phaseNum}_phase_review`,
        template_node_id: 'phase_review',
        phase_number: phaseNum,
        phase_name: phaseName,
        status: 'not_started',
      }),
    ];
    return base.map(n => Object.assign({}, n, overrides));
  }

  function makeTaskNodes(phaseNum, phaseName, taskNum, taskName, overrides = {}) {
    return [
      makeDagNode({
        id: `p${phaseNum}_t${taskNum}_handoff`,
        template_node_id: 'create_task_handoff',
        phase_number: phaseNum,
        phase_name: phaseName,
        task_number: taskNum,
        task_name: taskName,
        status: 'not_started',
        ...overrides,
      }),
      makeDagNode({
        id: `p${phaseNum}_t${taskNum}_coding`,
        template_node_id: 'execute_coding_task',
        phase_number: phaseNum,
        phase_name: phaseName,
        task_number: taskNum,
        task_name: taskName,
        status: 'not_started',
        ...overrides,
      }),
      makeDagNode({
        id: `p${phaseNum}_t${taskNum}_review`,
        template_node_id: 'code_review',
        phase_number: phaseNum,
        phase_name: phaseName,
        task_number: taskNum,
        task_name: taskName,
        status: 'not_started',
        ...overrides,
      }),
      makeDagNode({
        id: `p${phaseNum}_t${taskNum}_commit`,
        template_node_id: 'source_control_commit',
        phase_number: phaseNum,
        phase_name: phaseName,
        task_number: taskNum,
        task_name: taskName,
        status: 'not_started',
        ...overrides,
      }),
    ];
  }

  it('returns correct { status, current_phase, phases } shape', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.ok('status' in result);
    assert.ok('current_phase' in result);
    assert.ok(Array.isArray(result.phases));
  });

  it('returns not_started status when all phases are not_started', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.status, PHASE_STATUSES.NOT_STARTED);
  });

  it('returns not_started status and empty phases for empty nodes', () => {
    const result = mapExecution({});
    assert.equal(result.status, PHASE_STATUSES.NOT_STARTED);
    assert.equal(result.current_phase, 0);
    assert.deepEqual(result.phases, []);
  });

  it('returns not_started status for nodes without phase_number', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'in_progress' }),
    };
    const result = mapExecution(nodes);
    assert.equal(result.status, PHASE_STATUSES.NOT_STARTED);
    assert.deepEqual(result.phases, []);
  });

  it('produces correct phases with name, status, stage, current_task, tasks, docs, review', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1');
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases.length, 1);
    const phase = result.phases[0];
    assert.equal(phase.name, 'Phase 1');
    assert.ok('status' in phase);
    assert.ok('stage' in phase);
    assert.ok('current_task' in phase);
    assert.ok(Array.isArray(phase.tasks));
    assert.ok('docs' in phase);
    assert.ok('review' in phase);
  });

  it('produces correct tasks with name, status, stage, docs, review, retries, commit_hash', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1');
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    const task = result.phases[0].tasks[0];
    assert.equal(task.name, 'Task 1');
    assert.ok('status' in task);
    assert.ok('stage' in task);
    assert.ok('docs' in task);
    assert.ok('review' in task);
    assert.ok('retries' in task);
    assert.ok('commit_hash' in task);
  });

  it('current_phase is 1-based; returns 0 when no phases are active', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.current_phase, 0);
  });

  it('current_phase is 1-based; returns phase number when phase is active', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.current_phase, 1);
  });

  it('current_task is 1-based; returns 0 when no tasks are active', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1');
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].current_task, 0);
  });

  it('current_task is 1-based; returns task number when task is active', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].current_task, 1);
  });

  it('handles multiple phases in correct sorted order', () => {
    const phase2Nodes = makePhaseNodes(2, 'Phase 2');
    const phase1Nodes = makePhaseNodes(1, 'Phase 1');
    const allNodes = [...phase2Nodes, ...phase1Nodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases.length, 2);
    assert.equal(result.phases[0].name, 'Phase 1');
    assert.equal(result.phases[1].name, 'Phase 2');
  });

  it('handles phases with no task-scoped nodes', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks.length, 0);
  });

  it('derives phase stage as planning when create_phase_plan is not_started', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1');
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.PLANNING);
  });

  it('derives phase stage as planning when create_phase_plan is in_progress', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'in_progress' })
        : n
    );
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.PLANNING);
  });

  it('derives phase stage as reviewing when phase_review is in_progress', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n => {
      if (n.template_node_id === 'create_phase_plan') return Object.assign({}, n, { status: 'complete' });
      if (n.template_node_id === 'phase_review') return Object.assign({}, n, { status: 'in_progress' });
      return n;
    });
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.REVIEWING);
  });

  it('derives phase stage as reviewing when all task nodes are complete and phase_review is not_started', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n => {
      if (n.template_node_id === 'create_phase_plan') return Object.assign({}, n, { status: 'complete' });
      // phase_review stays not_started (default)
      return n;
    });
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.REVIEWING);
  });

  it('derives phase stage as executing when task nodes are active', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.EXECUTING);
  });

  it('derives phase stage as complete when all nodes are complete', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].stage, PHASE_STAGES.COMPLETE);
  });

  it('derives task stage as planning when handoff is not_started', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1');
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.PLANNING);
  });

  it('derives task stage as coding when execute_coding_task is in_progress', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n => {
      if (n.template_node_id === 'create_task_handoff') return Object.assign({}, n, { status: 'complete' });
      if (n.template_node_id === 'execute_coding_task') return Object.assign({}, n, { status: 'in_progress' });
      return n;
    });
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.CODING);
  });

  it('derives task stage as reviewing when code_review is in_progress', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n => {
      if (n.template_node_id === 'create_task_handoff') return Object.assign({}, n, { status: 'complete' });
      if (n.template_node_id === 'execute_coding_task') return Object.assign({}, n, { status: 'complete' });
      if (n.template_node_id === 'code_review') return Object.assign({}, n, { status: 'in_progress' });
      return n;
    });
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.REVIEWING);
  });

  it('derives task stage as reviewing when execute_coding_task is complete and code_review is not_started', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n => {
      if (n.template_node_id === 'create_task_handoff') return Object.assign({}, n, { status: 'complete' });
      if (n.template_node_id === 'execute_coding_task') return Object.assign({}, n, { status: 'complete' });
      // code_review stays not_started (default)
      // source_control_commit stays not_started (default)
      return n;
    });
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.REVIEWING);
  });

  it('derives task stage as complete when all task nodes are complete', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : Object.assign({}, n, { status: 'not_started' })
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.COMPLETE);
  });

  it('derives task stage as failed when any task node is failed', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n =>
      n.template_node_id === 'execute_coding_task'
        ? Object.assign({}, n, { status: 'failed' })
        : n
    );
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].stage, TASK_STAGES.FAILED);
  });

  it('reads commit_hash from source_control_commit node docs.commit_hash', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    const taskNodes = makeTaskNodes(1, 'Phase 1', 1, 'Task 1').map(n => {
      if (n.template_node_id === 'source_control_commit') {
        return Object.assign({}, n, { status: 'complete', docs: { commit_hash: 'abc123def456' } });
      }
      return Object.assign({}, n, { status: 'complete' });
    });
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].commit_hash, 'abc123def456');
  });

  it('returns null commit_hash when no source_control_commit node', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      n.template_node_id === 'create_phase_plan'
        ? Object.assign({}, n, { status: 'complete' })
        : n
    );
    // Only create handoff/coding/review without commit node
    const taskNodes = [
      makeDagNode({ id: 'handoff', template_node_id: 'create_task_handoff', phase_number: 1, task_number: 1, task_name: 'Task 1', status: 'complete' }),
      makeDagNode({ id: 'coding', template_node_id: 'execute_coding_task', phase_number: 1, task_number: 1, task_name: 'Task 1', status: 'complete' }),
    ];
    const allNodes = [...phaseNodes, ...taskNodes];
    const nodes = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].tasks[0].commit_hash, null);
  });

  it('reads phase docs from create_phase_plan, generate_phase_report, phase_review nodes', () => {
    const phaseNodes = [
      makeDagNode({
        id: 'pp', template_node_id: 'create_phase_plan', phase_number: 1, phase_name: 'Phase 1',
        status: 'complete', docs: { doc_path: 'phases/PHASE-01.md' },
      }),
      makeDagNode({
        id: 'pr', template_node_id: 'generate_phase_report', phase_number: 1, phase_name: 'Phase 1',
        status: 'complete', docs: { doc_path: 'phases/PHASE-01-REPORT.md' },
      }),
      makeDagNode({
        id: 'prv', template_node_id: 'phase_review', phase_number: 1, phase_name: 'Phase 1',
        status: 'complete', docs: { doc_path: 'phases/PHASE-01-REVIEW.md' },
      }),
    ];
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.phases[0].docs.phase_plan, 'phases/PHASE-01.md');
    assert.equal(result.phases[0].docs.phase_report, 'phases/PHASE-01-REPORT.md');
    assert.equal(result.phases[0].docs.phase_review, 'phases/PHASE-01-REVIEW.md');
  });

  it('returns execution status in_progress when any phase is in_progress', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'in_progress' })
    );
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.status, PHASE_STATUSES.IN_PROGRESS);
  });

  it('returns execution status halted when any phase is halted', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'halted' })
    );
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.status, PHASE_STATUSES.HALTED);
  });

  it('returns execution status complete when all phases complete', () => {
    const phaseNodes = makePhaseNodes(1, 'Phase 1').map(n =>
      Object.assign({}, n, { status: 'complete' })
    );
    const nodes = Object.fromEntries(phaseNodes.map(n => [n.id, n]));
    const result = mapExecution(nodes);
    assert.equal(result.status, PHASE_STATUSES.COMPLETE);
  });
});

// ─── deriveTier() ────────────────────────────────────────────────────────────

describe('deriveTier()', () => {
  it('returns planning when planning step nodes are active (not_started)', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'not_started' }),
    };
    const result = deriveTier(nodes, ['research']);
    assert.equal(result, PIPELINE_TIERS.PLANNING);
  });

  it('returns planning when planning step nodes are in_progress', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'in_progress' }),
    };
    const result = deriveTier(nodes, ['research']);
    assert.equal(result, PIPELINE_TIERS.PLANNING);
  });

  it('returns planning when planning gate is not_started but all planning steps complete', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      prd: makeDagNode({ id: 'prd', planning_step: 'prd', status: 'complete' }),
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'not_started' }),
    };
    const result = deriveTier(nodes, ['research', 'prd', 'planning_gate']);
    assert.equal(result, PIPELINE_TIERS.PLANNING);
  });

  it('returns execution when phase-scoped nodes are active', () => {
    const nodes = {
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'in_progress' }),
    };
    const result = deriveTier(nodes, ['planning_gate', 'phase_node']);
    assert.equal(result, PIPELINE_TIERS.EXECUTION);
  });

  it('returns execution when no planning or review conditions match', () => {
    const nodes = {
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'not_started' }),
    };
    const result = deriveTier(nodes, ['planning_gate', 'phase_node']);
    assert.equal(result, PIPELINE_TIERS.EXECUTION);
  });

  it('returns review when final review node is in_progress', () => {
    const nodes = {
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'complete' }),
      final_review: makeDagNode({ id: 'final_review', template_node_id: 'create_final_review', status: 'in_progress' }),
      final_gate: makeDagNode({ id: 'final_gate', gate_type: 'final', status: 'not_started' }),
    };
    const result = deriveTier(nodes, ['planning_gate', 'phase_node', 'final_review', 'final_gate']);
    assert.equal(result, PIPELINE_TIERS.REVIEW);
  });

  it('returns review when final gate is pending after final review completes', () => {
    const nodes = {
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'complete' }),
      final_review: makeDagNode({ id: 'final_review', template_node_id: 'create_final_review', status: 'complete' }),
      final_gate: makeDagNode({ id: 'final_gate', gate_type: 'final', status: 'not_started' }),
    };
    const result = deriveTier(nodes, ['planning_gate', 'phase_node', 'final_review', 'final_gate']);
    assert.equal(result, PIPELINE_TIERS.REVIEW);
  });

  it('returns complete when all nodes are complete', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      planning_gate: makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'complete' }),
      final_review: makeDagNode({ id: 'final_review', template_node_id: 'create_final_review', status: 'complete' }),
      final_gate: makeDagNode({ id: 'final_gate', gate_type: 'final', status: 'complete' }),
    };
    const result = deriveTier(nodes, Object.keys(nodes));
    assert.equal(result, PIPELINE_TIERS.COMPLETE);
  });

  it('returns complete when all nodes are skipped', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'skipped' }),
      b: makeDagNode({ id: 'b', status: 'skipped' }),
    };
    const result = deriveTier(nodes, ['a', 'b']);
    assert.equal(result, PIPELINE_TIERS.COMPLETE);
  });

  it('returns halted when any node is halted', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'halted' }),
    };
    const result = deriveTier(nodes, ['research', 'phase_node']);
    assert.equal(result, PIPELINE_TIERS.HALTED);
  });

  it('returns halted when any node is failed', () => {
    const nodes = {
      research: makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      phase_node: makeDagNode({ id: 'phase_node', phase_number: 1, status: 'failed' }),
    };
    const result = deriveTier(nodes, ['research', 'phase_node']);
    assert.equal(result, PIPELINE_TIERS.HALTED);
  });
});

// ─── computeNestedView() ─────────────────────────────────────────────────────

describe('computeNestedView()', () => {
  function makeMinimalDagState(nodeList = []) {
    const nodes = Object.fromEntries(nodeList.map(n => [n.id, n]));
    return makeDagState({ nodes, execution_order: nodeList.map(n => n.id) });
  }

  it('returns complete { planning, execution, final_review } shape', () => {
    const dagState = makeMinimalDagState([]);
    const result = computeNestedView(dagState);
    assert.ok('planning' in result);
    assert.ok('execution' in result);
    assert.ok('final_review' in result);
  });

  it('planning.status is not_started when no planning steps exist', () => {
    const dagState = makeMinimalDagState([]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.status, PLANNING_STATUSES.NOT_STARTED);
  });

  it('planning.status is not_started when all steps are not_started', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'research', planning_step: 'research', status: 'not_started' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.status, PLANNING_STATUSES.NOT_STARTED);
  });

  it('planning.status is in_progress when any step is in_progress', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'research', planning_step: 'research', status: 'in_progress' }),
      makeDagNode({ id: 'prd', planning_step: 'prd', status: 'not_started' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.status, PLANNING_STATUSES.IN_PROGRESS);
  });

  it('planning.status is complete when all steps are complete', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      makeDagNode({ id: 'prd', planning_step: 'prd', status: 'complete' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.status, PLANNING_STATUSES.COMPLETE);
  });

  it('planning.human_approved is false when planning gate is not_started', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'not_started' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.human_approved, false);
  });

  it('planning.human_approved is true when planning gate node is complete', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'planning_gate', gate_type: 'planning', status: 'complete' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.human_approved, true);
  });

  it('planning.human_approved is false when no planning gate node exists', () => {
    const dagState = makeMinimalDagState([]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.human_approved, false);
  });

  it('execution.status and execution.current_phase are populated', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'phase_plan', template_node_id: 'create_phase_plan', phase_number: 1, phase_name: 'Phase 1', status: 'in_progress' }),
    ]);
    const result = computeNestedView(dagState);
    assert.ok('status' in result.execution);
    assert.ok('current_phase' in result.execution);
    assert.equal(result.execution.current_phase, 1);
  });

  it('final_review.status is not_started when no final review node exists', () => {
    const dagState = makeMinimalDagState([]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.status, 'not_started');
  });

  it('final_review.status reflects final review node status', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'final_review', template_node_id: 'create_final_review', status: 'in_progress' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.status, 'in_progress');
  });

  it('final_review.doc_path is null when no docs on final review node', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'final_review', template_node_id: 'create_final_review', status: 'not_started' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.doc_path, null);
  });

  it('final_review.doc_path reads from create_final_review node docs.doc_path', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({
        id: 'final_review',
        template_node_id: 'create_final_review',
        status: 'complete',
        docs: { doc_path: 'projects/TEST/final-review.md' },
      }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.doc_path, 'projects/TEST/final-review.md');
  });

  it('final_review.human_approved is false when final gate is not_started', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'final_gate', gate_type: 'final', status: 'not_started' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.human_approved, false);
  });

  it('final_review.human_approved is true when final gate node is complete', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'final_gate', gate_type: 'final', status: 'complete' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.human_approved, true);
  });

  it('final_review.human_approved is false when no final gate node exists', () => {
    const dagState = makeMinimalDagState([]);
    const result = computeNestedView(dagState);
    assert.equal(result.final_review.human_approved, false);
  });

  it('planning.steps contains all planning step nodes', () => {
    const dagState = makeMinimalDagState([
      makeDagNode({ id: 'research', planning_step: 'research', status: 'complete' }),
      makeDagNode({ id: 'prd', planning_step: 'prd', status: 'in_progress' }),
    ]);
    const result = computeNestedView(dagState);
    assert.equal(result.planning.steps.length, 2);
    assert.equal(result.planning.steps[0].name, 'research');
    assert.equal(result.planning.steps[1].name, 'prd');
  });
});

// ─── Template Integration Tests ───────────────────────────────────────────────

describe('Template integration', () => {
  it('produces structurally valid output from a fully expanded "full" DAG with default not_started statuses', () => {
    const { nodes, execution_order } = makeExpandedDag('full');
    const dagState = makeDagState({ template_name: 'full', nodes, execution_order });
    const result = computeNestedView(dagState);

    // Top-level shape
    assert.ok('planning' in result, 'planning key missing');
    assert.ok('execution' in result, 'execution key missing');
    assert.ok('final_review' in result, 'final_review key missing');

    // Planning shape
    assert.ok('status' in result.planning, 'planning.status missing');
    assert.ok('human_approved' in result.planning, 'planning.human_approved missing');
    assert.ok(Array.isArray(result.planning.steps), 'planning.steps not an array');
    assert.equal(typeof result.planning.human_approved, 'boolean');

    // Execution shape
    assert.ok('status' in result.execution, 'execution.status missing');
    assert.ok('current_phase' in result.execution, 'execution.current_phase missing');
    assert.ok(Array.isArray(result.execution.phases), 'execution.phases not an array');

    // Final review shape
    assert.ok('status' in result.final_review, 'final_review.status missing');
    assert.ok('doc_path' in result.final_review, 'final_review.doc_path missing');
    assert.ok('human_approved' in result.final_review, 'final_review.human_approved missing');
    assert.equal(typeof result.final_review.human_approved, 'boolean');
  });

  it('produces structurally valid output from a fully expanded "quick" DAG with default statuses', () => {
    const { nodes, execution_order } = makeExpandedDag('quick');
    const dagState = makeDagState({ template_name: 'quick', nodes, execution_order });
    const result = computeNestedView(dagState);

    // Top-level shape
    assert.ok('planning' in result);
    assert.ok('execution' in result);
    assert.ok('final_review' in result);

    // Execution must have phases
    assert.ok(Array.isArray(result.execution.phases));

    // Planning shape
    assert.ok(Array.isArray(result.planning.steps));
    assert.equal(typeof result.planning.human_approved, 'boolean');
    assert.equal(typeof result.final_review.human_approved, 'boolean');
  });

  it('"quick" template output omits design step from planning.steps', () => {
    const { nodes, execution_order } = makeExpandedDag('quick');
    const dagState = makeDagState({ template_name: 'quick', nodes, execution_order });
    const result = computeNestedView(dagState);

    const stepNames = result.planning.steps.map(s => s.name);
    assert.ok(!stepNames.includes('design'), `Expected "design" to be omitted from quick template steps, got: ${stepNames.join(', ')}`);
  });

  it('"full" template output includes design step in planning.steps', () => {
    const { nodes, execution_order } = makeExpandedDag('full');
    const dagState = makeDagState({ template_name: 'full', nodes, execution_order });
    const result = computeNestedView(dagState);

    const stepNames = result.planning.steps.map(s => s.name);
    assert.ok(stepNames.includes('design'), `Expected "design" in full template steps, got: ${stepNames.join(', ')}`);
  });

  it('all phases in expanded "full" DAG have correct structure', () => {
    const { nodes, execution_order } = makeExpandedDag('full');
    const dagState = makeDagState({ template_name: 'full', nodes, execution_order });
    const result = computeNestedView(dagState);

    for (const phase of result.execution.phases) {
      assert.ok('name' in phase, `phase.name missing`);
      assert.ok('status' in phase, `phase.status missing`);
      assert.ok('stage' in phase, `phase.stage missing`);
      assert.ok('current_task' in phase, `phase.current_task missing`);
      assert.ok(Array.isArray(phase.tasks), `phase.tasks not an array`);
      assert.ok('docs' in phase, `phase.docs missing`);
      assert.ok('review' in phase, `phase.review missing`);

      for (const task of phase.tasks) {
        assert.ok('name' in task, `task.name missing`);
        assert.ok('status' in task, `task.status missing`);
        assert.ok('stage' in task, `task.stage missing`);
        assert.ok('docs' in task, `task.docs missing`);
        assert.ok('review' in task, `task.review missing`);
        assert.ok('retries' in task, `task.retries missing`);
        assert.ok('commit_hash' in task, `task.commit_hash missing`);
      }
    }
  });
});

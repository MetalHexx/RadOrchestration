'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { expandTemplate, computeExecutionOrder, expandPhases, expandTasks, injectCorrectiveTask, expandConditional, expandParallel } = require('../lib/dag-expander.js');
const { loadTemplate } = require('../lib/dag-template-loader.js');
const { makeExpandedDag } = require('./helpers/test-helpers.js');

// orchRoot = .github directory
const orchRoot = path.resolve(__dirname, '..', '..', '..', '..');

// Load templates for use in tests
const fullResult = loadTemplate('full', orchRoot);
const quickResult = loadTemplate('quick', orchRoot);
const fullTemplate = fullResult.template;
const quickTemplate = quickResult.template;

// ─── expandTemplate() ──────────────────────────────────────────────────────

describe('expandTemplate()', () => {
  it('returns { nodes, execution_order } for full template', () => {
    const result = expandTemplate(fullTemplate);
    assert.ok(result.nodes, 'result should have nodes');
    assert.ok(result.execution_order, 'result should have execution_order');
    assert.equal(typeof result.nodes, 'object');
    assert.ok(Array.isArray(result.execution_order));
  });

  it('expanded full template nodes has 10 entries', () => {
    const { nodes } = expandTemplate(fullTemplate);
    assert.equal(Object.keys(nodes).length, 10);
  });

  it('expanded quick template nodes has 7 entries', () => {
    const { nodes } = expandTemplate(quickTemplate);
    assert.equal(Object.keys(nodes).length, 7);
  });

  it('every expanded node has id, type, status, depends_on, template_node_id', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(typeof node.id, 'string', `node ${key} should have string id`);
      assert.equal(typeof node.type, 'string', `node ${key} should have string type`);
      assert.equal(typeof node.status, 'string', `node ${key} should have string status`);
      assert.ok(Array.isArray(node.depends_on), `node ${key} should have array depends_on`);
      assert.equal(typeof node.template_node_id, 'string', `node ${key} should have string template_node_id`);
    }
  });

  it('every expanded node status is not_started', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(node.status, 'not_started', `node ${key} status should be not_started`);
    }
  });

  it('every expanded node template_node_id equals its id', () => {
    const { nodes } = expandTemplate(fullTemplate);
    for (const [key, node] of Object.entries(nodes)) {
      assert.equal(node.template_node_id, node.id, `node ${key} template_node_id should equal id`);
    }
  });

  it('step nodes preserve action and events fields', () => {
    const { nodes } = expandTemplate(fullTemplate);
    // research is a step node
    const research = nodes['research'];
    assert.ok(research, 'research node should exist');
    assert.equal(research.type, 'step');
    assert.equal(typeof research.action, 'string', 'step node should have action');
    assert.ok(research.events, 'step node should have events');
    assert.equal(typeof research.events.completed, 'string', 'step node should have events.completed');
  });

  it('planning step nodes preserve planning_step field', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const research = nodes['research'];
    assert.equal(research.planning_step, 'research');
  });

  it('gate nodes have gate_type and action fields', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const gate = nodes['request_plan_approval'];
    assert.ok(gate, 'request_plan_approval gate node should exist');
    assert.equal(gate.type, 'gate');
    assert.equal(typeof gate.gate_type, 'string', 'gate node should have gate_type');
    assert.equal(typeof gate.action, 'string', 'gate node should have action');
  });

  it('container nodes (for_each_phase) preserve body array', () => {
    const { nodes } = expandTemplate(fullTemplate);
    const container = nodes['for_each_phase'];
    assert.ok(container, 'for_each_phase container node should exist');
    assert.equal(container.type, 'for_each_phase');
    assert.ok(Array.isArray(container.body), 'container node should have body array');
    assert.ok(container.body.length > 0, 'body should not be empty');
  });
});

// ─── execution_order ────────────────────────────────────────────────────────

describe('execution_order', () => {
  it('contains all node IDs (length matches nodes count)', () => {
    const { nodes, execution_order } = expandTemplate(fullTemplate);
    assert.equal(execution_order.length, Object.keys(nodes).length);
    const nodeIds = new Set(Object.keys(nodes));
    for (const id of execution_order) {
      assert.ok(nodeIds.has(id), `execution_order ID "${id}" should be in nodes`);
    }
  });

  it('respects dependencies (depends_on entries appear before dependent)', () => {
    const { nodes, execution_order } = expandTemplate(fullTemplate);
    const positionMap = new Map();
    execution_order.forEach((id, idx) => positionMap.set(id, idx));

    for (const [id, node] of Object.entries(nodes)) {
      for (const dep of node.depends_on) {
        assert.ok(
          positionMap.get(dep) < positionMap.get(id),
          `dependency "${dep}" should appear before "${id}" in execution_order`
        );
      }
    }
  });
});

// ─── computeExecutionOrder() ────────────────────────────────────────────────

describe('computeExecutionOrder()', () => {
  it('throws Error with "Cycle detected in DAG" on cyclic input', () => {
    const cyclicNodes = {
      a: { id: 'a', type: 'step', status: 'not_started', depends_on: ['b'], template_node_id: 'a' },
      b: { id: 'b', type: 'step', status: 'not_started', depends_on: ['a'], template_node_id: 'b' },
    };
    assert.throws(
      () => computeExecutionOrder(cyclicNodes),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'Cycle detected in DAG');
        return true;
      }
    );
  });
});

// ─── expandPhases() ─────────────────────────────────────────────────────────

describe('expandPhases()', () => {
  function createPhaseGraph() {
    return {
      gate: {
        id: 'gate', type: 'gate', status: 'not_started',
        depends_on: [], template_node_id: 'gate',
        gate_type: 'planning', action: 'request_plan_approval',
      },
      for_each_phase: {
        id: 'for_each_phase', type: 'for_each_phase', status: 'not_started',
        depends_on: ['gate'], template_node_id: 'for_each_phase',
        body: [
          { id: 'plan', type: 'step', action: 'create_phase_plan', events: { completed: 'phase_plan_created' } },
          { id: 'review', type: 'step', depends_on: ['plan'], action: 'spawn_phase_reviewer', events: { completed: 'phase_review_completed' } },
        ],
      },
      final: {
        id: 'final', type: 'step', status: 'not_started',
        depends_on: ['for_each_phase'], template_node_id: 'final',
        action: 'spawn_final_reviewer', events: { completed: 'final_review_completed' },
      },
    };
  }

  it('expands for_each_phase container with 3 phases into correct scoped IDs', () => {
    const nodes = createPhaseGraph();
    const phases = [{ name: 'Phase 1' }, { name: 'Phase 2' }, { name: 'Phase 3' }];
    const newIds = expandPhases(nodes, 'for_each_phase', 3, phases);
    assert.deepEqual(newIds, [
      'P01.plan', 'P01.review',
      'P02.plan', 'P02.review',
      'P03.plan', 'P03.review',
    ]);
  });

  it('P01 entry nodes inherit the container external depends_on', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 2, [{ name: 'P1' }, { name: 'P2' }]);
    assert.deepEqual(nodes['P01.plan'].depends_on, ['gate']);
  });

  it('P02+ entry nodes depend on the last node of the previous phase', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 3, [{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }]);
    assert.deepEqual(nodes['P02.plan'].depends_on, ['P01.review']);
    assert.deepEqual(nodes['P03.plan'].depends_on, ['P02.review']);
  });

  it('intra-phase depends_on are scoped correctly', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 2, [{ name: 'P1' }, { name: 'P2' }]);
    assert.deepEqual(nodes['P01.review'].depends_on, ['P01.plan']);
    assert.deepEqual(nodes['P02.review'].depends_on, ['P02.plan']);
  });

  it('downstream nodes rewired from container to last phase exit', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 2, [{ name: 'P1' }, { name: 'P2' }]);
    assert.deepEqual(nodes['final'].depends_on, ['P02.review']);
  });

  it('container node is removed from the map', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 1, [{ name: 'P1' }]);
    assert.equal(nodes['for_each_phase'], undefined);
  });

  it('computeExecutionOrder succeeds after expansion (no cycles)', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 3, [{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }]);
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });

  it('single phase (phaseCount=1) works correctly', () => {
    const nodes = createPhaseGraph();
    const newIds = expandPhases(nodes, 'for_each_phase', 1, [{ name: 'Solo' }]);
    assert.deepEqual(newIds, ['P01.plan', 'P01.review']);
    assert.deepEqual(nodes['P01.plan'].depends_on, ['gate']);
    assert.deepEqual(nodes['final'].depends_on, ['P01.review']);
  });

  it('phase_number and phase_name are set on expanded nodes', () => {
    const nodes = createPhaseGraph();
    expandPhases(nodes, 'for_each_phase', 2, [{ name: 'Alpha' }, { name: 'Beta' }]);
    assert.equal(nodes['P01.plan'].phase_number, 1);
    assert.equal(nodes['P01.plan'].phase_name, 'Alpha');
    assert.equal(nodes['P02.review'].phase_number, 2);
    assert.equal(nodes['P02.review'].phase_name, 'Beta');
  });

  it('nested for_each_task body arrays are preserved on expanded container nodes', () => {
    const taskBody = [
      { id: 'handoff', type: 'step', action: 'create_task_handoff', events: { completed: 'hc' } },
      { id: 'code', type: 'step', depends_on: ['handoff'], action: 'execute_task', events: { completed: 'tc' } },
    ];
    const nodes = {
      gate: {
        id: 'gate', type: 'gate', status: 'not_started',
        depends_on: [], template_node_id: 'gate',
        gate_type: 'planning', action: 'request_plan_approval',
      },
      for_each_phase: {
        id: 'for_each_phase', type: 'for_each_phase', status: 'not_started',
        depends_on: ['gate'], template_node_id: 'for_each_phase',
        body: [
          { id: 'plan', type: 'step', action: 'create_phase_plan', events: { completed: 'pc' } },
          { id: 'tasks', type: 'for_each_task', depends_on: ['plan'], body: taskBody },
          { id: 'review', type: 'step', depends_on: ['tasks'], action: 'spawn_phase_reviewer', events: { completed: 'rc' } },
        ],
      },
      final: {
        id: 'final', type: 'step', status: 'not_started',
        depends_on: ['for_each_phase'], template_node_id: 'final',
        action: 'spawn_final_reviewer', events: { completed: 'fc' },
      },
    };
    expandPhases(nodes, 'for_each_phase', 1, [{ name: 'P1' }]);
    assert.ok(Array.isArray(nodes['P01.tasks'].body), 'expanded for_each_task should preserve body');
    assert.equal(nodes['P01.tasks'].body.length, 2);
    assert.equal(nodes['P01.tasks'].type, 'for_each_task');
  });
});

// ─── expandTasks() ──────────────────────────────────────────────────────────

describe('expandTasks()', () => {
  function createTaskGraph() {
    return {
      'P01.plan': {
        id: 'P01.plan', type: 'step', status: 'not_started',
        depends_on: [], template_node_id: 'plan',
        action: 'create_phase_plan', events: { completed: 'pc' },
        phase_number: 1,
      },
      'P01.for_each_task': {
        id: 'P01.for_each_task', type: 'for_each_task', status: 'not_started',
        depends_on: ['P01.plan'], template_node_id: 'for_each_task',
        phase_number: 1,
        body: [
          { id: 'handoff', type: 'step', action: 'create_task_handoff', events: { started: 'hs', completed: 'hc' } },
          { id: 'code', type: 'step', depends_on: ['handoff'], action: 'execute_task', events: { completed: 'tc' } },
          { id: 'review', type: 'step', depends_on: ['code'], action: 'spawn_code_reviewer', events: { completed: 'rc' } },
        ],
      },
      'P01.report': {
        id: 'P01.report', type: 'step', status: 'not_started',
        depends_on: ['P01.for_each_task'], template_node_id: 'report',
        action: 'generate_phase_report', events: { completed: 'prc' },
        phase_number: 1,
      },
    };
  }

  it('expands for_each_task with 3 tasks into correct scoped IDs', () => {
    const nodes = createTaskGraph();
    const tasks = [{ name: 'T1' }, { name: 'T2' }, { name: 'T3' }];
    const newIds = expandTasks(nodes, 'P01.for_each_task', 1, tasks);
    assert.deepEqual(newIds, [
      'P01.T01.handoff', 'P01.T01.code', 'P01.T01.review',
      'P01.T02.handoff', 'P01.T02.code', 'P01.T02.review',
      'P01.T03.handoff', 'P01.T03.code', 'P01.T03.review',
    ]);
  });

  it('T01 entry nodes inherit the container external depends_on', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }]);
    assert.deepEqual(nodes['P01.T01.handoff'].depends_on, ['P01.plan']);
  });

  it('T02+ entry nodes depend on last node of previous task', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }, { name: 'T2' }, { name: 'T3' }]);
    assert.deepEqual(nodes['P01.T02.handoff'].depends_on, ['P01.T01.review']);
    assert.deepEqual(nodes['P01.T03.handoff'].depends_on, ['P01.T02.review']);
  });

  it('intra-task depends_on scoped correctly', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }]);
    assert.deepEqual(nodes['P01.T01.code'].depends_on, ['P01.T01.handoff']);
    assert.deepEqual(nodes['P01.T01.review'].depends_on, ['P01.T01.code']);
  });

  it('downstream nodes rewired from container to last task exit', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }, { name: 'T2' }]);
    assert.deepEqual(nodes['P01.report'].depends_on, ['P01.T02.review']);
  });

  it('container node is removed from the map', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }]);
    assert.equal(nodes['P01.for_each_task'], undefined);
  });

  it('computeExecutionOrder succeeds after expansion', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }, { name: 'T2' }]);
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });

  it('single task edge case works correctly', () => {
    const nodes = createTaskGraph();
    const newIds = expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'Solo' }]);
    assert.deepEqual(newIds, ['P01.T01.handoff', 'P01.T01.code', 'P01.T01.review']);
    assert.deepEqual(nodes['P01.T01.handoff'].depends_on, ['P01.plan']);
    assert.deepEqual(nodes['P01.report'].depends_on, ['P01.T01.review']);
  });

  it('phase_number, task_number, and task_name are set on expanded nodes', () => {
    const nodes = createTaskGraph();
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'Alpha' }, { name: 'Beta' }]);
    assert.equal(nodes['P01.T01.handoff'].phase_number, 1);
    assert.equal(nodes['P01.T01.handoff'].task_number, 1);
    assert.equal(nodes['P01.T01.handoff'].task_name, 'Alpha');
    assert.equal(nodes['P01.T02.code'].phase_number, 1);
    assert.equal(nodes['P01.T02.code'].task_number, 2);
    assert.equal(nodes['P01.T02.code'].task_name, 'Beta');
  });
});

// ─── injectCorrectiveTask() ─────────────────────────────────────────────────

describe('injectCorrectiveTask()', () => {
  function createReviewGraph() {
    return {
      'P01.T01.handoff': {
        id: 'P01.T01.handoff', type: 'step', status: 'complete',
        depends_on: [], template_node_id: 'create_task_handoff',
        action: 'create_task_handoff', events: { completed: 'hc' },
        phase_number: 1, task_number: 1,
      },
      'P01.T01.code': {
        id: 'P01.T01.code', type: 'step', status: 'complete',
        depends_on: ['P01.T01.handoff'], template_node_id: 'execute_coding_task',
        action: 'execute_task', events: { completed: 'tc' },
        phase_number: 1, task_number: 1,
      },
      'P01.T01.review': {
        id: 'P01.T01.review', type: 'step', status: 'failed',
        depends_on: ['P01.T01.code'], template_node_id: 'code_review',
        action: 'spawn_code_reviewer', events: { completed: 'rc' },
        phase_number: 1, task_number: 1,
      },
      'P01.T01.commit': {
        id: 'P01.T01.commit', type: 'step', status: 'not_started',
        depends_on: ['P01.T01.review'], template_node_id: 'source_control_commit',
        action: 'invoke_source_control_commit', events: { completed: 'cc' },
        phase_number: 1, task_number: 1,
      },
    };
  }

  it('injects three nodes with correct retry-scoped IDs', () => {
    const nodes = createReviewGraph();
    const newIds = injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    assert.deepEqual(newIds, [
      'P01.T01.create_task_handoff_r1',
      'P01.T01.execute_coding_task_r1',
      'P01.T01.code_review_r1',
    ]);
    assert.ok(nodes['P01.T01.create_task_handoff_r1']);
    assert.ok(nodes['P01.T01.execute_coding_task_r1']);
    assert.ok(nodes['P01.T01.code_review_r1']);
  });

  it('new handoff node depends on failedReviewNodeId', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    assert.deepEqual(nodes['P01.T01.create_task_handoff_r1'].depends_on, ['P01.T01.review']);
  });

  it('downstream nodes rewired to new review node', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    assert.deepEqual(nodes['P01.T01.commit'].depends_on, ['P01.T01.code_review_r1']);
  });

  it('failed review node is NOT deleted', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    assert.ok(nodes['P01.T01.review'], 'failed review node should still exist');
    assert.equal(nodes['P01.T01.review'].status, 'failed');
  });

  it('phase_number, task_number, and retries set on injected nodes', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    for (const id of ['P01.T01.create_task_handoff_r1', 'P01.T01.execute_coding_task_r1', 'P01.T01.code_review_r1']) {
      assert.equal(nodes[id].phase_number, 1);
      assert.equal(nodes[id].task_number, 1);
      assert.equal(nodes[id].retries, 1);
    }
  });

  it('computeExecutionOrder succeeds after injection', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });

  it('two sequential injections (r1 then r2) produce valid graph', () => {
    const nodes = createReviewGraph();
    injectCorrectiveTask(nodes, 'P01.T01.review', 1, 1, 1);
    // Simulate r1 review also failed
    nodes['P01.T01.code_review_r1'].status = 'failed';
    injectCorrectiveTask(nodes, 'P01.T01.code_review_r1', 1, 1, 2);

    // Verify r2 nodes exist
    assert.ok(nodes['P01.T01.create_task_handoff_r2']);
    assert.ok(nodes['P01.T01.execute_coding_task_r2']);
    assert.ok(nodes['P01.T01.code_review_r2']);

    // r2 handoff depends on r1 review
    assert.deepEqual(nodes['P01.T01.create_task_handoff_r2'].depends_on, ['P01.T01.code_review_r1']);

    // commit now depends on r2 review
    assert.deepEqual(nodes['P01.T01.commit'].depends_on, ['P01.T01.code_review_r2']);

    // No cycles
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });
});

// ─── End-to-end expansion ───────────────────────────────────────────────────

describe('End-to-end expansion', () => {
  it('expandTemplate → expandPhases(2) → expandTasks(3 each) produces valid DAG', () => {
    const { nodes } = makeExpandedDag('full');

    // Expand phases
    expandPhases(nodes, 'for_each_phase', 2, [{ name: 'Phase 1' }, { name: 'Phase 2' }]);

    // Expand tasks for each phase
    expandTasks(nodes, 'P01.for_each_task', 1, [{ name: 'T1' }, { name: 'T2' }, { name: 'T3' }]);
    expandTasks(nodes, 'P02.for_each_task', 2, [{ name: 'T1' }, { name: 'T2' }, { name: 'T3' }]);

    // Verify node count: 6 planning + 3 final + 2×(3 phase-only + 3×4 task) = 6+3+2×15 = 39
    assert.equal(Object.keys(nodes).length, 39);

    // computeExecutionOrder succeeds
    const order = computeExecutionOrder(nodes);
    assert.equal(order.length, 39);

    // Dependency order is respected
    const positionMap = new Map();
    order.forEach((id, idx) => positionMap.set(id, idx));
    for (const [id, node] of Object.entries(nodes)) {
      for (const dep of node.depends_on) {
        assert.ok(
          positionMap.get(dep) < positionMap.get(id),
          `dependency "${dep}" should appear before "${id}" in execution_order`
        );
      }
    }
  });
});

// ─── expandConditional() ────────────────────────────────────────────────────

describe('expandConditional()', () => {
  function createConditionalGraph() {
    return {
      start: {
        id: 'start', type: 'step', status: 'complete',
        depends_on: [], template_node_id: 'start',
        action: 'spawn_research', events: { completed: 'rc' },
      },
      cond: {
        id: 'cond', type: 'conditional', status: 'not_started',
        depends_on: ['start'], template_node_id: 'cond',
        condition: 'config.code_review_enabled',
        body: [
          { id: 'review', type: 'step', action: 'spawn_code_reviewer', events: { completed: 'review_done' } },
          { id: 'commit', type: 'step', depends_on: ['review'], action: 'invoke_source_control_commit', events: { completed: 'commit_done' } },
        ],
      },
      finish: {
        id: 'finish', type: 'step', status: 'not_started',
        depends_on: ['cond'], template_node_id: 'finish',
        action: 'display_complete', events: { completed: 'fc' },
      },
    };
  }

  it('creates body nodes with scoped IDs', () => {
    const nodes = createConditionalGraph();
    const newIds = expandConditional(nodes, 'cond');
    assert.deepEqual(newIds, ['cond.review', 'cond.commit']);
    assert.ok(nodes['cond.review']);
    assert.ok(nodes['cond.commit']);
  });

  it('wires entry nodes to container depends_on', () => {
    const nodes = createConditionalGraph();
    expandConditional(nodes, 'cond');
    assert.deepEqual(nodes['cond.review'].depends_on, ['start']);
  });

  it('wires intra-body dependencies with scoped prefix', () => {
    const nodes = createConditionalGraph();
    expandConditional(nodes, 'cond');
    assert.deepEqual(nodes['cond.commit'].depends_on, ['cond.review']);
  });

  it('rewires downstream nodes to body exit', () => {
    const nodes = createConditionalGraph();
    expandConditional(nodes, 'cond');
    assert.deepEqual(nodes['finish'].depends_on, ['cond.commit']);
  });

  it('deletes the container node', () => {
    const nodes = createConditionalGraph();
    expandConditional(nodes, 'cond');
    assert.equal(nodes['cond'], undefined);
  });

  it('produces valid topological order (no cycles)', () => {
    const nodes = createConditionalGraph();
    expandConditional(nodes, 'cond');
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });
});

// ─── expandParallel() ───────────────────────────────────────────────────────

describe('expandParallel()', () => {
  function createParallelGraph() {
    return {
      start: {
        id: 'start', type: 'step', status: 'complete',
        depends_on: [], template_node_id: 'start',
        action: 'spawn_research', events: { completed: 'rc' },
      },
      par: {
        id: 'par', type: 'parallel', status: 'not_started',
        depends_on: ['start'], template_node_id: 'par',
        branches: [
          [
            { id: 'a1', type: 'step', action: 'spawn_research', events: { completed: 'a1d' } },
            { id: 'a2', type: 'step', depends_on: ['a1'], action: 'spawn_prd', events: { completed: 'a2d' } },
          ],
          [
            { id: 'b1', type: 'step', action: 'spawn_design', events: { completed: 'b1d' } },
          ],
        ],
      },
      finish: {
        id: 'finish', type: 'step', status: 'not_started',
        depends_on: ['par'], template_node_id: 'finish',
        action: 'display_complete', events: { completed: 'fc' },
      },
    };
  }

  it('creates branch nodes with scoped IDs', () => {
    const nodes = createParallelGraph();
    const newIds = expandParallel(nodes, 'par');
    assert.deepEqual(newIds, ['par.B01.a1', 'par.B01.a2', 'par.B02.b1']);
    assert.ok(nodes['par.B01.a1']);
    assert.ok(nodes['par.B01.a2']);
    assert.ok(nodes['par.B02.b1']);
  });

  it('wires first branch entry to container depends_on', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    assert.deepEqual(nodes['par.B01.a1'].depends_on, ['start']);
  });

  it('wires branches sequentially — branch 2 entry depends on branch 1 exit', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    assert.deepEqual(nodes['par.B02.b1'].depends_on, ['par.B01.a2']);
  });

  it('wires intra-branch dependencies with branch-scoped prefix', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    assert.deepEqual(nodes['par.B01.a2'].depends_on, ['par.B01.a1']);
  });

  it('rewires downstream nodes to last branch exit', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    assert.deepEqual(nodes['finish'].depends_on, ['par.B02.b1']);
  });

  it('deletes the container node', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    assert.equal(nodes['par'], undefined);
  });

  it('produces valid topological order (no cycles)', () => {
    const nodes = createParallelGraph();
    expandParallel(nodes, 'par');
    const order = computeExecutionOrder(nodes);
    assert.ok(order.length > 0);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { findNextReadyNode, mapNodeToAction, resolveNextAction, evaluateCondition } = require('../lib/dag-walker.js');
const { makeDagNode, makeDagState } = require('./helpers/test-helpers.js');
const {
  DAG_NODE_STATUSES,
  NEXT_ACTIONS,
} = require('../lib/constants.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal v5 state for resolveNextAction and mapNodeToAction. */
function makeState(overrides = {}) {
  return Object.assign(
    {
      pipeline: {
        current_tier: 'execution',
        gate_mode: 'autonomous',
        source_control: {
          branch: 'feature-branch',
          worktree_path: '/path/to/worktree',
          base_branch: 'main',
        },
      },
      dag: makeDagState(),
      config: {
        human_gates: { execution_mode: 'autonomous' },
      },
    },
    overrides,
  );
}

/** Build a state with a dag using the provided nodes and execution_order. */
function makeStateWithDag(nodes, executionOrder, pipelineOverrides = {}) {
  return makeState({
    pipeline: Object.assign(
      {
        current_tier: 'execution',
        gate_mode: 'autonomous',
        source_control: {
          branch: 'feature-branch',
          worktree_path: '/path/to/worktree',
          base_branch: 'main',
        },
      },
      pipelineOverrides,
    ),
    dag: makeDagState({ nodes, execution_order: executionOrder }),
  });
}

const DEFAULT_CONFIG = { human_gates: { execution_mode: 'autonomous' } };

// ─── findNextReadyNode() ────────────────────────────────────────────────────

describe('findNextReadyNode()', () => {
  it('returns the first ready node when it has no dependencies', () => {
    const node = makeDagNode({ id: 'a', status: 'not_started', depends_on: [] });
    const nodes = { a: node };
    const result = findNextReadyNode(nodes, ['a']);
    assert.equal(result, node);
  });

  it('returns null when all nodes are complete', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'complete', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'complete', depends_on: ['a'] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.equal(result, null);
  });

  it('returns null when all nodes are skipped', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'skipped', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'skipped', depends_on: ['a'] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.equal(result, null);
  });

  it('returns in_progress node when it has all deps met (active work item)', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'in_progress', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: ['a'] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.ok(result, 'should return the in_progress node');
    assert.equal(result.id, 'a');
  });

  it('treats skipped deps as satisfied (like complete)', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'skipped', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: ['a'] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.ok(result, 'should find a ready node');
    assert.equal(result.id, 'b');
  });

  it('returns in_progress node before not_started when both have deps met', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'in_progress', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: [] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.ok(result, 'should find a ready node');
    assert.equal(result.id, 'a');
  });

  it('returns correct node in multi-node linear chain where middle node is ready', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'complete', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: ['a'] }),
      c: makeDagNode({ id: 'c', status: 'not_started', depends_on: ['b'] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b', 'c']);
    assert.ok(result, 'should find a ready node');
    assert.equal(result.id, 'b');
  });

  it('works with a single-node DAG (no dependencies)', () => {
    const node = makeDagNode({ id: 'solo', status: 'not_started', depends_on: [] });
    const nodes = { solo: node };
    const result = findNextReadyNode(nodes, ['solo']);
    assert.equal(result, node);
  });

  it('returns first ready node in execution_order sequence when multiple are ready', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'not_started', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: [] }),
    };
    const result = findNextReadyNode(nodes, ['a', 'b']);
    assert.equal(result.id, 'a');
  });
});

// ─── mapNodeToAction() ──────────────────────────────────────────────────────

describe('mapNodeToAction()', () => {
  // ── Step nodes ──────────────────────────────────────────────────────────

  it('step node: returns { action, context: {} } for basic node', () => {
    const node = makeDagNode({ id: 'research', type: 'step', action: 'spawn_research' });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result, 'should return a result');
    assert.equal(result.action, 'spawn_research');
    assert.deepStrictEqual(result.context, {});
  });

  it('step node: includes phase_number and phase_id when phase_number present', () => {
    const node = makeDagNode({ id: 'n', type: 'step', action: 'create_phase_plan', phase_number: 2 });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.equal(result.context.phase_number, 2);
    assert.equal(result.context.phase_id, 'P02');
  });

  it('step node: includes task_number and task_id when task_number present', () => {
    const node = makeDagNode({
      id: 'n',
      type: 'step',
      action: 'execute_task',
      phase_number: 1,
      task_number: 3,
    });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.equal(result.context.task_number, 3);
    assert.equal(result.context.task_id, 'P01-T03');
  });

  it('step node: includes handoff_doc from node.docs.handoff when present', () => {
    const node = makeDagNode({
      id: 'n',
      type: 'step',
      action: 'execute_task',
      phase_number: 1,
      task_number: 1,
      docs: { handoff: 'tasks/TASK-01.md' },
    });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.equal(result.context.handoff_doc, 'tasks/TASK-01.md');
  });

  it('step node: includes branch and worktree_path for invoke_source_control_commit', () => {
    const node = makeDagNode({
      id: 'sc_commit',
      type: 'step',
      action: NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_COMMIT,
    });
    const state = makeState({
      pipeline: {
        current_tier: 'execution',
        gate_mode: 'autonomous',
        source_control: {
          branch: 'my-branch',
          worktree_path: '/worktrees/my-branch',
          base_branch: 'main',
        },
      },
    });
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_COMMIT);
    assert.equal(result.context.branch, 'my-branch');
    assert.equal(result.context.worktree_path, '/worktrees/my-branch');
  });

  it('step node: includes base_branch for invoke_source_control_pr', () => {
    const node = makeDagNode({
      id: 'sc_pr',
      type: 'step',
      action: NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_PR,
    });
    const state = makeState({
      pipeline: {
        current_tier: 'execution',
        gate_mode: 'autonomous',
        source_control: {
          branch: 'feature',
          worktree_path: '/wt',
          base_branch: 'develop',
        },
      },
    });
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_PR);
    assert.equal(result.context.base_branch, 'develop');
    assert.equal(result.context.branch, 'feature');
    assert.equal(result.context.worktree_path, '/wt');
  });

  // ── Gate nodes ──────────────────────────────────────────────────────────

  it('gate node (planning): returns { action, context: {} } unconditionally', () => {
    const node = makeDagNode({
      id: 'request_plan_approval',
      type: 'gate',
      gate_type: 'planning',
      action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL,
    });
    const state = makeState({ pipeline: { current_tier: 'planning', gate_mode: null, source_control: null } });
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.REQUEST_PLAN_APPROVAL);
    assert.deepStrictEqual(result.context, {});
  });

  it('gate node (final): returns { action, context: {} } unconditionally', () => {
    const node = makeDagNode({
      id: 'request_final_approval',
      type: 'gate',
      gate_type: 'final',
      action: NEXT_ACTIONS.REQUEST_FINAL_APPROVAL,
    });
    const state = makeState({ pipeline: { current_tier: 'review', gate_mode: null, source_control: null } });
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.REQUEST_FINAL_APPROVAL);
    assert.deepStrictEqual(result.context, {});
  });

  it('gate node (execution, gate_mode=autonomous): returns null', () => {
    const node = makeDagNode({
      id: 'gate_task',
      type: 'gate',
      gate_type: 'task',
      action: NEXT_ACTIONS.GATE_TASK,
    });
    const state = makeState({
      pipeline: { current_tier: 'execution', gate_mode: 'autonomous', source_control: null },
    });
    const config = { human_gates: { execution_mode: 'autonomous' } };
    const result = mapNodeToAction(node, state, config);
    assert.equal(result, null);
  });

  it('gate node (execution): returns ask_gate_mode when gate_mode is null and effective mode is ask', () => {
    const node = makeDagNode({
      id: 'gate_task',
      type: 'gate',
      gate_type: 'task',
      action: NEXT_ACTIONS.GATE_TASK,
    });
    // state.config must not override execution_mode so config param's 'ask' is used
    const state = makeState({
      pipeline: { current_tier: 'execution', gate_mode: null, source_control: null },
      config: {},
    });
    const config = { human_gates: { execution_mode: 'ask' } };
    const result = mapNodeToAction(node, state, config);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.ASK_GATE_MODE);
    assert.deepStrictEqual(result.context, {});
  });

  it('gate node (execution, gate_mode=phase): returns { action: node.action, context: {} }', () => {
    const node = makeDagNode({
      id: 'gate_phase',
      type: 'gate',
      gate_type: 'phase',
      action: NEXT_ACTIONS.GATE_PHASE,
    });
    const state = makeState({
      pipeline: { current_tier: 'execution', gate_mode: 'phase', source_control: null },
    });
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.GATE_PHASE);
    assert.deepStrictEqual(result.context, {});
  });

  // ── Container nodes ──────────────────────────────────────────────────────

  it('for_each_phase node: returns { action, context } with container-awaiting details', () => {
    const node = makeDagNode({
      id: 'for_each_phase',
      type: 'for_each_phase',
      action: NEXT_ACTIONS.CREATE_PHASE_PLAN,
    });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.CREATE_PHASE_PLAN);
    assert.ok(typeof result.context.details === 'string');
    assert.ok(result.context.details.includes('for_each_phase'));
  });

  it('for_each_task node: returns { action, context } with container-awaiting details', () => {
    const node = makeDagNode({
      id: 'for_each_task',
      type: 'for_each_task',
      action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
    });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.CREATE_TASK_HANDOFF);
    assert.ok(typeof result.context.details === 'string');
    assert.ok(result.context.details.includes('for_each_task'));
  });

  it('unknown node type: returns { action: display_halted, context: { details } }', () => {
    const node = makeDagNode({ id: 'weird', type: 'unknown_type', action: null });
    const state = makeState();
    const result = mapNodeToAction(node, state, DEFAULT_CONFIG);
    assert.ok(result);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_HALTED);
    assert.ok(typeof result.context.details === 'string');
    assert.ok(result.context.details.includes('unknown_type'));
  });
});

// ─── resolveNextAction() ────────────────────────────────────────────────────

describe('resolveNextAction()', () => {
  it('returns display_complete when all nodes are complete', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'complete', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'complete', depends_on: ['a'] }),
    };
    const state = makeStateWithDag(nodes, ['a', 'b']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_COMPLETE);
    assert.deepStrictEqual(result.context, {});
  });

  it('returns display_complete when all nodes are complete or skipped', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'complete', depends_on: [] }),
      b: makeDagNode({ id: 'b', status: 'skipped', depends_on: ['a'] }),
    };
    const state = makeStateWithDag(nodes, ['a', 'b']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_COMPLETE);
  });

  it('returns display_halted when pipeline.current_tier is halted', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'not_started', depends_on: [] }),
    };
    const state = makeStateWithDag(nodes, ['a'], { current_tier: 'halted', gate_mode: null, source_control: null });
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_HALTED);
    assert.ok(result.context.details);
  });

  it('returns in_progress node action when node has deps met (active work)', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'in_progress', depends_on: [], action: 'spawn_research' }),
      b: makeDagNode({ id: 'b', status: 'not_started', depends_on: ['a'] }),
    };
    const state = makeStateWithDag(nodes, ['a', 'b']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'spawn_research');
  });

  it('returns correct action for first ready node in normal traversal', () => {
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'not_started', depends_on: [], action: 'spawn_research' }),
    };
    const state = makeStateWithDag(nodes, ['a']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'spawn_research');
  });

  it('returns correct action for step node with phase and task context', () => {
    const nodes = {
      a: makeDagNode({
        id: 'a',
        status: 'not_started',
        depends_on: [],
        type: 'step',
        action: 'execute_task',
        phase_number: 2,
        task_number: 1,
      }),
    };
    const state = makeStateWithDag(nodes, ['a']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'execute_task');
    assert.equal(result.context.phase_number, 2);
    assert.equal(result.context.phase_id, 'P02');
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.task_id, 'P02-T01');
  });

  it('works on empty DAG (0 nodes — allDone is trivially true)', () => {
    const state = makeStateWithDag({}, []);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_COMPLETE);
    assert.deepStrictEqual(result.context, {});
  });

  it('works with a single-node DAG (one not_started node, no dependencies)', () => {
    const nodes = {
      solo: makeDagNode({ id: 'solo', status: 'not_started', depends_on: [], action: 'spawn_prd' }),
    };
    const state = makeStateWithDag(nodes, ['solo']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'spawn_prd');
  });
});

// ─── evaluateCondition() ────────────────────────────────────────────────────

describe('evaluateCondition()', () => {
  it('resolves a dot-path to the value at state.config.code_review_enabled', () => {
    const state = { config: { code_review_enabled: true } };
    assert.equal(evaluateCondition('config.code_review_enabled', state), true);
  });

  it('returns undefined for a non-existent path', () => {
    const state = { config: {} };
    assert.equal(evaluateCondition('config.flags.missing', state), undefined);
  });

  it('handles null intermediate path segments without throwing', () => {
    const state = { config: null };
    assert.equal(evaluateCondition('config.flags.value', state), undefined);
  });

  it('handles undefined intermediate path segments without throwing', () => {
    const state = {};
    assert.equal(evaluateCondition('config.flags.value', state), undefined);
  });

  it('returns falsy value (false) correctly', () => {
    const state = { config: { enabled: false } };
    assert.equal(evaluateCondition('config.enabled', state), false);
  });

  it('returns numeric value', () => {
    const state = { config: { count: 42 } };
    assert.equal(evaluateCondition('config.count', state), 42);
  });

  it('returns undefined for null or undefined conditionPath', () => {
    const state = { config: { flag: true } };
    assert.strictEqual(evaluateCondition(null, state), undefined);
    assert.strictEqual(evaluateCondition(undefined, state), undefined);
  });
});

// ─── resolveNextAction() — conditional nodes ────────────────────────────────

describe('resolveNextAction() — conditional nodes', () => {
  it('expands body nodes when condition is truthy and returns first body step action', () => {
    const nodes = {
      start: makeDagNode({ id: 'start', status: 'complete', depends_on: [], action: 'spawn_research' }),
      cond: makeDagNode({
        id: 'cond',
        type: 'conditional',
        status: 'not_started',
        depends_on: ['start'],
        condition: 'config.code_review_enabled',
        body: [
          { id: 'review', type: 'step', action: 'spawn_code_reviewer', events: { completed: 'review_done' } },
        ],
      }),
      finish: makeDagNode({ id: 'finish', status: 'not_started', depends_on: ['cond'], action: 'display_complete' }),
    };
    const state = makeStateWithDag(nodes, ['start', 'cond', 'finish']);
    state.config = { code_review_enabled: true };
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'spawn_code_reviewer');
    // Body node should exist with scoped ID
    assert.ok(state.dag.nodes['cond.review'], 'body node should be expanded with scoped ID');
    // Container should be removed
    assert.equal(state.dag.nodes['cond'], undefined, 'conditional container should be deleted');
  });

  it('marks conditional as skipped when condition is falsy and proceeds to next node', () => {
    const nodes = {
      start: makeDagNode({ id: 'start', status: 'complete', depends_on: [], action: 'spawn_research' }),
      cond: makeDagNode({
        id: 'cond',
        type: 'conditional',
        status: 'not_started',
        depends_on: ['start'],
        condition: 'config.code_review_enabled',
        body: [
          { id: 'review', type: 'step', action: 'spawn_code_reviewer', events: { completed: 'review_done' } },
        ],
      }),
      finish: makeDagNode({ id: 'finish', status: 'not_started', depends_on: ['cond'], action: 'spawn_prd' }),
    };
    const state = makeStateWithDag(nodes, ['start', 'cond', 'finish']);
    state.config = { code_review_enabled: false };
    const result = resolveNextAction(state, DEFAULT_CONFIG);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(state.dag.nodes['cond'].status, 'skipped');
  });

  it('body nodes get scoped IDs and correct depends_on wiring', () => {
    const nodes = {
      start: makeDagNode({ id: 'start', status: 'complete', depends_on: [] }),
      cond: makeDagNode({
        id: 'cond',
        type: 'conditional',
        status: 'not_started',
        depends_on: ['start'],
        condition: 'config.enabled',
        body: [
          { id: 'step_a', type: 'step', action: 'spawn_research', events: { completed: 'a_done' } },
          { id: 'step_b', type: 'step', depends_on: ['step_a'], action: 'spawn_prd', events: { completed: 'b_done' } },
        ],
      }),
      finish: makeDagNode({ id: 'finish', status: 'not_started', depends_on: ['cond'], action: 'display_complete' }),
    };
    const state = makeStateWithDag(nodes, ['start', 'cond', 'finish']);
    state.config = { enabled: true };
    resolveNextAction(state, DEFAULT_CONFIG);

    assert.ok(state.dag.nodes['cond.step_a']);
    assert.ok(state.dag.nodes['cond.step_b']);
    assert.deepStrictEqual(state.dag.nodes['cond.step_a'].depends_on, ['start']);
    assert.deepStrictEqual(state.dag.nodes['cond.step_b'].depends_on, ['cond.step_a']);
    assert.deepStrictEqual(state.dag.nodes['finish'].depends_on, ['cond.step_b']);
  });
});

// ─── resolveNextAction() — parallel nodes ───────────────────────────────────

describe('resolveNextAction() — parallel nodes', () => {
  it('expands 2 branches into sequential nodes; branch 2 entry depends on branch 1 exit', () => {
    const nodes = {
      start: makeDagNode({ id: 'start', status: 'complete', depends_on: [] }),
      par: makeDagNode({
        id: 'par',
        type: 'parallel',
        status: 'not_started',
        depends_on: ['start'],
        branches: [
          [{ id: 'a', type: 'step', action: 'spawn_research', events: { completed: 'a_done' } }],
          [{ id: 'b', type: 'step', action: 'spawn_prd', events: { completed: 'b_done' } }],
        ],
      }),
      finish: makeDagNode({ id: 'finish', status: 'not_started', depends_on: ['par'], action: 'display_complete' }),
    };
    const state = makeStateWithDag(nodes, ['start', 'par', 'finish']);
    const result = resolveNextAction(state, DEFAULT_CONFIG);

    // First branch's first node should be the action
    assert.equal(result.action, 'spawn_research');

    // Branch 2 entry depends on branch 1 exit
    assert.deepStrictEqual(state.dag.nodes['par.B02.b'].depends_on, ['par.B01.a']);
    // Downstream depends on last branch exit
    assert.deepStrictEqual(state.dag.nodes['finish'].depends_on, ['par.B02.b']);
    // Container removed
    assert.equal(state.dag.nodes['par'], undefined);
  });

  it('branch nodes get scoped IDs with B{NN} prefix', () => {
    const nodes = {
      start: makeDagNode({ id: 'start', status: 'complete', depends_on: [] }),
      par: makeDagNode({
        id: 'par',
        type: 'parallel',
        status: 'not_started',
        depends_on: ['start'],
        branches: [
          [
            { id: 's1', type: 'step', action: 'spawn_research', events: { completed: 'd1' } },
            { id: 's2', type: 'step', depends_on: ['s1'], action: 'spawn_prd', events: { completed: 'd2' } },
          ],
          [
            { id: 's3', type: 'step', action: 'spawn_design', events: { completed: 'd3' } },
          ],
        ],
      }),
      finish: makeDagNode({ id: 'finish', status: 'not_started', depends_on: ['par'], action: 'display_complete' }),
    };
    const state = makeStateWithDag(nodes, ['start', 'par', 'finish']);
    resolveNextAction(state, DEFAULT_CONFIG);

    assert.ok(state.dag.nodes['par.B01.s1']);
    assert.ok(state.dag.nodes['par.B01.s2']);
    assert.ok(state.dag.nodes['par.B02.s3']);
    // Intra-branch dep
    assert.deepStrictEqual(state.dag.nodes['par.B01.s2'].depends_on, ['par.B01.s1']);
    // Branch 2 entry depends on branch 1 exit (s2)
    assert.deepStrictEqual(state.dag.nodes['par.B02.s3'].depends_on, ['par.B01.s2']);
    // Downstream depends on last branch exit
    assert.deepStrictEqual(state.dag.nodes['finish'].depends_on, ['par.B02.s3']);
  });
});

// ─── resolveNextAction() — depth guard ──────────────────────────────────────

describe('resolveNextAction() — depth guard', () => {
  it('returns display_halted if expansion depth exceeds MAX_EXPANSION_DEPTH', () => {
    // Use _depth parameter directly to simulate deep recursion
    const nodes = {
      a: makeDagNode({ id: 'a', status: 'not_started', depends_on: [], action: 'spawn_research' }),
    };
    const state = makeStateWithDag(nodes, ['a']);
    const result = resolveNextAction(state, DEFAULT_CONFIG, 21);
    assert.equal(result.action, NEXT_ACTIONS.DISPLAY_HALTED);
    assert.ok(result.context.details.includes('depth'));
  });
});

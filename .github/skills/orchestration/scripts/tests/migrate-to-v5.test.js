'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { detectVersion, reconstructDagState, migrateToV5, migrateProject } = require('../migrate-to-v5.js');
const {
  createBaseState,
  createExecutionState,
  createReviewState,
  createDefaultConfig,
  makeExpandedDag,
  deepClone,
} = require('./helpers/test-helpers.js');
const { SCHEMA_VERSION_V5, DAG_NODE_STATUSES } = require('../lib/constants.js');
const { validateTransition } = require('../lib/validator.js');

// Load the expanded "full" template once for all tests
const fullDag = makeExpandedDag('full');

// ─── detectVersion ──────────────────────────────────────────────────────────

describe('detectVersion', () => {
  it('returns v4 for orchestration-state-v4', () => {
    assert.equal(detectVersion({ $schema: 'orchestration-state-v4' }), 'v4');
  });

  it('returns v5 for orchestration-state-v5', () => {
    assert.equal(detectVersion({ $schema: 'orchestration-state-v5' }), 'v5');
  });

  it('returns unknown for garbage schema', () => {
    assert.equal(detectVersion({ $schema: 'garbage' }), 'unknown');
  });

  it('returns unknown for missing schema', () => {
    assert.equal(detectVersion({}), 'unknown');
  });
});

// ─── reconstructDagState — planning stage ────────────────────────────────────

describe('reconstructDagState — planning stage', () => {
  it('mid-planning: first 2 steps complete, 3rd in_progress', () => {
    const state = createBaseState({
      pipeline: { current_tier: 'planning' },
      planning: {
        status: 'in_progress',
        human_approved: false,
        steps: [
          { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
          { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
          { name: 'design', status: 'in_progress', doc_path: null },
          { name: 'architecture', status: 'not_started', doc_path: null },
          { name: 'master_plan', status: 'not_started', doc_path: null },
        ],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes.research.status, 'complete');
    assert.equal(nodes.create_prd.status, 'complete');
    assert.equal(nodes.create_design.status, 'in_progress');
    assert.equal(nodes.create_architecture.status, 'not_started');
    assert.equal(nodes.create_master_plan.status, 'not_started');
    assert.equal(nodes.request_plan_approval.status, 'not_started');
  });

  it('all planning complete, awaiting gate', () => {
    const state = createBaseState({
      pipeline: { current_tier: 'planning' },
      planning: {
        status: 'complete',
        human_approved: false,
        steps: [
          { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
          { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
          { name: 'design', status: 'complete', doc_path: 'docs/design.md' },
          { name: 'architecture', status: 'complete', doc_path: 'docs/architecture.md' },
          { name: 'master_plan', status: 'complete', doc_path: 'docs/master_plan.md' },
        ],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes.research.status, 'complete');
    assert.equal(nodes.create_prd.status, 'complete');
    assert.equal(nodes.create_design.status, 'complete');
    assert.equal(nodes.create_architecture.status, 'complete');
    assert.equal(nodes.create_master_plan.status, 'complete');
    assert.equal(nodes.request_plan_approval.status, 'in_progress');
  });

  it('gate approved: all step nodes + gate node complete', () => {
    const state = createBaseState({
      pipeline: { current_tier: 'planning' },
      planning: {
        status: 'complete',
        human_approved: true,
        steps: [
          { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
          { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
          { name: 'design', status: 'complete', doc_path: 'docs/design.md' },
          { name: 'architecture', status: 'complete', doc_path: 'docs/architecture.md' },
          { name: 'master_plan', status: 'complete', doc_path: 'docs/master_plan.md' },
        ],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes.request_plan_approval.status, 'complete');
    // Execution nodes still not_started
    assert.equal(nodes.for_each_phase.status, 'not_started');
    assert.equal(nodes.create_final_review.status, 'not_started');
  });
});

// ─── reconstructDagState — execution stage ───────────────────────────────────

describe('reconstructDagState — execution stage', () => {
  it('mid-phase: phase 1 complete, phase 2 executing with task 1 complete, task 2 in coding', () => {
    const state = createExecutionState({
      execution: {
        status: 'in_progress',
        current_phase: 2,
        phases: [
          {
            name: 'Phase 1',
            status: 'complete',
            stage: 'complete',
            current_task: 1,
            tasks: [{
              name: 'T01',
              status: 'complete',
              stage: 'complete',
              docs: { handoff: 'h.md', review: 'rv.md' },
              review: { verdict: 'approved', action: 'advanced' },
              retries: 0,
            }],
            docs: { phase_plan: 'pp.md', phase_report: 'pr.md', phase_review: 'prv.md' },
            review: { verdict: 'approved', action: 'advanced' },
          },
          {
            name: 'Phase 2',
            status: 'in_progress',
            stage: 'executing',
            current_task: 2,
            tasks: [
              {
                name: 'T01',
                status: 'complete',
                stage: 'complete',
                docs: { handoff: 'h.md', review: 'rv.md' },
                review: { verdict: 'approved', action: 'advanced' },
                retries: 0,
              },
              {
                name: 'T02',
                status: 'in_progress',
                stage: 'coding',
                docs: { handoff: 'h2.md', review: null },
                review: { verdict: null, action: null },
                retries: 0,
              },
            ],
            docs: { phase_plan: 'pp2.md', phase_report: null, phase_review: null },
            review: { verdict: null, action: null },
          },
        ],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    // Phase 1 — all complete
    assert.equal(nodes['P01.create_phase_plan'].status, 'complete');
    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'complete');
    assert.equal(nodes['P01.T01.code_review'].status, 'complete');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'complete');
    assert.equal(nodes['P01.generate_phase_report'].status, 'complete');
    assert.equal(nodes['P01.phase_review'].status, 'complete');

    // Phase 2 — mixed
    assert.equal(nodes['P02.create_phase_plan'].status, 'complete');
    assert.equal(nodes['P02.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P02.T01.execute_coding_task'].status, 'complete');
    assert.equal(nodes['P02.T01.code_review'].status, 'complete');
    assert.equal(nodes['P02.T01.source_control_commit'].status, 'complete');
    assert.equal(nodes['P02.T02.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P02.T02.execute_coding_task'].status, 'in_progress');
    assert.equal(nodes['P02.T02.code_review'].status, 'not_started');
    assert.equal(nodes['P02.T02.source_control_commit'].status, 'not_started');
    assert.equal(nodes['P02.generate_phase_report'].status, 'not_started');
    assert.equal(nodes['P02.phase_review'].status, 'not_started');

    // Final review nodes — not_started
    assert.equal(nodes.create_final_review.status, 'not_started');
  });
});

// ─── reconstructDagState — mid-task stages ───────────────────────────────────

describe('reconstructDagState — mid-task stages', () => {
  function createTaskStageState(stage, extra = {}) {
    const taskDefaults = {
      name: 'T01',
      status: stage === 'complete' ? 'complete' : 'in_progress',
      stage,
      docs: { handoff: stage !== 'planning' ? 'h.md' : null, review: null },
      review: { verdict: null, action: null },
      retries: 0,
    };
    if (stage === 'failed') {
      taskDefaults.status = 'in_progress';
      taskDefaults.review = { verdict: 'rejected', action: null };
    }
    const task = { ...taskDefaults, ...extra };

    return createExecutionState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [task],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
  }

  it('task in planning stage', () => {
    const state = createTaskStageState('planning');
    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'in_progress');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'not_started');
    assert.equal(nodes['P01.T01.code_review'].status, 'not_started');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });

  it('task in coding stage', () => {
    const state = createTaskStageState('coding');
    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'in_progress');
    assert.equal(nodes['P01.T01.code_review'].status, 'not_started');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });

  it('task in reviewing stage', () => {
    const state = createTaskStageState('reviewing');
    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'complete');
    assert.equal(nodes['P01.T01.code_review'].status, 'in_progress');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });

  it('task in failed stage', () => {
    const state = createTaskStageState('failed');
    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'complete');
    assert.equal(nodes['P01.T01.code_review'].status, 'failed');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });
});

// ─── reconstructDagState — review stage ──────────────────────────────────────

describe('reconstructDagState — review stage', () => {
  it('create_final_review in_progress when final_review.status is in_progress', () => {
    const state = createReviewState({
      final_review: { status: 'in_progress', doc_path: null, human_approved: false },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes.create_final_review.status, 'in_progress');
    assert.equal(nodes.invoke_source_control_pr.status, 'not_started');
    assert.equal(nodes.request_final_approval.status, 'not_started');
  });

  it('create_final_review complete when final_review.status is complete', () => {
    const state = createReviewState({
      final_review: { status: 'complete', doc_path: 'fr.md', human_approved: false },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    assert.equal(nodes.create_final_review.status, 'complete');
    // PR not created yet (no pr_url in pipeline)
    assert.equal(nodes.invoke_source_control_pr.status, 'not_started');
    assert.equal(nodes.request_final_approval.status, 'not_started');
  });
});

// ─── reconstructDagState — complete state ────────────────────────────────────

describe('reconstructDagState — complete state', () => {
  it('all nodes marked complete', () => {
    const state = createReviewState({
      pipeline: { current_tier: 'complete' },
      final_review: { status: 'complete', doc_path: 'fr.md', human_approved: true },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    for (const [id, node] of Object.entries(nodes)) {
      assert.equal(node.status, 'complete', `Node ${id} should be complete but is ${node.status}`);
    }
  });
});

// ─── reconstructDagState — halted state ──────────────────────────────────────

describe('reconstructDagState — halted state', () => {
  it('active node marked halted, completed nodes stay complete', () => {
    const state = createExecutionState({
      pipeline: { current_tier: 'halted' },
      execution: {
        status: 'halted',
        current_phase: 1,
        phases: [{
          name: 'Phase 1',
          status: 'halted',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01',
            status: 'halted',
            stage: 'coding',
            docs: { handoff: 'h.md', review: null },
            review: { verdict: null, action: null },
            retries: 0,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    // Planning nodes complete
    assert.equal(nodes.research.status, 'complete');
    assert.equal(nodes.request_plan_approval.status, 'complete');

    // Phase plan complete
    assert.equal(nodes['P01.create_phase_plan'].status, 'complete');

    // Task handoff complete (stage is coding, so handoff is done)
    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');

    // Execute was in_progress → now halted
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'halted');

    // Remaining not started
    assert.equal(nodes['P01.T01.code_review'].status, 'not_started');
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });
});

// ─── migrateToV5 ─────────────────────────────────────────────────────────────

describe('migrateToV5', () => {
  it('produces valid v5 state with correct schema, dag, and config sections', () => {
    const state = createBaseState();
    const result = migrateToV5(state, fullDag);

    assert.equal(result.$schema, SCHEMA_VERSION_V5);
    assert.ok(result.dag);
    assert.equal(result.dag.template_name, 'full');
    assert.ok(result.dag.nodes);
    assert.ok(Array.isArray(result.dag.execution_order));
    assert.ok(result.config);
    assert.ok(result.config.limits);
    assert.ok(result.config.human_gates);
    assert.equal(result.pipeline.template, 'full');
  });

  it('preserves pipeline.gate_mode and pipeline.source_control', () => {
    const state = createExecutionState({
      pipeline: {
        current_tier: 'execution',
        gate_mode: 'autonomous',
        source_control: {
          branch: 'feat/test',
          base_branch: 'main',
          worktree_path: '/tmp/wt',
          auto_commit: 'always',
          auto_pr: 'never',
        },
      },
    });

    const result = migrateToV5(state, fullDag);

    assert.equal(result.pipeline.gate_mode, 'autonomous');
    assert.deepEqual(result.pipeline.source_control, {
      branch: 'feat/test',
      base_branch: 'main',
      worktree_path: '/tmp/wt',
      auto_commit: 'always',
      auto_pr: 'never',
    });
  });

  it('uses v4 state config when present', () => {
    const state = createBaseState({
      config: {
        limits: {
          max_phases: 5,
          max_tasks_per_phase: 4,
          max_retries_per_task: 1,
          max_consecutive_review_rejections: 2,
        },
        human_gates: {
          after_planning: false,
          execution_mode: 'autonomous',
          after_final_review: false,
        },
      },
    });

    const result = migrateToV5(state, fullDag);

    assert.equal(result.config.limits.max_phases, 5);
    assert.equal(result.config.limits.max_tasks_per_phase, 4);
    assert.equal(result.config.human_gates.after_planning, false);
    assert.equal(result.config.human_gates.execution_mode, 'autonomous');
  });

  it('uses defaults when v4 state has no config', () => {
    const state = createBaseState();
    const result = migrateToV5(state, fullDag);

    assert.equal(result.config.limits.max_phases, 10);
    assert.equal(result.config.limits.max_tasks_per_phase, 8);
    assert.equal(result.config.human_gates.after_planning, true);
    assert.equal(result.config.human_gates.execution_mode, 'ask');
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('migrateProject returns success without modifying v5 state', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-v5-'));
    try {
      const v5State = { $schema: 'orchestration-state-v5' };
      fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(v5State), 'utf8');

      const result = migrateProject(tmpDir);

      assert.equal(result.success, true);
      assert.equal(result.error, null);

      // State should be unchanged
      const after = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf8'));
      assert.equal(after.$schema, 'orchestration-state-v5');

      // No backup created for v5 state
      assert.equal(fs.existsSync(path.join(tmpDir, 'state.v4.json.bak')), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

// ─── Round-trip validation ───────────────────────────────────────────────────

describe('round-trip validation', () => {
  const config = createDefaultConfig();

  it('migrated planning state passes validation', () => {
    const state = createBaseState({
      pipeline: { current_tier: 'planning' },
      planning: {
        status: 'in_progress',
        human_approved: false,
        steps: [
          { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
          { name: 'prd', status: 'in_progress', doc_path: null },
          { name: 'design', status: 'not_started', doc_path: null },
          { name: 'architecture', status: 'not_started', doc_path: null },
          { name: 'master_plan', status: 'not_started', doc_path: null },
        ],
      },
    });

    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });

  it('migrated execution state passes validation', () => {
    const state = createExecutionState();
    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });

  it('migrated review state passes validation', () => {
    const state = createReviewState({
      final_review: { status: 'in_progress', doc_path: null, human_approved: false },
    });
    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });

  it('migrated complete state passes validation', () => {
    const state = createReviewState({
      pipeline: { current_tier: 'complete' },
      final_review: { status: 'complete', doc_path: 'fr.md', human_approved: true },
    });
    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });

  it('migrated halted state passes validation', () => {
    const state = createExecutionState({
      pipeline: { current_tier: 'halted' },
      execution: {
        status: 'halted',
        current_phase: 1,
        phases: [{
          name: 'Phase 1',
          status: 'halted',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01',
            status: 'halted',
            stage: 'coding',
            docs: { handoff: 'h.md', review: null },
            review: { verdict: null, action: null },
            retries: 0,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });
});

// ─── Corrective task state ───────────────────────────────────────────────────

describe('corrective task state', () => {
  it('task with retries > 0 and corrective_task_issued maps correctly', () => {
    const state = createExecutionState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01',
            status: 'in_progress',
            stage: 'coding',
            docs: { handoff: 'h.md', review: 'rv.md' },
            review: { verdict: 'changes_requested', action: 'corrective_task_issued' },
            retries: 1,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });

    const nodes = reconstructDagState(state, fullDag.nodes);

    // Original nodes complete
    assert.equal(nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task'].status, 'complete');
    assert.equal(nodes['P01.T01.code_review'].status, 'complete');

    // Corrective nodes (r1)
    assert.equal(nodes['P01.T01.create_task_handoff_r1'].status, 'complete');
    assert.equal(nodes['P01.T01.execute_coding_task_r1'].status, 'in_progress');
    assert.equal(nodes['P01.T01.code_review_r1'].status, 'not_started');

    // source_control_commit depends on corrective review, still not started
    assert.equal(nodes['P01.T01.source_control_commit'].status, 'not_started');
  });

  it('corrective task round-trip validation passes', () => {
    const config = createDefaultConfig();
    const state = createExecutionState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01',
            status: 'in_progress',
            stage: 'coding',
            docs: { handoff: 'h.md', review: 'rv.md' },
            review: { verdict: 'changes_requested', action: 'corrective_task_issued' },
            retries: 1,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });

    const migrated = migrateToV5(state, fullDag);
    const errors = validateTransition(null, migrated, config);

    assert.deepEqual(errors, [], `Validation errors: ${JSON.stringify(errors)}`);
  });
});

// ─── migrateProject ──────────────────────────────────────────────────────────

describe('migrateProject', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-v5-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('backs up original state file before writing', () => {
    const state = createBaseState();
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state), 'utf8');

    const result = migrateProject(tmpDir);

    assert.equal(result.success, true, `Migration failed: ${result.error}`);
    assert.ok(fs.existsSync(path.join(tmpDir, 'state.v4.json.bak')), 'Backup file should exist');

    // Backup content matches original
    const backup = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.v4.json.bak'), 'utf8'));
    assert.equal(backup.$schema, 'orchestration-state-v4');

    // Migrated state is v5
    const migrated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf8'));
    assert.equal(migrated.$schema, 'orchestration-state-v5');
  });

  it('returns error when state.json is missing', () => {
    const result = migrateProject(tmpDir);

    assert.equal(result.success, false);
    assert.ok(result.error.includes('Failed to read state.json'));
  });

  it('returns error for unparseable state.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'state.json'), 'not json', 'utf8');

    const result = migrateProject(tmpDir);

    assert.equal(result.success, false);
    assert.ok(result.error.includes('Failed to read state.json'));
  });

  it('returns error for unknown schema version', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'state.json'),
      JSON.stringify({ $schema: 'orchestration-state-v99' }),
      'utf8'
    );

    const result = migrateProject(tmpDir);

    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown schema version'));
  });

  it('returns { success: false } when expandTemplate throws', () => {
    const state = createBaseState();
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state), 'utf8');

    const dagExpander = require('../lib/dag-expander.js');
    const originalExpand = dagExpander.expandTemplate;
    dagExpander.expandTemplate = () => { throw new Error('Cycle detected in DAG'); };

    try {
      const result = migrateProject(tmpDir);
      assert.equal(result.success, false);
      assert.ok(result.error.includes('Failed to expand template'), `Expected error to contain 'Failed to expand template', got: ${result.error}`);
    } finally {
      dagExpander.expandTemplate = originalExpand;
    }
  });
});

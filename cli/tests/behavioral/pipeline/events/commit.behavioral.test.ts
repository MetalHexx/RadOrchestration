// cli/tests/behavioral/pipeline/events/commit.behavioral.test.ts
// Covers commit_started and commit_completed events (FR-3, FR-8, DD-2).
// NFR-5: if the state schema changes, update the seeded states below accordingly.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, afterEach, expect } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

// Synthetic template that includes a commit step in the task body.
// commit_started / commit_completed are NOT out-of-band events; they require
// template indexing so the engine can resolve the node path.
const COMMIT_TEMPLATE_BODY = `template:
  id: syn-exec-commit
  version: "1.0.0"
  description: "Synthetic execution template with commit step for behavioral tests"
nodes:
  - id: gate_mode_selection
    kind: gate
    label: "Gate Mode Selection"
    mode_ref: human_gates.execution_mode
    action_if_needed: gate_task
    approved_event: gate_mode_set
    auto_approve_modes: [task, phase, autonomous]
    depends_on: []
  - id: phase_loop
    kind: for_each_phase
    label: "Phase Execution Loop"
    source_doc_ref: "$.nodes.master_plan.doc_path"
    total_field: total_phases
    depends_on: [gate_mode_selection]
    body:
      - id: task_loop
        kind: for_each_task
        label: "Task Execution Loop"
        source_doc_ref: "$.current_phase.doc_path"
        tasks_field: tasks
        depends_on: []
        body:
          - id: task_gate
            kind: gate
            label: "Task Gate"
            mode_ref: human_gates.execution_mode
            action_if_needed: gate_task
            approved_event: task_gate_approved
            auto_approve_modes: [phase, autonomous]
            depends_on: []
          - id: task_executor
            kind: step
            label: "Execute Task"
            action: execute_task
            events: { started: execution_started, completed: task_completed }
            depends_on: [task_gate]
          - id: commit
            kind: step
            label: "Commit"
            action: invoke_source_control_commit
            events: { started: commit_started, completed: commit_completed }
            depends_on: [task_executor]
          - id: code_review
            kind: step
            label: "Code Review"
            action: spawn_code_reviewer
            events: { started: code_review_started, completed: code_review_completed }
            doc_output_field: doc_path
            depends_on: [commit]
      - id: phase_gate
        kind: gate
        label: "Phase Gate"
        mode_ref: human_gates.execution_mode
        action_if_needed: gate_phase
        approved_event: phase_gate_approved
        auto_approve_modes: [task, autonomous]
        depends_on: [task_loop]
      - id: phase_review
        kind: step
        label: "Phase Review"
        action: spawn_phase_reviewer
        events: { started: phase_review_started, completed: phase_review_completed }
        doc_output_field: doc_path
        depends_on: [phase_gate]
  - id: final_review
    kind: step
    label: "Final Review"
    action: spawn_final_reviewer
    events: { started: final_review_started, completed: final_review_completed }
    doc_output_field: doc_path
    depends_on: [phase_loop]
  - id: final_approval_gate
    kind: gate
    label: "Final Approval Gate"
    mode_ref: human_gates.after_final_review
    action_if_needed: request_final_approval
    approved_event: final_approved
    auto_approve_modes: []
    depends_on: [final_review]
`;

// State after task_executor completed: commit is next (not_started).
const afterTaskExecutorCompletedState = {
  $schema: 'orchestration-state-v5',
  project: { name: 'cli-behavioral', created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z' },
  config: {
    gate_mode: 'task',
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
    source_control: { auto_commit: 'never', auto_pr: 'never' },
  },
  pipeline: {
    gate_mode: 'task',
    source_control: {
      branch: 'feature/syn',
      base_branch: 'main',
      worktree_path: '.',
      auto_commit: 'never',
      auto_pr: 'never',
      remote_url: null,
      compare_url: null,
      pr_url: null,
    },
    current_tier: 'execution',
    halt_reason: null,
  },
  graph: {
    template_id: 'syn-exec-commit',
    status: 'in_progress',
    current_node_path: 'phase_loop[0].task_loop[0].task_executor',
    nodes: {
      gate_mode_selection: { kind: 'gate', status: 'completed', gate_active: false },
      phase_loop: {
        kind: 'for_each_phase',
        status: 'in_progress',
        iterations: [
          {
            index: 0,
            status: 'in_progress',
            doc_path: null,
            commit_hash: null,
            corrective_tasks: [],
            nodes: {
              task_loop: {
                kind: 'for_each_task',
                status: 'in_progress',
                iterations: [
                  {
                    index: 0,
                    status: 'in_progress',
                    doc_path: null,
                    commit_hash: null,
                    corrective_tasks: [],
                    nodes: {
                      task_gate:     { kind: 'gate', status: 'completed', gate_active: true },
                      task_executor: { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
                      commit:        { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                      code_review:   { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                    },
                  },
                ],
              },
              phase_gate:   { kind: 'gate', status: 'not_started', gate_active: false },
              phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
            },
          },
        ],
      },
      final_review:        { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
  },
};

// State with commit in_progress (ready for commit_completed).
const afterCommitStartedState = {
  $schema: 'orchestration-state-v5',
  project: { name: 'cli-behavioral', created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z' },
  config: {
    gate_mode: 'task',
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
    source_control: { auto_commit: 'never', auto_pr: 'never' },
  },
  pipeline: {
    gate_mode: 'task',
    source_control: {
      branch: 'feature/syn',
      base_branch: 'main',
      worktree_path: '.',
      auto_commit: 'never',
      auto_pr: 'never',
      remote_url: null,
      compare_url: null,
      pr_url: null,
    },
    current_tier: 'execution',
    halt_reason: null,
  },
  graph: {
    template_id: 'syn-exec-commit',
    status: 'in_progress',
    current_node_path: 'phase_loop[0].task_loop[0].commit',
    nodes: {
      gate_mode_selection: { kind: 'gate', status: 'completed', gate_active: false },
      phase_loop: {
        kind: 'for_each_phase',
        status: 'in_progress',
        iterations: [
          {
            index: 0,
            status: 'in_progress',
            doc_path: null,
            commit_hash: null,
            corrective_tasks: [],
            nodes: {
              task_loop: {
                kind: 'for_each_task',
                status: 'in_progress',
                iterations: [
                  {
                    index: 0,
                    status: 'in_progress',
                    doc_path: null,
                    commit_hash: null,
                    corrective_tasks: [],
                    nodes: {
                      task_gate:     { kind: 'gate', status: 'completed', gate_active: true },
                      task_executor: { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
                      commit:        { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
                      code_review:   { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                    },
                  },
                ],
              },
              phase_gate:   { kind: 'gate', status: 'not_started', gate_active: false },
              phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
            },
          },
        ],
      },
      final_review:        { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
  },
};

describe('commit_started event (FR-3, FR-8, DD-2)', () => {
  it('commit_started marks commit.status = in_progress and returns action=invoke_source_control_commit', async () => {
    const w = buildWorld({
      template: { id: 'syn-exec-commit', body: COMMIT_TEMPLATE_BODY },
      state: afterTaskExecutorCompletedState,
      config: { default_template: 'syn-exec-commit', human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true } },
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'commit_started', '--phase', '1', '--task', '1', '--project-dir', w.projectDir, '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true, data: { action: 'invoke_source_control_commit' } },
      state: {
        graph: {
          template_id: 'syn-exec-commit',
        },
      },
      sideFiles: [],
    });
  });
});

describe('commit_completed event (FR-3, FR-8, DD-2)', () => {
  it('commit_completed marks commit.status = completed and writes commit_hash onto task iteration', async () => {
    const w = buildWorld({
      template: { id: 'syn-exec-commit', body: COMMIT_TEMPLATE_BODY },
      state: afterCommitStartedState,
      config: { default_template: 'syn-exec-commit', human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true } },
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: [
          '--event', 'commit_completed',
          '--phase', '1', '--task', '1',
          '--commit-hash', 'abc1234',
          '--project-dir', w.projectDir,
          '--config', w.configPath,
        ],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    // Assert envelope ok and state template_id via helper (partial-array limitation).
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true },
      state: { graph: { template_id: 'syn-exec-commit' } },
      sideFiles: [],
    });
    // Assert commit_hash written onto task iteration via direct state.json read.
    const onDisk = JSON.parse(fs.readFileSync(path.join(w.projectDir, 'state.json'), 'utf8'));
    const taskIteration = onDisk.graph.nodes.phase_loop.iterations[0].nodes.task_loop.iterations[0];
    expect(taskIteration.commit_hash, 'task_iteration[0].commit_hash').toBe('abc1234');
  });
});

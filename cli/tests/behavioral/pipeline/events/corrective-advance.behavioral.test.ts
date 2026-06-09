// cli/tests/behavioral/pipeline/events/corrective-advance.behavioral.test.ts
//
// Full-engine-flow coverage for corrective task advancement
// (signal → mutation → pre-walk validate → walkDAG → recompute → post-walk validate).
//
// Regression guard: the `current_node_path` honesty tripwire used to run at the
// PRE-walk validate (before the cursor is recomputed), so completing a
// corrective's child node — which leaves the corrective ENTRY in_progress with
// no in_progress child leaf, a state for which deriveCurrentNodePathFromMarkers
// returns the non-null entry path — spuriously disagreed with the stale cursor
// and rejected the mutation. The fix gates that check to the post-walk validate
// only. These tests prove BOTH phase-level and task-level correctives advance
// end-to-end through the real signal entry.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, afterEach, beforeEach, expect } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { useRealCatalog } from '../helpers/catalog.js';
import { assertPromptForEnvelopeAction } from '../helpers/prompt.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
beforeEach(() => { cleanups.push(useRealCatalog()); });

// Synthetic execution template: task body is task_gate → task_executor → commit
// → code_review. findTaskLoopBodyDefs mirrors this body into corrective entries
// (both phase- and task-scope), so a corrective walks the same four nodes.
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
            events: { completed: task_completed }
            depends_on: [task_gate]
          - id: commit
            kind: step
            label: "Commit"
            action: invoke_source_control_commit
            events: { completed: commit_completed }
            depends_on: [task_executor]
          - id: code_review
            kind: step
            label: "Code Review"
            action: spawn_code_reviewer
            events: { completed: code_review_completed }
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
        events: { completed: phase_review_completed }
        doc_output_field: doc_path
        depends_on: [phase_gate]
  - id: final_review
    kind: step
    label: "Final Review"
    action: spawn_final_reviewer
    events: { completed: final_review_completed }
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

// ── Node builders (schema-conformant v6 shapes) ──────────────────────────────
const step = (status: string) => ({ kind: 'step', status, doc_path: null, retries: 0 });
const gate = (status: string, gate_active: boolean) => ({ kind: 'gate', status, gate_active });

/** Corrective body nodes mirroring the task body. */
function correctiveNodes(taskExecutor: string, commit: string, codeReview: string) {
  return {
    task_gate: gate('completed', true),
    task_executor: step(taskExecutor),
    commit: step(commit),
    code_review: step(codeReview),
  };
}

/** Build a full v6 state with the project frame shared across these tests. */
function baseState(currentNodePath: string, phaseIteration: Record<string, unknown>) {
  return {
    $schema: 'orchestration-state-v6',
    project: { name: 'cli-behavioral', created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z' },
    config: {
      gate_mode: 'autonomous',
      limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
      source_control: { auto_commit: 'always', auto_pr: 'never' },
    },
    pipeline: {
      gate_mode: 'autonomous',
      source_control: {
        branch: 'feature/syn', base_branch: 'main', worktree_path: '.',
        auto_commit: 'always', auto_pr: 'never', remote_url: null, compare_url: null, pr_url: null,
      },
      current_tier: 'execution',
      halt_reason: null,
    },
    graph: {
      template_id: 'syn-exec-commit',
      status: 'in_progress',
      current_node_path: currentNodePath,
      nodes: {
        gate_mode_selection: gate('completed', false),
        phase_loop: { kind: 'for_each_phase', status: 'in_progress', iterations: [phaseIteration] },
        final_review: step('not_started'),
        final_approval_gate: gate('not_started', false),
      },
    },
  };
}

/** A completed original task body (the work that ran before a corrective). */
function completedTaskIteration(commitHash: string | null) {
  return {
    index: 0, status: 'completed', doc_path: null,
    repos: [{ name: 'backend', commit_hash: commitHash }],
    corrective_tasks: [],
    nodes: {
      task_gate: gate('completed', true),
      task_executor: step('completed'),
      commit: step('completed'),
      code_review: step('completed'),
    },
  };
}

// ── Phase-scope corrective states ────────────────────────────────────────────
function phaseCorrectiveState(cursor: string, nodes: Record<string, unknown>, repos = [{ name: 'backend', commit_hash: null }]) {
  return baseState(cursor, {
    index: 0, status: 'in_progress', doc_path: null, repos: [],
    corrective_tasks: [
      { index: 1, reason: 'phase review requested changes', injected_after: 'phase_review', status: 'in_progress', doc_path: null, repos, nodes },
    ],
    nodes: {
      task_loop: { kind: 'for_each_task', status: 'completed', iterations: [completedTaskIteration('aaa1111')] },
      phase_gate: gate('completed', false),
      phase_review: step('completed'),
    },
  });
}

// ── Task-scope corrective state ───────────────────────────────────────────────
function taskCorrectiveState(cursor: string, nodes: Record<string, unknown>) {
  const taskIter = completedTaskIteration('aaa1111');
  (taskIter as Record<string, unknown>).status = 'in_progress';
  (taskIter as Record<string, unknown>).corrective_tasks = [
    { index: 1, reason: 'code review requested changes', injected_after: 'code_review', status: 'in_progress', doc_path: null, repos: [{ name: 'backend', commit_hash: null }], nodes },
  ];
  return baseState(cursor, {
    index: 0, status: 'in_progress', doc_path: null, repos: [],
    corrective_tasks: [],
    nodes: {
      task_loop: { kind: 'for_each_task', status: 'in_progress', iterations: [taskIter] },
      phase_gate: gate('not_started', false),
      phase_review: step('not_started'),
    },
  });
}

async function signal(projectDir: string, configPath: string, argv: string[]) {
  return captureEnvelope(async () => {
    await runCommand(pipelineSignalCommand, {
      argv: [...argv, '--project-dir', projectDir, '--config', configPath],
      env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: projectDir },
      isTTY: false, stderr: process.stderr,
    });
  });
}

function makeWorld(state: unknown) {
  const w = buildWorld({
    template: { id: 'syn-exec-commit', body: COMMIT_TEMPLATE_BODY },
    state: state as Parameters<typeof buildWorld>[0]['state'],
    config: { default_template: 'syn-exec-commit', human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true } },
    sideFiles: [],
  });
  cleanups.push(w.cleanup);
  return w;
}

function readState(projectDir: string) {
  return JSON.parse(fs.readFileSync(path.join(projectDir, 'state.json'), 'utf8'));
}

describe('corrective task advancement — full engine flow', () => {
  it('phase-corrective task_completed advances to commit without tripping the cursor tripwire (regression)', async () => {
    const w = makeWorld(phaseCorrectiveState(
      'phase_loop[0].corrective_tasks[1].task_executor',
      correctiveNodes('in_progress', 'not_started', 'not_started'),
    ));
    const env = await signal(w.projectDir, w.configPath, ['--event', 'task_completed', '--phase', '1', '--task', '1']);

    expect(env.ok, env.error?.message).toBe(true);
    expect((env.data as { action: string }).action).toBe('invoke_source_control_commit');
    const onDisk = readState(w.projectDir);
    expect(onDisk.graph.current_node_path).toBe('phase_loop[0].corrective_tasks[1].commit');
    const corrective = onDisk.graph.nodes.phase_loop.iterations[0].corrective_tasks[0];
    expect(corrective.nodes.task_executor.status).toBe('completed');
    expect(corrective.nodes.commit.status).toBe('in_progress');
    assertPromptForEnvelopeAction(env);
  });

  it('task-corrective task_completed advances to commit without tripping the cursor tripwire', async () => {
    const w = makeWorld(taskCorrectiveState(
      'phase_loop[0].task_loop[0].corrective_tasks[1].task_executor',
      correctiveNodes('in_progress', 'not_started', 'not_started'),
    ));
    const env = await signal(w.projectDir, w.configPath, ['--event', 'task_completed', '--phase', '1', '--task', '1']);

    expect(env.ok, env.error?.message).toBe(true);
    expect((env.data as { action: string }).action).toBe('invoke_source_control_commit');
    const onDisk = readState(w.projectDir);
    expect(onDisk.graph.current_node_path).toBe('phase_loop[0].task_loop[0].corrective_tasks[1].commit');
    const corrective = onDisk.graph.nodes.phase_loop.iterations[0].nodes.task_loop.iterations[0].corrective_tasks[0];
    expect(corrective.nodes.task_executor.status).toBe('completed');
    expect(corrective.nodes.commit.status).toBe('in_progress');
    assertPromptForEnvelopeAction(env);
  });

  it('phase-corrective commit_completed advances to code review and records the per-corrective hash', async () => {
    const w = makeWorld(phaseCorrectiveState(
      'phase_loop[0].corrective_tasks[1].commit',
      correctiveNodes('completed', 'in_progress', 'not_started'),
    ));
    const env = await signal(w.projectDir, w.configPath, ['--event', 'commit_completed', '--phase', '1', '--task', '1', '--commit-hash', 'cor1234']);

    expect(env.ok, env.error?.message).toBe(true);
    expect((env.data as { action: string }).action).toBe('spawn_code_reviewer');
    const onDisk = readState(w.projectDir);
    expect(onDisk.graph.current_node_path).toBe('phase_loop[0].corrective_tasks[1].code_review');
    const corrective = onDisk.graph.nodes.phase_loop.iterations[0].corrective_tasks[0];
    expect(corrective.repos[0].commit_hash).toBe('cor1234');
    expect(corrective.nodes.commit.status).toBe('completed');
    assertPromptForEnvelopeAction(env);
  });
});

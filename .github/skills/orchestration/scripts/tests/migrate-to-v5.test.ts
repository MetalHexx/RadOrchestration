import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { migrateState, runMigration } from '../migrate-to-v5.js';
import type { PipelineState, StepNodeState, GateNodeState, ForEachPhaseNodeState, ForEachTaskNodeState, ConditionalNodeState } from '../lib/types.js';

// ── Fixture Builders ──────────────────────────────────────────────────────────

function makeV4Task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Sample Task',
    status: 'complete',
    stage: 'complete',
    docs: {
      handoff: 'C:/dev/orchestration-projects/MY-PROJECT/tasks/MY-PROJECT-TASK-P01-T01.md',
      review: 'C:/dev/orchestration-projects/MY-PROJECT/reports/MY-PROJECT-CODE-REVIEW-P01-T01.md',
    },
    review: { verdict: 'approved', action: 'advanced' },
    retries: 0,
    ...overrides,
  };
}

function makeV4Phase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Phase One',
    status: 'complete',
    stage: 'complete',
    current_task: 1,
    tasks: [makeV4Task()],
    docs: {
      phase_plan: 'C:/dev/orchestration-projects/MY-PROJECT/phases/MY-PROJECT-PHASE-01.md',
      phase_report: 'C:/dev/orchestration-projects/MY-PROJECT/reports/MY-PROJECT-PHASE-REPORT-P01.md',
      phase_review: 'C:/dev/orchestration-projects/MY-PROJECT/reports/MY-PROJECT-PHASE-REVIEW-P01.md',
    },
    review: { verdict: 'approved', action: 'advanced' },
    ...overrides,
  };
}

function makeV4State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: 'orchestration-state-v4',
    project: {
      name: 'MY-PROJECT',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-02T00:00:00.000Z',
    },
    pipeline: {
      current_tier: 'complete',
      gate_mode: 'autonomous',
    },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-RESEARCH.md' },
        { name: 'prd', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-PRD.md' },
        { name: 'design', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-ARCHITECTURE.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-MASTER-PLAN.md' },
      ],
    },
    execution: {
      status: 'complete',
      current_phase: 2,
      phases: [makeV4Phase(), makeV4Phase({ name: 'Phase Two' })],
    },
    final_review: {
      status: 'complete',
      doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/reports/MY-PROJECT-FINAL-REVIEW.md',
      human_approved: true,
    },
    config: {
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
    },
    ...overrides,
  };
}

// ── Temp dir helpers (for runMigration I/O tests) ─────────────────────────────

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-v5-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

// ── Helper to cast node from graph.nodes ──────────────────────────────────────

function getNode<T>(state: PipelineState, key: string): T {
  return state.graph.nodes[key] as T;
}

// ── Tests: migrateState() ─────────────────────────────────────────────────────

describe('migrateState()', () => {

  describe('complete project', () => {
    it('sets $schema to orchestration-state-v5', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.$schema).toBe('orchestration-state-v5');
    });

    it('sets graph.status to "completed"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.graph.status).toBe('completed');
    });

    it('sets graph.template_id to "full"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.graph.template_id).toBe('full');
    });

    it('sets graph.current_node_path to null', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.graph.current_node_path).toBeNull();
    });

    it('copies project fields verbatim', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.project).toEqual({
        name: 'MY-PROJECT',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-02T00:00:00.000Z',
      });
    });

    it('sets all planning nodes to "completed"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const stepNames = ['research', 'prd', 'design', 'architecture', 'master_plan'];
      for (const name of stepNames) {
        const node = getNode<StepNodeState>(result, name);
        expect(node.kind).toBe('step');
        expect(node.status).toBe('completed');
        expect(node.retries).toBe(0);
      }
    });

    it('sets plan_approval_gate to "completed" when human_approved is true', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const gate = getNode<GateNodeState>(result, 'plan_approval_gate');
      expect(gate.kind).toBe('gate');
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(false);
    });

    it('populates phase_loop iterations from v4 phases', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      expect(phaseLoop.kind).toBe('for_each_phase');
      expect(phaseLoop.status).toBe('completed');
      expect(phaseLoop.iterations).toHaveLength(2);
    });

    it('sets phase iteration indices correctly (0-based)', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      expect(phaseLoop.iterations[0].index).toBe(0);
      expect(phaseLoop.iterations[1].index).toBe(1);
    });

    it('sets task iteration indices correctly (0-based)', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].index).toBe(0);
    });

    it('sets final_review node to "completed"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const finalReview = getNode<StepNodeState>(result, 'final_review');
      expect(finalReview.status).toBe('completed');
    });

    it('sets final_approval_gate to "completed"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const gate = getNode<GateNodeState>(result, 'final_approval_gate');
      expect(gate.status).toBe('completed');
    });

    it('sets pr_gate to "completed"', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      const prGate = getNode<ConditionalNodeState>(result, 'pr_gate');
      expect(prGate.status).toBe('completed');
      expect(prGate.branch_taken).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('in-progress planning', () => {
    it('sets research and prd to "completed", rest to "not_started"', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        planning: {
          status: 'in_progress',
          human_approved: false,
          steps: [
            { name: 'research', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-RESEARCH.md' },
            { name: 'prd', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-PRD.md' },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'research').status).toBe('completed');
      expect(getNode<StepNodeState>(result, 'prd').status).toBe('completed');
      expect(getNode<StepNodeState>(result, 'design').status).toBe('not_started');
      expect(getNode<StepNodeState>(result, 'architecture').status).toBe('not_started');
      expect(getNode<StepNodeState>(result, 'master_plan').status).toBe('not_started');
    });

    it('sets phase_loop to "not_started" with empty iterations when no execution', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        planning: {
          status: 'in_progress',
          human_approved: false,
          steps: [
            { name: 'research', status: 'complete', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      expect(phaseLoop.status).toBe('not_started');
      expect(phaseLoop.iterations).toHaveLength(0);
    });

    it('sets graph.status to "in_progress"', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.graph.status).toBe('in_progress');
    });

    it('sets plan_approval_gate to "not_started" when human_approved is false', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        planning: {
          status: 'in_progress',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<GateNodeState>(result, 'plan_approval_gate').status).toBe('not_started');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('in-progress execution', () => {
    it('maps first-complete and second-in-progress phases correctly', () => {
      const completedTask = makeV4Task({
        status: 'complete',
        docs: {
          handoff: 'C:/dev/orchestration-projects/MY-PROJECT/tasks/TASK-P01-T01.md',
          review: 'C:/dev/orchestration-projects/MY-PROJECT/reports/REVIEW-P01-T01.md',
        },
        review: { verdict: 'approved', action: 'advanced' },
      });
      const inProgressTask = makeV4Task({
        name: 'Task P02-T01',
        status: 'in_progress',
        docs: {
          handoff: 'C:/dev/orchestration-projects/MY-PROJECT/tasks/TASK-P02-T01.md',
          review: null,
        },
        review: { verdict: null, action: null },
      });
      const notStartedTask = makeV4Task({
        name: 'Task P02-T02',
        status: 'not_started',
        docs: { handoff: null, review: null },
        review: { verdict: null, action: null },
      });

      const phase1 = makeV4Phase({
        name: 'Phase 1',
        status: 'complete',
        tasks: [completedTask],
        docs: {
          phase_plan: 'C:/dev/orchestration-projects/MY-PROJECT/phases/PHASE-01.md',
          phase_report: 'C:/dev/orchestration-projects/MY-PROJECT/reports/PHASE-REPORT-P01.md',
          phase_review: 'C:/dev/orchestration-projects/MY-PROJECT/reports/PHASE-REVIEW-P01.md',
        },
        review: { verdict: 'approved', action: 'advanced' },
      });
      const phase2 = makeV4Phase({
        name: 'Phase 2',
        status: 'in_progress',
        stage: 'execution',
        tasks: [inProgressTask, notStartedTask],
        docs: {
          phase_plan: 'C:/dev/orchestration-projects/MY-PROJECT/phases/PHASE-02.md',
          phase_report: null,
          phase_review: null,
        },
        review: { verdict: null, action: null },
      });

      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: {
          status: 'in_progress',
          current_phase: 2,
          phases: [phase1, phase2],
        },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');

      expect(phaseLoop.iterations).toHaveLength(2);
      expect(phaseLoop.iterations[0].status).toBe('completed');
      expect(phaseLoop.iterations[1].status).toBe('in_progress');

      // Phase 1 task loop should be completed
      const p1TaskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(p1TaskLoop.status).toBe('completed');

      // Phase 2 task loop should be in_progress
      const p2TaskLoop = phaseLoop.iterations[1].nodes['task_loop'] as ForEachTaskNodeState;
      expect(p2TaskLoop.status).toBe('in_progress');
      expect(p2TaskLoop.iterations[0].status).toBe('in_progress');
      expect(p2TaskLoop.iterations[1].status).toBe('not_started');
    });

    it('sets graph.status to "in_progress" for execution tier', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: {
          status: 'in_progress',
          current_phase: 1,
          phases: [makeV4Phase({ status: 'in_progress', tasks: [] })],
        },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.graph.status).toBe('in_progress');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('in review', () => {
    it('sets graph.status to "in_progress" and final_review.status to "completed"', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'review', gate_mode: 'autonomous' },
        final_review: {
          status: 'complete',
          doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/reports/FINAL-REVIEW.md',
          human_approved: false,
        },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.graph.status).toBe('in_progress');
      expect(getNode<StepNodeState>(result, 'final_review').status).toBe('completed');
      expect(getNode<GateNodeState>(result, 'final_approval_gate').status).toBe('not_started');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('halted project', () => {
    it('sets graph.status to "halted"', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'halted', gate_mode: 'autonomous' },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.graph.status).toBe('halted');
    });

    it('sets pipeline.halt_reason to "migrated_from_v4"', () => {
      const v4 = makeV4State({
        pipeline: { current_tier: 'halted', gate_mode: 'autonomous' },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.halt_reason).toBe('migrated_from_v4');
    });

    it('sets pipeline.halt_reason to null for non-halted projects', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.pipeline.halt_reason).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('with corrective tasks (retries > 0)', () => {
    it('synthesizes 2 CorrectiveTaskEntry objects for retries: 2', () => {
      const taskWithRetries = makeV4Task({ retries: 2 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });

      const v4 = makeV4State({
        execution: {
          status: 'complete',
          current_phase: 1,
          phases: [phase],
        },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const correctives = taskLoop.iterations[0].corrective_tasks;

      expect(correctives).toHaveLength(2);
    });

    it('assigns indices 1 and 2 to the corrective entries', () => {
      const taskWithRetries = makeV4Task({ retries: 2 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const correctives = taskLoop.iterations[0].corrective_tasks;

      expect(correctives[0].index).toBe(1);
      expect(correctives[1].index).toBe(2);
    });

    it('sets reason to "migrated_from_v4_retry"', () => {
      const taskWithRetries = makeV4Task({ retries: 1 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;

      expect(taskLoop.iterations[0].corrective_tasks[0].reason).toBe('migrated_from_v4_retry');
    });

    it('sets all corrective task fields correctly', () => {
      const taskWithRetries = makeV4Task({ retries: 1 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const ct = taskLoop.iterations[0].corrective_tasks[0];

      expect(ct.injected_after).toBe('code_review');
      expect(ct.status).toBe('completed');
      expect((ct.nodes['task_handoff'] as StepNodeState).status).toBe('completed');
      expect((ct.nodes['task_executor'] as StepNodeState).status).toBe('completed');
      expect((ct.nodes['code_review'] as StepNodeState).status).toBe('completed');
      expect((ct.nodes['code_review'] as StepNodeState).verdict).toBeNull();
      expect((ct.nodes['task_gate'] as GateNodeState).status).toBe('completed');
      expect((ct.nodes['task_gate'] as GateNodeState).gate_active).toBe(false);
    });

    it('produces empty corrective_tasks for retries: 0', () => {
      const taskNoRetries = makeV4Task({ retries: 0 });
      const phase = makeV4Phase({ tasks: [taskNoRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
    });

    it('sets commit_hash to null on migrated IterationEntry', () => {
      const taskWithRetries = makeV4Task({ retries: 2 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].commit_hash).toBeNull();
    });

    it('sets commit_hash to null on each migrated CorrectiveTaskEntry', () => {
      const taskWithRetries = makeV4Task({ retries: 2 });
      const phase = makeV4Phase({ tasks: [taskWithRetries] });
      const v4 = makeV4State({ execution: { status: 'complete', current_phase: 1, phases: [phase] } });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const correctives = taskLoop.iterations[0].corrective_tasks;
      expect(correctives[0].commit_hash).toBeNull();
      expect(correctives[1].commit_hash).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('with source control', () => {
    it('maps source_control fields to pipeline.source_control', () => {
      const v4 = makeV4State({
        pipeline: {
          current_tier: 'complete',
          gate_mode: 'autonomous',
          source_control: {
            branch: 'feat/my-feature',
            base_branch: 'main',
            worktree_path: 'C:\\dev\\orchestration\\v3-worktrees\\my-feature',
            auto_commit: 'always',
            auto_pr: 'never',
            remote_url: 'https://github.com/org/repo',
            compare_url: 'https://github.com/org/repo/compare/main...feat/my-feature',
          },
        },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.source_control).toEqual({
        branch: 'feat/my-feature',
        base_branch: 'main',
        worktree_path: 'C:\\dev\\orchestration\\v3-worktrees\\my-feature',
        auto_commit: 'always',
        auto_pr: 'never',
        remote_url: 'https://github.com/org/repo',
        compare_url: 'https://github.com/org/repo/compare/main...feat/my-feature',
        pr_url: null,
      });
    });

    it('sets pr_url to null when absent', () => {
      const v4 = makeV4State({
        pipeline: {
          current_tier: 'complete',
          gate_mode: 'autonomous',
          source_control: {
            branch: 'feat/my-feature',
            base_branch: 'main',
            worktree_path: '/path/to/worktree',
            auto_commit: 'always',
            auto_pr: 'never',
          },
        },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.source_control?.pr_url).toBeNull();
    });

    it('migrated pipeline.source_control does not have a commit_hash property', () => {
      const v4 = makeV4State({
        pipeline: {
          current_tier: 'complete',
          gate_mode: 'autonomous',
          source_control: {
            branch: 'feat/my-feature',
            base_branch: 'main',
            worktree_path: '/path/to/worktree',
            auto_commit: 'always',
            auto_pr: 'never',
          },
        },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.source_control).not.toHaveProperty('commit_hash');
    });

    it('commit_hash absent from pipeline.source_control even when v4 source had a commit_hash field', () => {
      const v4 = makeV4State({
        pipeline: {
          current_tier: 'complete',
          gate_mode: 'autonomous',
          source_control: {
            branch: 'branch',
            base_branch: 'main',
            worktree_path: '/path',
            auto_commit: 'always',
            auto_pr: 'never',
            commit_hash: 'oldglobalhash',
          },
        },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.source_control).not.toHaveProperty('commit_hash');
    });

    it('maps auto_commit and auto_pr to config.source_control', () => {
      const v4 = makeV4State({
        pipeline: {
          current_tier: 'complete',
          gate_mode: 'autonomous',
          source_control: {
            branch: 'b',
            base_branch: 'main',
            worktree_path: '/p',
            auto_commit: 'always',
            auto_pr: 'never',
          },
        },
      });
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.config.source_control).toEqual({
        auto_commit: 'always',
        auto_pr: 'never',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('without source control', () => {
    it('sets pipeline.source_control to null', () => {
      const v4 = makeV4State();
      // default makeV4State has no source_control in pipeline
      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.pipeline.source_control).toBeNull();
    });

    it('defaults config.source_control to ask/ask when absent', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.config.source_control).toEqual({
        auto_commit: 'ask',
        auto_pr: 'ask',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('doc_path normalization', () => {
    it('strips absolute path prefix for planning steps (forward slashes)', () => {
      const v4 = makeV4State({
        planning: {
          status: 'complete',
          human_approved: true,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'complete', doc_path: 'C:/dev/orchestration-projects/MY-PROJECT/MY-PROJECT-PRD.md' },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'prd').doc_path).toBe('MY-PROJECT-PRD.md');
    });

    it('normalizes backslash paths to forward-slash project-relative paths', () => {
      const v4 = makeV4State({
        planning: {
          status: 'complete',
          human_approved: true,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'complete', doc_path: 'C:\\dev\\orchestration-projects\\MY-PROJECT\\phases\\MY-PHASE.md' },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'design').doc_path).toBe('phases/MY-PHASE.md');
    });

    it('handles nested paths below the project directory', () => {
      const v4 = makeV4State({
        planning: {
          status: 'complete',
          human_approved: true,
          steps: [
            { name: 'research', status: 'complete', doc_path: 'c:/dev/orchestration-projects/MY-PROJECT/reports/MY-REPORT.md' },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'research').doc_path).toBe('reports/MY-REPORT.md');
    });

    it('leaves already-relative paths unchanged', () => {
      const v4 = makeV4State({
        planning: {
          status: 'complete',
          human_approved: true,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'complete', doc_path: 'MY-PROJECT-DESIGN.md' },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'design').doc_path).toBe('MY-PROJECT-DESIGN.md');
    });

    it('preserves null doc_path as null', () => {
      const v4 = makeV4State({
        planning: {
          status: 'in_progress',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      expect(getNode<StepNodeState>(result, 'research').doc_path).toBeNull();
    });

    it('normalizes phase doc paths to project-relative forward-slash paths', () => {
      const phase = makeV4Phase({
        docs: {
          phase_plan: 'C:/dev/orchestration-projects/MY-PROJECT/phases/MY-PROJECT-PHASE-01.md',
          phase_report: null,
          phase_review: null,
        },
      });
      const v4 = makeV4State({
        execution: { status: 'complete', current_phase: 1, phases: [phase] },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const phasePlanning = phaseLoop.iterations[0].nodes['phase_planning'] as StepNodeState;
      expect(phasePlanning.doc_path).toBe('phases/MY-PROJECT-PHASE-01.md');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('config defaults', () => {
    it('applies default limits when config section is absent', () => {
      const v4: Record<string, unknown> = {
        $schema: 'orchestration-state-v4',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        planning: {
          status: 'not_started',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
        // no config section
      };

      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.config.limits).toEqual({
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      });
    });

    it('derives gate_mode from human_gates.execution_mode when pipeline.gate_mode is missing', () => {
      const v4: Record<string, unknown> = {
        $schema: 'orchestration-state-v4',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        pipeline: { current_tier: 'planning' },
        planning: {
          status: 'not_started',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
        config: {
          human_gates: { after_planning: true, execution_mode: 'phase', after_final_review: true },
        },
      };

      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.config.gate_mode).toBe('phase');
    });

    it('defaults gate_mode to "ask" when both pipeline.gate_mode and human_gates are absent', () => {
      const v4: Record<string, unknown> = {
        $schema: 'orchestration-state-v4',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        pipeline: { current_tier: 'planning' },
        planning: {
          status: 'not_started',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      };

      const result = migrateState(v4, 'MY-PROJECT');
      expect(result.config.gate_mode).toBe('ask');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('empty execution phases', () => {
    it('sets phase_loop.iterations to [] and status to "not_started"', () => {
      const v4 = makeV4State({
        execution: {
          status: 'not_started',
          current_phase: 0,
          phases: [],
        },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      expect(phaseLoop.iterations).toHaveLength(0);
      expect(phaseLoop.status).toBe('not_started');
    });

    it('handles absent execution section as empty phases', () => {
      const v4: Record<string, unknown> = {
        $schema: 'orchestration-state-v4',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        planning: {
          status: 'not_started',
          human_approved: false,
          steps: [
            { name: 'research', status: 'not_started', doc_path: null },
            { name: 'prd', status: 'not_started', doc_path: null },
            { name: 'design', status: 'not_started', doc_path: null },
            { name: 'architecture', status: 'not_started', doc_path: null },
            { name: 'master_plan', status: 'not_started', doc_path: null },
          ],
        },
        // no execution section
      };

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      expect(phaseLoop.iterations).toHaveLength(0);
      expect(phaseLoop.status).toBe('not_started');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('absent planning section', () => {
    it('initializes all 5 planning nodes as "not_started" when planning is absent', () => {
      const v4: Record<string, unknown> = {
        $schema: 'orchestration-state-v4',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        pipeline: { current_tier: 'planning', gate_mode: 'ask' },
        execution: { status: 'not_started', current_phase: 0, phases: [] },
      };

      const result = migrateState(v4, 'MY-PROJECT');
      const stepNames = ['research', 'prd', 'design', 'architecture', 'master_plan'];
      for (const name of stepNames) {
        const node = getNode<StepNodeState>(result, name);
        expect(node.status).toBe('not_started');
        expect(node.doc_path).toBeNull();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('pipeline section mapping', () => {
    it('copies current_tier verbatim', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.pipeline.current_tier).toBe('complete');
    });

    it('sets pipeline.gate_mode from v4.pipeline.gate_mode', () => {
      const result = migrateState(makeV4State(), 'MY-PROJECT');
      expect(result.pipeline.gate_mode).toBe('autonomous');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('task_loop status derivation', () => {
    it('sets task_loop.status to "not_started" when all tasks are "not_started"', () => {
      const task = makeV4Task({ status: 'not_started', stage: 'not_started', docs: { handoff: null, review: null }, review: { verdict: null, action: null } });
      const phase = makeV4Phase({ status: 'in_progress', tasks: [task] });
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: { status: 'in_progress', current_phase: 1, phases: [phase] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('not_started');
    });

    it('sets task_loop.status to "not_started" for a mix of "not_started" and "completed" tasks', () => {
      const completedTask = makeV4Task({ status: 'complete', stage: 'complete' });
      const notStartedTask = makeV4Task({ status: 'not_started', stage: 'not_started', docs: { handoff: null, review: null }, review: { verdict: null, action: null } });
      const phase = makeV4Phase({ status: 'in_progress', tasks: [completedTask, notStartedTask] });
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: { status: 'in_progress', current_phase: 1, phases: [phase] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('not_started');
    });

    it('sets task_loop.status to "in_progress" when at least one task is in_progress (regression guard)', () => {
      const inProgressTask = makeV4Task({ status: 'in_progress', stage: 'coding', docs: { handoff: 'some/path.md', review: null }, review: { verdict: null, action: null } });
      const phase = makeV4Phase({ status: 'in_progress', tasks: [inProgressTask] });
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: { status: 'in_progress', current_phase: 1, phases: [phase] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('in_progress');
    });

    it('sets task_loop.status to "completed" when all tasks are completed (regression guard)', () => {
      const phase = makeV4Phase({ status: 'complete', tasks: [makeV4Task()] });
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: { status: 'in_progress', current_phase: 1, phases: [phase] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('completed');
    });

    it('sets task_loop.status to "not_started" when task list is empty (regression guard)', () => {
      const phase = makeV4Phase({ status: 'in_progress', tasks: [] });
      const v4 = makeV4State({
        pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
        execution: { status: 'in_progress', current_phase: 1, phases: [phase] },
        final_review: { status: 'not_started', doc_path: null, human_approved: false },
      });

      const result = migrateState(v4, 'MY-PROJECT');
      const phaseLoop = getNode<ForEachPhaseNodeState>(result, 'phase_loop');
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('not_started');
    });
  });
});

// ── Tests: runMigration() ─────────────────────────────────────────────────────

describe('runMigration()', () => {

  describe('$schema skip (already v5)', () => {
    it('skips project with orchestration-state-v5 schema', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'MY-PROJECT');
      fs.mkdirSync(projectDir);

      const v5State: PipelineState = {
        $schema: 'orchestration-state-v5',
        project: { name: 'MY-PROJECT', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' },
        config: {
          gate_mode: 'autonomous',
          limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
          source_control: { auto_commit: 'ask', auto_pr: 'ask' },
        },
        pipeline: { gate_mode: null, source_control: null, current_tier: 'complete', halt_reason: null },
        graph: { template_id: 'full', status: 'completed', current_node_path: null, nodes: {} },
      };

      fs.writeFileSync(
        path.join(projectDir, 'state.json'),
        JSON.stringify(v5State),
        'utf-8',
      );

      const summary = runMigration({ dryRun: true, basePath: tmpDir });

      expect(summary.skipped).toBe(1);
      expect(summary.migrated).toBe(0);
      expect(summary.details[0].status).toBe('skip');
      expect(summary.details[0].project).toBe('MY-PROJECT');
    });
  });

  describe('unrecognized $schema', () => {
    it('warns and skips project with unknown schema', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'UNKNOWN-PROJECT');
      fs.mkdirSync(projectDir);

      fs.writeFileSync(
        path.join(projectDir, 'state.json'),
        JSON.stringify({ $schema: 'something-unknown', project: { name: 'UNKNOWN-PROJECT' } }),
        'utf-8',
      );

      const summary = runMigration({ dryRun: true, basePath: tmpDir });

      expect(summary.warnings).toBe(1);
      expect(summary.migrated).toBe(0);
      expect(summary.details[0].status).toBe('warn');
    });
  });

  describe('dry-run mode', () => {
    it('does not write files when dryRun is true', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'MY-PROJECT');
      fs.mkdirSync(projectDir);

      const statePath = path.join(projectDir, 'state.json');
      const originalContent = JSON.stringify(makeV4State());
      fs.writeFileSync(statePath, originalContent, 'utf-8');

      runMigration({ dryRun: true, basePath: tmpDir });

      const afterContent = fs.readFileSync(statePath, 'utf-8');
      expect(afterContent).toBe(originalContent);
    });
  });

  describe('successful migration via projectDir option', () => {
    it('migrates a single project and returns done status', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'MY-PROJECT');
      fs.mkdirSync(projectDir);

      fs.writeFileSync(
        path.join(projectDir, 'state.json'),
        JSON.stringify(makeV4State()),
        'utf-8',
      );

      const summary = runMigration({ dryRun: true, projectDir, basePath: tmpDir });

      expect(summary.migrated).toBe(1);
      expect(summary.details[0].status).toBe('done');
      expect(summary.details[0].project).toBe('MY-PROJECT');
    });
  });

  describe('missing $schema field', () => {
    it('warns on state without $schema field', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'NO-SCHEMA-PROJECT');
      fs.mkdirSync(projectDir);

      fs.writeFileSync(
        path.join(projectDir, 'state.json'),
        JSON.stringify({ project: { name: 'NO-SCHEMA-PROJECT' } }),
        'utf-8',
      );

      const summary = runMigration({ dryRun: true, basePath: tmpDir });
      expect(summary.warnings).toBe(1);
      expect(summary.details[0].status).toBe('warn');
    });
  });

  describe('dryRun: false writes state.json', () => {
    it('writes migrated state with v5 schema when dryRun is false', () => {
      const tmpDir = makeTmpDir();
      const projectDir = path.join(tmpDir, 'MY-PROJECT');
      fs.mkdirSync(projectDir);

      fs.writeFileSync(
        path.join(projectDir, 'state.json'),
        JSON.stringify(makeV4State()),
        'utf-8',
      );

      const summary = runMigration({ dryRun: false, basePath: tmpDir });

      expect(summary.migrated).toBe(1);
      expect(summary.details[0].status).toBe('done');

      const written = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'state.json'), 'utf-8'),
      );
      expect(written.$schema).toBe('orchestration-state-v5');
    });
  });
});

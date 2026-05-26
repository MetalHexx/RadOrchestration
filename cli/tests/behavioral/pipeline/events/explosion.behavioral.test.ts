// cli/tests/behavioral/pipeline/events/explosion.behavioral.test.ts
import { describe, it, afterEach } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from './fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

// State after master_plan_completed: requirements+master_plan=completed, rest=not_started
const afterMasterPlanCompletedState = {
  $schema: 'orchestration-state-v5',
  project: { name: 'cli-behavioral', created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z' },
  config: {
    gate_mode: 'task',
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
    source_control: { auto_commit: 'never', auto_pr: 'never' },
  },
  pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
  graph: {
    template_id: 'syn-planning',
    status: 'in_progress',
    current_node_path: null,
    nodes: {
      requirements:       { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
      master_plan:        { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
      explode_master_plan:{ kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
  },
};

// Per FR-11, `explosion_started` is no longer accepted as an event; step
// transition to in_progress now happens via the optimistic write in
// processEvent (FR-10). The behavioral arm for that signal was deleted with
// the event identifier itself; the completed arm below carries the remaining
// behavior coverage for the explode_master_plan step.
describe('explosion events (FR-3, FR-7, DD-2, DD-4)', () => {
  it('explosion_completed marks explode_master_plan node completed and returns action=request_plan_approval', async () => {
    const stateWithExplosionInProgress = {
      ...afterMasterPlanCompletedState,
      graph: {
        ...afterMasterPlanCompletedState.graph,
        nodes: {
          ...afterMasterPlanCompletedState.graph.nodes,
          explode_master_plan: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
        },
      },
    };
    const w = buildWorld({
      template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY },
      state: stateWithExplosionInProgress,
      config: { default_template: 'syn-planning' },
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'explosion_completed', '--project-dir', w.projectDir, '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true, data: { action: 'request_plan_approval' } },
      state: {
        graph: {
          nodes: {
            explode_master_plan: { status: 'completed' },
            plan_approval_gate: { status: 'not_started', gate_active: true },
          },
        },
      },
      sideFiles: [],
    });
  });
});

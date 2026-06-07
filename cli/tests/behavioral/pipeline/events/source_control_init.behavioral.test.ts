// cli/tests/behavioral/pipeline/events/source_control_init.behavioral.test.ts
// Covers source_control_init event (FR-3, FR-7, DD-2).
// NFR-5: if the state schema changes, update the seeded state below accordingly.
import { describe, it, beforeEach, afterEach } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { useRealCatalog } from '../helpers/catalog.js';
import { assertPromptForEnvelopeAction } from '../helpers/prompt.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { EXECUTION_TEMPLATE_BODY } from './fixtures/execution-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
beforeEach(() => { cleanups.push(useRealCatalog()); });

// State for source_control_init: pipeline is in_progress, gate_mode_selection done,
// phase_loop has no iterations yet (source_control not yet set).
const beforeSourceControlInitState = {
  $schema: 'orchestration-state-v6',
  project: { name: 'cli-behavioral', created: '2024-01-01T00:00:00.000Z', updated: '2024-01-01T00:00:00.000Z' },
  config: {
    gate_mode: 'task',
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
    source_control: { auto_commit: 'never', auto_pr: 'never' },
  },
  pipeline: { gate_mode: 'task', source_control: null, current_tier: 'execution', halt_reason: null },
  graph: {
    template_id: 'syn-exec',
    status: 'in_progress',
    current_node_path: null,
    nodes: {
      gate_mode_selection: { kind: 'gate', status: 'completed', gate_active: false },
      phase_loop:          { kind: 'for_each_phase', status: 'not_started', iterations: [] },
      final_review:        { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
  },
};

describe('source_control_init event (FR-3, FR-7, DD-2)', () => {
  it('source_control_init writes pipeline.source_control with branch, base_branch, worktree_path, auto_commit, auto_pr', async () => {
    const w = buildWorld({
      template: { id: 'syn-exec', body: EXECUTION_TEMPLATE_BODY },
      state: beforeSourceControlInitState,
      config: { default_template: 'syn-exec', human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true } },
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: [
          '--event', 'source_control_init',
          '--project-dir', w.projectDir,
          '--branch', 'feature/syn',
          '--base-branch', 'main',
          '--worktree-path', w.projectDir,
          '--auto-commit', 'never',
          '--auto-pr', 'never',
          '--config', w.configPath,
        ],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true },
      state: {
        pipeline: {
          source_control: {
            branch: 'feature/syn',
            base_branch: 'main',
            auto_commit: 'never',
            auto_pr: 'never',
          },
        },
      },
      sideFiles: [],
    });
    // FR-4, FR-23 — source_control_init is out-of-band; after mutation the
    // walker advances to the next pending step. The envelope's action drives
    // which event the composed prompt's Signal line names (per the real
    // catalog at runtime-config/action-events/).
    assertPromptForEnvelopeAction(env);
  });
});

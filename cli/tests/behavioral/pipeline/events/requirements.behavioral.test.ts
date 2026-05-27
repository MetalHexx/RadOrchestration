// cli/tests/behavioral/pipeline/events/requirements.behavioral.test.ts
import { describe, it, beforeEach, afterEach } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { useRealCatalog } from '../helpers/catalog.js';
import { assertPromptForEvent } from '../helpers/prompt.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from './fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
beforeEach(() => { cleanups.push(useRealCatalog()); });

// Shared scaffolded state that mirrors the engine output after the start event.
const afterStartState = {
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
      requirements:       { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      master_plan:        { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      explode_master_plan:{ kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
  },
};

// Per FR-11, `requirements_started` is no longer accepted as an event; step
// transition to in_progress now happens via the optimistic write in
// processEvent (FR-10). The behavioral arm for that signal was deleted with
// the event identifier itself; the completed arm below carries the remaining
// behavior coverage for the requirements step.
describe('requirements events (FR-3, FR-7, DD-2, DD-4)', () => {
  it('requirements_completed marks requirements node completed and returns action=spawn_master_plan', async () => {
    const stateWithRequirementsInProgress = {
      ...afterStartState,
      graph: {
        ...afterStartState.graph,
        nodes: {
          ...afterStartState.graph.nodes,
          requirements: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
        },
      },
    };
    // requirements_completed requires a doc file with requirement_count frontmatter
    const requirementsDoc = `---\nrequirement_count: 5\n---\nRequirements content here.\n`;
    const w = buildWorld({
      template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY },
      state: stateWithRequirementsInProgress,
      config: { default_template: 'syn-planning' },
      sideFiles: [{ path: 'requirements.md', contents: requirementsDoc }],
    });
    cleanups.push(w.cleanup);
    const requirementsDocPath = `${w.projectDir}/requirements.md`;
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'requirements_completed', '--project-dir', w.projectDir, '--doc-path', requirementsDocPath, '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true, data: { action: 'spawn_master_plan' } },
      state: {
        graph: {
          nodes: {
            requirements: { status: 'completed' },
            master_plan: { status: 'in_progress' },
          },
        },
      },
      sideFiles: [],
    });
    // FR-4, FR-23 — spawn_master_plan's completion event is master_plan_completed.
    assertPromptForEvent(env, 'master_plan_completed');
  });
});

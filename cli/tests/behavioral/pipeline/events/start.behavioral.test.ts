// cli/tests/behavioral/pipeline/events/start.behavioral.test.ts
import { describe, expect, it, afterEach } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from './fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('start event (FR-3, DD-2)', () => {
  it('start event with a synthetic planning template writes state.json and returns action=spawn_requirements', async () => {
    const w = buildWorld({
      template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY },
      state: null,
      config: { default_template: 'syn-planning' },
      // Provide the template as syn-planning.yml so the engine can load it for a new project
      sideFiles: [{ path: 'syn-planning.yml', contents: PLANNING_TEMPLATE_BODY }],
    });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'start', '--project-dir', w.projectDir, '--template', 'syn-planning', '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: true, data: { action: 'spawn_requirements' } },
      state: { graph: { template_id: 'syn-planning', nodes: { requirements: { status: 'not_started' } } } },
      sideFiles: [],
    });
  });
});

// cli/tests/behavioral/pipeline/unhappy/bad-input.behavioral.test.ts
import { describe, it, afterEach } from 'vitest';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from '../events/fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('bad-input unhappy class (FR-4)', () => {
  it('unknown event name returns ok:false with data.event echoing the input', async () => {
    const w = buildWorld({ template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY }, state: null, config: {}, sideFiles: [] });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'definitely_not_an_event', '--project-dir', w.projectDir, '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, data: { event: 'definitely_not_an_event' }, error: { type: 'user_error' } },
      state: 'absent',
      sideFiles: [],
    });
  });

  it('malformed --parse-error JSON returns ok:false with data.field=parse-error', async () => {
    const w = buildWorld({ template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY }, state: null, config: {}, sideFiles: [] });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'explosion_failed', '--project-dir', w.projectDir, '--parse-error', 'not-json', '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, data: { event: 'explosion_failed', field: 'parse-error' }, error: { type: 'user_error' } },
      state: 'absent',
      sideFiles: [],
    });
  });

  it('malformed --phase returns ok:false with data.field=phase', async () => {
    const w = buildWorld({ template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY }, state: null, config: {}, sideFiles: [] });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'task_completed', '--project-dir', w.projectDir, '--phase', 'abc', '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, data: { event: 'task_completed', field: 'phase' }, error: { type: 'user_error' } },
      state: 'absent',
      sideFiles: [],
    });
  });
});

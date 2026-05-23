// cli/tests/behavioral/pipeline/unhappy/invalid-transition.behavioral.test.ts
import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from '../events/fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('invalid-transition unhappy class (FR-5)', () => {
  it('task_completed before start returns ok:false and leaves state.json unchanged', async () => {
    const seeded = {
      $schema: 'orchestration-state-v5',
      graph: { template_id: 'syn-planning', status: 'not_started', current_node_path: null, nodes: {} },
    };
    const w = buildWorld({
      template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY },
      state: seeded,
      config: {},
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    const before = fs.readFileSync(path.join(w.projectDir, 'state.json'), 'utf8');
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'task_completed', '--project-dir', w.projectDir, '--phase', '1', '--task', '1', '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    const after = fs.readFileSync(path.join(w.projectDir, 'state.json'), 'utf8');
    expect(after).toBe(before);
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, error: { type: 'user_error' } },
      state: seeded,
      sideFiles: [],
    });
  });
});

// cli/tests/behavioral/pipeline/unhappy/missing-world.behavioral.test.ts
import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorld } from '../helpers/world.js';
import { captureEnvelope } from '../helpers/capture.js';
import { assertEnvelopeStateSideFiles } from '../helpers/assert.js';
import { pipelineSignalCommand } from '../../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../../src/framework/command.js';
import { PLANNING_TEMPLATE_BODY } from '../events/fixtures/planning-template.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('missing-world unhappy class (FR-6)', () => {
  it('firing master_plan_completed with no state.json returns ok:false and leaves no state.json behind', async () => {
    const w = buildWorld({ template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY }, state: null, config: {}, sideFiles: [] });
    cleanups.push(w.cleanup);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'master_plan_completed', '--project-dir', w.projectDir, '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, error: { type: 'user_error' } },
      state: 'absent',
      sideFiles: [],
    });
  });

  it('firing start with a missing template file returns ok:false and writes no state.json', async () => {
    const w = buildWorld({ template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY }, state: null, config: {}, sideFiles: [] });
    cleanups.push(w.cleanup);
    fs.rmSync(path.join(w.projectDir, 'template.yml'), { force: true });
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'start', '--project-dir', w.projectDir, '--template', 'syn-planning', '--config', w.configPath],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: w.projectDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    assertEnvelopeStateSideFiles(env, {
      projectDir: w.projectDir,
      envelope: { ok: false, error: { type: 'user_error' } },
      state: 'absent',
      sideFiles: [{ path: 'template.yml', exists: false }],
    });
  });

  it('firing any event with a missing project directory returns ok:false and creates no project directory', async () => {
    const ghostDir = path.join(os.tmpdir(), `cli-behavioral-ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    expect(fs.existsSync(ghostDir)).toBe(false);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'start', '--project-dir', ghostDir, '--template', 'syn-planning'],
        env: { ...process.env, RADORCH_NO_LOG: '1', RADORCH_TEMPLATES_DIR: ghostDir },
        isTTY: false, stderr: process.stderr,
      });
    });
    expect(env.ok).toBe(false);
    expect(env.error?.type).toBe('user_error');
    expect(fs.existsSync(ghostDir)).toBe(false);
  });
});

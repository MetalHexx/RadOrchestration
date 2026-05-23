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

  // For `start` with state===null the engine always loads from the global
  // templates dir (`${templatesDir}/${name}.yml`), ignoring any project-local
  // template.yml. Seed syn-planning.yml as the global template, delete it,
  // then assert the missing-global-template failure path.
  it('firing start with a missing global template returns ok:false and writes no state.json', async () => {
    const w = buildWorld({
      template: { id: 'syn-planning', body: PLANNING_TEMPLATE_BODY },
      state: null,
      config: {},
      sideFiles: [{ path: 'syn-planning.yml', contents: PLANNING_TEMPLATE_BODY }],
    });
    cleanups.push(w.cleanup);
    fs.rmSync(path.join(w.projectDir, 'syn-planning.yml'), { force: true });
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
      sideFiles: [{ path: 'syn-planning.yml', exists: false }],
    });
  });

  // The engine resolves templatesDir from process.env['RADORCH_TEMPLATES_DIR']
  // (path-context.ts), not from runCommand's `env` option. Stub it via
  // process.env so template resolution is deterministic; use a non-start
  // event so the engine's null-state guard fires before any project-dir
  // ensure step would run.
  it('firing master_plan_completed against a missing project directory returns ok:false and creates no project directory', async () => {
    const ghostDir = path.join(os.tmpdir(), `cli-behavioral-ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const stubTemplatesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-behavioral-templates-'));
    fs.writeFileSync(path.join(stubTemplatesDir, 'extra-high.yml'), PLANNING_TEMPLATE_BODY, 'utf8');
    const prevTemplatesEnv = process.env['RADORCH_TEMPLATES_DIR'];
    process.env['RADORCH_TEMPLATES_DIR'] = stubTemplatesDir;
    cleanups.push(() => {
      if (prevTemplatesEnv === undefined) delete process.env['RADORCH_TEMPLATES_DIR'];
      else process.env['RADORCH_TEMPLATES_DIR'] = prevTemplatesEnv;
      fs.rmSync(stubTemplatesDir, { recursive: true, force: true });
    });
    expect(fs.existsSync(ghostDir)).toBe(false);
    const env = await captureEnvelope(async () => {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'master_plan_completed', '--project-dir', ghostDir],
        env: { ...process.env, RADORCH_NO_LOG: '1' },
        isTTY: false, stderr: process.stderr,
      });
    });
    expect(env.ok).toBe(false);
    expect(env.error?.type).toBe('user_error');
    expect(fs.existsSync(ghostDir)).toBe(false);
  });
});

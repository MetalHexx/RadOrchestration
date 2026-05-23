import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildWorld } from './world.js';
import { captureEnvelope } from './capture.js';
import { assertEnvelopeStateSideFiles } from './assert.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe('behavioral helpers', () => {
  it('buildWorld creates an isolated per-test directory under os.tmpdir() with the requested template, state, config, and side-files', () => {
    const w = buildWorld({
      template: { id: 'syn', body: 'template:\n  id: syn\n  version: "1.0.0"\n  description: "syn"\nnodes: []\n' },
      state: null,
      config: { default_template: 'syn' },
      sideFiles: [{ path: 'seed.txt', contents: 'hello' }],
    });
    cleanups.push(w.cleanup);
    expect(w.projectDir.startsWith(os.tmpdir())).toBe(true);
    expect(fs.existsSync(path.join(w.projectDir, 'template.yml'))).toBe(true);
    expect(fs.existsSync(path.join(w.projectDir, 'seed.txt'))).toBe(true);
    expect(fs.existsSync(path.join(w.projectDir, 'state.json'))).toBe(false);
    expect(w.pathContext.templatesDir).toBe(w.projectDir);
    expect(typeof w.configPath).toBe('string');
  });

  it('buildWorld writes state.json when state is provided and tears down on cleanup', () => {
    const w = buildWorld({
      template: { id: 'syn', body: 'template:\n  id: syn\n  version: "1.0.0"\n  description: "syn"\nnodes: []\n' },
      state: { $schema: 'orchestration-state-v5', graph: { template_id: 'syn', status: 'in_progress', current_node_path: null, nodes: {} } },
      config: {},
      sideFiles: [],
    });
    const projectDir = w.projectDir;
    expect(fs.existsSync(path.join(projectDir, 'state.json'))).toBe(true);
    w.cleanup();
    expect(fs.existsSync(projectDir)).toBe(false);
  });

  it('captureEnvelope returns the parsed JSON envelope written to stdout and restores the spies', async () => {
    const env = await captureEnvelope(async () => {
      process.stdout.write(JSON.stringify({ ok: true, data: { action: null, context: {} } }));
    });
    expect(env).toEqual({ ok: true, data: { action: null, context: {} } });
    // Spy restored: a second write should not be captured by the previous helper call.
    const second = await captureEnvelope(async () => { process.stdout.write('{"ok":false,"data":{"event":"x"},"error":{"type":"user_error","message":"m"}}'); });
    expect(second.ok).toBe(false);
  });

  it('assertEnvelopeStateSideFiles deep-compares envelope partial, reads state.json from disk, and enumerates created/absent side-files', () => {
    const w = buildWorld({
      template: { id: 'syn', body: 'template:\n  id: syn\n  version: "1.0.0"\n  description: "syn"\nnodes: []\n' },
      state: { $schema: 'orchestration-state-v5', graph: { template_id: 'syn', status: 'in_progress', current_node_path: null, nodes: {} } },
      config: {},
      sideFiles: [{ path: 'present.txt', contents: 'yes' }],
    });
    cleanups.push(w.cleanup);
    assertEnvelopeStateSideFiles(
      { ok: true, data: { action: null, context: { event: 'noop' } } },
      {
        projectDir: w.projectDir,
        envelope: { ok: true, data: { action: null } },
        state: { $schema: 'orchestration-state-v5', graph: { template_id: 'syn' } },
        sideFiles: [
          { path: 'present.txt', exists: true, contentsMatches: /yes/ },
          { path: 'absent.txt', exists: false },
        ],
      },
    );
  });

  it('assertEnvelopeStateSideFiles supports asserting state.json is absent', () => {
    const w = buildWorld({
      template: { id: 'syn', body: 'template:\n  id: syn\n  version: "1.0.0"\n  description: "syn"\nnodes: []\n' },
      state: null,
      config: {},
      sideFiles: [],
    });
    cleanups.push(w.cleanup);
    assertEnvelopeStateSideFiles(
      { ok: false, data: { event: 'start' }, error: { type: 'user_error', message: 'missing' } },
      {
        projectDir: w.projectDir,
        envelope: { ok: false, error: { type: 'user_error' } },
        state: 'absent',
        sideFiles: [],
      },
    );
  });
});

// vi.mock is hoisted by vitest before all imports — node:fs is fully auto-mocked in this file.
// This isolation is required because vi.spyOn cannot patch ESM namespace properties on node built-ins.
import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';

vi.mock('node:fs');

import * as fs from 'node:fs';
import { writeState } from '../lib/state-io.js';
import type { PipelineState } from '../lib/types.js';

// ── Minimal fixture ───────────────────────────────────────────────────────────

const MIN_STATE: PipelineState = {
  $schema: 'orchestration-state-v5',
  project: {
    name: 'RENAME-TEST',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  },
  config: {
    gate_mode: 'auto',
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 20,
      max_retries_per_task: 3,
      max_consecutive_review_rejections: 3,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'never',
    },
  },
  pipeline: {
    gate_mode: null,
    source_control: null,
    current_tier: 'planning',
    halt_reason: null,
  },
  graph: {
    template_id: 'full',
    status: 'not_started',
    current_node_path: null,
    nodes: {},
  },
};

// ── writeState > rename failure ───────────────────────────────────────────────

describe('writeState > rename failure', () => {
  it('calls rmSync with the tmp path and rethrows when renameSync fails', () => {
    const dir = '/fake/project-dir';
    const tmpPath = path.join(dir, 'state.json.tmp');
    const renameError = new Error('simulated rename failure');

    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.renameSync).mockImplementation(() => { throw renameError; });

    expect(() => writeState(dir, MIN_STATE)).toThrow('simulated rename failure');
    expect(vi.mocked(fs.rmSync)).toHaveBeenCalledWith(tmpPath, { force: true });
  });
});

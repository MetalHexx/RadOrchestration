import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pipelineSignal } from '../../../src/commands/pipeline/signal.js';
import type { IOAdapter, PathContext, PipelineResult } from '../../../src/lib/pipeline-engine/types.js';

function makeStubIO(_result: PipelineResult): { io: IOAdapter; calls: unknown[] } {
  const calls: unknown[] = [];
  const io: IOAdapter = {
    readState: () => null,
    writeState: () => { calls.push('writeState'); },
    readConfig: () => ({ limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
                        human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true },
                        source_control: { auto_commit: 'never', auto_pr: 'never' },
                        default_template: 'medium' }),
    readDocument: () => null,
    ensureDirectories: () => { calls.push('ensureDirectories'); },
  };
  // result is unused here — pipelineSignal is wired with the real engine; the stubs above suffice
  // to drive the start-event happy path through scaffolding.
  return { io, calls };
}

const pathContext: PathContext = {
  scriptsDir: os.tmpdir(),
  templatesDir: path.resolve(__dirname, '..', '..', '..', '..', 'runtime-config', 'templates'),
};

describe('pipelineSignal core function', () => {
  it('projects engine result into { action, context } on success', async () => {
    const { io } = makeStubIO({ action: 'spawn_requirements', context: {} });
    const r = await pipelineSignal({ event: 'start', projectDir: '/tmp/proj', context: {}, io, pathContext });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.data).sort()).toEqual(['action', 'context']);
    }
  });

  it('maps engine failure to { ok:false, data:{ event }, error:{ type:user_error } }', async () => {
    const { io } = makeStubIO({ action: null, context: {}, error: { message: 'bad', event: 'unknown' } });
    const r = await pipelineSignal({ event: 'totally_unknown_event', projectDir: '/tmp/proj', context: {}, io, pathContext });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.type).toBe('user_error');
      expect(r.data?.event).toBeDefined();
    }
  });
});

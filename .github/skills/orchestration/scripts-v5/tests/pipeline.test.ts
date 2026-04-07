import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineResult } from '../lib/types.js';

vi.mock('../lib/engine.js', () => ({
  processEvent: vi.fn(),
}));

import { run } from '../pipeline.js';
import { processEvent } from '../lib/engine.js';

const mockProcessEvent = vi.mocked(processEvent);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_ARGS = [
  '--event', 'task_started',
  '--project-dir', '/tmp/test-project',
  '--config', '/tmp/config.yml',
];

const MOCK_SUCCESS: PipelineResult = {
  success: true,
  action: 'spawn_task',
  context: {},
  mutations_applied: [],
  orchRoot: '.github',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pipeline CLI — run()', () => {
  let output = '';

  beforeEach(() => {
    output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8');
      return true;
    });
    mockProcessEvent.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function capturedJson(): PipelineResult {
    return JSON.parse(output) as PipelineResult;
  }

  // ── Argument Parsing ────────────────────────────────────────────────────────

  it('parses all 10 CLI arguments correctly', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([
      '--event',       'task_started',
      '--project-dir', '/tmp/test-project',
      '--config',      '/tmp/config.yml',
      '--doc-path',    '/tmp/doc.md',
      '--branch',      'main',
      '--gate-mode',   'auto',
      '--step',        'research',
      '--phase',       '3',
      '--task',        '2',
      '--verdict',     'approved',
    ]);

    expect(mockProcessEvent).toHaveBeenCalledWith(
      'task_started',
      '/tmp/test-project',
      expect.objectContaining({
        doc_path:  '/tmp/doc.md',
        branch:    'main',
        gate_mode: 'auto',
        step:      'research',
        phase:     3,
        task:      2,
        verdict:   'approved',
      }),
      expect.objectContaining({
        readState:        expect.any(Function),
        writeState:       expect.any(Function),
        readConfig:       expect.any(Function),
        readDocument:     expect.any(Function),
        ensureDirectories: expect.any(Function),
      }),
      '/tmp/config.yml',
    );
  });

  it('converts --phase "3" to number 3 and --task "2" to number 2', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([...BASE_ARGS, '--phase', '3', '--task', '2']);

    const [, , context] = mockProcessEvent.mock.calls[0];
    expect(context.phase).toBe(3);
    expect(typeof context.phase).toBe('number');
    expect(context.task).toBe(2);
    expect(typeof context.task).toBe('number');
  });

  it('invalid --phase "abc" results in NaN or graceful handling without crashing', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([...BASE_ARGS, '--phase', 'abc']);

    const result = capturedJson();
    // Pipeline either passes NaN to engine or returns a structured error — no crash
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('invalid --task "xyz" results in NaN or graceful handling without crashing', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([...BASE_ARGS, '--task', 'xyz']);

    const result = capturedJson();
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  // ── Required Argument Validation ────────────────────────────────────────────

  it('missing --event produces { success: false } JSON with error mentioning --event', () => {
    run(['--project-dir', '/tmp/test-project', '--config', '/tmp/config.yml']);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--event');
  });

  it('missing --project-dir produces { success: false } JSON with error mentioning --project-dir', () => {
    run(['--event', 'task_started', '--config', '/tmp/config.yml']);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--project-dir');
  });

  it('missing --config produces { success: false } JSON with error mentioning --config', () => {
    run(['--event', 'task_started', '--project-dir', '/tmp/test-project']);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--config');
  });

  // ── Engine Integration ──────────────────────────────────────────────────────

  it('successful engine call writes valid PipelineResult JSON to stdout', () => {
    const successResult: PipelineResult = {
      success: true,
      action: 'spawn_research',
      context: { step: 'research' },
      mutations_applied: ['set research.status = in_progress'],
      orchRoot: '.github',
    };
    mockProcessEvent.mockReturnValue(successResult);

    run(BASE_ARGS);

    const result = capturedJson();
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.mutations_applied).toEqual(['set research.status = in_progress']);
    expect(result.orchRoot).toBe('.github');
  });

  it('uncaught engine exception produces { success: false } error JSON, not a stack trace', () => {
    mockProcessEvent.mockImplementation(() => {
      throw new Error('engine exploded');
    });

    run(BASE_ARGS);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('engine exploded');
    expect(result.orchRoot).toBe('.github');
  });

  // ── Output Contract ─────────────────────────────────────────────────────────

  it('orchRoot is present in success responses', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);
    run(BASE_ARGS);
    expect(capturedJson().orchRoot).toBeDefined();
  });

  it('orchRoot is present in error responses (missing required arg)', () => {
    run(['--project-dir', '/tmp/test-project', '--config', '/tmp/config.yml']);
    expect(capturedJson().orchRoot).toBeDefined();
  });

  it('orchRoot is present in uncaught exception responses', () => {
    mockProcessEvent.mockImplementation(() => {
      throw new Error('boom');
    });
    run(BASE_ARGS);
    expect(capturedJson().orchRoot).toBeDefined();
  });

  it('writes output exactly once — no other stdout output', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);
    const writeSpy = vi.mocked(process.stdout.write);

    run(BASE_ARGS);

    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('exit code is always 0 — process.exit is never called with a non-zero code', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as typeof process.exit);

    // Error case: engine throws
    mockProcessEvent.mockImplementation(() => {
      throw new Error('uncaught');
    });
    run(BASE_ARGS);

    for (const [code] of exitSpy.mock.calls) {
      expect(code === undefined || code === 0).toBe(true);
    }

    exitSpy.mockRestore();
  });

  // ── CLI Contract Schema Validation ──────────────────────────────────────────

  it('success response contains exactly the required fields', () => {
    const successResult: PipelineResult = {
      success: true,
      action: 'spawn_research',
      context: { step: 'research' },
      mutations_applied: ['set research.status = in_progress'],
      orchRoot: '.github',
    };
    mockProcessEvent.mockReturnValue(successResult);

    run(BASE_ARGS);

    const result = capturedJson();
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('context');
    expect(typeof result.context).toBe('object');
    expect(result).toHaveProperty('mutations_applied');
    expect(Array.isArray(result.mutations_applied)).toBe(true);
    expect(result).toHaveProperty('orchRoot');
    expect(typeof result.orchRoot).toBe('string');

    // Only allowed top-level keys
    const keys = Object.keys(result);
    const allowed = new Set(['success', 'action', 'context', 'mutations_applied', 'orchRoot', 'error']);
    for (const key of keys) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  it('error response contains success: false, action: null, and error object with message and event', () => {
    mockProcessEvent.mockImplementation(() => {
      throw new Error('engine exploded');
    });

    run(BASE_ARGS);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.action).toBeNull();
    expect(result).toHaveProperty('context');
    expect(typeof result.context).toBe('object');
    expect(result).toHaveProperty('mutations_applied');
    expect(Array.isArray(result.mutations_applied)).toBe(true);
    expect(result).toHaveProperty('orchRoot');
    expect(typeof result.orchRoot).toBe('string');
    expect(result.error).toBeDefined();
    expect(typeof result.error!.message).toBe('string');
    expect(typeof result.error!.event).toBe('string');
  });

  it('invalid --phase returns success: false with structured error mentioning --phase', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([...BASE_ARGS, '--phase', 'abc']);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('--phase');
  });

  it('invalid --task returns success: false with structured error mentioning --task', () => {
    mockProcessEvent.mockReturnValue(MOCK_SUCCESS);

    run([...BASE_ARGS, '--task', 'xyz']);

    const result = capturedJson();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('--task');
  });
});

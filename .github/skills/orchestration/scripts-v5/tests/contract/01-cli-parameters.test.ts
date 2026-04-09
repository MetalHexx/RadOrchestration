import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIO,
  DOC_STORE,
  PROJECT_DIR,
} from '../fixtures/parity-states.js';

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Test group 1 — All 17 CLI parameters are accepted ────────────────────────

describe('[CONTRACT] CLI Parameters — all 17 v4 CLI parameters are accepted', () => {
  it('accepts all 14 optional context fields simultaneously without error', () => {
    const io = createMockIO(null);
    const result = processEvent(
      'start',
      PROJECT_DIR,
      {
        doc_path: '/tmp/doc.md',
        branch: 'feature/test',
        base_branch: 'main',
        worktree_path: '/tmp/wt',
        auto_commit: 'ask',
        auto_pr: 'ask',
        gate_type: 'planning',
        gate_mode: 'manual',
        reason: 'test reason',
        commit_hash: 'abc123',
        pushed: 'true',
        remote_url: 'https://github.com/org/repo',
        compare_url: 'https://github.com/org/repo/compare',
        pr_url: 'https://github.com/org/repo/pull/1',
      },
      io,
    );
    expect(result.success).toBe(true);
  });

  const optionalContextFields: Array<[string, Record<string, string>]> = [
    ['doc_path', { doc_path: '/tmp/doc.md' }],
    ['branch', { branch: 'feature/test' }],
    ['base_branch', { base_branch: 'main' }],
    ['worktree_path', { worktree_path: '/tmp/wt' }],
    ['auto_commit', { auto_commit: 'ask' }],
    ['auto_pr', { auto_pr: 'ask' }],
    ['gate_type', { gate_type: 'planning' }],
    ['gate_mode', { gate_mode: 'manual' }],
    ['reason', { reason: 'test reason' }],
    ['commit_hash', { commit_hash: 'abc123' }],
    ['pushed', { pushed: 'true' }],
    ['remote_url', { remote_url: 'https://github.com/org/repo' }],
    ['compare_url', { compare_url: 'https://github.com/org/repo/compare' }],
    ['pr_url', { pr_url: 'https://github.com/org/repo/pull/1' }],
  ];

  for (const [field, context] of optionalContextFields) {
    it(`accepts context field "${field}" without error`, () => {
      const io = createMockIO(null);
      const result = processEvent('start', PROJECT_DIR, context, io);
      expect(result.success).toBe(true);
    });
  }
});

// ── Test group 2 — Optional parameters do not cause errors when omitted ───────

describe('[CONTRACT] CLI Parameters — optional parameters do not cause errors when omitted', () => {
  it('succeeds with only required positional args (event, projectDir, empty context, io)', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
  });
});

// ── Test group 3 — --config optional fallback ─────────────────────────────────

describe('[CONTRACT] CLI Parameters — --config optional fallback', () => {
  it('succeeds when configPath is undefined', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io, undefined);
    expect(result.success).toBe(true);
  });

  it('succeeds when configPath is omitted entirely (5th arg not provided)', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
  });
});

// ── Test group 4 — Internal parameters accepted but not required ──────────────

describe('[CONTRACT] CLI Parameters — internal parameters accepted but not required', () => {
  it('succeeds when internal parameters (phase, task, step, verdict) are omitted', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
  });

  it('accepts internal parameters (phase, task, step, verdict) when explicitly provided', () => {
    const io = createMockIO(null);
    const result = processEvent(
      'start',
      PROJECT_DIR,
      { phase: 1, task: 1, step: 'research', verdict: 'approved' },
      io,
    );
    expect(result.success).toBe(true);
  });
});

// ── Test group 5 — Unknown event produces structured error ────────────────────

describe('[CONTRACT] CLI Parameters — unknown event produces structured error', () => {
  it('returns success=false with error message containing "Unknown event"', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('nonexistent_event', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Unknown event');
  });
});

// ── Test group 6 — Parameter values flow through without conflict ─────────────

describe('[CONTRACT] CLI Parameters — multiple optional parameters flow through without conflict', () => {
  it('accepts multiple optional context fields simultaneously without conflict', () => {
    const io = createMockIO(null);
    const result = processEvent(
      'start',
      PROJECT_DIR,
      {
        branch: 'feature/test',
        base_branch: 'main',
        worktree_path: '/tmp/wt',
      },
      io,
    );
    expect(result.success).toBe(true);
  });
});

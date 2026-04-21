import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { preRead } from '../lib/pre-reads.js';
import type { EventContext, EventIndexEntry, IOAdapter } from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_DIR = '/tmp/pre-reads-test';
const ABS_DOC_PATH = join(PROJECT_DIR, 'tasks', 'TASK-01.md');
const REL_DOC_PATH = join('tasks', 'TASK-01.md');
const EXPECTED_RESOLVED_PATH = join(PROJECT_DIR, 'tasks', 'TASK-01.md');

function makeStepEntry(doc_output_field?: string): EventIndexEntry {
  return {
    nodeDef: {
      id: 'test_step',
      kind: 'step',
      action: 'prompt',
      events: {
        started: 'test_step_started',
        completed: 'test_step_completed',
      },
      ...(doc_output_field !== undefined ? { doc_output_field } : {}),
    },
    eventPhase: 'completed',
    templatePath: 'test_step',
  };
}

function makeGateEntry(): EventIndexEntry {
  return {
    nodeDef: {
      id: 'test_gate',
      kind: 'gate',
      mode_ref: 'gate_mode',
      action_if_needed: 'prompt',
      approved_event: 'test_gate_approved',
    },
    eventPhase: 'completed',
    templatePath: 'test_gate',
  };
}

function baseContext(overrides?: Partial<EventContext>): Partial<EventContext> {
  return {
    event: 'step_completed',
    project_dir: PROJECT_DIR,
    config_path: '/config.yml',
    ...overrides,
  };
}

// ── started event ─────────────────────────────────────────────────────────────

describe('preRead — started event', () => {
  it('returns context unchanged with no error and does not call readDocument', () => {
    const context = baseContext({ event: 'step_started' });
    const entry: EventIndexEntry = { ...makeStepEntry('doc_output'), eventPhase: 'started' };
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_started', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeUndefined();
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ── approved event ────────────────────────────────────────────────────────────

describe('preRead — approved event', () => {
  it('returns context unchanged with no error and does not call readDocument', () => {
    const context = baseContext({ event: 'gate_approved' });
    const entry: EventIndexEntry = { ...makeGateEntry(), eventPhase: 'approved' };
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('gate_approved', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeUndefined();
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ── completed — step without doc_output_field ─────────────────────────────────

describe('preRead — completed event on step without doc_output_field', () => {
  it('returns context unchanged with no error and does not call readDocument', () => {
    const context = baseContext();
    const entry = makeStepEntry(); // no doc_output_field
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeUndefined();
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ── completed — gate node (non-step) ─────────────────────────────────────────

describe('preRead — completed event on a gate node', () => {
  it('returns context unchanged with no error and does not call readDocument', () => {
    const context = baseContext();
    const entry = makeGateEntry();
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeUndefined();
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ── completed — step with doc_output_field, valid doc_path ───────────────────

describe('preRead — completed event with valid doc_path on step with doc_output_field', () => {
  it('returns enriched context containing all frontmatter fields', () => {
    const context = baseContext({ doc_path: ABS_DOC_PATH });
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn().mockReturnValue({
      frontmatter: { total_phases: 4, verdict: 'approved', tasks: ['T1', 'T2'] },
      content: '# Document',
    });
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeUndefined();
    expect(mockFn).toHaveBeenCalledWith(ABS_DOC_PATH);
    expect((result.context as Record<string, unknown>)['total_phases']).toBe(4);
    expect((result.context as Record<string, unknown>)['verdict']).toBe('approved');
    expect((result.context as Record<string, unknown>)['tasks']).toEqual(['T1', 'T2']);
    // Existing context fields preserved
    expect(result.context.event).toBe('step_completed');
    expect(result.context.project_dir).toBe(PROJECT_DIR);
    expect(result.context.config_path).toBe('/config.yml');
  });
});

// ── completed — missing doc_path ─────────────────────────────────────────────

describe('preRead — completed event with missing doc_path', () => {
  it('returns error with field "doc_path" and message containing "missing required field"', () => {
    const context = baseContext(); // no doc_path
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
    expect(result.error!.message).toContain('missing required field');
    expect(result.error!.event).toBe('step_completed');
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('returns error when doc_path is an empty string', () => {
    const context = baseContext({ doc_path: '' });
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn();
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
    expect(result.error!.message).toContain('missing required field');
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ── completed — unreadable document ──────────────────────────────────────────

describe('preRead — completed event with unreadable document', () => {
  it('returns error with field "doc_path" and message containing "not found or unreadable"', () => {
    const context = baseContext({ doc_path: ABS_DOC_PATH });
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn().mockReturnValue(null);
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.context).toBe(context);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
    expect(result.error!.message).toContain('not found or unreadable');
    expect(result.error!.event).toBe('step_completed');
  });
});

// ── frontmatter does not overwrite existing context fields ───────────────────

describe('preRead — frontmatter merge priority', () => {
  it('context fields are preserved when frontmatter has overlapping keys', () => {
    const context = baseContext({
      doc_path: ABS_DOC_PATH,
      verdict: 'original_verdict',
    });
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn().mockReturnValue({
      frontmatter: {
        verdict: 'frontmatter_verdict',
        event: 'frontmatter_event',
        project_dir: '/different/dir',
        total_phases: 3,
      },
      content: '# Document',
    });
    const readDocument: IOAdapter['readDocument'] = mockFn;

    const result = preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeUndefined();
    // Context fields win over frontmatter
    expect(result.context.event).toBe('step_completed');
    expect(result.context.project_dir).toBe(PROJECT_DIR);
    expect(result.context.verdict).toBe('original_verdict');
    // New frontmatter-only field is still merged in
    expect((result.context as Record<string, unknown>)['total_phases']).toBe(3);
  });
});

// ── relative doc_path resolution ─────────────────────────────────────────────

describe('preRead — relative doc_path resolution', () => {
  it('resolves relative doc_path against projectDir before calling readDocument', () => {
    const context = baseContext({ doc_path: REL_DOC_PATH });
    const entry = makeStepEntry('doc_output');
    const mockFn = vi.fn().mockReturnValue({
      frontmatter: { total_phases: 2 },
      content: '',
    });
    const readDocument: IOAdapter['readDocument'] = mockFn;

    preRead('step_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(mockFn).toHaveBeenCalledWith(EXPECTED_RESOLVED_PATH);
  });
});

// ── plan_approved auto-derivation ─────────────────────────────────────────────

describe('preRead — plan_approved: auto-derivation from graph.nodes.master_plan.doc_path', () => {
  const MOCK_STATE = { graph: { nodes: { master_plan: { doc_path: 'plans/MASTER-PLAN.md' } } } };

  it('derives doc_path from state.graph.nodes.master_plan.doc_path when no doc_path in context', () => {
    const entry: EventIndexEntry = {
      nodeDef: {
        id: 'plan_approval_gate',
        kind: 'gate',
        mode_ref: 'gate_mode',
        action_if_needed: 'prompt',
        approved_event: 'plan_approved',
      },
      eventPhase: 'approved',
      templatePath: 'plan_approval_gate',
    };
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue({
      frontmatter: { total_phases: 3, total_tasks: 6 },
      content: '---\ntotal_phases: 3\ntotal_tasks: 6\n---\n# Plan',
    });

    const result = preRead('plan_approved', {}, readDocument, PROJECT_DIR, MOCK_STATE, entry);

    expect(result.error).toBeUndefined();
    expect(result.context.doc_path).toBe(join(PROJECT_DIR, 'plans/MASTER-PLAN.md'));
  });

  it('returns structured error when readDocument returns null for plan_approved', () => {
    const entry: EventIndexEntry = {
      nodeDef: {
        id: 'plan_approval_gate',
        kind: 'gate',
        mode_ref: 'gate_mode',
        action_if_needed: 'prompt',
        approved_event: 'plan_approved',
      },
      eventPhase: 'approved',
      templatePath: 'plan_approval_gate',
    };
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue(null);

    const result = preRead('plan_approved', {}, readDocument, PROJECT_DIR, MOCK_STATE, entry);

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('document not found or unreadable');
    expect(result.error!.field).toBe('doc_path');
  });

  it('errors with message containing "graph.nodes.master_plan.doc_path is not set" when state has no master_plan doc_path', () => {
    const emptyState = { graph: { nodes: { master_plan: { doc_path: null } } } };
    const entry: EventIndexEntry = {
      nodeDef: {
        id: 'plan_approval_gate',
        kind: 'gate',
        mode_ref: 'gate_mode',
        action_if_needed: 'prompt',
        approved_event: 'plan_approved',
      },
      eventPhase: 'approved',
      templatePath: 'plan_approval_gate',
    };
    const readDocument: IOAdapter['readDocument'] = vi.fn();

    const result = preRead('plan_approved', {}, readDocument, PROJECT_DIR, emptyState, entry);

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('graph.nodes.master_plan.doc_path is not set');
  });
});

// ── Iter 10 — code_review_completed: orchestrator-mediation frontmatter ───────

describe('preRead — code_review_completed: orchestrator-mediation frontmatter propagation (Iter 10)', () => {
  // Entry for code_review_completed — a step with a doc_output_field so
  // pre-reads fires the read + validate loop.
  function codeReviewEntry(): EventIndexEntry {
    return {
      nodeDef: {
        id: 'code_review',
        kind: 'step',
        action: 'spawn_code_reviewer',
        events: {
          started: 'code_review_started',
          completed: 'code_review_completed',
        },
        doc_output_field: 'doc_path',
      },
      eventPhase: 'completed',
      templatePath: 'phase_loop.body.task_loop.body.code_review',
    };
  }

  it('surfaces orchestrator_mediated + effective_outcome + corrective_handoff_path onto event context', () => {
    const context = baseContext({ event: 'code_review_completed', doc_path: ABS_DOC_PATH });
    const entry = codeReviewEntry();
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue({
      frontmatter: {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        corrective_handoff_path: 'tasks/X-P01-T01-C1.md',
      },
      content: '# review',
    });

    const result = preRead('code_review_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeUndefined();
    const ctx = result.context as Record<string, unknown>;
    expect(ctx.verdict).toBe('changes_requested');
    expect(ctx.orchestrator_mediated).toBe(true);
    expect(ctx.effective_outcome).toBe('changes_requested');
    expect(ctx.corrective_handoff_path).toBe('tasks/X-P01-T01-C1.md');
  });

  it('propagates validator rejection when mediation contract is violated (missing corrective_handoff_path)', () => {
    const context = baseContext({ event: 'code_review_completed', doc_path: ABS_DOC_PATH });
    const entry = codeReviewEntry();
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue({
      frontmatter: {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        // corrective_handoff_path intentionally missing — validator must reject.
      },
      content: '# review',
    });

    const result = preRead('code_review_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('corrective_handoff_path');
    expect(result.error!.message).toContain('Missing required field');
    expect(result.error!.event).toBe('code_review_completed');
  });

  it('passes through raw approved verdict with no mediation fields (valid contract)', () => {
    const context = baseContext({ event: 'code_review_completed', doc_path: ABS_DOC_PATH });
    const entry = codeReviewEntry();
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue({
      frontmatter: { verdict: 'approved' },
      content: '# review',
    });

    const result = preRead('code_review_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeUndefined();
    expect((result.context as Record<string, unknown>).verdict).toBe('approved');
  });

  it('rejects raw approved verdict with orchestrator_mediated set (forbidden on non-mediated paths)', () => {
    const context = baseContext({ event: 'code_review_completed', doc_path: ABS_DOC_PATH });
    const entry = codeReviewEntry();
    const readDocument: IOAdapter['readDocument'] = vi.fn().mockReturnValue({
      frontmatter: { verdict: 'approved', orchestrator_mediated: true },
      content: '# review',
    });

    const result = preRead('code_review_completed', context, readDocument, PROJECT_DIR, {}, entry);

    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('orchestrator_mediated');
  });
});

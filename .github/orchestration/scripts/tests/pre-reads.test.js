'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { preRead } = require('../lib/pre-reads');

// ─── Mock Factory ───────────────────────────────────────────────────────────

function mockReadDocument(mapping) {
  return (docPath) => mapping[docPath] ?? null;
}

// ─── plan_approved ──────────────────────────────────────────────────────────

describe('plan_approved', () => {
  const event = 'plan_approved';
  const ctx = { doc_path: '/plan.md', existing: true };

  it('extracts total_phases from master plan frontmatter', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: { total_phases: 3 }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.total_phases, 3);
    assert.equal(res.context.existing, true);
  });

  it('returns structured error when document is not found', () => {
    const read = mockReadDocument({});
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.event, 'plan_approved');
    assert.ok(res.error.error.includes('Document not found'));
  });

  it('returns structured error when total_phases is missing', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: {}, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });

  it('returns structured error when total_phases is zero', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: { total_phases: 0 }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });

  it('returns structured error when total_phases is negative', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: { total_phases: -2 }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });

  it('returns structured error when total_phases is a non-integer', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: { total_phases: 2.5 }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });

  it('returns structured error when total_phases is not a number', () => {
    const read = mockReadDocument({ '/plan.md': { frontmatter: { total_phases: 'three' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });
});

// ─── task_completed ─────────────────────────────────────────────────────────

describe('task_completed', () => {
  const event = 'task_completed';
  const ctx = { doc_path: '/report.md' };
  const validFm = { status: 'complete', has_deviations: false, deviation_type: 'none' };

  it('extracts status, has_deviations, deviation_type from task report', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: validFm, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.report_status, 'complete');
    assert.equal(res.context.has_deviations, false);
    assert.equal(res.context.deviation_type, 'none');
  });

  it('normalizes status "pass" to report_status "complete"', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'pass' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context.report_status, 'complete');
  });

  it('normalizes status "fail" to report_status "failed"', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'fail' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context.report_status, 'failed');
  });

  it('normalizes status "partial" to report_status "failed"', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'partial' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context.report_status, 'failed');
  });

  it('passes through status "complete" to report_status "complete"', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'complete' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context.report_status, 'complete');
  });

  it('passes through status "failed" to report_status "failed"', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'failed' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context.report_status, 'failed');
  });

  it('returns structured error when document is not found', () => {
    const read = mockReadDocument({});
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.event, 'task_completed');
  });

  it('returns structured error when status is missing', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { has_deviations: false, deviation_type: 'none' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'status');
  });

  it('returns structured error when has_deviations is missing', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { status: 'complete', deviation_type: 'none' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'has_deviations');
  });

  it('returns structured error when deviation_type is missing (undefined)', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { status: 'complete', has_deviations: false }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'deviation_type');
  });

  it('returns structured error when status value is unrecognized', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...validFm, status: 'banana' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'status');
    assert.ok(res.error.error.includes('Unrecognized'));
  });
});

// ─── code_review_completed ──────────────────────────────────────────────────

describe('code_review_completed', () => {
  const event = 'code_review_completed';
  const ctx = { doc_path: '/review.md' };

  it('extracts verdict and sets review_doc_path', () => {
    const read = mockReadDocument({ '/review.md': { frontmatter: { verdict: 'approved' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.verdict, 'approved');
    assert.equal(res.context.review_doc_path, '/review.md');
  });

  it('returns structured error when document is not found', () => {
    const read = mockReadDocument({});
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.event, 'code_review_completed');
  });

  it('returns structured error when verdict is missing', () => {
    const read = mockReadDocument({ '/review.md': { frontmatter: {}, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
  });
});

// ─── phase_plan_created ─────────────────────────────────────────────────────

describe('phase_plan_created', () => {
  const event = 'phase_plan_created';
  const ctx = { doc_path: '/phase.md' };

  it('extracts tasks array from phase plan frontmatter', () => {
    const tasks = [{ id: 't1' }, { id: 't2' }];
    const read = mockReadDocument({ '/phase.md': { frontmatter: { tasks }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.deepEqual(res.context.tasks, tasks);
  });

  it('returns structured error when document is not found', () => {
    const read = mockReadDocument({});
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.event, 'phase_plan_created');
  });

  it('returns structured error when tasks is missing', () => {
    const read = mockReadDocument({ '/phase.md': { frontmatter: {}, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'tasks');
  });

  it('returns structured error when tasks is not an array', () => {
    const read = mockReadDocument({ '/phase.md': { frontmatter: { tasks: 'not-array' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'tasks');
  });

  it('returns structured error when tasks is an empty array', () => {
    const read = mockReadDocument({ '/phase.md': { frontmatter: { tasks: [] }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'tasks');
  });

  it('forwards title to context when present in frontmatter', () => {
    const tasks = [{ id: 't1' }];
    const read = mockReadDocument({ '/phase.md': { frontmatter: { tasks, title: 'Core Features' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.title, 'Core Features');
  });

  it('sets context.title to null when title is absent from frontmatter', () => {
    const tasks = [{ id: 't1' }];
    const read = mockReadDocument({ '/phase.md': { frontmatter: { tasks }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.title, null);
  });
});

// ─── phase_review_completed ─────────────────────────────────────────────────

describe('phase_review_completed', () => {
  const event = 'phase_review_completed';
  const ctx = { doc_path: '/phase-review.md' };

  it('extracts verdict, exit_criteria_met, and sets review_doc_path', () => {
    const read = mockReadDocument({ '/phase-review.md': { frontmatter: { verdict: 'approved', exit_criteria_met: true }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.equal(res.context.verdict, 'approved');
    assert.equal(res.context.exit_criteria_met, true);
    assert.equal(res.context.review_doc_path, '/phase-review.md');
  });

  it('returns structured error when document is not found', () => {
    const read = mockReadDocument({});
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.event, 'phase_review_completed');
  });

  it('returns structured error when verdict is missing', () => {
    const read = mockReadDocument({ '/phase-review.md': { frontmatter: { exit_criteria_met: true }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
  });

  it('returns structured error when exit_criteria_met is missing', () => {
    const read = mockReadDocument({ '/phase-review.md': { frontmatter: { verdict: 'approved' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'exit_criteria_met');
  });
});

// ─── Pass-through behavior ──────────────────────────────────────────────────

describe('pass-through behavior', () => {
  it('returns success with unmodified context for unknown events', () => {
    const ctx = { foo: 'bar' };
    const read = () => { throw new Error('readDocument should not be called'); };
    const res = preRead('start', ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.deepEqual(res.context, { foo: 'bar' });
  });

  it('returns success with unmodified context for another unknown event', () => {
    const ctx = { x: 1 };
    const read = () => { throw new Error('readDocument should not be called'); };
    const res = preRead('unknown_event', ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.deepEqual(res.context, { x: 1 });
  });
});

// ─── coerceNull behavior (via preRead entry point) ──────────────────────────

describe('coerceNull via task_completed', () => {
  const event = 'task_completed';
  const ctx = { doc_path: '/report.md' };
  const base = { status: 'complete', has_deviations: false };

  it('coerces deviation_type "null" string to JSON null', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...base, deviation_type: 'null' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.strictEqual(res.context.deviation_type, null);
  });

  it('coerces deviation_type "undefined" string to JSON null', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...base, deviation_type: 'undefined' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.strictEqual(res.context.deviation_type, null);
  });

  it('passes through deviation_type "minor" unchanged', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...base, deviation_type: 'minor' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.strictEqual(res.context.deviation_type, 'minor');
  });

  it('passes through deviation_type null (JSON null) unchanged', () => {
    const read = mockReadDocument({ '/report.md': { frontmatter: { ...base, deviation_type: null }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.error, undefined);
    assert.strictEqual(res.context.deviation_type, null);
  });
});

describe('coerceNull via code_review_completed', () => {
  const event = 'code_review_completed';
  const ctx = { doc_path: '/review.md' };

  it('coerces verdict "null" string to null and returns structured error (missing required field)', () => {
    const read = mockReadDocument({ '/review.md': { frontmatter: { verdict: 'null' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
    assert.equal(res.error.error, 'Missing required field');
  });

  it('coerces verdict "undefined" string to null and returns structured error (missing required field)', () => {
    const read = mockReadDocument({ '/review.md': { frontmatter: { verdict: 'undefined' }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
    assert.equal(res.error.error, 'Missing required field');
  });
});

describe('coerceNull via phase_review_completed', () => {
  const event = 'phase_review_completed';
  const ctx = { doc_path: '/phase-review.md' };

  it('coerces verdict "null" string to null and returns structured error (missing required field)', () => {
    const read = mockReadDocument({ '/phase-review.md': { frontmatter: { verdict: 'null', exit_criteria_met: true }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
    assert.equal(res.error.error, 'Missing required field');
  });

  it('coerces verdict "undefined" string to null and returns structured error (missing required field)', () => {
    const read = mockReadDocument({ '/phase-review.md': { frontmatter: { verdict: 'undefined', exit_criteria_met: true }, body: '' } });
    const res = preRead(event, ctx, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'verdict');
    assert.equal(res.error.error, 'Missing required field');
  });
});

// ─── Error structure ────────────────────────────────────────────────────────

describe('error structure', () => {
  it('all failure results have context: undefined and error with event + error string', () => {
    const read = mockReadDocument({});
    const res = preRead('plan_approved', { doc_path: '/x.md' }, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(typeof res.error.error, 'string');
    assert.equal(typeof res.error.event, 'string');
  });

  it('missing-field failures include field property', () => {
    const read = mockReadDocument({ '/x.md': { frontmatter: {}, body: '' } });
    const res = preRead('plan_approved', { doc_path: '/x.md' }, read, '/proj');
    assert.equal(res.context, undefined);
    assert.equal(res.error.field, 'total_phases');
  });
});

/**
 * Tests for normalizer final_review v3 fallback logic.
 * Run with: npx tsx ui/lib/normalizer.test.ts
 */
import assert from 'node:assert';
import { normalizeState } from './normalizer';
import type { RawStateJson } from '@/types/state';

/** Minimal v3 RawStateJson factory — final_review is absent by default. */
function makeV3Raw(overrides?: {
  execution?: Record<string, unknown>;
  final_review?: RawStateJson['final_review'];
}): RawStateJson {
  const base: RawStateJson = {
    $schema: 'orchestration-state-v3',
    project: { name: 'TEST', description: 'desc', created: '2025-01-01', updated: '2025-01-02', brainstorming_doc: 'b.md' },
    pipeline: { current_tier: 'execution', human_gate_mode: 'ask' },
    planning: {
      status: 'complete',
      steps: {
        research: { status: 'complete', output: 'r.md' },
        prd: { status: 'complete', output: 'p.md' },
        design: { status: 'complete', output: 'd.md' },
        architecture: { status: 'complete', output: 'a.md' },
        master_plan: { status: 'complete', output: 'm.md' },
      },
      human_approved: true,
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      total_phases: 1,
      phases: [],
      ...(overrides?.execution ?? {}),
    } as RawStateJson['execution'],
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3 },
  };
  if (overrides?.final_review !== undefined) {
    base.final_review = overrides.final_review;
  }
  return base;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

console.log('normalizeState — final_review v3 fallback');

test('v3 with final review complete and approved', () => {
  const raw = makeV3Raw({
    execution: {
      final_review_status: 'complete',
      final_review_doc: 'custom/project-store/X/reports/FINAL-REVIEW.md',
      final_review_approved: true,
    },
  });
  const result = normalizeState(raw);
  assert.deepStrictEqual(result.final_review, {
    status: 'complete',
    report_doc: 'custom/project-store/X/reports/FINAL-REVIEW.md',
    human_approved: true,
  });
});

test('v3 with final review complete but not yet approved', () => {
  const raw = makeV3Raw({
    execution: {
      final_review_status: 'complete',
      final_review_doc: 'custom/project-store/X/reports/FINAL-REVIEW.md',
      // no final_review_approved
    },
  });
  const result = normalizeState(raw);
  assert.deepStrictEqual(result.final_review, {
    status: 'complete',
    report_doc: 'custom/project-store/X/reports/FINAL-REVIEW.md',
    human_approved: false,
  });
});

test('v3 before any final review activity', () => {
  const raw = makeV3Raw();
  const result = normalizeState(raw);
  assert.deepStrictEqual(result.final_review, {
    status: 'not_started',
    report_doc: null,
    human_approved: false,
  });
});

test('v4+ with top-level final_review uses it as-is', () => {
  const raw = makeV3Raw({
    final_review: {
      status: 'complete',
      report_doc: 'path/to/report.md',
      human_approved: true,
    },
  });
  const result = normalizeState(raw);
  assert.deepStrictEqual(result.final_review, {
    status: 'complete',
    report_doc: 'path/to/report.md',
    human_approved: true,
  });
});

test('all other normalized fields unchanged', () => {
  const raw = makeV3Raw({
    execution: {
      final_review_status: 'complete',
      final_review_doc: 'doc.md',
      final_review_approved: true,
    },
  });
  const result = normalizeState(raw);

  assert.strictEqual(result.schema, 'orchestration-state-v3');
  assert.strictEqual(result.project.name, 'TEST');
  assert.strictEqual(result.project.description, 'desc');
  assert.strictEqual(result.pipeline.current_tier, 'execution');
  assert.strictEqual(result.planning.status, 'complete');
  assert.strictEqual(result.planning.human_approved, true);
  assert.strictEqual(result.execution.status, 'in_progress');
  assert.strictEqual(result.execution.current_phase, 1);
  assert.deepStrictEqual(result.errors, { total_retries: 0, total_halts: 0, active_blockers: [] });
  assert.deepStrictEqual(result.limits, { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3 });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

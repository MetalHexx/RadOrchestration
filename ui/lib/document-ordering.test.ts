/**
 * Tests for document-ordering utility.
 * Run with: npx tsx ui/lib/document-ordering.test.ts
 */
import assert from 'node:assert';
import { getOrderedDocs, getAdjacentDocs } from './document-ordering';
import type { NormalizedProjectState } from '@/types/state';
import type { OrderedDoc } from '@/types/components';

function makeState(overrides?: Partial<NormalizedProjectState>): NormalizedProjectState {
  return {
    schema: '2.0',
    project: { name: 'TEST', description: null, created: '', updated: '', brainstorming_doc: null },
    pipeline: { current_tier: 'execution', human_gate_mode: 'ask' },
    planning: {
      status: 'complete',
      steps: {
        research: { status: 'not_started', output: null },
        prd: { status: 'not_started', output: null },
        design: { status: 'not_started', output: null },
        architecture: { status: 'not_started', output: null },
        master_plan: { status: 'not_started', output: null },
      },
      human_approved: false,
    },
    execution: { status: 'not_started', current_phase: 0, total_phases: 0, phases: [] },
    final_review: { status: 'not_started', report_doc: null, human_approved: false },
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    limits: { max_phases: 5, max_tasks_per_phase: 10, max_retries_per_task: 3 },
    ...overrides,
  };
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

console.log('getOrderedDocs');

test('returns planning + phase docs in canonical order', () => {
  const state = makeState({
    planning: {
      status: 'complete',
      steps: {
        research: { status: 'complete', output: 'docs/RESEARCH.md' },
        prd: { status: 'complete', output: 'docs/PRD.md' },
        design: { status: 'not_started', output: null },
        architecture: { status: 'not_started', output: null },
        master_plan: { status: 'not_started', output: null },
      },
      human_approved: true,
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      total_phases: 1,
      phases: [
        {
          phase_number: 1,
          title: 'Phase One',
          status: 'in_progress',
          phase_doc: 'phases/P01-PLAN.md',
          current_task: 1,
          total_tasks: 1,
          tasks: [
            {
              task_number: 1,
              title: 'Setup',
              status: 'complete',
              handoff_doc: 'tasks/T01.md',
              report_doc: 'reports/T01-REPORT.md',
              retries: 0,
              last_error: null,
              severity: null,
              review_doc: 'reviews/T01-REVIEW.md',
              review_verdict: 'approved',
              review_action: 'advanced',
            },
          ],
          phase_report: 'reports/P01-REPORT.md',
          human_approved: false,
          phase_review: 'reviews/P01-REVIEW.md',
          phase_review_verdict: null,
          phase_review_action: null,
        },
      ],
    },
  });

  const docs = getOrderedDocs(state, 'TEST');
  const titles = docs.map((d) => d.title);

  assert.deepStrictEqual(titles, [
    'Research',
    'PRD',
    'Phase 1 Plan',
    'P1-T1: Setup',
    'P1-T1 Report',
    'P1-T1 Review',
    'Phase 1 Report',
    'Phase 1 Review',
  ]);

  assert.strictEqual(docs[0].category, 'planning');
  assert.strictEqual(docs[2].category, 'phase');
  assert.strictEqual(docs[3].category, 'task');
  assert.strictEqual(docs[5].category, 'review');
});

test('skips null paths', () => {
  const state = makeState({
    planning: {
      status: 'complete',
      steps: {
        research: { status: 'complete', output: 'docs/RESEARCH.md' },
        prd: { status: 'not_started', output: null },
        design: { status: 'not_started', output: null },
        architecture: { status: 'not_started', output: null },
        master_plan: { status: 'not_started', output: null },
      },
      human_approved: true,
    },
  });

  const docs = getOrderedDocs(state, 'TEST');
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, 'Research');
});

test('appends error log from allFiles after final review', () => {
  const state = makeState({
    final_review: { status: 'complete', report_doc: 'reviews/FINAL.md', human_approved: true },
  });

  const allFiles = ['reviews/FINAL.md', 'projects/TEST-ERROR-LOG.md'];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  assert.deepStrictEqual(docs.map((d) => d.title), ['Final Review', 'Error Log']);
  assert.strictEqual(docs[1].category, 'error-log');
});

test('appends other docs sorted alphabetically', () => {
  const state = makeState();
  const allFiles = ['docs/ZEBRA.md', 'docs/ALPHA.md', 'image.png'];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  assert.deepStrictEqual(docs.map((d) => d.title), ['ALPHA', 'ZEBRA']);
  assert.strictEqual(docs[0].category, 'other');
  assert.strictEqual(docs[1].category, 'other');
});

console.log('\ngetAdjacentDocs');

const sampleDocs: OrderedDoc[] = [
  { path: 'a.md', title: 'A', category: 'planning' },
  { path: 'b.md', title: 'B', category: 'phase' },
  { path: 'c.md', title: 'C', category: 'task' },
];

test('returns prev: null at index 0', () => {
  const result = getAdjacentDocs(sampleDocs, 'a.md');
  assert.strictEqual(result.prev, null);
  assert.deepStrictEqual(result.next, sampleDocs[1]);
  assert.strictEqual(result.currentIndex, 0);
  assert.strictEqual(result.total, 3);
});

test('returns next: null at last index', () => {
  const result = getAdjacentDocs(sampleDocs, 'c.md');
  assert.deepStrictEqual(result.prev, sampleDocs[1]);
  assert.strictEqual(result.next, null);
  assert.strictEqual(result.currentIndex, 2);
  assert.strictEqual(result.total, 3);
});

test('returns both prev and next at a middle index', () => {
  const result = getAdjacentDocs(sampleDocs, 'b.md');
  assert.deepStrictEqual(result.prev, sampleDocs[0]);
  assert.deepStrictEqual(result.next, sampleDocs[2]);
  assert.strictEqual(result.currentIndex, 1);
  assert.strictEqual(result.total, 3);
});

test('returns currentIndex -1 when path not found', () => {
  const result = getAdjacentDocs(sampleDocs, 'unknown.md');
  assert.deepStrictEqual(result, { prev: null, next: null, currentIndex: -1, total: 3 });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

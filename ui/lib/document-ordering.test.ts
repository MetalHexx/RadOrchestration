/**
 * Tests for document-ordering utility.
 * Run with: npx tsx ui/lib/document-ordering.test.ts
 */
import assert from 'node:assert';
import { getOrderedDocs, getAdjacentDocs } from './document-ordering';
import type { ProjectState } from '@/types/state';
import type { OrderedDoc } from '@/types/components';

function makeState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: '', updated: '' },
    pipeline: { current_tier: 'execution', gate_mode: null },
    planning: {
      status: 'complete',
      human_approved: false,
      steps: [
        { name: 'research', status: 'not_started', doc_path: null },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
    execution: { status: 'not_started', current_phase: 0, phases: [] },
    final_review: { status: 'not_started', doc_path: null, human_approved: false },
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
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'docs/RESEARCH.md' },
        { name: 'prd', status: 'complete', doc_path: 'docs/PRD.md' },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase One',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [
            {
              name: 'Setup',
              status: 'complete',
              stage: 'complete',
              docs: {
                handoff: 'tasks/T01.md',
                review: 'reviews/T01-REVIEW.md',
              },
              review: { verdict: 'approved', action: 'advanced' },
              retries: 0,
            },
          ],
          docs: {
            phase_plan: 'phases/P01-PLAN.md',
            phase_review: 'reviews/P01-REVIEW.md',
          },
          review: { verdict: null, action: null },
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
    'P1-T1 Review',
    'Phase 1 Review',
  ]);

  assert.strictEqual(docs[0].category, 'planning');
  assert.strictEqual(docs[2].category, 'phase');
  assert.strictEqual(docs[3].category, 'task');
  assert.strictEqual(docs[4].category, 'review');
});

test('skips null paths', () => {
  const state = makeState({
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'docs/RESEARCH.md' },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
  });

  const docs = getOrderedDocs(state, 'TEST');
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, 'Research');
});

test('appends error log from allFiles after final review', () => {
  const state = makeState({
    final_review: { status: 'complete', doc_path: 'reviews/FINAL.md', human_approved: true },
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

test('excludes planning docs from Other Documents when state uses absolute paths but allFiles has relative paths', () => {
  const state = makeState({
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'C:/dev/projects/TEST/TEST-RESEARCH-FINDINGS.md' },
        { name: 'prd', status: 'complete', doc_path: 'C:/dev/projects/TEST/TEST-PRD.md' },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
  });

  const allFiles = ['TEST-RESEARCH-FINDINGS.md', 'TEST-PRD.md', 'EXTRA-NOTES.md'];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  const otherDocs = docs.filter((d) => d.category === 'other');
  assert.strictEqual(otherDocs.length, 1, 'Only EXTRA-NOTES.md should be other');
  assert.strictEqual(otherDocs[0].title, 'EXTRA-NOTES');
});

test('excludes phase plan docs from Other Documents when state paths differ in format', () => {
  const state = makeState({
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase One',
          status: 'in_progress',
          stage: 'executing',
          current_task: 0,
          tasks: [],
          docs: {
            phase_plan: 'C:/dev/projects/TEST/phases/TEST-PHASE-P01-PLAN.md',
            phase_review: null,
          },
          review: { verdict: null, action: null },
        },
      ],
    },
  });

  const allFiles = ['phases/TEST-PHASE-P01-PLAN.md', 'EXTRA.md'];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  const otherDocs = docs.filter((d) => d.category === 'other');
  assert.strictEqual(otherDocs.length, 1, 'Only EXTRA.md should be other');
  assert.strictEqual(otherDocs[0].title, 'EXTRA');
});

test('excludes task handoff docs from Other Documents when paths differ in format', () => {
  const state = makeState({
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase One',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [
            {
              name: 'Setup',
              status: 'complete',
              stage: 'complete',
              docs: {
                handoff: 'C:/dev/projects/TEST/tasks/TEST-TASK-P01-T01-SETUP.md',
                review: null,
              },
              review: { verdict: 'approved', action: 'advanced' },
              retries: 0,
            },
          ],
          docs: { phase_plan: null, phase_review: null },
          review: { verdict: null, action: null },
        },
      ],
    },
  });

  const allFiles = [
    'tasks/TEST-TASK-P01-T01-SETUP.md',
    'NOTES.md',
  ];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  const otherDocs = docs.filter((d) => d.category === 'other');
  assert.strictEqual(otherDocs.length, 1, 'Only NOTES.md should be other');
  assert.strictEqual(otherDocs[0].title, 'NOTES');
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

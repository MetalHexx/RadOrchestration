/**
 * Tests for document-ordering utility.
 * Run with: npx tsx ui/lib/document-ordering.test.ts
 */
import assert from 'node:assert';
import { getOrderedDocs, getAdjacentDocs, getOrderedDocsV5 } from './document-ordering';
import type { ProjectState, ProjectStateV5, NodesRecord } from '@/types/state';
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
              commit_hash: null,
            },
          ],
          docs: {
            phase_plan: 'phases/P01-PLAN.md',
            phase_report: null,
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

test('includes phase_report between task reviews and phase_review', () => {
  const state = makeState({
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase One',
          status: 'in_progress',
          stage: 'reviewing',
          current_task: 1,
          tasks: [
            {
              name: 'Setup',
              status: 'complete',
              stage: 'complete',
              docs: { handoff: 'tasks/T01.md', review: 'reviews/T01-REVIEW.md' },
              review: { verdict: 'approved', action: 'advanced' },
              retries: 0,
              commit_hash: null,
            },
          ],
          docs: {
            phase_plan: 'phases/P01-PLAN.md',
            phase_report: 'reports/P01-REPORT.md',
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
    'Phase 1 Plan',
    'P1-T1: Setup',
    'P1-T1 Review',
    'Phase 1 Report',
    'Phase 1 Review',
  ]);

  const reportDoc = docs.find((d) => d.title === 'Phase 1 Report')!;
  assert.strictEqual(reportDoc.category, 'phase');
  assert.strictEqual(reportDoc.path, 'reports/P01-REPORT.md');
});

test('skips null phase_report path', () => {
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
          docs: { phase_plan: 'phases/P01-PLAN.md', phase_report: null, phase_review: 'reviews/P01-REVIEW.md' },
          review: { verdict: null, action: null },
        },
      ],
    },
  });

  const docs = getOrderedDocs(state, 'TEST');
  const titles = docs.map((d) => d.title);
  assert.deepStrictEqual(titles, ['Phase 1 Plan', 'Phase 1 Review']);
  assert.strictEqual(docs.find((d) => d.title === 'Phase 1 Report'), undefined);
});

test('excludes phase_report from Other Documents', () => {
  const state = makeState({
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase One',
          status: 'in_progress',
          stage: 'reviewing',
          current_task: 0,
          tasks: [],
          docs: {
            phase_plan: null,
            phase_report: 'C:/dev/projects/TEST/TEST-PHASE-P01-REPORT.md',
            phase_review: null,
          },
          review: { verdict: null, action: null },
        },
      ],
    },
  });

  const allFiles = ['TEST-PHASE-P01-REPORT.md', 'EXTRA.md'];
  const docs = getOrderedDocs(state, 'TEST', allFiles);

  const otherDocs = docs.filter((d) => d.category === 'other');
  assert.strictEqual(otherDocs.length, 1, 'Only EXTRA.md should be other');
  assert.strictEqual(otherDocs[0].title, 'EXTRA');
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
            phase_report: null,
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
              commit_hash: null,
            },
          ],
          docs: { phase_plan: null, phase_report: null, phase_review: null },
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

// ─── getOrderedDocsV5 ─────────────────────────────────────────────────────────

console.log('\ngetOrderedDocsV5');

function makeV5State(nodes: NodesRecord = {}): ProjectStateV5 {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '', updated: '' },
    config: {
      gate_mode: 'autonomous',
      limits: { max_phases: 5, max_tasks_per_phase: 10, max_retries_per_task: 2, max_consecutive_review_rejections: 2 },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    },
    pipeline: {
      gate_mode: 'autonomous',
      source_control: null,
      current_tier: 'execution',
      halt_reason: null,
    },
    graph: {
      template_id: 'full',
      status: 'in_progress',
      current_node_path: null,
      nodes,
    },
  };
}

test('root planning step nodes produce docs in definition order with planning category', () => {
  const state = makeV5State({
    research: { kind: 'step', status: 'completed', doc_path: 'docs/RESEARCH.md', retries: 0 },
    prd: { kind: 'step', status: 'completed', doc_path: 'docs/PRD.md', retries: 0 },
    design: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
    architecture: { kind: 'step', status: 'completed', doc_path: 'docs/ARCH.md', retries: 0 },
    master_plan: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 3);
  assert.deepStrictEqual(docs.map((d) => d.title), ['Research Findings', 'PRD', 'Architecture']);
  assert.deepStrictEqual(docs.map((d) => d.category), ['planning', 'planning', 'planning']);
  assert.strictEqual(docs[0].path, 'docs/RESEARCH.md');
});

test('null doc_path on step nodes is skipped', () => {
  const state = makeV5State({
    research: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
    prd: { kind: 'step', status: 'completed', doc_path: 'docs/PRD.md', retries: 0 },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, 'PRD');
});

test('for_each_phase iterations produce phase-level documents with correct categories and titles', () => {
  const state = makeV5State({
    phase_loop: {
      kind: 'for_each_phase',
      status: 'in_progress',
      iterations: [
        {
          index: 0,
          status: 'completed',
          nodes: {
            phase_planning: { kind: 'step', status: 'completed', doc_path: 'phases/P01-PLAN.md', retries: 0 },
            phase_report: { kind: 'step', status: 'completed', doc_path: 'phases/P01-REPORT.md', retries: 0 },
            phase_review: { kind: 'step', status: 'completed', doc_path: 'reviews/P01-REVIEW.md', retries: 0 },
          },
          corrective_tasks: [],
          commit_hash: null,
        },
      ],
    },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 3);
  assert.deepStrictEqual(docs.map((d) => d.title), ['Phase 1 Plan', 'Phase 1 Report', 'Phase 1 Review']);
  assert.deepStrictEqual(docs.map((d) => d.category), ['phase', 'phase', 'review']);
});

test('for_each_task iterations produce task-level documents with correct categories and PN-TM titles', () => {
  const state = makeV5State({
    phase_loop: {
      kind: 'for_each_phase',
      status: 'in_progress',
      iterations: [
        {
          index: 0,
          status: 'in_progress',
          nodes: {
            task_loop: {
              kind: 'for_each_task',
              status: 'in_progress',
              iterations: [
                {
                  index: 0,
                  status: 'completed',
                  nodes: {
                    task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/T01.md', retries: 0 },
                    code_review: { kind: 'step', status: 'completed', doc_path: 'reviews/T01-REVIEW.md', retries: 0 },
                  },
                  corrective_tasks: [],
                  commit_hash: null,
                },
              ],
            },
          },
          corrective_tasks: [],
          commit_hash: null,
        },
      ],
    },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 2);
  assert.deepStrictEqual(docs.map((d) => d.title), ['P1-T1 Handoff', 'P1-T1 Review']);
  assert.strictEqual(docs[0].category, 'task');
  assert.strictEqual(docs[1].category, 'review');
});

test('corrective task step nodes append CT suffix with task category', () => {
  const state = makeV5State({
    phase_loop: {
      kind: 'for_each_phase',
      status: 'in_progress',
      iterations: [
        {
          index: 0,
          status: 'in_progress',
          nodes: {
            task_loop: {
              kind: 'for_each_task',
              status: 'in_progress',
              iterations: [
                {
                  index: 0,
                  status: 'in_progress',
                  nodes: {
                    task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/T01.md', retries: 0 },
                  },
                  corrective_tasks: [
                    {
                      index: 1,
                      reason: 'failed',
                      injected_after: 'code_review',
                      status: 'completed',
                      nodes: {
                        task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/T01-CT1.md', retries: 0 },
                      },
                      commit_hash: null,
                    },
                  ],
                  commit_hash: null,
                },
              ],
            },
          },
          corrective_tasks: [],
          commit_hash: null,
        },
      ],
    },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 2);
  assert.strictEqual(docs[0].title, 'P1-T1 Handoff');
  assert.strictEqual(docs[1].title, 'P1-T1 Handoff (CT1)');
  assert.strictEqual(docs[1].category, 'task');
  assert.strictEqual(docs[1].path, 'tasks/T01-CT1.md');
});

test('gate and conditional nodes are skipped (no documents produced)', () => {
  const state = makeV5State({
    plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    gate_mode_selection: { kind: 'conditional', status: 'not_started', branch_taken: null },
    research: { kind: 'step', status: 'completed', doc_path: 'docs/RESEARCH.md', retries: 0 },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, 'Research Findings');
});

test('final_review root step node produces review category with Final Review title', () => {
  const state = makeV5State({
    final_review: { kind: 'step', status: 'completed', doc_path: 'reviews/FINAL-REVIEW.md', retries: 0 },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].title, 'Final Review');
  assert.strictEqual(docs[0].category, 'review');
  assert.strictEqual(docs[0].path, 'reviews/FINAL-REVIEW.md');
});

test('error log from allFiles is appended with error-log category after graph docs', () => {
  const state = makeV5State({
    final_review: { kind: 'step', status: 'completed', doc_path: 'reviews/FINAL-REVIEW.md', retries: 0 },
  });

  const allFiles = ['reviews/FINAL-REVIEW.md', 'TEST-ERROR-LOG.md'];
  const docs = getOrderedDocsV5(state, 'TEST', allFiles);

  assert.strictEqual(docs.length, 2);
  assert.strictEqual(docs[0].title, 'Final Review');
  assert.strictEqual(docs[1].title, 'Error Log');
  assert.strictEqual(docs[1].category, 'error-log');
});

test('remaining md files from allFiles are appended sorted with other category', () => {
  const state = makeV5State();
  const allFiles = ['docs/ZEBRA.md', 'docs/ALPHA.md', 'image.png'];
  const docs = getOrderedDocsV5(state, 'TEST', allFiles);

  assert.deepStrictEqual(docs.map((d) => d.title), ['ALPHA', 'ZEBRA']);
  assert.strictEqual(docs[0].category, 'other');
  assert.strictEqual(docs[1].category, 'other');
});

test('empty graph produces empty result', () => {
  const state = makeV5State();
  const docs = getOrderedDocsV5(state, 'TEST');
  assert.deepStrictEqual(docs, []);
});

test('empty graph with allFiles extras returns only extras', () => {
  const state = makeV5State();
  const allFiles = ['TEST-ERROR-LOG.md', 'EXTRA.md'];
  const docs = getOrderedDocsV5(state, 'TEST', allFiles);
  assert.strictEqual(docs[0].category, 'error-log');
  assert.strictEqual(docs[1].category, 'other');
  assert.strictEqual(docs[1].title, 'EXTRA');
});

test('full integration: planning + phase iteration with task iteration + corrective task + final review', () => {
  const state = makeV5State({
    research: { kind: 'step', status: 'completed', doc_path: 'docs/RESEARCH.md', retries: 0 },
    prd: { kind: 'step', status: 'completed', doc_path: 'docs/PRD.md', retries: 0 },
    design: { kind: 'step', status: 'completed', doc_path: 'docs/DESIGN.md', retries: 0 },
    architecture: { kind: 'step', status: 'completed', doc_path: 'docs/ARCH.md', retries: 0 },
    master_plan: { kind: 'step', status: 'completed', doc_path: 'docs/MASTER-PLAN.md', retries: 0 },
    plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: false },
    phase_loop: {
      kind: 'for_each_phase',
      status: 'in_progress',
      iterations: [
        {
          index: 0,
          status: 'in_progress',
          nodes: {
            phase_planning: { kind: 'step', status: 'completed', doc_path: 'phases/P01-PLAN.md', retries: 0 },
            task_loop: {
              kind: 'for_each_task',
              status: 'in_progress',
              iterations: [
                {
                  index: 0,
                  status: 'completed',
                  nodes: {
                    task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/T01.md', retries: 0 },
                    code_review: { kind: 'step', status: 'completed', doc_path: 'reviews/T01-REVIEW.md', retries: 0 },
                  },
                  corrective_tasks: [
                    {
                      index: 1,
                      reason: 'failed review',
                      injected_after: 'code_review',
                      status: 'completed',
                      nodes: {
                        task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/T01-CT1.md', retries: 0 },
                      },
                      commit_hash: null,
                    },
                  ],
                  commit_hash: null,
                },
              ],
            },
            phase_report: { kind: 'step', status: 'completed', doc_path: 'phases/P01-REPORT.md', retries: 0 },
            phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          },
          corrective_tasks: [],
          commit_hash: null,
        },
      ],
    },
    final_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
  });

  const docs = getOrderedDocsV5(state, 'TEST');
  const titles = docs.map((d) => d.title);

  assert.deepStrictEqual(titles, [
    'Research Findings',
    'PRD',
    'Design',
    'Architecture',
    'Master Plan',
    'Phase 1 Plan',
    'P1-T1 Handoff',
    'P1-T1 Review',
    'P1-T1 Handoff (CT1)',
    'Phase 1 Report',
  ]);

  assert.strictEqual(docs[0].category, 'planning');
  assert.strictEqual(docs[5].category, 'phase');
  assert.strictEqual(docs[6].category, 'task');
  assert.strictEqual(docs[7].category, 'review');
  assert.strictEqual(docs[8].category, 'task');
  assert.strictEqual(docs[9].category, 'phase');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

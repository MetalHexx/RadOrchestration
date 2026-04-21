/**
 * Review-Rework Fixture Registry (Iter 12)
 *
 * Six fixture pairs (approved + changes_requested per scope) consumed by the
 * unit-level review-rework tests. Each fixture declares:
 *   - Programmatic commit structure (rehydrated via `createGitFixture`).
 *   - Planning-doc content strings the reviewer would read in the harness.
 *   - Expected verdict + representative audit-table shape used for assertions.
 *
 * The fixtures are intentionally minimal — they exercise the engine contract
 * (enrichment + validator). End-to-end reviewer behaviour is covered by the
 * prompt harness in `prompt-tests/code-review-rework-e2e/`.
 */

export type AuditStatus = 'on-track' | 'drift' | 'regression' | 'met' | 'missing';

export interface FixtureAuditRow {
  requirement_id: string;
  status: AuditStatus;
  severity: 'none' | 'low' | 'medium' | 'high';
  note: string;
}

export interface FixtureCommitSpec {
  message: string;
  files: Record<string, string>;
}

export interface ReviewReworkFixture {
  id: string;
  scope: 'task' | 'phase' | 'final';
  outcome: 'approved' | 'changes_requested';
  projectName: string;
  /** Commit sequence to rehydrate in the temp repo. */
  commits: FixtureCommitSpec[];
  /** Requirements doc content (inlined — no separate asset file). */
  requirementsDoc: string;
  /** Phase Plan content (phase + final scopes only). */
  phasePlanDoc?: string;
  /** Master Plan content (phase + final scopes only). */
  masterPlanDoc?: string;
  /**
   * Task handoff contents by relative path. Keyed so the test can assert the
   * set matches the commit sequence's `tasks/` layout.
   */
  taskHandoffs?: Record<string, string>;
  /**
   * Expected review doc frontmatter — the shape a reviewer should emit.
   * Tests use this to assert the validator accepts the expected frontmatter
   * and rejects a contrived invalid variant.
   */
  expectedFrontmatter: Record<string, unknown>;
  /**
   * Representative audit rows — one row per fixture. Tests assert the
   * fixture's prose matches the declared outcome (e.g., the broken
   * task-review fixture carries one drift row at severity: medium).
   */
  expectedAuditRows: FixtureAuditRow[];
}

// ─── Task-scope fixtures ──────────────────────────────────────────────────────

const TASK_REVIEW_CLEAN: ReviewReworkFixture = {
  id: 'task-review/clean',
  scope: 'task',
  outcome: 'approved',
  projectName: 'TASK-CLEAN',
  commits: [
    {
      message: 'T1: implement getColors returning FR-1 + FR-2 shape',
      files: {
        'src/colors.ts':
          "export type Color = 'red' | 'orange' | 'yellow';\n" +
          "export function getColors(): Color[] {\n" +
          "  return ['red', 'orange', 'yellow'];\n" +
          "}\n",
        'src/colors.test.ts':
          "import { getColors } from './colors.js';\n" +
          "test('returns ordered palette', () => {\n" +
          "  expect(getColors()).toEqual(['red', 'orange', 'yellow']);\n" +
          "});\n",
      },
    },
  ],
  requirementsDoc:
    '# TASK-CLEAN Requirements\n\n' +
    '## FR-1: Ordered palette\nThe `getColors` function MUST return the palette in the order red, orange, yellow.\n\n' +
    '## FR-2: Type-safe return\nThe return type MUST be `Color[]` where `Color` is the union `\'red\' | \'orange\' | \'yellow\'`.\n',
  taskHandoffs: {
    'tasks/TASK-CLEAN-TASK-P01-T01-COLORS.md':
      '---\nproject: "TASK-CLEAN"\nphase: 1\ntask: 1\ntitle: "Colors"\nstatus: "pending"\nskills: []\nestimated_files: 2\n---\n\n# Task: Colors\n\nImplement FR-1 + FR-2 per the Requirements doc. File Targets: `src/colors.ts`, `src/colors.test.ts`.\n',
  },
  expectedFrontmatter: {
    project: 'TASK-CLEAN',
    phase: 1,
    task: 1,
    verdict: 'approved',
    severity: 'none',
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'on-track', severity: 'none', note: 'getColors returns palette in correct order' },
    { requirement_id: 'FR-2', status: 'on-track', severity: 'none', note: 'Return type Color[] matches contract' },
  ],
};

const TASK_REVIEW_BROKEN: ReviewReworkFixture = {
  id: 'task-review/broken',
  scope: 'task',
  outcome: 'changes_requested',
  projectName: 'TASK-BROKEN',
  commits: [
    {
      message: 'T1: implement getColors — FR-2 drift (return type Promise<Color[]>)',
      files: {
        'src/colors.ts':
          "export type Color = 'red' | 'orange' | 'yellow';\n" +
          "// Drift: Task Handoff / FR-2 specify Color[] (synchronous).\n" +
          "// Implementation returns a Promise, breaking the contract.\n" +
          "export async function getColors(): Promise<Color[]> {\n" +
          "  return ['red', 'orange', 'yellow'];\n" +
          "}\n",
      },
    },
  ],
  requirementsDoc:
    '# TASK-BROKEN Requirements\n\n' +
    '## FR-1: Ordered palette\nThe `getColors` function MUST return the palette in the order red, orange, yellow.\n\n' +
    '## FR-2: Synchronous return\nThe function MUST return `Color[]` synchronously — no Promise wrapping.\n',
  taskHandoffs: {
    'tasks/TASK-BROKEN-TASK-P01-T01-COLORS.md':
      '---\nproject: "TASK-BROKEN"\nphase: 1\ntask: 1\ntitle: "Colors"\nstatus: "pending"\nskills: []\nestimated_files: 1\n---\n\n# Task: Colors\n\nImplement FR-1 + FR-2 per the Requirements doc. The return type MUST be `Color[]` synchronously.\n',
  },
  expectedFrontmatter: {
    project: 'TASK-BROKEN',
    phase: 1,
    task: 1,
    verdict: 'changes_requested',
    severity: 'medium',
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'on-track', severity: 'none', note: 'Ordering intact' },
    { requirement_id: 'FR-2', status: 'drift', severity: 'medium', note: 'Return type is Promise<Color[]> — contract specifies synchronous Color[]' },
  ],
};

// ─── Phase-scope fixtures ─────────────────────────────────────────────────────

const PHASE_REVIEW_CLEAN: ReviewReworkFixture = {
  id: 'phase-review/clean',
  scope: 'phase',
  outcome: 'approved',
  projectName: 'PHASE-CLEAN',
  commits: [
    {
      message: 'T1: add getColors (FR-1)',
      files: {
        'src/colors.ts':
          "export type Color = 'red' | 'orange' | 'yellow';\n" +
          "export function getColors(): Color[] {\n" +
          "  return ['red', 'orange', 'yellow'];\n" +
          "}\n",
      },
    },
    {
      message: 'T2: consume getColors to format greeting (FR-2)',
      files: {
        'src/greet.ts':
          "import { getColors } from './colors.js';\n" +
          "export function greet(name: string): string {\n" +
          "  const palette = getColors().join(', ');\n" +
          "  return `Hello, ${name}! Palette: ${palette}.`;\n" +
          "}\n",
      },
    },
  ],
  requirementsDoc:
    '# PHASE-CLEAN Requirements\n\n' +
    '## FR-1: Palette source\n`getColors` returns `Color[]` synchronously.\n\n' +
    '## FR-2: Greeting formatter\n`greet(name)` consumes `getColors()` output and embeds the comma-joined palette.\n',
  masterPlanDoc:
    '---\nproject: "PHASE-CLEAN"\ntype: "master_plan"\nstatus: "approved"\nauthor: "planner-agent"\ncreated: "2026-04-21"\ntotal_phases: 1\ntotal_tasks: 2\n---\n\n# PHASE-CLEAN Master Plan\n\n## P01: Core flow\n\n### P01-T01: Colors\n### P01-T02: Greeting\n',
  phasePlanDoc:
    '---\nproject: "PHASE-CLEAN"\nphase: 1\ntitle: "Core flow"\nstatus: "active"\ntasks:\n  - id: "P01-T01"\n    title: "Colors"\n  - id: "P01-T02"\n    title: "Greeting"\nauthor: "explosion-script"\ncreated: "2026-04-21"\n---\n\n# Phase 01: Core flow\n\n**Requirements:** FR-1, FR-2\n\nExit criteria: tests pass and the greeting embeds the palette.\n',
  taskHandoffs: {
    'tasks/PHASE-CLEAN-TASK-P01-T01-COLORS.md':
      '---\nproject: "PHASE-CLEAN"\nphase: 1\ntask: 1\ntitle: "Colors"\nstatus: "pending"\nskills: []\nestimated_files: 1\n---\n\n# Task: Colors\n\nImplement FR-1 — `getColors(): Color[]`.\n',
    'tasks/PHASE-CLEAN-TASK-P01-T02-GREETING.md':
      '---\nproject: "PHASE-CLEAN"\nphase: 1\ntask: 2\ntitle: "Greeting"\nstatus: "pending"\nskills: []\nestimated_files: 1\n---\n\n# Task: Greeting\n\nImplement FR-2 — consume `getColors()` synchronously.\n',
  },
  expectedFrontmatter: {
    project: 'PHASE-CLEAN',
    phase: 1,
    verdict: 'approved',
    severity: 'none',
    exit_criteria_met: true,
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'on-track', severity: 'none', note: 'Phase delivers getColors contract' },
    { requirement_id: 'FR-2', status: 'on-track', severity: 'none', note: 'Greeting consumes palette as declared' },
  ],
};

const PHASE_REVIEW_BROKEN: ReviewReworkFixture = {
  id: 'phase-review/broken',
  scope: 'phase',
  outcome: 'changes_requested',
  projectName: 'PHASE-BROKEN',
  commits: [
    {
      message: 'T1: add getColors returning string[] (not Color[])',
      files: {
        'src/colors.ts':
          'export function getColors(): string[] {\n' +
          "  return ['red', 'orange', 'yellow'];\n" +
          '}\n',
      },
    },
    {
      message: 'T2: consume getColors expecting Promise<Color[]> — cross-task drift',
      files: {
        'src/greet.ts':
          "import { getColors } from './colors.js';\n" +
          "// Cross-task contract drift: T1 returned string[]; T2 awaits a Promise.\n" +
          "export async function greet(name: string): Promise<string> {\n" +
          "  const palette = (await (getColors() as unknown as Promise<string[]>)).join(', ');\n" +
          "  return `Hello, ${name}! Palette: ${palette}.`;\n" +
          "}\n",
      },
    },
  ],
  requirementsDoc:
    '# PHASE-BROKEN Requirements\n\n' +
    '## FR-1: Palette source\n`getColors` returns `Color[]` synchronously.\n\n' +
    '## FR-2: Greeting formatter\n`greet(name)` consumes `getColors()` output and embeds the comma-joined palette.\n',
  masterPlanDoc:
    '---\nproject: "PHASE-BROKEN"\ntype: "master_plan"\nstatus: "approved"\nauthor: "planner-agent"\ncreated: "2026-04-21"\ntotal_phases: 1\ntotal_tasks: 2\n---\n\n# PHASE-BROKEN Master Plan\n\n## P01: Core flow\n',
  phasePlanDoc:
    '---\nproject: "PHASE-BROKEN"\nphase: 1\ntitle: "Core flow"\nstatus: "active"\ntasks:\n  - id: "P01-T01"\n    title: "Colors"\n  - id: "P01-T02"\n    title: "Greeting"\nauthor: "explosion-script"\ncreated: "2026-04-21"\n---\n\n# Phase 01: Core flow\n\n**Requirements:** FR-1, FR-2\n\nExit criteria: tests pass and the greeting embeds the palette.\n',
  taskHandoffs: {
    'tasks/PHASE-BROKEN-TASK-P01-T01-COLORS.md':
      '---\nproject: "PHASE-BROKEN"\nphase: 1\ntask: 1\ntitle: "Colors"\nstatus: "pending"\nskills: []\nestimated_files: 1\n---\n\n# Task: Colors\n\nImplement FR-1.\n',
    'tasks/PHASE-BROKEN-TASK-P01-T02-GREETING.md':
      '---\nproject: "PHASE-BROKEN"\nphase: 1\ntask: 2\ntitle: "Greeting"\nstatus: "pending"\nskills: []\nestimated_files: 1\n---\n\n# Task: Greeting\n\nImplement FR-2.\n',
  },
  expectedFrontmatter: {
    project: 'PHASE-BROKEN',
    phase: 1,
    verdict: 'changes_requested',
    severity: 'medium',
    exit_criteria_met: false,
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'on-track', severity: 'none', note: 'Palette ordering correct' },
    { requirement_id: 'FR-2', status: 'drift', severity: 'medium', note: 'T2 awaits a Promise but T1 returns string[]; cross-task contract drift at the seam' },
  ],
};

// ─── Final-scope fixtures ─────────────────────────────────────────────────────

const FINAL_REVIEW_CLEAN: ReviewReworkFixture = {
  id: 'final-review/clean',
  scope: 'final',
  outcome: 'approved',
  projectName: 'FINAL-CLEAN',
  commits: [
    {
      message: 'P01-T01: add getColors',
      files: {
        'src/colors.ts':
          "export type Color = 'red' | 'orange' | 'yellow';\n" +
          "export function getColors(): Color[] {\n" +
          "  return ['red', 'orange', 'yellow'];\n" +
          "}\n",
      },
    },
    {
      message: 'P01-T02: add greet — embeds palette',
      files: {
        'src/greet.ts':
          "import { getColors } from './colors.js';\n" +
          "export function greet(name: string): string {\n" +
          "  return `Hello, ${name}! Palette: ${getColors().join(', ')}.`;\n" +
          "}\n",
      },
    },
    {
      message: 'P01-T03: README documents the public API (NFR-1 + NFR-2)',
      files: {
        'README.md':
          '# FINAL-CLEAN\n\n' +
          '## API\n- `getColors(): Color[]` — ordered palette.\n- `greet(name: string): string` — embeds palette into greeting.\n\n' +
          '## Performance (NFR-1)\nSynchronous; O(1).\n\n' +
          '## Documentation (NFR-2)\nPublic API documented in this README.\n',
      },
    },
  ],
  requirementsDoc:
    '# FINAL-CLEAN Requirements\n\n' +
    '## FR-1: Palette source\n`getColors` returns `Color[]`.\n\n' +
    '## FR-2: Greeting formatter\n`greet(name)` embeds the comma-joined palette.\n\n' +
    '## FR-3: Deterministic ordering\nPalette order is red, orange, yellow.\n\n' +
    '## NFR-1: Synchronous API\nPublic API is synchronous.\n\n' +
    '## NFR-2: Public-API documentation\nPublic API is documented in the README.\n',
  masterPlanDoc:
    '---\nproject: "FINAL-CLEAN"\ntype: "master_plan"\nstatus: "approved"\nauthor: "planner-agent"\ncreated: "2026-04-21"\ntotal_phases: 1\ntotal_tasks: 3\n---\n\n# FINAL-CLEAN Master Plan\n\n## P01: All work\n',
  expectedFrontmatter: {
    project: 'FINAL-CLEAN',
    verdict: 'approved',
    severity: 'none',
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'met', severity: 'none', note: 'getColors in src/colors.ts' },
    { requirement_id: 'FR-2', status: 'met', severity: 'none', note: 'greet in src/greet.ts embeds palette' },
    { requirement_id: 'FR-3', status: 'met', severity: 'none', note: 'Order verified in source literal' },
    { requirement_id: 'NFR-1', status: 'met', severity: 'none', note: 'All signatures synchronous' },
    { requirement_id: 'NFR-2', status: 'met', severity: 'none', note: 'README.md API section' },
  ],
};

const FINAL_REVIEW_BROKEN: ReviewReworkFixture = {
  id: 'final-review/broken',
  scope: 'final',
  outcome: 'changes_requested',
  projectName: 'FINAL-BROKEN',
  commits: [
    {
      message: 'P01-T01: add getColors',
      files: {
        'src/colors.ts':
          "export type Color = 'red' | 'orange' | 'yellow';\n" +
          "export function getColors(): Color[] {\n" +
          "  return ['red', 'orange', 'yellow'];\n" +
          "}\n",
      },
    },
    {
      message: 'P01-T02: add greet — embeds palette',
      files: {
        'src/greet.ts':
          "import { getColors } from './colors.js';\n" +
          "export function greet(name: string): string {\n" +
          "  return `Hello, ${name}! Palette: ${getColors().join(', ')}.`;\n" +
          "}\n",
      },
    },
    // Deliberately no README authored — NFR-2 goes missing.
  ],
  requirementsDoc:
    '# FINAL-BROKEN Requirements\n\n' +
    '## FR-1: Palette source\n`getColors` returns `Color[]`.\n\n' +
    '## FR-2: Greeting formatter\n`greet(name)` embeds the comma-joined palette.\n\n' +
    '## FR-3: Deterministic ordering\nPalette order is red, orange, yellow.\n\n' +
    '## NFR-1: Synchronous API\nPublic API is synchronous.\n\n' +
    '## NFR-2: Public-API documentation\nPublic API is documented in a README.md at the repo root.\n',
  masterPlanDoc:
    '---\nproject: "FINAL-BROKEN"\ntype: "master_plan"\nstatus: "approved"\nauthor: "planner-agent"\ncreated: "2026-04-21"\ntotal_phases: 1\ntotal_tasks: 2\n---\n\n# FINAL-BROKEN Master Plan\n',
  expectedFrontmatter: {
    project: 'FINAL-BROKEN',
    verdict: 'changes_requested',
    severity: 'medium',
    author: 'reviewer-agent',
    created: '2026-04-21',
  },
  expectedAuditRows: [
    { requirement_id: 'FR-1', status: 'met', severity: 'none', note: 'getColors in src/colors.ts' },
    { requirement_id: 'FR-2', status: 'met', severity: 'none', note: 'greet in src/greet.ts embeds palette' },
    { requirement_id: 'FR-3', status: 'met', severity: 'none', note: 'Order verified in source literal' },
    { requirement_id: 'NFR-1', status: 'met', severity: 'none', note: 'All signatures synchronous' },
    { requirement_id: 'NFR-2', status: 'missing', severity: 'medium', note: 'No README.md in the cumulative project diff' },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const REVIEW_REWORK_FIXTURES: ReviewReworkFixture[] = [
  TASK_REVIEW_CLEAN,
  TASK_REVIEW_BROKEN,
  PHASE_REVIEW_CLEAN,
  PHASE_REVIEW_BROKEN,
  FINAL_REVIEW_CLEAN,
  FINAL_REVIEW_BROKEN,
];

export function getFixture(id: string): ReviewReworkFixture {
  const fixture = REVIEW_REWORK_FIXTURES.find(f => f.id === id);
  if (!fixture) {
    throw new Error(`No review-rework fixture registered with id '${id}'`);
  }
  return fixture;
}

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveTemplateName, resolveTemplatePath, snapshotTemplate } from '../lib/template-resolver.js';
import { loadTemplate } from '../lib/template-loader.js';
import { processEvent } from '../lib/engine.js';
import { NEXT_ACTIONS } from '../lib/constants.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
} from '../lib/types.js';

// ── Real templates directory ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), '..', '..', 'templates');
const ORCH_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..', '..');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<OrchestrationConfig> = {}): OrchestrationConfig {
  return {
    system: { orch_root: ORCH_ROOT },
    projects: { base_path: '', naming: 'SCREAMING_CASE' },
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
    source_control: { auto_commit: 'ask', auto_pr: 'ask', provider: 'github' },
    default_template: 'default',
    ...overrides,
  };
}

function makeState(templateId: string): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
    config: {
      gate_mode: 'ask',
      limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: templateId,
      status: 'not_started',
      current_node_path: null,
      nodes: {},
    },
  };
}

// ── End-to-End Template Selection Tests ───────────────────────────────────────

describe('e2e: template selection and loading', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('CLI --template default resolves to { templateName: "default", source: "cli" } and path points to default.yml', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, 'default', makeConfig(), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('default');
    expect(result.source).toBe('cli');
    expect(result.templatePath.endsWith('default.yml')).toBe(true);
  });

  it('config.default_template: "default" resolves to { templateName: "default", source: "config" } when no state or CLI arg', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, undefined, makeConfig({ default_template: 'default' }), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('default');
    expect(result.source).toBe('config');
  });

  it('resolved template path loads via loadTemplate() without errors and returns template.template.id === "default"', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, 'default', makeConfig(), tmpDir, TEMPLATES_DIR);
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('default');
  });

  it('fallback chain — state absent, CLI absent, config.default_template: "" resolves to default (source: default)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, undefined, makeConfig({ default_template: '' }), tmpDir, TEMPLATES_DIR);
    expect(result.source).toBe('default');
    expect(result.templateName).toBe('default');
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('default');
  });

  it('fallback chain — state absent, CLI absent, config.default_template: "ask" resolves to default (source: default)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, undefined, makeConfig({ default_template: 'ask' }), tmpDir, TEMPLATES_DIR);
    expect(result.source).toBe('default');
    expect(result.templateName).toBe('default');
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('default');
  });

  // ── full.yml escape-hatch regression coverage ──────────────────────────────

  it('CLI --template full still resolves to full.yml (escape hatch — full.yml retained deprecated)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, 'full', makeConfig(), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('full');
    expect(result.source).toBe('cli');
    expect(result.templatePath.endsWith('full.yml')).toBe(true);
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('full');
  });

  it('config.default_template: "full" still resolves to full.yml (escape hatch)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, undefined, makeConfig({ default_template: 'full' }), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('full');
    expect(result.source).toBe('config');
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('full');
  });

  it('full priority chain: state > CLI > config > default', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));

    // state beats CLI and config
    const r1 = resolveTemplateName(makeState('full'), 'default', makeConfig({ default_template: 'default' }), tmpDir, TEMPLATES_DIR);
    expect(r1.source).toBe('state');
    expect(r1.templateName).toBe('full');

    // CLI beats config
    const r2 = resolveTemplateName(null, 'full', makeConfig({ default_template: 'default' }), tmpDir, TEMPLATES_DIR);
    expect(r2.source).toBe('cli');
    expect(r2.templateName).toBe('full');

    // config beats default
    const r3 = resolveTemplateName(null, undefined, makeConfig({ default_template: 'full' }), tmpDir, TEMPLATES_DIR);
    expect(r3.source).toBe('config');
    expect(r3.templateName).toBe('full');

    // default fallback when no state or CLI, and config.default_template is 'ask'
    const r4 = resolveTemplateName(null, undefined, makeConfig({ default_template: 'ask' }), tmpDir, TEMPLATES_DIR);
    expect(r4.source).toBe('default');
    expect(r4.templateName).toBe('default');
  });
});

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

function createMockIO(
  initialState: PipelineState | null = null,
  config?: OrchestrationConfig,
  docStore?: Record<string, { frontmatter: Record<string, unknown>; content: string }>,
): IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
} {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
  const ensureDirCalls: string[] = [];
  const effectiveConfig = config ?? makeConfig();
  const effectiveDocStore = docStore ?? {};
  return {
    get currentState() { return currentState; },
    writeCalls,
    ensureDirCalls,
    readState(_projectDir: string): PipelineState | null {
      return currentState ? structuredClone(currentState) : null;
    },
    writeState(_projectDir: string, state: PipelineState): void {
      currentState = structuredClone(state);
      writeCalls.push({ projectDir: _projectDir, state: structuredClone(state) });
    },
    readConfig(_configPath?: string): OrchestrationConfig {
      return structuredClone(effectiveConfig);
    },
    readDocument(docPath: string) {
      return effectiveDocStore[docPath.replace(/\\/g, '/')] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── E2E: default Template Pipeline Processing ────────────────────────────────

describe('e2e: default template pipeline processing', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('processEvent start with null state and default config scaffolds on default.yml', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null, makeConfig());
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(Object.values(NEXT_ACTIONS)).toContain(result.action);
    expect(io.currentState!.graph.template_id).toBe('default');
  });

  it('processEvent start with --template default scaffolds state with template_id: default and the default.yml node tree', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, { template: 'default' }, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('default');

    // Assert the default.yml top-level node tree is present in scaffolded state.
    const nodes = io.currentState!.graph.nodes;
    for (const nodeId of [
      'requirements',
      'master_plan',
      'explode_master_plan',
      'plan_approval_gate',
      'gate_mode_selection',
      'phase_loop',
      'final_review',
      'pr_gate',
      'final_approval_gate',
    ]) {
      expect(nodes).toHaveProperty(nodeId);
    }
  });

  it('default template first action is spawn_requirements (Requirements is the top node)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, { template: 'default' }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_requirements');
  });
});

// ── E2E: full template pipeline processing (regression — escape hatch) ───────

describe('e2e: full template pipeline processing', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('processEvent start with --template full scaffolds state with template_id: full', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, { template: 'full' }, io);
    expect(result.success).toBe(true);
    expect(Object.values(NEXT_ACTIONS)).toContain(result.action);
    expect(io.currentState!.graph.template_id).toBe('full');
  });

  it('full template scaffolded state contains master_plan, plan_approval_gate, phase_loop', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, { template: 'full' }, io);
    const nodes = io.currentState!.graph.nodes;
    for (const nodeId of ['master_plan', 'plan_approval_gate', 'phase_loop']) {
      expect(nodes).toHaveProperty(nodeId);
    }
  });
});

// ── E2E: isProjectLocal Template Resolution ───────────────────────────────────

describe('e2e: isProjectLocal template resolution', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolveTemplatePath returns isProjectLocal: true when template.yml exists in project dir', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    snapshotTemplate(path.join(TEMPLATES_DIR, 'default.yml'), tmpDir);
    const result = resolveTemplatePath('default', tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(true);
    expect(path.resolve(result.path)).toBe(path.resolve(tmpDir, 'template.yml'));
  });

  it('resolveTemplatePath returns isProjectLocal: false when no template.yml exists in project dir', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    const result = resolveTemplatePath('default', tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(false);
  });

  it('resolveTemplateName returns isProjectLocal: true when project-local template exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    snapshotTemplate(path.join(TEMPLATES_DIR, 'default.yml'), tmpDir);
    const result = resolveTemplateName(null, undefined, makeConfig(), tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(true);
  });

  it('processEvent start with project-local default.yml snapshot succeeds', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    snapshotTemplate(path.join(TEMPLATES_DIR, 'default.yml'), tmpDir);
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('default');
  });
});

// ── E2E: default_template Config Resolution ───────────────────────────────────

describe('e2e: default_template config resolution', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('default_template: default in config causes processEvent to scaffold default template', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null, makeConfig({ default_template: 'default' }));
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('default');
  });

  it('default_template: full in config causes processEvent to scaffold full template (escape hatch)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null, makeConfig({ default_template: 'full' }));
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('full');
  });
});

// ── E2E smoke: drive default.yml end-to-end from start to final_approved ─────
//
// This test is the iteration's keystone evidence: a mock project on default.yml
// scaffolded from null state and driven through every node to completion.
//
// Drive sequence: start → requirements_completed → master_plan_completed →
// explosion_completed → plan_approved → gate_mode_selection (auto, autonomous)
// → phase_loop (1 phase, 1 task, pre-seeded explosion state) → task_executor
// completes → commit_completed → code_review_completed (approved) →
// task_gate_approved (auto, autonomous) → phase_review_completed (approved) →
// phase_gate_approved (auto, autonomous) → final_review_completed (approved) →
// pr_created → final_approved → display_complete.

describe('e2e: default.yml full-pipeline smoke test', () => {
  const PROJECT_DIR = '/tmp/test-project/DEFAULT-YML-E2E';
  const DOC_STORE: Record<string, { frontmatter: Record<string, unknown>; content: string }> = {};

  function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
    DOC_STORE[docPath.replace(/\\/g, '/')] = {
      frontmatter: {
        title: path.basename(docPath, path.extname(docPath)),
        status: 'completed',
        ...extraFrontmatter,
      },
      content: `# ${path.basename(docPath)}`,
    };
  }

  function makeAutonomousConfig(): OrchestrationConfig {
    return makeConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: {
        auto_commit: 'always',
        auto_pr: 'always',
        provider: 'github',
      },
    });
  }

  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('drives default.yml from start → final_approved with every node reaching completed (1 phase, 1 task, autonomous)', () => {
    const io = createMockIO(null, makeAutonomousConfig(), DOC_STORE);

    // ── start (scaffolds state) ────────────────────────────────────────────
    let result = processEvent('start', PROJECT_DIR, { template: 'default' }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_requirements');
    expect(io.currentState!.graph.template_id).toBe('default');

    // ── requirements_started → requirements_completed ──────────────────────
    result = processEvent('requirements_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);

    const reqDoc = path.join(PROJECT_DIR, 'docs', 'requirements.md');
    seedDoc(reqDoc, { requirement_count: 4 });
    result = processEvent('requirements_completed', PROJECT_DIR, { doc_path: reqDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');

    // ── master_plan_started → master_plan_completed ────────────────────────
    result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);

    const masterPlanDoc = path.join(PROJECT_DIR, 'docs', 'master-plan.md');
    seedDoc(masterPlanDoc, { total_phases: 1, total_tasks: 1 });
    result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: masterPlanDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('explode_master_plan');

    // ── explosion_started → explosion_completed ─────────────────────────────
    result = processEvent('explosion_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);

    result = processEvent('explosion_completed', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');

    // ── plan_approved ──────────────────────────────────────────────────────
    result = processEvent('plan_approved', PROJECT_DIR, { doc_path: masterPlanDoc }, io);
    expect(result.success).toBe(true);

    // ── Simulate the explosion script's pre-seeding of phase_planning +
    // task_handoff child step nodes (Iter 5 behavior). The walker needs these
    // to advance task_loop expansion after phase_loop iterations are created.
    const phaseLoop0 = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop0.iterations).toHaveLength(1);
    const phaseIter = phaseLoop0.iterations[0];
    const phaseDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-plan.md');
    seedDoc(phaseDoc, { tasks: [{ id: 'T01', title: 'Task 1' }] });

    phaseIter.nodes['phase_planning'] = {
      kind: 'step',
      status: 'completed',
      doc_path: phaseDoc,
      retries: 0,
    };

    const taskLoop0 = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    const handoffDoc = path.join(PROJECT_DIR, 'tasks', 'p1-t1-handoff.md');
    seedDoc(handoffDoc);
    taskLoop0.iterations = [
      {
        index: 0,
        status: 'not_started',
        nodes: {
          task_handoff: {
            kind: 'step',
            status: 'completed',
            doc_path: handoffDoc,
            retries: 0,
          },
          task_executor: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          commit_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
          commit: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          code_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        },
        corrective_tasks: [],
        commit_hash: null,
      },
    ];

    // Re-trigger walker post-seeding.
    result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.action).toBe('execute_task');

    // ── Task 1 execution ───────────────────────────────────────────────────
    const taskCtx = { phase: 1, task: 1 };
    result = processEvent('execution_started', PROJECT_DIR, taskCtx, io);
    expect(result.success).toBe(true);

    result = processEvent('task_completed', PROJECT_DIR, taskCtx, io);
    expect(result.success).toBe(true);
    // commit_gate fires first (body order: executor → commit_gate → code_review → task_gate)
    expect(result.action).toBe('invoke_source_control_commit');

    // ── commit_started → commit_completed ──────────────────────────────────
    result = processEvent('commit_started', PROJECT_DIR, taskCtx, io);
    expect(result.success).toBe(true);

    result = processEvent('commit_completed', PROJECT_DIR, { ...taskCtx, commit_hash: 'abc123' }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_code_reviewer');

    // ── code_review_started → code_review_completed ───────────────────────
    result = processEvent('code_review_started', PROJECT_DIR, taskCtx, io);
    expect(result.success).toBe(true);

    const codeReviewDoc = path.join(PROJECT_DIR, 'tasks', 'p1-t1-review.md');
    seedDoc(codeReviewDoc);
    result = processEvent('code_review_completed', PROJECT_DIR, {
      ...taskCtx,
      doc_path: codeReviewDoc,
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    // In autonomous mode, task_gate auto-approves via verdict check → advances to phase_review
    expect(result.action).toBe('spawn_phase_reviewer');

    // Verify task_gate completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
    }

    // ── phase_review_started → phase_review_completed ─────────────────────
    result = processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);

    const phaseReviewDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-review.md');
    seedDoc(phaseReviewDoc);
    result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc,
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    // In autonomous mode, phase_gate auto-approves via verdict check → advances to final_review
    expect(result.action).toBe('spawn_final_reviewer');

    // Verify phase_gate completed via walker's verdict-based auto-approve
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(false);
    }

    // ── final_review_started → final_review_completed ─────────────────────
    result = processEvent('final_review_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);

    const finalReviewDoc = path.join(PROJECT_DIR, 'docs', 'final-review.md');
    seedDoc(finalReviewDoc);
    result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: finalReviewDoc,
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    // auto_pr='always' neq 'never' → pr_gate true branch → invoke PR
    expect(result.action).toBe('invoke_source_control_pr');

    // ── pr_requested → pr_created ──────────────────────────────────────────
    result = processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/test-branch',
      base_branch: 'main',
      worktree_path: '.',
      auto_commit: 'always',
      auto_pr: 'always',
      remote_url: 'https://github.com/test/repo',
    }, io);
    expect(result.success).toBe(true);

    result = processEvent('pr_requested', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);

    result = processEvent('pr_created', PROJECT_DIR, { pr_url: 'https://github.com/test/repo/pull/1' }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_final_approval');

    // ── final_approved ─────────────────────────────────────────────────────
    result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');

    // ── Final state assertions — every top-level node reached completed ───
    const finalNodes = io.currentState!.graph.nodes;
    expect((finalNodes['requirements'] as StepNodeState).status).toBe('completed');
    expect((finalNodes['master_plan'] as StepNodeState).status).toBe('completed');
    expect((finalNodes['explode_master_plan'] as StepNodeState).status).toBe('completed');
    expect((finalNodes['plan_approval_gate'] as GateNodeState).status).toBe('completed');
    expect((finalNodes['gate_mode_selection'] as GateNodeState).status).toBe('completed');
    expect((finalNodes['phase_loop'] as ForEachPhaseNodeState).status).toBe('completed');
    expect((finalNodes['final_review'] as StepNodeState).status).toBe('completed');
    expect((finalNodes['pr_gate'] as ConditionalNodeState).status).toBe('completed');
    expect((finalNodes['final_approval_gate'] as GateNodeState).status).toBe('completed');

    // Graph complete
    expect(io.currentState!.graph.status).toBe('completed');
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveTemplateName, resolveTemplatePath, snapshotTemplate } from '../lib/template-resolver.js';
import { loadTemplate } from '../lib/template-loader.js';
import { processEvent } from '../lib/engine.js';
import { NEXT_ACTIONS } from '../lib/constants.js';
import type { PipelineState, OrchestrationConfig, IOAdapter } from '../lib/types.js';

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
    default_template: 'full',
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

  it('CLI --template quick resolves to { templateName: "quick", source: "cli" } and path points to quick.yml', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, 'quick', makeConfig(), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('quick');
    expect(result.source).toBe('cli');
    expect(result.templatePath.endsWith('quick.yml')).toBe(true);
  });

  it('config.default_template: "quick" resolves to { templateName: "quick", source: "config" } when no state or CLI arg', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, undefined, makeConfig({ default_template: 'quick' }), tmpDir, TEMPLATES_DIR);
    expect(result.templateName).toBe('quick');
    expect(result.source).toBe('config');
  });

  it('resolved template path loads via loadTemplate() without errors and returns template.template.id === "quick"', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-template-'));
    const result = resolveTemplateName(null, 'quick', makeConfig(), tmpDir, TEMPLATES_DIR);
    const loaded = loadTemplate(result.templatePath);
    expect(loaded.template.template.id).toBe('quick');
  });

  it('config.default_template: "full" resolves correctly and the template loads with template.template.id === "full"', () => {
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
    const r1 = resolveTemplateName(makeState('full'), 'quick', makeConfig({ default_template: 'quick' }), tmpDir, TEMPLATES_DIR);
    expect(r1.source).toBe('state');
    expect(r1.templateName).toBe('full');

    // CLI beats config
    const r2 = resolveTemplateName(null, 'quick', makeConfig({ default_template: 'full' }), tmpDir, TEMPLATES_DIR);
    expect(r2.source).toBe('cli');
    expect(r2.templateName).toBe('quick');

    // config beats default
    const r3 = resolveTemplateName(null, undefined, makeConfig({ default_template: 'quick' }), tmpDir, TEMPLATES_DIR);
    expect(r3.source).toBe('config');
    expect(r3.templateName).toBe('quick');

    // default fallback when no state or CLI, and config.default_template is 'ask'
    const r4 = resolveTemplateName(null, undefined, makeConfig({ default_template: 'ask' }), tmpDir, TEMPLATES_DIR);
    expect(r4.source).toBe('default');
    expect(r4.templateName).toBe('full');
  });
});

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

function createMockIO(
  initialState: PipelineState | null = null,
  config?: OrchestrationConfig,
): IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
} {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
  const ensureDirCalls: string[] = [];
  const effectiveConfig = config ?? makeConfig();
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
    readDocument(_docPath: string) { return null; },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── E2E: Full Template Pipeline Processing ────────────────────────────────────

describe('e2e: full template pipeline processing', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('processEvent start with null state scaffolds correctly and returns a valid NEXT_ACTIONS value', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(Object.values(NEXT_ACTIONS)).toContain(result.action);
    expect(io.currentState!.graph.template_id).toBe('full');
  });

  it('full template scaffolded state contains all expected top-level nodes', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, {}, io);
    const nodes = io.currentState!.graph.nodes;
    for (const nodeId of ['research', 'prd', 'design', 'architecture', 'master_plan', 'plan_approval_gate', 'phase_loop']) {
      expect(nodes).toHaveProperty(nodeId);
    }
  });

  it('pipeline can advance past the first node via research_started', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, {}, io);
    const result2 = processEvent('research_started', tmpDir, {}, io);
    expect(result2.success).toBe(true);
  });
});

// ── E2E: Quick Template Pipeline Processing ───────────────────────────────────

describe('e2e: quick template pipeline processing', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('processEvent start with template: quick scaffolds correctly and returns a valid NEXT_ACTIONS value', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-quick-'));
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, { template: 'quick' }, io);
    expect(result.success).toBe(true);
    expect(Object.values(NEXT_ACTIONS)).toContain(result.action);
    expect(io.currentState!.graph.template_id).toBe('quick');
  });

  it('quick template scaffolded state does NOT contain prd, design, phase_report, phase_review nodes', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-quick-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, { template: 'quick' }, io);
    const nodes = io.currentState!.graph.nodes;
    for (const nodeId of ['prd', 'design', 'phase_report', 'phase_review']) {
      expect(nodes).not.toHaveProperty(nodeId);
    }
  });

  it('quick template scaffolded state DOES contain research, architecture, master_plan, plan_approval_gate, phase_loop', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-quick-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, { template: 'quick' }, io);
    const nodes = io.currentState!.graph.nodes;
    for (const nodeId of ['research', 'architecture', 'master_plan', 'plan_approval_gate', 'phase_loop']) {
      expect(nodes).toHaveProperty(nodeId);
    }
  });

  it('quick pipeline can advance past the first node via research_started', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-quick-'));
    const io = createMockIO(null);
    processEvent('start', tmpDir, { template: 'quick' }, io);
    const result2 = processEvent('research_started', tmpDir, {}, io);
    expect(result2.success).toBe(true);
  });

  it('all emitted actions from quick pipeline are members of NEXT_ACTIONS values', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-quick-'));
    const io = createMockIO(null);
    const result1 = processEvent('start', tmpDir, { template: 'quick' }, io);
    const nextActionsValues = new Set<string>(Object.values(NEXT_ACTIONS));
    if (result1.action !== null) {
      expect(nextActionsValues.has(result1.action)).toBe(true);
    }
    const result2 = processEvent('research_started', tmpDir, {}, io);
    if (result2.action !== null) {
      expect(nextActionsValues.has(result2.action)).toBe(true);
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
    snapshotTemplate(path.join(TEMPLATES_DIR, 'full.yml'), tmpDir);
    const result = resolveTemplatePath('full', tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(true);
    expect(path.resolve(result.path)).toBe(path.resolve(tmpDir, 'template.yml'));
  });

  it('resolveTemplatePath returns isProjectLocal: false when no template.yml exists in project dir', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    const result = resolveTemplatePath('full', tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(false);
  });

  it('resolveTemplateName returns isProjectLocal: true when project-local template exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    snapshotTemplate(path.join(TEMPLATES_DIR, 'full.yml'), tmpDir);
    const result = resolveTemplateName(null, undefined, makeConfig(), tmpDir, TEMPLATES_DIR);
    expect(result.isProjectLocal).toBe(true);
  });

  it('processEvent start with project-local template present succeeds', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-local-'));
    snapshotTemplate(path.join(TEMPLATES_DIR, 'full.yml'), tmpDir);
    const io = createMockIO(null);
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('full');
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

  it('default_template: quick in config causes processEvent to scaffold quick template', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null, makeConfig({ default_template: 'quick' }));
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('quick');
  });

  it('default_template: full in config causes processEvent to scaffold full template', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-default-'));
    const io = createMockIO(null, makeConfig({ default_template: 'full' }));
    const result = processEvent('start', tmpDir, {}, io);
    expect(result.success).toBe(true);
    expect(io.currentState!.graph.template_id).toBe('full');
  });
});

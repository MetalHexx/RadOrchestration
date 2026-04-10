import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveTemplateName } from '../lib/template-resolver.js';
import { loadTemplate } from '../lib/template-loader.js';
import type { PipelineState, OrchestrationConfig } from '../lib/types.js';

// ── Real templates directory ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), '..', '..', 'templates');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<OrchestrationConfig> = {}): OrchestrationConfig {
  return {
    system: { orch_root: '.github' },
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

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  resolveTemplateName,
  resolveTemplatePath,
  snapshotTemplate,
  listAvailableTemplates,
} from '../lib/template-resolver.js';
import type { PipelineState, OrchestrationConfig } from '../lib/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-test-'));
}

function makeConfig(overrides: Partial<OrchestrationConfig> = {}): OrchestrationConfig {
  return {
    system: { orch_root: '.github' },
    projects: { base_path: '', naming: 'SCREAMING_CASE' },
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
    source_control: { auto_commit: 'ask', auto_pr: 'ask', provider: 'github' },
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

// ── resolveTemplateName ───────────────────────────────────────────────────────

describe('resolveTemplateName', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns source: state when state exists — even when CLI and config are also provided', () => {
    tmpDir = makeTempDir();
    const state = makeState('quick');
    const config = makeConfig({ default_template: 'custom' });
    const result = resolveTemplateName(state, 'cli-template', config, tmpDir, '/some/templates');
    expect(result.source).toBe('state');
    expect(result.templateName).toBe('quick');
  });

  it('returns source: cli when state is null and CLI name is provided', () => {
    tmpDir = makeTempDir();
    const config = makeConfig({ default_template: 'custom' });
    const result = resolveTemplateName(null, 'my-template', config, tmpDir, '/some/templates');
    expect(result.source).toBe('cli');
    expect(result.templateName).toBe('my-template');
  });

  it('returns source: config when state is null, CLI is undefined, and config has a valid default_template', () => {
    tmpDir = makeTempDir();
    const config = makeConfig({ default_template: 'quick' });
    const result = resolveTemplateName(null, undefined, config, tmpDir, '/some/templates');
    expect(result.source).toBe('config');
    expect(result.templateName).toBe('quick');
  });

  it('returns source: default and templateName: "full" when state is null, CLI is undefined, and config has no default_template', () => {
    tmpDir = makeTempDir();
    const config = makeConfig();
    const result = resolveTemplateName(null, undefined, config, tmpDir, '/some/templates');
    expect(result.source).toBe('default');
    expect(result.templateName).toBe('full');
  });

  it('returns source: default and templateName: "full" when config.default_template is "ask"', () => {
    tmpDir = makeTempDir();
    const config = makeConfig({ default_template: 'ask' });
    const result = resolveTemplateName(null, undefined, config, tmpDir, '/some/templates');
    expect(result.source).toBe('default');
    expect(result.templateName).toBe('full');
  });
});

// ── resolveTemplatePath ──────────────────────────────────────────────────────

describe('resolveTemplatePath', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns project-local path and isProjectLocal: true when {projectDir}/template.yml exists', () => {
    tmpDir = makeTempDir();
    fs.writeFileSync(path.join(tmpDir, 'template.yml'), 'template: {id: local}');
    const result = resolveTemplatePath('full', tmpDir, '/some/templates');
    expect(result.isProjectLocal).toBe(true);
    expect(result.path).toBe(path.resolve(tmpDir, 'template.yml'));
  });

  it('returns global path and isProjectLocal: false when no project-local snapshot exists', () => {
    tmpDir = makeTempDir();
    const result = resolveTemplatePath('full', tmpDir, '/some/templates');
    expect(result.isProjectLocal).toBe(false);
    expect(result.path).toBe(path.join('/some/templates', 'full.yml'));
  });

  it('returned path is absolute in both cases', () => {
    tmpDir = makeTempDir();

    // project-local case
    fs.writeFileSync(path.join(tmpDir, 'template.yml'), 'template: {id: local}');
    const localResult = resolveTemplatePath('full', tmpDir, '/some/templates');
    expect(path.isAbsolute(localResult.path)).toBe(true);

    // global case (new temp dir without template.yml)
    const tmpDir2 = makeTempDir();
    try {
      const globalResult = resolveTemplatePath('quick', tmpDir2, '/abs/templates');
      expect(path.isAbsolute(globalResult.path)).toBe(true);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});

// ── snapshotTemplate ──────────────────────────────────────────────────────────

describe('snapshotTemplate', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates {projectDir}/template.yml as a byte-identical copy', () => {
    tmpDir = makeTempDir();
    const sourceDir = path.join(tmpDir, 'source');
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(projectDir);
    const sourceContent = 'template:\n  id: full\n  version: 1.0.0\n';
    const sourcePath = path.join(sourceDir, 'full.yml');
    fs.writeFileSync(sourcePath, sourceContent);

    snapshotTemplate(sourcePath, projectDir);

    const dest = path.join(projectDir, 'template.yml');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe(sourceContent);
  });

  it('creates the project directory if it does not already exist', () => {
    tmpDir = makeTempDir();
    const sourceDir = path.join(tmpDir, 'source');
    const projectDir = path.join(tmpDir, 'new-project');
    fs.mkdirSync(sourceDir);
    const sourcePath = path.join(sourceDir, 'full.yml');
    fs.writeFileSync(sourcePath, 'template: {id: full}');

    expect(fs.existsSync(projectDir)).toBe(false);
    snapshotTemplate(sourcePath, projectDir);
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'template.yml'))).toBe(true);
  });

  it('overwrites an existing template.yml (idempotent)', () => {
    tmpDir = makeTempDir();
    const sourceDir = path.join(tmpDir, 'source');
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(projectDir);
    const dest = path.join(projectDir, 'template.yml');
    fs.writeFileSync(dest, 'old content');

    const newContent = 'template:\n  id: quick\n';
    const sourcePath = path.join(sourceDir, 'quick.yml');
    fs.writeFileSync(sourcePath, newContent);

    snapshotTemplate(sourcePath, projectDir);

    expect(fs.readFileSync(dest, 'utf8')).toBe(newContent);
  });
});

// ── listAvailableTemplates ────────────────────────────────────────────────────

describe('listAvailableTemplates', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns filename stems for .yml files in the templates directory', () => {
    tmpDir = makeTempDir();
    const orchRoot = tmpDir;
    const templatesDir = path.join(orchRoot, 'skills/orchestration/scripts-v5/templates');
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(path.join(templatesDir, 'full.yml'), '');
    fs.writeFileSync(path.join(templatesDir, 'quick.yml'), '');

    const result = listAvailableTemplates(orchRoot);
    expect(result.sort()).toEqual(['full', 'quick'].sort());
  });

  it('returns an empty array when the templates directory does not exist', () => {
    tmpDir = makeTempDir();
    const result = listAvailableTemplates(path.join(tmpDir, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('ignores non-.yml files (e.g., .gitkeep)', () => {
    tmpDir = makeTempDir();
    const orchRoot = tmpDir;
    const templatesDir = path.join(orchRoot, 'skills/orchestration/scripts-v5/templates');
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(path.join(templatesDir, 'full.yml'), '');
    fs.writeFileSync(path.join(templatesDir, '.gitkeep'), '');
    fs.writeFileSync(path.join(templatesDir, 'readme.txt'), '');

    const result = listAvailableTemplates(orchRoot);
    expect(result).toEqual(['full']);
  });
});

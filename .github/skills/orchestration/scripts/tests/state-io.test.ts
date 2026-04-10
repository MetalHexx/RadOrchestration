import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readState, writeState, readConfig, readDocument, ensureDirectories } from '../lib/state-io.js';
import type { PipelineState } from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_STATE: PipelineState = {
  $schema: 'orchestration-state-v5',
  project: {
    name: 'TEST-PROJECT',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  },
  config: {
    gate_mode: 'auto',
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 20,
      max_retries_per_task: 3,
      max_consecutive_review_rejections: 3,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'never',
    },
  },
  pipeline: {
    gate_mode: null,
    source_control: null,
    current_tier: 'planning',
    halt_reason: null,
  },
  graph: {
    template_id: 'full',
    status: 'not_started',
    current_node_path: null,
    nodes: {},
  },
};

const DEFAULT_CONFIG_VALUES = {
  system: { orch_root: '.github' },
  projects: { base_path: '', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'ask',
    auto_pr: 'ask',
    provider: 'github',
  },
  default_template: 'full',
};

// ── Temp dir management ───────────────────────────────────────────────────────

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

// ── readState ─────────────────────────────────────────────────────────────────

describe('readState', () => {
  it('returns parsed PipelineState when state.json exists', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(SAMPLE_STATE, null, 2));
    const result = readState(dir);
    expect(result).toEqual(SAMPLE_STATE);
  });

  it('returns null when state.json does not exist', () => {
    const dir = makeTmpDir();
    expect(readState(dir)).toBeNull();
  });
});

// ── writeState ────────────────────────────────────────────────────────────────

describe('writeState', () => {
  it('writes valid JSON that readState can read back (round-trip)', () => {
    const dir = makeTmpDir();
    writeState(dir, SAMPLE_STATE);
    expect(readState(dir)).toEqual(SAMPLE_STATE);
  });

  it('uses atomic write pattern — final file exists and no .tmp file remains', () => {
    const dir = makeTmpDir();
    writeState(dir, SAMPLE_STATE);
    expect(fs.existsSync(path.join(dir, 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'state.json.tmp'))).toBe(false);
  });

  it('creates the project directory if it does not exist', () => {
    const base = makeTmpDir();
    const nestedDir = path.join(base, 'nested', 'project');
    writeState(nestedDir, SAMPLE_STATE);
    expect(fs.existsSync(path.join(nestedDir, 'state.json'))).toBe(true);
  });

});

// ── readConfig ────────────────────────────────────────────────────────────────

describe('readConfig', () => {
  it('returns DEFAULT_CONFIG when no path is provided', () => {
    expect(readConfig()).toEqual(DEFAULT_CONFIG_VALUES);
  });

  it('returns DEFAULT_CONFIG when the file does not exist', () => {
    expect(readConfig('/nonexistent/path/orchestration.yml')).toEqual(DEFAULT_CONFIG_VALUES);
  });

  it('deep-merges a partial config over defaults — override only limits.max_phases, other defaults preserved', () => {
    const dir = makeTmpDir();
    const configPath = path.join(dir, 'orchestration.yml');
    fs.writeFileSync(configPath, 'limits:\n  max_phases: 20\n');
    const result = readConfig(configPath);
    expect(result.limits.max_phases).toBe(20);
    expect(result.limits.max_tasks_per_phase).toBe(8);
    expect(result.limits.max_retries_per_task).toBe(2);
    expect(result.limits.max_consecutive_review_rejections).toBe(3);
  });

  it('deep-merges nested objects — source_control.auto_commit overridden, others preserved at defaults', () => {
    const dir = makeTmpDir();
    const configPath = path.join(dir, 'orchestration.yml');
    fs.writeFileSync(configPath, 'source_control:\n  auto_commit: always\n');
    const result = readConfig(configPath);
    expect(result.source_control.auto_commit).toBe('always');
    expect(result.source_control.auto_pr).toBe('ask');
    expect(result.source_control.provider).toBe('github');
  });
});

// ── readDocument ──────────────────────────────────────────────────────────────

describe('readDocument', () => {
  it('extracts YAML frontmatter and body content from a markdown file with frontmatter', () => {
    const dir = makeTmpDir();
    const docPath = path.join(dir, 'doc.md');
    fs.writeFileSync(docPath, '---\ntitle: Test Doc\nphase: 1\n---\nBody content here.');
    const result = readDocument(docPath);
    expect(result).not.toBeNull();
    expect(result?.frontmatter).toEqual({ title: 'Test Doc', phase: 1 });
    expect(result?.content).toBe('Body content here.');
  });

  it('returns { frontmatter: {}, content: <full content> } for a file with no frontmatter', () => {
    const dir = makeTmpDir();
    const docPath = path.join(dir, 'doc.md');
    const rawContent = 'Just plain content, no frontmatter.';
    fs.writeFileSync(docPath, rawContent);
    expect(readDocument(docPath)).toEqual({ frontmatter: {}, content: rawContent });
  });

  it('returns null when the file does not exist', () => {
    expect(readDocument('/nonexistent/doc.md')).toBeNull();
  });
});

// ── ensureDirectories ─────────────────────────────────────────────────────────

describe('ensureDirectories', () => {
  it('creates projectDir and subdirectories phases/, tasks/, reports/, reviews/', () => {
    const base = makeTmpDir();
    const projectDir = path.join(base, 'my-project');
    ensureDirectories(projectDir);
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'phases'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'tasks'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'reports'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'reviews'))).toBe(true);
  });

  it('is idempotent — calling twice does not throw', () => {
    const base = makeTmpDir();
    const projectDir = path.join(base, 'my-project');
    ensureDirectories(projectDir);
    expect(() => ensureDirectories(projectDir)).not.toThrow();
  });
});

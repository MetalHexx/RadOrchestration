'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  readState,
  writeState,
  readConfig,
  readDocument,
  ensureDirectories,
  createRealIO,
  DEFAULT_CONFIG,
} = require('../lib/state-io');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-test-'));
}

function cleanTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeValidState() {
  return {
    $schema: 'orchestration-state-v4',
    project: {
      name: 'TEST-PROJECT',
      created: '2025-01-01T00:00:00.000Z',
      updated: '2025-01-01T00:00:00.000Z',
    },
    pipeline: { current_tier: 'planning' },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [
        { name: 'research', status: 'not_started', doc_path: null },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
    execution: {
      status: 'not_started',
      current_phase: 0,
      phases: [],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  };
}

// ─── readState ──────────────────────────────────────────────────────────────

describe('readState', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it('returns null for missing file', () => {
    const result = readState(tmpDir);
    assert.equal(result, null);
  });

  it('returns parsed object for valid state.json', () => {
    const state = makeValidState();
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state, null, 2), 'utf-8');
    const result = readState(tmpDir);
    assert.equal(result.$schema, 'orchestration-state-v4');
    assert.ok(result.project);
    assert.ok(result.planning);
    assert.ok(result.execution);
    assert.ok(result.pipeline);
    assert.ok(result.final_review);
  });

  it('throws on invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'state.json'), '{ not valid json !!!', 'utf-8');
    assert.throws(() => readState(tmpDir), (err) => {
      assert.ok(err.message.includes('Failed to parse state.json'));
      return true;
    });
  });

  it('throws on schema version mismatch — v3 rejected', () => {
    const state = { $schema: 'orchestration-state-v3', project: {}, planning: {}, execution: {} };
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state), 'utf-8');
    assert.throws(() => readState(tmpDir), (err) => {
      assert.ok(err.message.includes('Schema version mismatch'));
      return true;
    });
  });

  it('throws on schema version mismatch — v2 rejected', () => {
    const state = { $schema: 'orchestration-state-v2', project: {}, planning: {}, execution: {} };
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state), 'utf-8');
    assert.throws(() => readState(tmpDir), (err) => {
      assert.ok(err.message.includes('Schema version mismatch'));
      return true;
    });
  });
});

// ─── writeState ─────────────────────────────────────────────────────────────

describe('writeState', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it('sets project.updated to a valid ISO timestamp', () => {
    const state = makeValidState();
    const before = new Date().toISOString();
    writeState(tmpDir, state);
    const after = new Date().toISOString();

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'));
    assert.ok(written.project.updated >= before);
    assert.ok(written.project.updated <= after);
    // Verify it's a valid ISO date
    assert.ok(!isNaN(Date.parse(written.project.updated)));
  });

  it('overwrites a past project.updated (sole setter)', () => {
    const state = makeValidState();
    state.project.updated = '2000-01-01T00:00:00.000Z';
    const before = new Date().toISOString();
    writeState(tmpDir, state);

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'));
    assert.ok(written.project.updated >= before);
    assert.notEqual(written.project.updated, '2000-01-01T00:00:00.000Z');
  });

  it('produces valid JSON with 2-space indentation and trailing newline', () => {
    const state = makeValidState();
    writeState(tmpDir, state);

    const raw = fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8');
    // Trailing newline
    assert.ok(raw.endsWith('\n'));
    // Valid JSON
    const parsed = JSON.parse(raw);
    assert.ok(parsed);
    // 2-space indentation check
    assert.ok(raw.includes('  "'));
  });
});

// ─── readConfig ─────────────────────────────────────────────────────────────

describe('readConfig', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it('returns merged config with valid YAML file', () => {
    const configPath = path.join(tmpDir, 'orchestration.yml');
    fs.writeFileSync(configPath, 'limits:\n  max_phases: 20\nhuman_gates:\n  execution_mode: autonomous\n', 'utf-8');
    const config = readConfig(configPath);
    assert.equal(config.limits.max_phases, 20);
    assert.equal(config.limits.max_tasks_per_phase, 8); // default preserved
    assert.equal(config.human_gates.execution_mode, 'autonomous');
    assert.equal(config.human_gates.after_final_review, true); // default preserved
  });

  it('returns DEFAULT_CONFIG when file does not exist', () => {
    const config = readConfig(path.join(tmpDir, 'nonexistent.yml'));
    assert.deepStrictEqual(config.limits, DEFAULT_CONFIG.limits);
    assert.deepStrictEqual(config.human_gates, DEFAULT_CONFIG.human_gates);
    assert.deepStrictEqual(config.projects, DEFAULT_CONFIG.projects);
  });

  it('merges partial config preserving other defaults', () => {
    const configPath = path.join(tmpDir, 'orchestration.yml');
    fs.writeFileSync(configPath, 'limits:\n  max_phases: 5\n', 'utf-8');
    const config = readConfig(configPath);
    assert.equal(config.limits.max_phases, 5);
    assert.equal(config.limits.max_tasks_per_phase, 8);
    assert.equal(config.limits.max_retries_per_task, 2);
    assert.equal(config.limits.max_consecutive_review_rejections, 3);
    assert.equal(config.human_gates.after_planning, true);
  });
});

// ─── readDocument ───────────────────────────────────────────────────────────

describe('readDocument', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it('returns frontmatter and body for valid markdown with frontmatter', () => {
    const docPath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(docPath, '---\ntitle: Hello\nstatus: draft\n---\n\n# Body\nSome content\n', 'utf-8');
    const result = readDocument(docPath);
    assert.ok(result);
    assert.ok(result.frontmatter);
    assert.equal(result.frontmatter.title, 'Hello');
    assert.equal(result.frontmatter.status, 'draft');
    assert.ok(result.body.includes('# Body'));
  });

  it('returns null for missing file', () => {
    const result = readDocument(path.join(tmpDir, 'missing.md'));
    assert.equal(result, null);
  });

  it('returns null frontmatter for markdown without frontmatter', () => {
    const docPath = path.join(tmpDir, 'plain.md');
    fs.writeFileSync(docPath, '# Just a heading\n\nSome content.\n', 'utf-8');
    const result = readDocument(docPath);
    assert.ok(result);
    assert.equal(result.frontmatter, null);
    assert.ok(result.body.includes('# Just a heading'));
  });
});

// ─── ensureDirectories ──────────────────────────────────────────────────────

describe('ensureDirectories', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = path.join(makeTmpDir(), 'project'); });
  afterEach(() => { cleanTmpDir(path.dirname(tmpDir)); });

  it('creates project subdirectories', () => {
    ensureDirectories(tmpDir);
    assert.ok(fs.existsSync(tmpDir));
    assert.ok(fs.existsSync(path.join(tmpDir, 'phases')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'tasks')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'reports')));
  });

  it('is idempotent — calling twice does not error', () => {
    ensureDirectories(tmpDir);
    assert.doesNotThrow(() => ensureDirectories(tmpDir));
  });
});

// ─── createRealIO ───────────────────────────────────────────────────────────

describe('createRealIO', () => {
  it('returns PipelineIO-conforming object with 5 function properties', () => {
    const io = createRealIO();
    assert.equal(typeof io.readState, 'function');
    assert.equal(typeof io.writeState, 'function');
    assert.equal(typeof io.readConfig, 'function');
    assert.equal(typeof io.readDocument, 'function');
    assert.equal(typeof io.ensureDirectories, 'function');
    assert.equal(Object.keys(io).length, 5);
  });
});

// ─── DEFAULT_CONFIG ─────────────────────────────────────────────────────────

describe('DEFAULT_CONFIG', () => {
  it('has expected top-level keys with correct defaults', () => {
    assert.ok(DEFAULT_CONFIG.projects);
    assert.equal(DEFAULT_CONFIG.projects.base_path, '.github/projects');
    assert.ok(DEFAULT_CONFIG.limits);
    assert.equal(DEFAULT_CONFIG.limits.max_phases, 10);
    assert.equal(DEFAULT_CONFIG.limits.max_tasks_per_phase, 8);
    assert.equal(DEFAULT_CONFIG.limits.max_retries_per_task, 2);
    assert.ok(DEFAULT_CONFIG.human_gates);
    assert.equal(DEFAULT_CONFIG.human_gates.execution_mode, 'ask');
    assert.equal(DEFAULT_CONFIG.human_gates.after_final_review, true);
    assert.ok(DEFAULT_CONFIG.errors);
    assert.equal(DEFAULT_CONFIG.errors.on_critical, 'halt');
    assert.equal(DEFAULT_CONFIG.errors.on_minor, 'retry');
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(DEFAULT_CONFIG));
  });
});

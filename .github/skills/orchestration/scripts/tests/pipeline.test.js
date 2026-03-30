'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { parseArgs } = require('../pipeline');

// ─── Unit Tests: parseArgs ──────────────────────────────────────────────────

describe('parseArgs', () => {
  it('parses all flags correctly', () => {
    const result = parseArgs([
      '--event', 'task_completed',
      '--project-dir', '/tmp/proj',
      '--config', '/cfg.yml',
      '--doc-path', '/docs/handoff.md',
      '--branch', 'feat/my-branch',
      '--base-branch', 'main',
      '--worktree-path', '/worktrees/my-branch',
      '--auto-commit', 'always',
      '--auto-pr', 'never',
      '--gate-type', 'task',
      '--reason', 'ready-to-advance',
      '--gate-mode', 'autonomous',
      '--commit-hash', 'abc123def',
      '--pushed', 'true',
      '--remote-url',  'https://github.com/org/repo',
      '--compare-url', 'https://github.com/org/repo/compare/main...feat'
    ]);
    assert.deepStrictEqual(result, {
      event: 'task_completed',
      projectDir: '/tmp/proj',
      configPath: '/cfg.yml',
      docPath: '/docs/handoff.md',
      branch: 'feat/my-branch',
      baseBranch: 'main',
      worktreePath: '/worktrees/my-branch',
      autoCommit: 'always',
      autoPr: 'never',
      gateType: 'task',
      reason: 'ready-to-advance',
      gateMode: 'autonomous',
      commitHash: 'abc123def',
      pushed: 'true',
      remoteUrl:  'https://github.com/org/repo',
      compareUrl: 'https://github.com/org/repo/compare/main...feat'
    });
  });

  it('returns undefined for all 13 named flags when only required flags are provided', () => {
    const result = parseArgs(['--event', 'task_completed', '--project-dir', '/tmp/proj']);
    assert.deepStrictEqual(result, {
      event: 'task_completed',
      projectDir: '/tmp/proj',
      configPath: undefined,
      docPath: undefined,
      branch: undefined,
      baseBranch: undefined,
      worktreePath: undefined,
      autoCommit: undefined,
      autoPr: undefined,
      gateType: undefined,
      reason: undefined,
      gateMode: undefined,
      commitHash: undefined,
      pushed: undefined,
      remoteUrl:  undefined,
      compareUrl: undefined
    });
  });

  it('throws when --event is missing', () => {
    assert.throws(
      () => parseArgs(['--project-dir', '/tmp/proj']),
      { message: /Missing required flag: --event/ }
    );
  });

  it('throws when --project-dir is missing', () => {
    assert.throws(
      () => parseArgs(['--event', 'start']),
      { message: /Missing required flag: --project-dir/ }
    );
  });

  it('throws when both required flags are missing', () => {
    assert.throws(
      () => parseArgs([]),
      { message: /Missing required flag/ }
    );
  });

  it('parses document-group flag --doc-path correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--doc-path', '/path/to/handoff.md'
    ]);
    assert.strictEqual(result.docPath, '/path/to/handoff.md');
  });

  it('parses source-control-group flags correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--branch', 'feat/x',
      '--base-branch', 'main',
      '--worktree-path', '/wt/feat-x',
      '--auto-commit', 'always',
      '--auto-pr', 'never'
    ]);
    assert.strictEqual(result.branch, 'feat/x');
    assert.strictEqual(result.baseBranch, 'main');
    assert.strictEqual(result.worktreePath, '/wt/feat-x');
    assert.strictEqual(result.autoCommit, 'always');
    assert.strictEqual(result.autoPr, 'never');
  });

  it('parses gate-group flags correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--gate-type', 'approval',
      '--reason', 'ready-to-advance'
    ]);
    assert.strictEqual(result.gateType, 'approval');
    assert.strictEqual(result.reason, 'ready-to-advance');
  });

  it('parses --gate-mode flag correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--gate-mode', 'autonomous'
    ]);
    assert.strictEqual(result.gateMode, 'autonomous');
  });

  it('parses commit-group flags correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--commit-hash', 'abc123def456',
      '--pushed', 'true'
    ]);
    assert.strictEqual(result.commitHash, 'abc123def456');
    assert.strictEqual(result.pushed, 'true');
  });

  it('parses --remote-url flag correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--remote-url', 'https://github.com/org/repo'
    ]);
    assert.strictEqual(result.remoteUrl, 'https://github.com/org/repo');
  });

  it('parses --compare-url flag correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--compare-url', 'https://github.com/org/repo/compare/main...feat'
    ]);
    assert.strictEqual(result.compareUrl, 'https://github.com/org/repo/compare/main...feat');
  });

  it('parses both --remote-url and --compare-url together', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--remote-url',  'https://github.com/org/repo',
      '--compare-url', 'https://github.com/org/repo/compare/main...feat'
    ]);
    assert.strictEqual(result.remoteUrl,  'https://github.com/org/repo');
    assert.strictEqual(result.compareUrl, 'https://github.com/org/repo/compare/main...feat');
  });

  it('parses --remote-url with empty string value', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--remote-url', ''
    ]);
    assert.strictEqual(result.remoteUrl, '');
  });
  it('unknown flags are silently ignored', () => {
    assert.doesNotThrow(() => {
      parseArgs([
        '--event', 'start',
        '--project-dir', '/tmp/proj',
        '--unknown-flag', 'some-value',
        '--another-unknown', 'another-value'
      ]);
    });
  });
});

// ─── E2E Tests: pipeline.js via child_process ───────────────────────────────

describe('E2E: pipeline.js via child_process', () => {
  const pipelinePath = path.resolve(__dirname, '..', 'pipeline.js');
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--event start initializes project when no state.json exists', () => {
    const stdout = execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir], {
      encoding: 'utf-8'
    });
    const result = JSON.parse(stdout);

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.action, 'string');
    assert.strictEqual(result.action, 'spawn_research');
    assert.ok(result.mutations_applied.includes('project_initialized'));
    assert.strictEqual(typeof result.orchRoot, 'string');
    assert.ok(result.orchRoot.length > 0);

    // Verify files/directories on disk
    assert.ok(fs.existsSync(path.join(tmpDir, 'state.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'phases')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'tasks')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'reports')));

    // Verify state.json content
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'));
    assert.strictEqual(state.$schema, 'orchestration-state-v4');
    assert.ok(state.project.name);
    assert.strictEqual(state.pipeline.current_tier, 'planning');
  });

  it('--event start with existing state.json performs cold start', () => {
    // state.json already exists from the previous test
    const stdout = execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir], {
      encoding: 'utf-8'
    });
    const result = JSON.parse(stdout);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.mutations_applied, []);
    assert.strictEqual(typeof result.action, 'string');
    assert.strictEqual(typeof result.orchRoot, 'string');
    assert.strictEqual(result.orchRoot, '.github');
  });

  it('missing --event flag returns exit code 1 with stderr message', () => {
    try {
      execFileSync('node', [pipelinePath, '--project-dir', tmpDir], { encoding: 'utf-8' });
      assert.fail('Expected non-zero exit code');
    } catch (error) {
      assert.strictEqual(error.status, 1);
      assert.ok(error.stderr.toString().includes('Missing required flag: --event'));
    }
  });

  it('missing --project-dir flag returns exit code 1 with stderr message', () => {
    try {
      execFileSync('node', [pipelinePath, '--event', 'start'], { encoding: 'utf-8' });
      assert.fail('Expected non-zero exit code');
    } catch (error) {
      assert.strictEqual(error.status, 1);
      assert.ok(error.stderr.toString().includes('Missing required flag: --project-dir'));
    }
  });

  it('unknown event returns exit code 1 with error JSON on stdout', () => {
    // State already exists from init test
    try {
      execFileSync('node', [pipelinePath, '--event', 'nonexistent_event', '--project-dir', tmpDir], {
        encoding: 'utf-8'
      });
      assert.fail('Expected non-zero exit code');
    } catch (error) {
      assert.strictEqual(error.status, 1);
      const result = JSON.parse(error.stdout.toString());
      assert.strictEqual(result.success, false);
      assert.ok(/Unknown event/.test(result.context.error));
      assert.strictEqual(typeof result.orchRoot, 'string');
    }
  });

  it('all JSON results include orchRoot field with string value', () => {
    const stdout = execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir], {
      encoding: 'utf-8'
    });
    const result = JSON.parse(stdout);
    assert.strictEqual(typeof result.orchRoot, 'string');
    assert.strictEqual(result.orchRoot, '.github');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'orchRoot'));
  });

  it('stdout is valid JSON on both success and error cases', () => {
    // Success case — state already exists, cold start
    const stdout = execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir], {
      encoding: 'utf-8'
    });
    assert.doesNotThrow(() => JSON.parse(stdout));

    // Error case — unknown event
    try {
      execFileSync('node', [pipelinePath, '--event', 'nonexistent_event', '--project-dir', tmpDir], {
        encoding: 'utf-8'
      });
    } catch (error) {
      assert.doesNotThrow(() => JSON.parse(error.stdout.toString()));
    }
  });
});

// ─── E2E Tests: CLI-surface named-flag groups ────────────────────────────────

describe('E2E: CLI-surface named-flag groups', () => {
  const pipelinePath = path.resolve(__dirname, '..', 'pipeline.js');
  let flagsTmpDir;

  before(() => {
    flagsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-flags-test-'));
    execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', flagsTmpDir], {
      encoding: 'utf-8'
    });
  });

  after(() => {
    fs.rmSync(flagsTmpDir, { recursive: true, force: true });
  });

  it('document-group: --doc-path is propagated to mutations_applied', () => {
    const stdout = execFileSync('node', [
      pipelinePath,
      '--event', 'research_completed',
      '--project-dir', flagsTmpDir,
      '--doc-path', '/tmp/test-research-findings.md'
    ], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);

    assert.strictEqual(result.success, true);
    assert.ok(result.mutations_applied.some(m => m.includes('/tmp/test-research-findings.md')));
  });

  it('source-control-group: all 5 SC flags are propagated to mutations_applied and state.json', () => {
    const stdout = execFileSync('node', [
      pipelinePath,
      '--event', 'source_control_init',
      '--project-dir', flagsTmpDir,
      '--branch', 'feat/test-branch',
      '--base-branch', 'main',
      '--worktree-path', '/wt/test',
      '--auto-commit', 'always',
      '--auto-pr', 'never'
    ], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);

    assert.strictEqual(result.success, true);
    assert.ok(result.mutations_applied.some(m => m.includes('feat/test-branch')));

    const state = JSON.parse(fs.readFileSync(path.join(flagsTmpDir, 'state.json'), 'utf-8'));
    assert.strictEqual(state.pipeline.source_control.branch, 'feat/test-branch');
    assert.strictEqual(state.pipeline.source_control.base_branch, 'main');
    assert.strictEqual(state.pipeline.source_control.worktree_path, '/wt/test');
    assert.strictEqual(state.pipeline.source_control.auto_commit, 'always');
    assert.strictEqual(state.pipeline.source_control.auto_pr, 'never');
  });

  it('remote-url and compare-url flags are accepted by source_control_init without error', () => {
    const stdout = execFileSync('node', [
      pipelinePath,
      '--event', 'source_control_init',
      '--project-dir', flagsTmpDir,
      '--branch', 'feat/test-branch',
      '--base-branch', 'main',
      '--worktree-path', '/wt/test',
      '--auto-commit', 'always',
      '--auto-pr', 'never',
      '--remote-url',  'https://github.com/org/repo',
      '--compare-url', 'https://github.com/org/repo/compare/main...feat'
    ], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);
    assert.strictEqual(result.success, true);
  });

  it('gate-group: --gate-type and --reason are propagated to mutations_applied', () => {
    const gateTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-gate-test-'));
    try {
      const now = new Date().toISOString();
      const fixtureState = {
        $schema: 'orchestration-state-v4',
        project: { name: 'gate-test', created: now, updated: now },
        pipeline: { current_tier: 'execution', gate_mode: 'task' },
        planning: {
          status: 'complete',
          human_approved: true,
          steps: [
            { name: 'research',     status: 'complete', doc_path: '/docs/research.md' },
            { name: 'prd',          status: 'complete', doc_path: '/docs/prd.md' },
            { name: 'design',       status: 'complete', doc_path: '/docs/design.md' },
            { name: 'architecture', status: 'complete', doc_path: '/docs/arch.md' },
            { name: 'master_plan',  status: 'complete', doc_path: '/docs/master.md' }
          ]
        },
        execution: {
          status: 'in_progress',
          current_phase: 1,
          phases: [{
            name: 'Phase 1',
            status: 'in_progress',
            stage: 'executing',
            current_task: 1,
            tasks: [{
              name: 'T01',
              status: 'in_progress',
              stage: 'reviewing',
              docs: { handoff: '/docs/h.md', review: null },
              review: { verdict: null, action: null },
              retries: 0
            }],
            docs: { phase_plan: '/docs/plan.md', phase_report: null, phase_review: null },
            review: { verdict: null, action: null }
          }]
        },
        final_review: { status: 'not_started', doc_path: null, human_approved: false }
      };
      fs.writeFileSync(path.join(gateTmpDir, 'state.json'), JSON.stringify(fixtureState, null, 2));

      const stdout = execFileSync('node', [
        pipelinePath,
        '--event', 'gate_rejected',
        '--project-dir', gateTmpDir,
        '--gate-type', 'task',
        '--reason', 'needs-rework'
      ], { encoding: 'utf-8' });
      const result = JSON.parse(stdout);

      assert.strictEqual(result.success, true);
      assert.ok(result.mutations_applied.some(m => m.includes('needs-rework')));
      assert.ok(result.mutations_applied.some(m => m.includes('task')));
    } finally {
      fs.rmSync(gateTmpDir, { recursive: true, force: true });
    }
  });

  it('gate-mode-group: --gate-mode is propagated to mutations_applied and state.json', () => {
    const stdout = execFileSync('node', [
      pipelinePath,
      '--event', 'gate_mode_set',
      '--project-dir', flagsTmpDir,
      '--gate-mode', 'autonomous'
    ], { encoding: 'utf-8' });
    const result = JSON.parse(stdout);

    assert.strictEqual(result.success, true);
    assert.ok(result.mutations_applied.some(m => m.includes('autonomous')));

    const state = JSON.parse(fs.readFileSync(path.join(flagsTmpDir, 'state.json'), 'utf-8'));
    assert.strictEqual(state.pipeline.gate_mode, 'autonomous');
  });
});

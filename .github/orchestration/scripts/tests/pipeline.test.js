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
  it('parses all four flags correctly', () => {
    const result = parseArgs([
      '--event', 'start',
      '--project-dir', '/tmp/proj',
      '--config', '/cfg.yml',
      '--context', '{"key":"val"}'
    ]);
    assert.deepStrictEqual(result, {
      event: 'start',
      projectDir: '/tmp/proj',
      configPath: '/cfg.yml',
      context: { key: 'val' }
    });
  });

  it('parses required flags only, optional flags are undefined', () => {
    const result = parseArgs(['--event', 'task_completed', '--project-dir', '/tmp/proj']);
    assert.deepStrictEqual(result, {
      event: 'task_completed',
      projectDir: '/tmp/proj',
      configPath: undefined,
      context: undefined
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

  it('throws on invalid --context JSON', () => {
    assert.throws(
      () => parseArgs(['--event', 'start', '--project-dir', '/tmp/proj', '--context', '{bad json}']),
      { message: /Invalid --context JSON/ }
    );
  });

  it('parses empty context object without throwing', () => {
    const result = parseArgs(['--event', 'start', '--project-dir', '/tmp/proj', '--context', '{}']);
    assert.deepStrictEqual(result.context, {});
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

  it('invalid --context JSON returns exit code 1 with stderr message', () => {
    try {
      execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir, '--context', '{bad}'], {
        encoding: 'utf-8'
      });
      assert.fail('Expected non-zero exit code');
    } catch (error) {
      assert.strictEqual(error.status, 1);
      assert.ok(error.stderr.toString().includes('Invalid --context JSON'));
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
    }
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

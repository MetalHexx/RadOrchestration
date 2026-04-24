import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseArgs } from './cli.js';

describe('parseArgs', () => {
  describe('command detection', () => {
    it('--help returns help command', () => {
      assert.deepStrictEqual(parseArgs(['--help']), { command: 'help', options: {} });
    });

    it('-h returns help command', () => {
      assert.deepStrictEqual(parseArgs(['-h']), { command: 'help', options: {} });
    });

    it('--version returns version command', () => {
      assert.deepStrictEqual(parseArgs(['--version']), { command: 'version', options: {} });
    });

    it('-v returns version command', () => {
      assert.deepStrictEqual(parseArgs(['-v']), { command: 'version', options: {} });
    });

    it('no args returns run command with empty options', () => {
      assert.deepStrictEqual(parseArgs([]), { command: 'run', options: {} });
    });
  });

  describe('boolean flags', () => {
    it('--yes sets skipConfirmation to true', () => {
      const { options } = parseArgs(['--yes']);
      assert.strictEqual(options.skipConfirmation, true);
    });

    it('-y sets skipConfirmation to true', () => {
      const { options } = parseArgs(['-y']);
      assert.strictEqual(options.skipConfirmation, true);
    });

    it('--overwrite sets overwrite to true', () => {
      const { options } = parseArgs(['--overwrite']);
      assert.strictEqual(options.overwrite, true);
    });

    it('--force sets overwrite to true', () => {
      const { options } = parseArgs(['--force']);
      assert.strictEqual(options.overwrite, true);
    });

    it('--dashboard sets installUi to true', () => {
      const { options } = parseArgs(['--dashboard']);
      assert.strictEqual(options.installUi, true);
    });

    it('--no-dashboard sets installUi to false', () => {
      const { options } = parseArgs(['--no-dashboard']);
      assert.strictEqual(options.installUi, false);
    });
  });

  describe('key-value flags', () => {
    it('--tool copilot', () => {
      const { options } = parseArgs(['--tool', 'copilot']);
      assert.strictEqual(options.tool, 'copilot');
    });

    it('--tool claude-code', () => {
      const { options } = parseArgs(['--tool', 'claude-code']);
      assert.strictEqual(options.tool, 'claude-code');
    });

    it('--orch-root .rad', () => {
      const { options } = parseArgs(['--orch-root', '.rad']);
      assert.strictEqual(options.orchRoot, '.rad');
    });

    it('--projects-path some/path', () => {
      const { options } = parseArgs(['--projects-path', 'some/path']);
      assert.strictEqual(options.projectsBasePath, 'some/path');
    });

    it('--naming lowercase', () => {
      const { options } = parseArgs(['--naming', 'lowercase']);
      assert.strictEqual(options.projectsNaming, 'lowercase');
    });

    it('--execution-mode autonomous', () => {
      const { options } = parseArgs(['--execution-mode', 'autonomous']);
      assert.strictEqual(options.executionMode, 'autonomous');
    });

    it('--auto-commit always', () => {
      const { options } = parseArgs(['--auto-commit', 'always']);
      assert.strictEqual(options.autoCommit, 'always');
    });

    it('--auto-pr never', () => {
      const { options } = parseArgs(['--auto-pr', 'never']);
      assert.strictEqual(options.autoPr, 'never');
    });
  });

  describe('integer parsing', () => {
    it('--max-phases 5 parses as number', () => {
      const { options } = parseArgs(['--max-phases', '5']);
      assert.strictEqual(options.maxPhases, 5);
    });

    it('--max-tasks 12 parses as number', () => {
      const { options } = parseArgs(['--max-tasks', '12']);
      assert.strictEqual(options.maxTasksPerPhase, 12);
    });

    it('--max-retries 3 parses as number', () => {
      const { options } = parseArgs(['--max-retries', '3']);
      assert.strictEqual(options.maxRetriesPerTask, 3);
    });

    it('--max-rejections 4 parses as number', () => {
      const { options } = parseArgs(['--max-rejections', '4']);
      assert.strictEqual(options.maxConsecutiveReviewRejections, 4);
    });
  });

  describe('path resolution', () => {
    it('--workspace resolves to absolute path', () => {
      const { options } = parseArgs(['--workspace', '.']);
      assert.strictEqual(options.workspaceDir, path.resolve('.'));
    });

    it('--dashboard-dir resolves to absolute path', () => {
      const { options } = parseArgs(['--dashboard-dir', 'ui']);
      assert.strictEqual(options.uiDir, path.resolve('ui'));
    });

    it('--dashboard-dir implicitly sets installUi to true', () => {
      const { options } = parseArgs(['--dashboard-dir', 'ui']);
      assert.strictEqual(options.installUi, true);
    });
  });

  describe('enum validation', () => {
    it('--tool invalid throws', () => {
      assert.throws(() => parseArgs(['--tool', 'invalid']), /Invalid value/);
    });

    it('--naming bad throws', () => {
      assert.throws(() => parseArgs(['--naming', 'bad']), /Invalid value/);
    });

    it('--execution-mode wrong throws', () => {
      assert.throws(() => parseArgs(['--execution-mode', 'wrong']), /Invalid value/);
    });

    it('--auto-commit bad throws', () => {
      assert.throws(() => parseArgs(['--auto-commit', 'bad']), /Invalid value/);
    });

    it('--auto-pr bad throws', () => {
      assert.throws(() => parseArgs(['--auto-pr', 'bad']), /Invalid value/);
    });
  });

  describe('integer validation', () => {
    it('--max-phases abc throws', () => {
      assert.throws(() => parseArgs(['--max-phases', 'abc']), /Must be a non-negative integer/);
    });
  });

  describe('combined flags', () => {
    it('parses multiple flags together', () => {
      const { command, options } = parseArgs([
        '--yes', '--overwrite', '--orch-root', '.rad', '--max-phases', '5',
      ]);
      assert.strictEqual(command, 'run');
      assert.strictEqual(options.skipConfirmation, true);
      assert.strictEqual(options.overwrite, true);
      assert.strictEqual(options.orchRoot, '.rad');
      assert.strictEqual(options.maxPhases, 5);
    });
  });
});

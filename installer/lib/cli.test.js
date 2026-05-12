import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
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
  });

  describe('retired boolean flags (FR-20)', () => {
    it('--dashboard is no longer parsed — installUi stays undefined', () => {
      const { options } = parseArgs(['--dashboard']);
      assert.strictEqual(options.installUi, undefined);
    });

    it('--no-dashboard is no longer parsed — installUi stays undefined', () => {
      const { options } = parseArgs(['--no-dashboard']);
      assert.strictEqual(options.installUi, undefined);
    });
  });

  describe('key-value flags', () => {
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

  describe('retired key-value flags (FR-20)', () => {
    it('--tool is no longer parsed — tool stays undefined', () => {
      const { options } = parseArgs(['--tool', 'copilot-vscode']);
      assert.strictEqual(options.tool, undefined);
    });

    it('--orch-root is no longer parsed — orchRoot stays undefined', () => {
      const { options } = parseArgs(['--orch-root', '.rad']);
      assert.strictEqual(options.orchRoot, undefined);
    });

    it('--projects-path is no longer parsed — projectsBasePath stays undefined', () => {
      const { options } = parseArgs(['--projects-path', 'some/path']);
      assert.strictEqual(options.projectsBasePath, undefined);
    });

    it('--naming is no longer parsed — projectsNaming stays undefined', () => {
      const { options } = parseArgs(['--naming', 'lowercase']);
      assert.strictEqual(options.projectsNaming, undefined);
    });

    it('--workspace is no longer parsed — workspaceDir stays undefined', () => {
      const { options } = parseArgs(['--workspace', '.']);
      assert.strictEqual(options.workspaceDir, undefined);
    });

    it('--dashboard-dir is no longer parsed — uiDir stays undefined', () => {
      const { options } = parseArgs(['--dashboard-dir', 'ui']);
      assert.strictEqual(options.uiDir, undefined);
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

  describe('enum validation', () => {
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
    it('parses multiple active flags together', () => {
      const { command, options } = parseArgs([
        '--yes', '--overwrite', '--max-phases', '5',
      ]);
      assert.strictEqual(command, 'run');
      assert.strictEqual(options.skipConfirmation, true);
      assert.strictEqual(options.overwrite, true);
      assert.strictEqual(options.maxPhases, 5);
    });
  });
});

test('parseArgs returns command="uninstall" when first arg is "uninstall"', () => {
  const result = parseArgs(['uninstall']);
  assert.strictEqual(result.command, 'uninstall');
});

test('--mode flag is no longer parsed (FR-20)', () => {
  // After FR-20, --mode is removed from FLAG_MAP; parseArgs silently ignores it.
  // Alternative shape: the parsed options must not contain a mode field.
  const result = parseArgs(['--mode', 'custom']);
  assert.strictEqual(result.options.mode, undefined, 'mode parsing should be inert or rejected');
});

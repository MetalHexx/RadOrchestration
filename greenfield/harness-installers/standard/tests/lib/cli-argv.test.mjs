// tests/lib/cli-argv.test.mjs — CLI argument parser tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../../lib/cli.js';

describe('parseArgs — harness selection', () => {
  it('parses --harness with comma-separated list into harnesses array', () => {
    const result = parseArgs(['--harness', 'claude,copilot-cli']);
    assert.equal(result.command, 'run');
    assert.deepEqual(result.options.harnesses, ['claude', 'copilot-cli']);
  });

  it('parses single --harness value', () => {
    const result = parseArgs(['--harness', 'claude']);
    assert.deepEqual(result.options.harnesses, ['claude']);
  });

  it('throws for invalid harness value, naming allowed values', () => {
    assert.throws(
      () => parseArgs(['--harness', 'bogus']),
      (err) => {
        assert.ok(err.message.includes('bogus'), 'error should mention the invalid value');
        assert.ok(
          err.message.includes('claude') &&
          err.message.includes('copilot-vscode') &&
          err.message.includes('copilot-cli'),
          'error should name all allowed values'
        );
        return true;
      }
    );
  });
});

describe('parseArgs — --yes / -y flag', () => {
  it('--yes sets skipConfirmation: true', () => {
    const result = parseArgs(['--yes']);
    assert.equal(result.command, 'run');
    assert.equal(result.options.skipConfirmation, true);
  });

  it('-y sets skipConfirmation: true', () => {
    const result = parseArgs(['-y']);
    assert.equal(result.options.skipConfirmation, true);
  });
});

describe('parseArgs — uninstall positional', () => {
  it('uninstall positional produces command: uninstall', () => {
    const result = parseArgs(['uninstall']);
    assert.equal(result.command, 'uninstall');
    assert.deepEqual(result.options, {});
  });

  it('uninstall with --yes sets skipConfirmation too', () => {
    const result = parseArgs(['uninstall', '--yes']);
    assert.equal(result.command, 'uninstall');
    assert.equal(result.options.skipConfirmation, true);
  });
});

describe('parseArgs — --help', () => {
  it('--help produces command: help', () => {
    const result = parseArgs(['--help']);
    assert.equal(result.command, 'help');
    assert.deepEqual(result.options, {});
  });

  it('-h produces command: help', () => {
    const result = parseArgs(['-h']);
    assert.equal(result.command, 'help');
  });
});

describe('parseArgs — --version', () => {
  it('--version produces command: version', () => {
    const result = parseArgs(['--version']);
    assert.equal(result.command, 'version');
    assert.deepEqual(result.options, {});
  });

  it('-v produces command: version', () => {
    const result = parseArgs(['-v']);
    assert.equal(result.command, 'version');
  });
});

describe('parseArgs — default run command', () => {
  it('no args produces command: run with empty options', () => {
    const result = parseArgs([]);
    assert.equal(result.command, 'run');
    assert.deepEqual(result.options, {});
  });
});

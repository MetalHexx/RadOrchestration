// tests/lib/wizard.test.mjs — Headless wizard behavior and harness auto-detection.
//
// All tests pass a synthetic `homeDir` (a tmpdir staging area) so the test
// suite never touches the real ~/.claude or ~/.copilot — that would couple
// CI results to the developer's local machine.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runWizard, detectInstalledHarnesses } from '../../lib/wizard.js';

function mkHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('runWizard — headless (skipConfirmation) behavior', () => {
  it('falls back to ["claude"] when no harness folders are detected', async () => {
    const home = mkHome('std-wiz-empty-');
    try {
      const result = await runWizard({
        skipConfirmation: true,
        cliOverrides: {},
        homeDir: home,
      });
      assert.deepEqual(result.harnesses, ['claude']);
      assert.equal(result.skipConfirmation, true);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('auto-detects ["claude","copilot-vscode","copilot-cli"] when both folders exist', async () => {
    const home = mkHome('std-wiz-both-');
    try {
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });

      const result = await runWizard({
        skipConfirmation: true,
        cliOverrides: {},
        homeDir: home,
      });
      assert.deepEqual(result.harnesses, ['claude', 'copilot-vscode', 'copilot-cli']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('honors cliOverrides.harnesses verbatim regardless of detection', async () => {
    const home = mkHome('std-wiz-override-');
    try {
      // Stage every folder so detection would otherwise return everything.
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });

      const result = await runWizard({
        skipConfirmation: true,
        cliOverrides: { harnesses: ['copilot-cli'] },
        homeDir: home,
      });
      assert.deepEqual(result.harnesses, ['copilot-cli']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('detectInstalledHarnesses', () => {
  it('returns [] when neither .claude nor .copilot exists', () => {
    const home = mkHome('std-det-empty-');
    try {
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns ["claude"] when only .claude exists', () => {
    const home = mkHome('std-det-claude-');
    try {
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), ['claude']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns ["copilot-vscode","copilot-cli"] when only .copilot exists', () => {
    const home = mkHome('std-det-copilot-');
    try {
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), [
        'copilot-vscode',
        'copilot-cli',
      ]);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns the full union when both .claude and .copilot exist', () => {
    const home = mkHome('std-det-both-');
    try {
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), [
        'claude',
        'copilot-vscode',
        'copilot-cli',
      ]);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

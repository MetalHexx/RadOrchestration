// tests/lib/wizard.test.mjs — Headless wizard behavior and harness auto-detection.
//
// The wizard is single-select: it returns a length-1 array. Interactive
// branches (the inquirer `select` and `confirm` prompts) are not covered
// here — they would require mocking @inquirer/prompts and are exercised
// end-to-end via the smoke-test skill.
//
// All tests pass a synthetic `homeDir` (a tmpdir staging area) so the test
// suite never touches the real ~/.claude or ~/.radorch — that would couple
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
  it('defensive fallback returns ["claude"] when no override is provided', async () => {
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

  it('honors cliOverrides.harnesses verbatim', async () => {
    const home = mkHome('std-wiz-override-');
    try {
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

  it('headless uninstall: forceAction + cliOverrides returns action="uninstall" and bypasses confirmation', async () => {
    const home = mkHome('std-wiz-uninstall-headless-');
    try {
      const radorchDir = path.join(home, '.radorch');
      fs.mkdirSync(radorchDir, { recursive: true });
      fs.writeFileSync(
        path.join(radorchDir, 'install.json'),
        JSON.stringify({
          harnesses: {
            'copilot-cli': {
              version: '1.0.0-alpha.9',
              channel: 'legacy-installer',
              installed_at: 't',
              last_writer_version: '1.0.0-alpha.9',
            },
          },
        }),
        'utf8',
      );

      const result = await runWizard({
        skipConfirmation: true,
        cliOverrides: { harnesses: ['copilot-cli'] },
        homeDir: home,
        forceAction: 'uninstall',
      });
      assert.equal(result.action, 'uninstall');
      assert.deepEqual(result.harnesses, ['copilot-cli']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('headless uninstall: throws NOT_INSTALLED when the override harness is not registered', async () => {
    const home = mkHome('std-wiz-uninstall-not-installed-');
    try {
      const radorchDir = path.join(home, '.radorch');
      fs.mkdirSync(radorchDir, { recursive: true });
      fs.writeFileSync(
        path.join(radorchDir, 'install.json'),
        JSON.stringify({ harnesses: {} }),
        'utf8',
      );

      await assert.rejects(
        async () =>
          runWizard({
            skipConfirmation: true,
            cliOverrides: { harnesses: ['copilot-cli'] },
            homeDir: home,
            forceAction: 'uninstall',
          }),
        (err) => err.code === 'NOT_INSTALLED',
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('skipConfirmation bypasses the destructive-pick confirm even when the override would otherwise prompt', async () => {
    // Stage a synthetic ~/.radorch/install.json with copilot-vscode already
    // registered. Picking copilot-cli would normally be destructive (mutex
    // eviction) and fire the confirm prompt — but skipConfirmation=true
    // short-circuits that.
    const home = mkHome('std-wiz-destructive-headless-');
    try {
      const radorchDir = path.join(home, '.radorch');
      fs.mkdirSync(radorchDir, { recursive: true });
      fs.writeFileSync(
        path.join(radorchDir, 'install.json'),
        JSON.stringify({
          harnesses: {
            'copilot-vscode': {
              version: '1.0.0-alpha.9',
              channel: 'legacy-installer',
              installed_at: 't',
              last_writer_version: '1.0.0-alpha.9',
            },
          },
        }),
        'utf8',
      );

      const result = await runWizard({
        skipConfirmation: true,
        cliOverrides: { harnesses: ['copilot-cli'] },
        homeDir: home,
        deliveringVersion: '1.0.0-alpha.9',
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

  it('returns [] when only .copilot exists (~/.copilot/ is not a Copilot install signal)', () => {
    const home = mkHome('std-det-copilot-');
    try {
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns only ["claude"] when both .claude and .copilot exist (Copilot is opt-in)', () => {
    const home = mkHome('std-det-both-');
    try {
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses({ homeDir: home }), ['claude']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

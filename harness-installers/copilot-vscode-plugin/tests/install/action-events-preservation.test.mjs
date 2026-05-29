// harness-installers/copilot-vscode-plugin/tests/install/action-events-preservation.test.mjs —
// FR-19, FR-20, FR-21, AD-10. Asserts the copilot-vscode-plugin's manifest-driven
// install/upgrade preserves user payloads under action-events/custom/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withTempHome, installFull, uninstallHarness } from '../helpers/install-bench.js';
import { removeManifestFiles } from '../../lib/install/remove-files.js';

test('install hydrates action-events/ and shipped action.*/event.* (FR-19)', async () => {
  await withTempHome(async (home, ctx) => {
    await installFull(home, ctx);
    const aeRoot = path.join(home, '.radorc', 'action-events');
    assert.ok(fs.existsSync(aeRoot), 'action-events/ created');
    assert.ok(fs.existsSync(path.join(aeRoot, 'README.md')), 'top-level README.md present');
    const actionFiles = fs.readdirSync(aeRoot).filter((f) => f.startsWith('action.'));
    assert.ok(actionFiles.length > 0, 'at least one shipped action.*.md present');
    const eventFiles = fs.readdirSync(aeRoot).filter((f) => f.startsWith('event.'));
    assert.ok(eventFiles.length > 0, 'at least one shipped event.*.md present');
  });
});

test('user file under custom/ survives remove (FR-21)', async () => {
  await withTempHome(async (home, ctx) => {
    await installFull(home, ctx);
    const customDir = path.join(home, '.radorc', 'action-events', 'custom');
    fs.mkdirSync(customDir, { recursive: true });
    const userFile = path.join(customDir, 'action.spawn_planner.pre.md');
    fs.writeFileSync(userFile, 'MINE');
    uninstallHarness(home, ctx);
    assert.strictEqual(fs.readFileSync(userFile, 'utf8'), 'MINE', 'user file untouched by remove');
  });
});

test('removeManifestFiles refuses any entry under action-events/custom/ (defensive guard)', async () => {
  await withTempHome(async (home) => {
    const tamperedManifest = {
      files: [
        {
          destinationPath: '${RAD_HOME}/action-events/custom/action.user_added.pre.md',
          sourcePath: '_install-source/action-events/custom/action.user_added.pre.md',
          ownership: 'installer-owned',
        },
      ],
    };
    assert.throws(
      () => removeManifestFiles(tamperedManifest, { radHome: path.join(home, '.radorc') }),
      /custom.*payload|action-events.*custom/i,
      'remove path must throw on any entry under action-events/custom/',
    );
  });
});

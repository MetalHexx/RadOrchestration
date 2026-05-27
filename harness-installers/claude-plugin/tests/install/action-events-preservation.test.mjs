// harness-installers/claude-plugin/tests/install/action-events-preservation.test.mjs —
// FR-19, FR-20, FR-21, AD-10. Asserts the claude-plugin's manifest-driven
// install/upgrade preserves user payloads under action-events/custom/:
//   - shipped action.*.md / event.*.md / README.md land under ${RAD_HOME}/action-events/
//   - shipped custom/README.md seeded on first install only — never overwrites a
//     user-edited file (FR-20)
//   - any user-authored file under custom/ survives the remove half of upgrade (FR-21)
//   - removeManifestFiles refuses any non-shipped entry under action-events/custom/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withTempHome, installFull, uninstallHarness } from '../helpers/install-bench.js';
import { removeManifestFiles } from '../../lib/install/remove-files.js';
import { installManifestFiles } from '../../lib/install/install-files.js';
import { loadManifest } from '../../lib/install/catalog.js';

test('install hydrates action-events/, custom/README.md, and shipped action.*/event.* (FR-19)', async () => {
  await withTempHome(async (home, ctx) => {
    await installFull(home, ctx);
    const aeRoot = path.join(home, '.radorc', 'action-events');
    assert.ok(fs.existsSync(aeRoot), 'action-events/ created');
    assert.ok(fs.existsSync(path.join(aeRoot, 'README.md')), 'top-level README.md present');
    assert.ok(fs.existsSync(path.join(aeRoot, 'custom', 'README.md')), 'custom/README.md present');
    const actionFiles = fs.readdirSync(aeRoot).filter((f) => f.startsWith('action.'));
    assert.ok(actionFiles.length > 0, 'at least one shipped action.*.md present');
    const eventFiles = fs.readdirSync(aeRoot).filter((f) => f.startsWith('event.'));
    assert.ok(eventFiles.length > 0, 'at least one shipped event.*.md present');
  });
});

test('user file under custom/ survives remove (FR-21)', async () => {
  await withTempHome(async (home, ctx) => {
    await installFull(home, ctx);
    const userFile = path.join(home, '.radorc', 'action-events', 'custom', 'action.spawn_planner.pre.md');
    fs.writeFileSync(userFile, 'MINE');
    uninstallHarness(home, ctx);
    assert.strictEqual(fs.readFileSync(userFile, 'utf8'), 'MINE', 'user file untouched by remove');
  });
});

test('installManifestFiles preserves a user-edited custom/README.md — first-install seed is absent-only (FR-20)', async () => {
  await withTempHome(async (home, ctx) => {
    await installFull(home, ctx);
    const customReadme = path.join(home, '.radorc', 'action-events', 'custom', 'README.md');
    fs.writeFileSync(customReadme, '# user-edited custom README\n');

    // Drive installManifestFiles directly — bypasses runInstall's noop fast
    // path so the per-entry copy is actually exercised. Re-stage the plugin
    // root first because the prior runInstall destroys _install-source/ on
    // success.
    const { stagePluginRoot } = await import('../helpers/install-bench.js');
    stagePluginRoot(ctx.pluginRoot);
    const manifest = loadManifest(ctx.pluginRoot, '1.0.0-alpha.9');
    installManifestFiles(manifest, ctx.pluginRoot, { radHome: path.join(home, '.radorc') });

    assert.strictEqual(
      fs.readFileSync(customReadme, 'utf8'),
      '# user-edited custom README\n',
      'install must not overwrite a user-edited custom/README.md',
    );
  });
});

test('removeManifestFiles refuses any non-shipped entry under action-events/custom/ (defensive guard)', async () => {
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
      'remove path must throw on any non-shipped entry under action-events/custom/',
    );
  });
});

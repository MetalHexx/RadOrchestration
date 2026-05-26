// harness-installers/standard/tests/install/action-events-preservation.test.mjs —
// FR-8, FR-19, FR-20, FR-21, AD-10. Asserts the standard installer's
// manifest-driven install of the action-events catalog:
//   - shipped action.*.md / event.*.md / README.md land under ${RAD_HOME}/action-events/
//   - shipped custom/README.md is seeded on first install only — never overwrites
//     an existing user-edited file (FR-20)
//   - any user-authored file under custom/ survives uninstall (FR-21)
//   - removeManifestFiles refuses any manifest entry whose resolved destination
//     lives under action-events/custom/ (defensive guard against future manifest drift)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withTempHome, installFull, uninstallHarness, stageActionEventsBundle } from '../helpers/install-bench.js';
import { removeManifestFiles } from '../../lib/install/remove-files.js';
import { installManifestFiles } from '../../lib/install/install-files.js';

test('install hydrates action-events/, custom/README.md, copies shipped action.*.md / event.*.md (FR-19)', async () => {
  await withTempHome(async (home) => {
    installFull(home, { harness: 'claude' });
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

test('user file under custom/ survives uninstall (FR-21)', async () => {
  await withTempHome(async (home) => {
    const { manifest } = installFull(home, { harness: 'claude' });
    const userFile = path.join(home, '.radorc', 'action-events', 'custom', 'action.spawn_planner.pre.md');
    fs.writeFileSync(userFile, 'MINE');
    uninstallHarness(home, { harness: 'claude', manifest });
    assert.strictEqual(fs.readFileSync(userFile, 'utf8'), 'MINE', 'user file untouched by uninstall');
  });
});

test('user-edited custom/README.md survives reinstall — first-install seed is absent-only (FR-20)', async () => {
  await withTempHome(async (home) => {
    installFull(home, { harness: 'claude' });
    const customReadme = path.join(home, '.radorc', 'action-events', 'custom', 'README.md');
    fs.writeFileSync(customReadme, '# user-edited custom README\n');
    installFull(home, { harness: 'claude' });
    assert.strictEqual(
      fs.readFileSync(customReadme, 'utf8'),
      '# user-edited custom README\n',
      're-install must not overwrite a user-edited custom/README.md',
    );
  });
});

test('uninstall removes shipped action.*.md / event.*.md / top-level README (FR-21)', async () => {
  await withTempHome(async (home) => {
    const { manifest } = installFull(home, { harness: 'claude' });
    uninstallHarness(home, { harness: 'claude', manifest });
    const aeRoot = path.join(home, '.radorc', 'action-events');
    if (fs.existsSync(aeRoot)) {
      const remaining = fs.readdirSync(aeRoot).filter((f) => f.startsWith('action.') || f.startsWith('event.'));
      assert.deepStrictEqual(remaining, [], 'shipped action.*/event.* removed');
      assert.strictEqual(fs.existsSync(path.join(aeRoot, 'README.md')), false, 'top-level README removed');
    }
  });
});

test('removeManifestFiles refuses any non-shipped entry under action-events/custom/ (defensive guard)', async () => {
  await withTempHome(async (home) => {
    const { manifest } = stageActionEventsBundle(home, { harness: 'claude' });
    // Tampered manifest — a user-authored custom payload appears as a manifest entry.
    const tamperedManifest = {
      files: [
        ...manifest.files,
        {
          bundlePath: 'action-events/custom/action.user_added.pre.md',
          destinationPath: '${RAD_HOME}/action-events/custom/action.user_added.pre.md',
          sha256: 'x',
        },
      ],
    };
    assert.throws(
      () => removeManifestFiles(tamperedManifest, 'claude'),
      /custom.*payload|action-events.*custom/i,
      'remove path must throw on any non-shipped entry under action-events/custom/',
    );
  });
});

test('removeManifestFiles accepts the shipped action-events/custom/README.md entry (does not over-trigger guard)', async () => {
  await withTempHome(async (home) => {
    const { bundle, manifest } = stageActionEventsBundle(home, { harness: 'claude' });
    installManifestFiles(manifest, bundle, 'claude');
    // Shipped manifest (which DOES include action-events/custom/README.md) must not trip the guard.
    assert.doesNotThrow(
      () => removeManifestFiles(manifest, 'claude'),
      'shipped manifest containing only custom/README.md must pass the defensive guard',
    );
  });
});

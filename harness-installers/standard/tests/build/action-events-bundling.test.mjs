// harness-installers/standard/tests/build/action-events-bundling.test.mjs —
// FR-1, FR-19, FR-20, AD-3, AD-10. Asserts the standard installer build
// stages `runtime-config/action-events/` into every per-harness `output/<h>/`
// payload, ships only `custom/README.md` from the canonical `custom/` slot
// (never user-authored files), and records the action-events files in the
// per-harness manifest with `${RAD_HOME}/action-events/...` destinations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runBuild } from '../helpers/run-build.js';

const HARNESSES = ['claude', 'copilot-vscode', 'copilot-cli'];

test('standard build bundles action-events for every harness', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    for (const h of HARNESSES) {
      const aeRoot = path.join(outRoot, h, 'action-events');
      assert.ok(fs.existsSync(aeRoot), `${h}: action-events/ directory present`);
      assert.ok(fs.existsSync(path.join(aeRoot, 'README.md')),
        `${h}: action-events/README.md present`);
      assert.ok(fs.existsSync(path.join(aeRoot, 'custom', 'README.md')),
        `${h}: action-events/custom/README.md present`);
      const actionFiles = fs.readdirSync(aeRoot).filter((f) => /^action\..*\.md$/.test(f));
      assert.ok(actionFiles.length > 0, `${h}: at least one shipped action.*.md present`);
      const eventFiles = fs.readdirSync(aeRoot).filter((f) => /^event\..*\.md$/.test(f));
      assert.ok(eventFiles.length > 0, `${h}: at least one shipped event.*.md present`);
    }
  } finally {
    cleanup();
  }
});

test('standard build ships only custom/README.md from action-events/custom/ — never user-authored files (FR-20)', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    for (const h of HARNESSES) {
      const customDir = path.join(outRoot, h, 'action-events', 'custom');
      const entries = fs.readdirSync(customDir);
      assert.deepStrictEqual(entries.sort(), ['README.md'],
        `${h}: action-events/custom/ contains exactly README.md (no user-authored files leak)`);
    }
  } finally {
    cleanup();
  }
});

test('manifest entries for action-events all destinate under ${RAD_HOME}/action-events/', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    for (const h of HARNESSES) {
      const manifestPath = path.join(outRoot, h, 'manifests', 'v1.0.0-alpha.9.json');
      assert.ok(fs.existsSync(manifestPath), `${h}: manifest written`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const aeFiles = manifest.files.filter((f) => f.bundlePath.startsWith('action-events/'));
      assert.ok(aeFiles.length > 0, `${h}: manifest lists at least one action-events entry`);
      for (const f of aeFiles) {
        assert.match(f.destinationPath, /^\$\{RAD_HOME\}\/action-events\//,
          `${h}: ${f.bundlePath} destinationPath uses \${RAD_HOME}/action-events/...`);
      }
      // Defensive: manifest must NOT list any path under action-events/custom/
      // other than the shipped custom/README.md.
      for (const f of aeFiles) {
        if (f.bundlePath.startsWith('action-events/custom/')) {
          assert.strictEqual(f.bundlePath, 'action-events/custom/README.md',
            `${h}: manifest must not list user-authored custom payloads (got ${f.bundlePath})`);
        }
      }
    }
  } finally {
    cleanup();
  }
});

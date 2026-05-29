// harness-installers/copilot-vscode-plugin/tests/build/action-events-bundling.test.mjs —
// FR-1, FR-19, FR-20, AD-3, AD-10. Asserts the copilot-vscode-plugin installer
// build stages `runtime-config/action-events/` under `output/_install-source/`
// and ships an empty `custom/` slot — no user-authored files leak.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runBuild } from '../helpers/run-build.js';

test('copilot-vscode-plugin build stages action-events under _install-source/ (FR-19)', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    const aeRoot = path.join(outRoot, '_install-source', 'action-events');
    assert.ok(fs.existsSync(aeRoot), 'action-events/ staged under _install-source/');
    assert.ok(fs.existsSync(path.join(aeRoot, 'README.md')), 'shipped top-level README.md present');
    const actionFiles = fs.readdirSync(aeRoot).filter((f) => /^action\..*\.md$/.test(f));
    assert.ok(actionFiles.length > 0, 'at least one shipped action.*.md present');
    const eventFiles = fs.readdirSync(aeRoot).filter((f) => /^event\..*\.md$/.test(f));
    assert.ok(eventFiles.length > 0, 'at least one shipped event.*.md present');
  } finally {
    cleanup();
  }
});

test('copilot-vscode-plugin build ships an empty action-events/custom/ — no user-authored files leak (FR-20)', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    const customDir = path.join(outRoot, '_install-source', 'action-events', 'custom');
    assert.ok(fs.existsSync(customDir), 'action-events/custom/ directory present');
    const entries = fs.readdirSync(customDir);
    assert.deepStrictEqual(entries, [],
      'action-events/custom/ ships empty (no user-authored files leak)');
  } finally {
    cleanup();
  }
});

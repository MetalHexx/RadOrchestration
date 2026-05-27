// harness-installers/copilot-cli-plugin/tests/build/action-events-bundling.test.mjs —
// FR-1, FR-19, FR-20, AD-3, AD-10. Asserts the copilot-cli-plugin installer
// build stages `runtime-config/action-events/` under `output/_install-source/`
// and ships only `custom/README.md` from the canonical `custom/` slot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runBuild } from '../helpers/run-build.js';

test('copilot-cli-plugin build stages action-events under _install-source/ (FR-19)', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    const aeRoot = path.join(outRoot, '_install-source', 'action-events');
    assert.ok(fs.existsSync(aeRoot), 'action-events/ staged under _install-source/');
    assert.ok(fs.existsSync(path.join(aeRoot, 'README.md')), 'shipped top-level README.md present');
    assert.ok(fs.existsSync(path.join(aeRoot, 'custom', 'README.md')),
      'shipped custom/README.md present');
    const actionFiles = fs.readdirSync(aeRoot).filter((f) => /^action\..*\.md$/.test(f));
    assert.ok(actionFiles.length > 0, 'at least one shipped action.*.md present');
    const eventFiles = fs.readdirSync(aeRoot).filter((f) => /^event\..*\.md$/.test(f));
    assert.ok(eventFiles.length > 0, 'at least one shipped event.*.md present');
  } finally {
    cleanup();
  }
});

test('copilot-cli-plugin build ships only custom/README.md from action-events/custom/ (FR-20)', async () => {
  const { outRoot, cleanup } = await runBuild();
  try {
    const customDir = path.join(outRoot, '_install-source', 'action-events', 'custom');
    const entries = fs.readdirSync(customDir);
    assert.deepStrictEqual(entries.sort(), ['README.md'],
      'action-events/custom/ contains exactly README.md — no user-authored files leak');
  } finally {
    cleanup();
  }
});

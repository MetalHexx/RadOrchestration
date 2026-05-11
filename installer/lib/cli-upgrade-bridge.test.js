// installer/lib/cli-upgrade-bridge.test.js — Verify the thin JS shim that
// re-exports runPluginBootstrap from the CLI's compiled output.
//
// The legacy installer is plain JS and cannot import the TypeScript sources
// directly. The bridge loads cli/dist/commands/plugin-bootstrap/run.js (the
// compiled output) and re-exports its runPluginBootstrap, giving the
// installer one canonical upgrade path with the rest of the system.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bridge from './cli-upgrade-bridge.js';

test('cli-upgrade-bridge re-exports runPluginBootstrap as a function', () => {
  assert.equal(typeof bridge.runPluginBootstrap, 'function',
    'runPluginBootstrap must be exported from the bridge');
});

test('cli-upgrade-bridge does not export retired legacy primitives', () => {
  // Sanity guard: the bridge surface must stay narrow. Adding more exports
  // re-introduces the divergence we removed.
  const allowed = new Set(['runPluginBootstrap']);
  for (const key of Object.keys(bridge)) {
    assert.ok(allowed.has(key),
      `unexpected bridge export '${key}' — the bridge must stay narrow`);
  }
});

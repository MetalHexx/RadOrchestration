import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { expandDestinationTokens } from './expand-tokens.js';

const home = os.homedir();

test('expandDestinationTokens — HARNESS_ROOT, claude', () => {
  assert.equal(
    expandDestinationTokens('${HARNESS_ROOT}/skills/foo', 'claude'),
    path.normalize(path.join(home, '.claude', 'skills', 'foo')),
  );
});

test('expandDestinationTokens — HARNESS_ROOT, copilot-vscode', () => {
  assert.equal(
    expandDestinationTokens('${HARNESS_ROOT}/agents/bar.md', 'copilot-vscode'),
    path.normalize(path.join(home, '.copilot', 'agents', 'bar.md')),
  );
});

test('expandDestinationTokens — HARNESS_ROOT, copilot-cli', () => {
  assert.equal(
    expandDestinationTokens('${HARNESS_ROOT}/skills/baz', 'copilot-cli'),
    path.normalize(path.join(home, '.copilot', 'skills', 'baz')),
  );
});

test('expandDestinationTokens — RAD_HOME', () => {
  assert.equal(
    expandDestinationTokens('${RAD_HOME}/ui/server.js', 'claude'),
    path.normalize(path.join(home, '.radorch', 'ui', 'server.js')),
  );
});

test('expandDestinationTokens — no tokens passes through (normalised)', () => {
  assert.equal(
    expandDestinationTokens('/abs/path', 'claude'),
    path.normalize('/abs/path'),
  );
});

test('expandDestinationTokens — unknown harness throws', () => {
  assert.throws(() => expandDestinationTokens('${HARNESS_ROOT}/x', 'bogus'), /unknown harness/);
});

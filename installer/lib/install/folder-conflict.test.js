// installer/lib/install/folder-conflict.test.js — Dedicated coverage of the
// two v6 conflict helpers (Section 6):
//   - resolveFolderConflict: copilot-cli ↔ copilot-vscode share ~/.copilot/
//     and are mutually exclusive in the registry. Writing one variant while
//     the other is registered removes the prior partner.
//   - detectChannelOverlap: claude ↔ claude-plugin both write into ~/.claude/
//     and coexist in the registry. The detector returns the partner key for
//     the writer's warning surface; it does NOT mutate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFolderConflict,
  detectChannelOverlap,
} from './install-json.js';

function entry(version, channel = 'legacy-installer') {
  return {
    version,
    channel,
    installed_at: '2026-01-01T00:00:00.000Z',
    last_writer_version: version,
  };
}

test('resolveFolderConflict — copilot-cli replaces existing copilot-vscode entry', () => {
  const harnesses = { 'copilot-vscode': entry('1.0.0-alpha.7') };
  const result = resolveFolderConflict(harnesses, 'copilot-cli');
  assert.ok(result.removed, 'partner should be reported removed');
  assert.equal(result.removed.key, 'copilot-vscode');
  assert.equal(result.removed.entry.version, '1.0.0-alpha.7');
  assert.ok(!harnesses['copilot-vscode'], 'partner deleted from harnesses');
});

test('resolveFolderConflict — copilot-vscode replaces existing copilot-cli entry', () => {
  const harnesses = { 'copilot-cli': entry('1.0.0-alpha.8') };
  const result = resolveFolderConflict(harnesses, 'copilot-vscode');
  assert.ok(result.removed);
  assert.equal(result.removed.key, 'copilot-cli');
  assert.ok(!harnesses['copilot-cli']);
});

test('resolveFolderConflict — no-op when partner not present', () => {
  const harnesses = { 'copilot-cli': entry('1.0.0') };
  const result = resolveFolderConflict(harnesses, 'copilot-cli');
  assert.equal(result.removed, undefined);
  assert.ok(harnesses['copilot-cli'], 'own entry left untouched');
});

test('resolveFolderConflict — no-op for claude (no folder mutex partner)', () => {
  const harnesses = { 'claude-plugin': entry('1.0.0', 'plugin') };
  const result = resolveFolderConflict(harnesses, 'claude');
  assert.equal(result.removed, undefined);
  assert.ok(harnesses['claude-plugin'], 'claude-plugin must NOT be removed by folder-conflict logic');
});

test('resolveFolderConflict — no-op for claude-plugin', () => {
  const harnesses = { 'claude': entry('1.0.0') };
  const result = resolveFolderConflict(harnesses, 'claude-plugin');
  assert.equal(result.removed, undefined);
  assert.ok(harnesses['claude'], 'claude must NOT be removed by folder-conflict logic');
});

test('resolveFolderConflict — empty registry is no-op', () => {
  const harnesses = {};
  const result = resolveFolderConflict(harnesses, 'copilot-cli');
  assert.equal(result.removed, undefined);
});

test('detectChannelOverlap — returns claude-plugin when installing claude with claude-plugin registered', () => {
  const harnesses = { 'claude-plugin': entry('1.0.0', 'plugin') };
  const partner = detectChannelOverlap(harnesses, 'claude');
  assert.equal(partner, 'claude-plugin');
  // Detector is non-mutating.
  assert.ok(harnesses['claude-plugin']);
});

test('detectChannelOverlap — returns claude when installing claude-plugin with claude registered', () => {
  const harnesses = { 'claude': entry('1.0.0') };
  const partner = detectChannelOverlap(harnesses, 'claude-plugin');
  assert.equal(partner, 'claude');
  assert.ok(harnesses['claude']);
});

test('detectChannelOverlap — undefined when no partner registered', () => {
  const harnesses = { 'claude': entry('1.0.0') };
  assert.equal(detectChannelOverlap(harnesses, 'claude'), undefined);
});

test('detectChannelOverlap — undefined for copilot keys (no channel partner)', () => {
  const harnesses = { 'copilot-cli': entry('1.0.0'), 'copilot-vscode': entry('1.0.0') };
  assert.equal(detectChannelOverlap(harnesses, 'copilot-cli'), undefined);
  assert.equal(detectChannelOverlap(harnesses, 'copilot-vscode'), undefined);
});

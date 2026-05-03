import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findPriorInstallAtOtherOrchRoot } from './cross-harness-scan.js';

function seedYml(workspace, orchRootName, packageVersion) {
  const cfg = path.join(workspace, orchRootName, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(cfg, { recursive: true });
  const body = packageVersion === null
    ? 'version: "1.0"\nsystem:\n  orch_root: ' + orchRootName + '\n'
    : `version: "1.0"\npackage_version: ${packageVersion}\nsystem:\n  orch_root: ${orchRootName}\n`;
  fs.writeFileSync(path.join(cfg, 'orchestration.yml'), body, 'utf8');
}

test('returns null when no other-orchRoot install is present', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  assert.strictEqual(findPriorInstallAtOtherOrchRoot(ws, '.claude'), null);
});

test('returns prior install when chosen orchRoot is .github but a .claude install exists', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  seedYml(ws, '.claude', '1.0.0-alpha.9');
  const got = findPriorInstallAtOtherOrchRoot(ws, '.github');
  assert.deepStrictEqual(got, { orchRoot: path.join(ws, '.claude'), packageVersion: '1.0.0-alpha.9', tool: 'claude-code' });
});

test('tool field is claude-code when prior orchRoot is .claude', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  seedYml(ws, '.claude', '1.0.0-alpha.9');
  const got = findPriorInstallAtOtherOrchRoot(ws, '.github');
  assert.strictEqual(got.tool, 'claude-code', '.claude orchRoot must yield tool=claude-code');
});

test('tool field is copilot-vscode when prior orchRoot is .github', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  seedYml(ws, '.github', '1.0.0-alpha.9');
  const got = findPriorInstallAtOtherOrchRoot(ws, '.claude');
  assert.strictEqual(got.tool, 'copilot-vscode', '.github orchRoot must yield tool=copilot-vscode');
});

test('returns null when the chosen orchRoot equals the only install present (same-orchRoot upgrade is handled by the installer main flow)', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  seedYml(ws, '.claude', '1.0.0-alpha.9');
  assert.strictEqual(findPriorInstallAtOtherOrchRoot(ws, '.claude'), null);
});

test('skips pre-manifest installs (DD-1 manual migration path applies to those)', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  seedYml(ws, '.claude', null);
  assert.strictEqual(findPriorInstallAtOtherOrchRoot(ws, '.github'), null);
});

test('does not auto-detect absolute-path orchRoot installs (AD-7)', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  // Absolute orchRoots live outside the workspace — scanner does not look there.
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'elsewhere-'));
  seedYml(elsewhere, '.claude', '1.0.0-alpha.9');
  assert.strictEqual(findPriorInstallAtOtherOrchRoot(ws, '.github'), null);
});

// harness-dogfood/install-files.test.mjs — In-folder dogfood library coverage
// mirroring the dogfood-relevant code paths previously covered by
// installer/lib/install/install-files.test.js (NFR-3).

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installManifestFiles } from './install-files.js';

let tmp;
let homeOriginal;
let pluginRoot;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-install-'));
  homeOriginal = os.homedir;
  os.homedir = () => tmp;
  pluginRoot = path.join(tmp, 'staging');
  fs.mkdirSync(path.join(pluginRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'skills', 'rad-plan'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'agents', 'planner.md'), 'agent-body');
  fs.writeFileSync(path.join(pluginRoot, 'skills', 'rad-plan', 'SKILL.md'), 'skill-body');
});

afterEach(() => {
  os.homedir = homeOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('installManifestFiles — copies agents/ to ~/.claude/', () => {
  const manifest = {
    files: [{
      bundlePath: 'agents/planner.md',
      destinationPath: '${HARNESS_ROOT}/agents/planner.md',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  const target = path.join(tmp, '.claude', 'agents', 'planner.md');
  assert.ok(fs.existsSync(target), 'agent should be copied');
  assert.equal(fs.readFileSync(target, 'utf8'), 'agent-body');
  assert.equal(result.copiedCount, 1);
});

test('installManifestFiles — copies agents/ to ~/.copilot/ for copilot-vscode', () => {
  const manifest = {
    files: [{
      bundlePath: 'agents/planner.md',
      destinationPath: '${HARNESS_ROOT}/agents/planner.md',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'copilot-vscode');
  const target = path.join(tmp, '.copilot', 'agents', 'planner.md');
  assert.ok(fs.existsSync(target), 'agent should be copied under ~/.copilot/');
  assert.equal(fs.readFileSync(target, 'utf8'), 'agent-body');
  assert.equal(result.copiedCount, 1);
});

test('installManifestFiles — copies agents/ to ~/.copilot/ for copilot-cli', () => {
  const manifest = {
    files: [{
      bundlePath: 'agents/planner.md',
      destinationPath: '${HARNESS_ROOT}/agents/planner.md',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'copilot-cli');
  const target = path.join(tmp, '.copilot', 'agents', 'planner.md');
  assert.ok(fs.existsSync(target), 'agent should be copied under ~/.copilot/');
  assert.equal(result.copiedCount, 1);
});

test('installManifestFiles — copies skills/ to ~/.claude/', () => {
  const manifest = {
    files: [{
      bundlePath: 'skills/rad-plan/SKILL.md',
      destinationPath: '${HARNESS_ROOT}/skills/rad-plan/SKILL.md',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  const target = path.join(tmp, '.claude', 'skills', 'rad-plan', 'SKILL.md');
  assert.ok(fs.existsSync(target), 'skill should be copied');
  assert.equal(fs.readFileSync(target, 'utf8'), 'skill-body');
  assert.equal(result.copiedCount, 1);
});

test('installManifestFiles — copies templates/ to ~/.radorc/templates/', () => {
  fs.mkdirSync(path.join(pluginRoot, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'templates', 'high.yml'), 'template-body');
  const manifest = {
    files: [{
      bundlePath: 'templates/high.yml',
      destinationPath: '${RAD_HOME}/templates/high.yml',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  const target = path.join(tmp, '.radorc', 'templates', 'high.yml');
  assert.ok(fs.existsSync(target), 'template should be in ~/.radorc/templates/');
  assert.equal(fs.readFileSync(target, 'utf8'), 'template-body');
  assert.equal(result.copiedCount, 1);
});

test('installManifestFiles — AD-7: skips entries under projects/', () => {
  fs.mkdirSync(path.join(pluginRoot, 'projects', 'evil'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'projects', 'evil', 'state.json'), '{}');
  const manifest = {
    files: [{
      bundlePath: 'projects/evil/state.json',
      destinationPath: '${RAD_HOME}/projects/evil/state.json',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  const target = path.join(tmp, '.radorc', 'projects', 'evil', 'state.json');
  assert.ok(!fs.existsSync(target), 'projects/ must not be touched');
  assert.equal(result.copiedCount, 0);
  assert.equal(result.skippedCount, 1);
});

import { test, mock, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installManifestFiles } from './install-files.js';

let tmp;
let homeOriginal;
let pluginRoot;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-files-'));
  homeOriginal = os.homedir;
  os.homedir = () => tmp;
  pluginRoot = path.join(tmp, 'plugin');
  fs.mkdirSync(path.join(pluginRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'skills', 'rad-plan'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'agents', 'planner.md'), 'agent-body');
  fs.writeFileSync(path.join(pluginRoot, 'skills', 'rad-plan', 'SKILL.md'), 'skill-body');
  fs.writeFileSync(path.join(pluginRoot, 'templates', 'high.yml'), 'template-body');
});

afterEach(() => {
  os.homedir = homeOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('installManifestFiles — copies agents/ to harness root', () => {
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

test('installManifestFiles — copies templates/ under RAD_HOME', () => {
  const manifest = {
    files: [{
      bundlePath: 'templates/high.yml',
      destinationPath: '${RAD_HOME}/templates/high.yml',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  const target = path.join(tmp, '.radorch', 'templates', 'high.yml');
  assert.ok(fs.existsSync(target));
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
  const target = path.join(tmp, '.radorch', 'projects', 'evil', 'state.json');
  assert.ok(!fs.existsSync(target), 'projects/ must not be touched');
  assert.equal(result.copiedCount, 0);
  assert.equal(result.skippedCount, 1);
});

test('installManifestFiles — ui/ resolves from sharedRoot when provided', () => {
  const sharedRoot = path.join(tmp, 'shared');
  fs.mkdirSync(path.join(sharedRoot, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(sharedRoot, 'ui', 'server.js'), 'ui-body');

  const manifest = {
    files: [{
      bundlePath: 'ui/server.js',
      destinationPath: '${RAD_HOME}/ui/server.js',
    }],
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude', { sharedRoot });
  const target = path.join(tmp, '.radorch', 'ui', 'server.js');
  assert.ok(fs.existsSync(target));
  assert.equal(fs.readFileSync(target, 'utf8'), 'ui-body');
  assert.equal(result.copiedCount, 1);
});

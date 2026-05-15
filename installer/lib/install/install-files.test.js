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

test('installManifestFiles — tier templates install to ${RAD_HOME}/templates/ (not harness skill folder)', () => {
  // Tier templates use bundlePath skills/rad-orchestration/templates/<name>.yml
  // but destinationPath ${RAD_HOME}/templates/<name>.yml — source comes from
  // the plugin root's skills/ subtree, destination is the shared user-data folder.
  const tierNames = ['extra-high', 'high', 'medium', 'low'];
  const templatesDir = path.join(pluginRoot, 'skills', 'rad-orchestration', 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  for (const name of tierNames) {
    fs.writeFileSync(path.join(templatesDir, `${name}.yml`), `template: ${name}`);
  }
  const manifest = {
    files: tierNames.map(name => ({
      bundlePath: `skills/rad-orchestration/templates/${name}.yml`,
      destinationPath: `\${RAD_HOME}/templates/${name}.yml`,
    })),
  };
  const result = installManifestFiles(manifest, pluginRoot, 'claude');
  assert.equal(result.copiedCount, tierNames.length);
  for (const name of tierNames) {
    const target = path.join(tmp, '.radorch', 'templates', `${name}.yml`);
    assert.ok(fs.existsSync(target), `${name}.yml must be in ~/.radorch/templates/`);
    assert.equal(fs.readFileSync(target, 'utf8'), `template: ${name}`);
    // Must NOT be in the harness skill folder
    const wrongTarget = path.join(tmp, '.claude', 'skills', 'rad-orchestration', 'templates', `${name}.yml`);
    assert.ok(!fs.existsSync(wrongTarget), `${name}.yml must NOT be in harness skill folder`);
  }
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

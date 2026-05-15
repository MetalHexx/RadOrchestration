import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeManifestFiles } from './remove-files.js';

let tmp;
let homeOriginal;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-files-'));
  homeOriginal = os.homedir;
  os.homedir = () => tmp;
});

afterEach(() => {
  os.homedir = homeOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('removeManifestFiles — deletes file at resolved destinationPath', () => {
  const target = path.join(tmp, '.claude', 'agents', 'planner.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'body');

  const manifest = {
    files: [{
      bundlePath: 'agents/planner.md',
      destinationPath: '${HARNESS_ROOT}/agents/planner.md',
    }],
  };
  const result = removeManifestFiles(manifest, 'claude');
  assert.ok(!fs.existsSync(target));
  assert.equal(result.removedCount, 1);
});

test('removeManifestFiles — idempotent: missing file is a no-op', () => {
  const manifest = {
    files: [{
      bundlePath: 'agents/missing.md',
      destinationPath: '${HARNESS_ROOT}/agents/missing.md',
    }],
  };
  const result = removeManifestFiles(manifest, 'claude');
  assert.equal(result.removedCount, 0);
});

test('removeManifestFiles — AD-7: never deletes under projects/', () => {
  const projectFile = path.join(tmp, '.radorch', 'projects', 'mine', 'state.json');
  fs.mkdirSync(path.dirname(projectFile), { recursive: true });
  fs.writeFileSync(projectFile, '{"sacred":true}');

  const manifest = {
    files: [{
      bundlePath: 'projects/mine/state.json',
      destinationPath: '${RAD_HOME}/projects/mine/state.json',
    }],
  };
  const result = removeManifestFiles(manifest, 'claude');
  assert.ok(fs.existsSync(projectFile), 'projects/ files must survive');
  assert.equal(result.removedCount, 0);
});

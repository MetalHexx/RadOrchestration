// harness-dogfood/remove-files.test.mjs — In-folder dogfood library coverage
// mirroring the dogfood-relevant code paths previously covered by
// installer/lib/install/remove-files.test.js (NFR-3).

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeManifestFiles } from './remove-files.js';

let tmp;
let homeOriginal;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-remove-'));
  homeOriginal = os.homedir;
  os.homedir = () => tmp;
});

afterEach(() => {
  os.homedir = homeOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('removeManifestFiles — deletes file at resolved destinationPath (~/.claude/)', () => {
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

test('removeManifestFiles — deletes file under ~/.copilot/ for copilot-vscode', () => {
  const target = path.join(tmp, '.copilot', 'agents', 'planner.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'body');

  const manifest = {
    files: [{
      bundlePath: 'agents/planner.md',
      destinationPath: '${HARNESS_ROOT}/agents/planner.md',
    }],
  };
  const result = removeManifestFiles(manifest, 'copilot-vscode');
  assert.ok(!fs.existsSync(target));
  assert.equal(result.removedCount, 1);
});

test('removeManifestFiles — deletes ~/.radorch/templates/ entry', () => {
  const target = path.join(tmp, '.radorch', 'templates', 'high.yml');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'template-body');

  const manifest = {
    files: [{
      bundlePath: 'templates/high.yml',
      destinationPath: '${RAD_HOME}/templates/high.yml',
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

test('removeManifestFiles — prunes emptied parent dirs but does not cross above ~/.radorch/ or harness root', () => {
  // Create a deeply nested file under ~/.claude/skills/rad-plan/refs/guide.md
  // and a sibling untouched file in ~/.claude/skills/rad-other/SKILL.md.
  // Removing rad-plan should prune rad-plan/refs and rad-plan, but leave
  // ~/.claude/skills/ (still has rad-other) and ~/.claude/ alone.
  const planFile = path.join(tmp, '.claude', 'skills', 'rad-plan', 'refs', 'guide.md');
  const otherFile = path.join(tmp, '.claude', 'skills', 'rad-other', 'SKILL.md');
  fs.mkdirSync(path.dirname(planFile), { recursive: true });
  fs.mkdirSync(path.dirname(otherFile), { recursive: true });
  fs.writeFileSync(planFile, 'g');
  fs.writeFileSync(otherFile, 's');

  const manifest = {
    files: [{
      bundlePath: 'skills/rad-plan/refs/guide.md',
      destinationPath: '${HARNESS_ROOT}/skills/rad-plan/refs/guide.md',
    }],
  };
  const result = removeManifestFiles(manifest, 'claude');
  assert.ok(!fs.existsSync(planFile), 'target file should be removed');
  assert.equal(result.removedCount, 1);
  // rad-plan/refs should be pruned (was emptied)
  assert.ok(!fs.existsSync(path.join(tmp, '.claude', 'skills', 'rad-plan', 'refs')),
    'emptied refs/ should be pruned');
  // rad-plan should be pruned (was emptied after refs/ pruned)
  assert.ok(!fs.existsSync(path.join(tmp, '.claude', 'skills', 'rad-plan')),
    'emptied rad-plan/ should be pruned');
  // ~/.claude/skills/ should survive (still contains rad-other)
  assert.ok(fs.existsSync(path.join(tmp, '.claude', 'skills')),
    'skills/ should survive (still has rad-other)');
  // ~/.claude/ should survive
  assert.ok(fs.existsSync(path.join(tmp, '.claude')),
    'harness root should survive');
});

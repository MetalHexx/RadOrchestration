import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeBaseFiles } from './base-files.js';

test('writeBaseFiles emits config.yml, registry.yml, .harness, .gitignore', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'base-'));
  writeBaseFiles(root, 'claude');

  const config = fs.readFileSync(path.join(root, 'config.yml'), 'utf8');
  assert.match(config, /default_active_harness:\s*claude/);

  const registry = fs.readFileSync(path.join(root, 'registry.yml'), 'utf8');
  assert.match(registry, /repos:\s*\[\]/);
  assert.match(registry, /workspaces:\s*\[\]/);

  const harness = fs.readFileSync(path.join(root, '.harness'), 'utf8');
  assert.equal(harness, 'claude\n');

  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /projects\//);
  assert.match(gitignore, /config\.yml/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeBaseFiles is idempotent — second call overwrites', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'base-'));
  writeBaseFiles(root, 'claude');
  writeBaseFiles(root, 'copilot-vscode');

  const harness = fs.readFileSync(path.join(root, '.harness'), 'utf8');
  assert.equal(harness, 'copilot-vscode\n');

  fs.rmSync(root, { recursive: true, force: true });
});

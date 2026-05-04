// installer/lib/manifest.test.js — Tests for manifest.js (harness-aware).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getManifest } from './manifest.js';

test('getManifest returns object with categories array and globalExcludes array', () => {
  const manifest = getManifest('.claude', 'claude-code');
  assert.ok(manifest !== null && typeof manifest === 'object');
  assert.ok(Array.isArray(manifest.categories));
  assert.ok(Array.isArray(manifest.globalExcludes));
});

test('getManifest returns exactly 3 categories', () => {
  const { categories } = getManifest('.claude', 'claude-code');
  assert.strictEqual(categories.length, 3);
});

test('claude-code tool resolves sourceDir to src/claude/...', () => {
  const { categories } = getManifest('.claude', 'claude-code');
  assert.strictEqual(categories[0].sourceDir, 'src/claude');
  assert.strictEqual(categories[1].sourceDir, 'src/claude/agents');
  assert.strictEqual(categories[2].sourceDir, 'src/claude/skills');
});

test('copilot-vscode tool resolves sourceDir to src/copilot-vscode/...', () => {
  const { categories } = getManifest('.github', 'copilot-vscode');
  assert.strictEqual(categories[0].sourceDir, 'src/copilot-vscode');
  assert.strictEqual(categories[1].sourceDir, 'src/copilot-vscode/agents');
  assert.strictEqual(categories[2].sourceDir, 'src/copilot-vscode/skills');
});

test('copilot-cli tool resolves sourceDir to src/copilot-cli/...', () => {
  const { categories } = getManifest('.github', 'copilot-cli');
  assert.strictEqual(categories[0].sourceDir, 'src/copilot-cli');
  assert.strictEqual(categories[1].sourceDir, 'src/copilot-cli/agents');
  assert.strictEqual(categories[2].sourceDir, 'src/copilot-cli/skills');
});

test('targetDir resolves to root (".") for root-config category, "agents"/"skills" for the others', () => {
  const { categories } = getManifest('.claude', 'claude-code');
  assert.strictEqual(categories[0].targetDir, '.');
  assert.strictEqual(categories[1].targetDir, 'agents');
  assert.strictEqual(categories[2].targetDir, 'skills');
});

test('globalExcludes matches expected array', () => {
  const { globalExcludes } = getManifest('.claude', 'claude-code');
  assert.deepStrictEqual(globalExcludes, [
    'node_modules',
    '.next',
    '.env.local',
    'package-lock.json',
  ]);
});

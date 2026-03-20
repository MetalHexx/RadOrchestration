// installer/lib/config-generator.test.js — Tests for config-generator.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateConfig, writeConfig } from './config-generator.js';

/** @type {import('./types.js').InstallerConfig} */
const sampleConfig = {
  tool: 'copilot',
  workspaceDir: '/workspace',
  orchRoot: '.github',
  projectsBasePath: '../orchestration-projects',
  projectsNaming: 'SCREAMING_CASE',
  maxPhases: 6,
  maxTasksPerPhase: 10,
  maxRetriesPerTask: 2,
  maxConsecutiveReviewRejections: 3,
  executionMode: 'ask',
  installUi: false,
  skipConfirmation: false,
};

// ── generateConfig ────────────────────────────────────────────────────────────

test('generateConfig - returns a string containing version: "1.0"', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(typeof yaml === 'string');
  assert.ok(yaml.includes('version: "1.0"'));
});

test('generateConfig - output contains system: section with orch_root from config', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(yaml.includes('system:'));
  assert.ok(yaml.includes(`orch_root: "${sampleConfig.orchRoot}"`));
});

test('generateConfig - output contains projects: section with base_path and naming from config', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(yaml.includes('projects:'));
  assert.ok(yaml.includes(`base_path: "${sampleConfig.projectsBasePath}"`));
  assert.ok(yaml.includes(`naming: "${sampleConfig.projectsNaming}"`));
});

test('generateConfig - output contains limits: section with all 4 keys', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(yaml.includes('limits:'));
  assert.ok(yaml.includes(`max_phases: ${sampleConfig.maxPhases}`));
  assert.ok(yaml.includes(`max_tasks_per_phase: ${sampleConfig.maxTasksPerPhase}`));
  assert.ok(yaml.includes(`max_retries_per_task: ${sampleConfig.maxRetriesPerTask}`));
  assert.ok(yaml.includes(`max_consecutive_review_rejections: ${sampleConfig.maxConsecutiveReviewRejections}`));
});

test('generateConfig - output contains human_gates: section with all 3 keys', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(yaml.includes('human_gates:'));
  assert.ok(yaml.includes('after_planning: true'));
  assert.ok(yaml.includes(`execution_mode: "${sampleConfig.executionMode}"`));
  assert.ok(yaml.includes('after_final_review: true'));
});

test('generateConfig - output does NOT contain errors: or git: sections', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(!yaml.includes('errors:'));
  assert.ok(!yaml.includes('git:'));
});

test('generateConfig - output contains inline comments', () => {
  const yaml = generateConfig(sampleConfig);
  // Count lines containing # comment (exclude header lines to only count inline ones)
  const lines = yaml.split('\n');
  const commentLines = lines.filter(l => l.includes('#'));
  assert.ok(commentLines.length > 5, 'Should have several comment lines');
});

test('generateConfig - output contains section header comments with ─── pattern', () => {
  const yaml = generateConfig(sampleConfig);
  assert.ok(yaml.includes('─── '));
});

// ── writeConfig ───────────────────────────────────────────────────────────────

test('writeConfig - creates intermediate directories when they do not exist', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-'));
  try {
    const orchRoot = path.join(tmpDir, 'deep', 'orch');
    writeConfig(tmpDir, orchRoot, 'test: true\n');
    const expectedDir = path.join(orchRoot, 'skills', 'orchestration', 'config');
    assert.ok(fs.existsSync(expectedDir));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writeConfig - writes file to {resolvedOrchRoot}/skills/orchestration/config/orchestration.yml', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-'));
  try {
    const orchRoot = path.join(tmpDir, 'orch');
    const yamlContent = 'version: "1.0"\n';
    writeConfig(tmpDir, orchRoot, yamlContent);
    const expectedPath = path.join(orchRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
    assert.ok(fs.existsSync(expectedPath));
    assert.strictEqual(fs.readFileSync(expectedPath, 'utf8'), yamlContent);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writeConfig - resolves relative orchRoot against workspaceDir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-'));
  try {
    const relativeOrchRoot = '.github';
    writeConfig(tmpDir, relativeOrchRoot, 'test: true\n');
    const expectedPath = path.join(tmpDir, relativeOrchRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
    assert.ok(fs.existsSync(expectedPath));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writeConfig - uses absolute orchRoot directly when path.isAbsolute() is true', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-'));
  try {
    // orchRoot is already absolute — workspaceDir should not be prepended
    const absoluteOrchRoot = path.join(tmpDir, 'absolute-orch');
    const differentWorkspace = path.join(os.tmpdir(), 'some-other-workspace');
    writeConfig(differentWorkspace, absoluteOrchRoot, 'test: true\n');
    const expectedPath = path.join(absoluteOrchRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
    assert.ok(fs.existsSync(expectedPath));
    // Ensure it did NOT write under differentWorkspace
    const wrongPath = path.join(differentWorkspace, absoluteOrchRoot, 'skills', 'orchestration', 'config', 'orchestration.yml');
    assert.ok(!fs.existsSync(wrongPath));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

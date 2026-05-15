// installer/lib/config-generator.test.js — Tests for config-generator.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateConfig, writeConfig } from './config-generator.js';

// generateConfig now emits canonical defaults unconditionally (FR-16).
// Only packageVersion is read from the input; all other properties are fixed.
const PACKAGE_VERSION = '1.1.0';

// ── generateConfig ────────────────────────────────────────────────────────────

test('generateConfig - returns a string containing version: "1.0"', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(typeof yaml === 'string');
  assert.ok(yaml.includes('version: "1.0"'));
});

test('generateConfig - output contains package_version from config', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(yaml.includes(`package_version: ${PACKAGE_VERSION}`));
});

test('generateConfig - output contains canonical default_template: ask', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(yaml.includes('default_template: ask'));
});

test('generateConfig - output contains limits: section with canonical values', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(yaml.includes('limits:'));
  assert.ok(yaml.includes('max_phases: 10'));
  assert.ok(yaml.includes('max_tasks_per_phase: 8'));
  assert.ok(yaml.includes('max_retries_per_task: 5'));
  assert.ok(yaml.includes('max_consecutive_review_rejections: 3'));
});

test('generateConfig - output contains human_gates: section with canonical values', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(yaml.includes('human_gates:'));
  assert.ok(yaml.includes('after_planning: true'));
  assert.ok(yaml.includes('execution_mode: "ask"'));
  assert.ok(yaml.includes('after_final_review: true'));
});

test('generateConfig - output contains source_control: section with canonical values', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(yaml.includes('source_control:'));
  assert.ok(yaml.includes('auto_commit: "ask"'));
  assert.ok(yaml.includes('auto_pr: "ask"'));
});

test('generateConfig - source_control block appears after human_gates', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  const humanGatesIndex = yaml.indexOf('human_gates:');
  const sourceControlIndex = yaml.indexOf('source_control:');
  assert.ok(sourceControlIndex > humanGatesIndex, 'source_control should appear after human_gates');
});

test('generateConfig - output does NOT contain system or projects or provider', () => {
  const yaml = generateConfig({ packageVersion: PACKAGE_VERSION });
  assert.ok(!yaml.includes('system:'));
  assert.ok(!yaml.includes('projects:'));
  assert.ok(!yaml.includes('provider:'));
});

// ── writeConfig ───────────────────────────────────────────────────────────────

test('writeConfig - creates ~/.radorch directory if it does not exist', () => {
  const origHome = process.env.HOME || process.env.USERPROFILE;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-home-'));

  try {
    // Temporarily override home directory for this test
    const oldHome = process.env.HOME || process.env.USERPROFILE;
    if (process.platform === 'win32') {
      process.env.USERPROFILE = tmpHome;
    } else {
      process.env.HOME = tmpHome;
    }

    const yamlContent = 'version: "1.0"\n';
    writeConfig(yamlContent);

    const expectedDir = path.join(tmpHome, '.radorch');
    assert.ok(fs.existsSync(expectedDir));
  } finally {
    // Restore original home directory
    if (process.platform === 'win32') {
      process.env.USERPROFILE = origHome;
    } else {
      process.env.HOME = origHome;
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('writeConfig - writes file to ~/.radorch/orchestration.yml', () => {
  const origHome = process.env.HOME || process.env.USERPROFILE;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'config-gen-test-home-'));

  try {
    // Temporarily override home directory for this test
    const oldHome = process.env.HOME || process.env.USERPROFILE;
    if (process.platform === 'win32') {
      process.env.USERPROFILE = tmpHome;
    } else {
      process.env.HOME = tmpHome;
    }

    const yamlContent = 'version: "1.0"\npackage_version: 1.0.0\n';
    writeConfig(yamlContent);

    const expectedPath = path.join(tmpHome, '.radorch', 'orchestration.yml');
    assert.ok(fs.existsSync(expectedPath));
    assert.strictEqual(fs.readFileSync(expectedPath, 'utf8'), yamlContent);
  } finally {
    // Restore original home directory
    if (process.platform === 'win32') {
      process.env.USERPROFILE = origHome;
    } else {
      process.env.HOME = origHome;
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('generateConfig emits the canonical 10 properties unconditionally (FR-16)', () => {
  const yaml = generateConfig({ packageVersion: '9.9.9' });
  assert.match(yaml, /^version: "1\.0"$/m);
  assert.match(yaml, /^package_version: 9\.9\.9$/m);
  assert.match(yaml, /^default_template: ask$/m);
  assert.match(yaml, /^  max_phases: 10$/m);
  assert.match(yaml, /^  max_tasks_per_phase: 8$/m);
  assert.match(yaml, /^  max_retries_per_task: 5$/m);
  assert.match(yaml, /^  max_consecutive_review_rejections: 3$/m);
  assert.match(yaml, /^  after_planning: true$/m);
  assert.match(yaml, /^  execution_mode: "ask"$/m);
  assert.match(yaml, /^  after_final_review: true$/m);
  assert.match(yaml, /^  auto_commit: "ask"$/m);
  assert.match(yaml, /^  auto_pr: "ask"$/m);
});

test('generateConfig emits the ten canonical keys only', () => {
  const yaml = generateConfig({
    packageVersion: '1.1.0',
    defaultTemplate: 'ask',
    maxPhases: 10, maxTasksPerPhase: 8, maxRetriesPerTask: 5,
    maxConsecutiveReviewRejections: 3,
    afterPlanning: true, executionMode: 'ask', afterFinalReview: true,
    autoCommit: 'ask', autoPr: 'ask',
  });
  assert.match(yaml, /^version: "1\.0"$/m);
  assert.match(yaml, /^package_version: 1\.1\.0$/m);
  assert.match(yaml, /^default_template: ask$/m);
  assert.match(yaml, /^limits:$/m);
  assert.match(yaml, /^  max_phases: 10$/m);
  // Four retired keys absent:
  assert.doesNotMatch(yaml, /orch_root/);
  assert.doesNotMatch(yaml, /base_path/);
  assert.doesNotMatch(yaml, /naming:/);
  assert.doesNotMatch(yaml, /^\s*provider:/m);
});

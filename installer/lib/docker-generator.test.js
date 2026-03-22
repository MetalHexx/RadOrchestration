// installer/lib/docker-generator.test.js — Tests for docker-generator.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDockerCompose } from './docker-generator.js';

// ── Shared test options ──────────────────────────────────────────────────────

const UNIX_OPTS = {
  uiDir: '/home/user/project/ui',
  workspaceDir: '/home/user/project',
  orchRoot: '.github',
  projectsDir: '/home/user/project/orchestration-projects',
};

const WINDOWS_OPTS = {
  uiDir: 'C:\\dev\\myproject\\ui',
  workspaceDir: 'C:\\dev\\myproject',
  orchRoot: '.github',
  projectsDir: 'C:\\dev\\orchestration-projects',
};

// ── Output structure ─────────────────────────────────────────────────────────

test('generateDockerCompose - output starts with name: RadOrchestration', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.startsWith('name: RadOrchestration'));
});

test('generateDockerCompose - output contains "services:" as top-level key', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('services:'));
});

test('generateDockerCompose - output contains service name radorch-ui', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('radorch-ui'));
});

test('generateDockerCompose - output contains image: node:20-alpine', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('image: node:20-alpine'));
});

test('generateDockerCompose - output contains working_dir: /app', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('working_dir: /app'));
});

test('generateDockerCompose - output contains port mapping "3000:3000"', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('"3000:3000"'));
});

test('generateDockerCompose - output contains WORKSPACE_ROOT=/workspace in environment', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('WORKSPACE_ROOT=/workspace'));
});

test('generateDockerCompose - output contains ORCH_ROOT set to provided orchRoot', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('ORCH_ROOT=.github'));
});

test('generateDockerCompose - output contains command: sh -c "npm start"', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('command: sh -c "npm start"'));
});

// ── Volume mounts (Unix paths — pass through unchanged) ──────────────────────

test('generateDockerCompose - Unix paths: volume mount for UI dir maps to :/app', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('/home/user/project/ui:/app'));
});

test('generateDockerCompose - Unix paths: volume mount for workspace dir maps to :/workspace', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('/home/user/project:/workspace'));
});

test('generateDockerCompose - Unix paths: paths are unchanged in volume mounts', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('/home/user/project/ui:/app'));
  assert.ok(result.includes('/home/user/project:/workspace'));
});

// ── Volume mounts (Windows paths — must be converted) ───────────────────────

test('generateDockerCompose - Windows paths: converted to Docker format in volume mounts', () => {
  const result = generateDockerCompose(WINDOWS_OPTS);
  assert.ok(result.includes('/c/dev/myproject/ui:/app'));
  assert.ok(result.includes('/c/dev/myproject:/workspace'));
});

test('generateDockerCompose - Windows paths: UI dir volume mount maps to :/app', () => {
  const result = generateDockerCompose(WINDOWS_OPTS);
  assert.ok(result.includes('/c/dev/myproject/ui:/app'));
});

test('generateDockerCompose - Windows paths: workspace dir volume mount maps to :/workspace', () => {
  const result = generateDockerCompose(WINDOWS_OPTS);
  assert.ok(result.includes('/c/dev/myproject:/workspace'));
});

// ── Output ends with trailing newline ────────────────────────────────────────

test('generateDockerCompose - output ends with trailing newline', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.endsWith('\n'));
});

// ── Custom orchRoot value ────────────────────────────────────────────────────

test('generateDockerCompose - ORCH_ROOT reflects provided orchRoot value', () => {
  const result = generateDockerCompose({ ...UNIX_OPTS, orchRoot: 'custom-orch' });
  assert.ok(result.includes('ORCH_ROOT=custom-orch'));
});

// ── Projects volume mount ────────────────────────────────────────────────────

test('generateDockerCompose - output contains volume mount for projectsDir mapping to :/projects', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('/home/user/project/orchestration-projects:/projects'));
});

test('generateDockerCompose - output contains PROJECTS_DIR=/projects in environment', () => {
  const result = generateDockerCompose(UNIX_OPTS);
  assert.ok(result.includes('PROJECTS_DIR=/projects'));
});

test('generateDockerCompose - Unix projectsDir paths pass through unchanged in volume mount', () => {
  const result = generateDockerCompose({
    ...UNIX_OPTS,
    projectsDir: '/data/shared/projects',
  });
  assert.ok(result.includes('/data/shared/projects:/projects'));
});

test('generateDockerCompose - Windows projectsDir paths are converted via toDockerPath', () => {
  const result = generateDockerCompose(WINDOWS_OPTS);
  assert.ok(result.includes('/c/dev/orchestration-projects:/projects'));
});

test('generateDockerCompose - projectsDir inside workspaceDir still gets its own mount', () => {
  const result = generateDockerCompose({
    ...UNIX_OPTS,
    projectsDir: '/home/user/project/projects',
  });
  assert.ok(result.includes('/home/user/project/projects:/projects'));
  assert.ok(result.includes('/home/user/project:/workspace'));
});

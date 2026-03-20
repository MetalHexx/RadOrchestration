// installer/lib/docker-generator.test.js — Tests for docker-generator.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDockerCompose } from './docker-generator.js';

// ── Output structure ─────────────────────────────────────────────────────────

test('generateDockerCompose - output contains "services:" as top-level key', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.startsWith('services:'));
});

test('generateDockerCompose - output contains service name radorch-ui', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('radorch-ui'));
});

test('generateDockerCompose - output contains image: node:20-alpine', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('image: node:20-alpine'));
});

test('generateDockerCompose - output contains working_dir: /app', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('working_dir: /app'));
});

test('generateDockerCompose - output contains port mapping "3000:3000"', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('"3000:3000"'));
});

test('generateDockerCompose - output contains WORKSPACE_ROOT=/workspace in environment', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('WORKSPACE_ROOT=/workspace'));
});

test('generateDockerCompose - output contains ORCH_ROOT set to provided orchRoot', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('ORCH_ROOT=.github'));
});

test('generateDockerCompose - output contains command: sh -c "npm start"', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('command: sh -c "npm start"'));
});

// ── Volume mounts (Unix paths — pass through unchanged) ──────────────────────

test('generateDockerCompose - Unix paths: volume mount for UI dir maps to :/app', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/home/user/project/ui:/app'));
});

test('generateDockerCompose - Unix paths: volume mount for workspace dir maps to :/workspace', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/home/user/project:/workspace'));
});

test('generateDockerCompose - Unix paths: paths are unchanged in volume mounts', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/home/user/project/ui:/app'));
  assert.ok(result.includes('/home/user/project:/workspace'));
});

// ── Volume mounts (Windows paths — must be converted) ───────────────────────

test('generateDockerCompose - Windows paths: converted to Docker format in volume mounts', () => {
  const result = generateDockerCompose({
    uiDir: 'C:\\dev\\myproject\\ui',
    workspaceDir: 'C:\\dev\\myproject',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/c/dev/myproject/ui:/app'));
  assert.ok(result.includes('/c/dev/myproject:/workspace'));
});

test('generateDockerCompose - Windows paths: UI dir volume mount maps to :/app', () => {
  const result = generateDockerCompose({
    uiDir: 'C:\\dev\\myproject\\ui',
    workspaceDir: 'C:\\dev\\myproject',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/c/dev/myproject/ui:/app'));
});

test('generateDockerCompose - Windows paths: workspace dir volume mount maps to :/workspace', () => {
  const result = generateDockerCompose({
    uiDir: 'C:\\dev\\myproject\\ui',
    workspaceDir: 'C:\\dev\\myproject',
    orchRoot: '.github',
  });
  assert.ok(result.includes('/c/dev/myproject:/workspace'));
});

// ── Output ends with trailing newline ────────────────────────────────────────

test('generateDockerCompose - output ends with trailing newline', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: '.github',
  });
  assert.ok(result.endsWith('\n'));
});

// ── Custom orchRoot value ────────────────────────────────────────────────────

test('generateDockerCompose - ORCH_ROOT reflects provided orchRoot value', () => {
  const result = generateDockerCompose({
    uiDir: '/home/user/project/ui',
    workspaceDir: '/home/user/project',
    orchRoot: 'custom-orch',
  });
  assert.ok(result.includes('ORCH_ROOT=custom-orch'));
});

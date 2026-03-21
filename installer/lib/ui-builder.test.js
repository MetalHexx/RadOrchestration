// installer/lib/ui-builder.test.js — Tests for ui-builder.js
//
// Strategy: mock.module() is used for modules with named imports (node:child_process,
// ora, env-generator, docker-generator) loaded via dynamic import after mock registration.
// mock.method() is used for node:fs (default import — shared object reference).
// All mocks are registered before the dynamic import of ui-builder.js.

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const expectedNpmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// ── Mutable test state ────────────────────────────────────────────────────────

const state = {
  execFileSyncThrowsFor: null,  // null | 'node' | 'npm'
  spawnResults: [],              // queue: [{ exitCode?, stderr?, error? }, ...]
  cpSyncThrows: null,            // Error to throw from cpSync
};

function resetState() {
  state.execFileSyncThrowsFor = null;
  state.spawnResults = [];
  state.cpSyncThrows = null;
}

// ── Call-order tracking ───────────────────────────────────────────────────────

const callOrder = [];

// ── Persistent mock functions ─────────────────────────────────────────────────

const execFileSyncMock = mock.fn((cmd, _args, _opts) => {
  if (state.execFileSyncThrowsFor === cmd) {
    throw new Error(`${cmd}: command not found`);
  }
});

const spawnMock = mock.fn((cmd, args, _opts) => {
  callOrder.push(`spawn:${args.join(' ')}`);
  const { exitCode = 0, stderr = '', error = null } = state.spawnResults.shift() ?? {};
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (error) {
      child.emit('error', error);
    } else {
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode);
    }
  });
  return child;
});

const mkdirSyncMock = mock.fn(() => { callOrder.push('mkdirSync'); });

const cpSyncMock = mock.fn((src, _dest, opts) => {
  callOrder.push('cpSync');
  if (state.cpSyncThrows) throw state.cpSyncThrows;
  // Invoke filter with a fake file path so fileCount gets incremented
  if (opts && typeof opts.filter === 'function') {
    opts.filter(path.join(src, 'package.json'), path.join(_dest, 'package.json'));
  }
});

const writeFileSyncMock = mock.fn((_p) => { callOrder.push('writeFileSync'); });

const statSyncMock = mock.fn(() => ({ isFile: () => true }));

const spinnerInstances = [];
const oraMock = mock.fn((opts) => {
  const spinner = {
    text: opts ? (opts.text || '') : '',
    start: mock.fn(function () { return this; }),
    succeed: mock.fn(),
    fail: mock.fn(),
  };
  spinnerInstances.push(spinner);
  return spinner;
});

const generateEnvLocalMock = mock.fn(
  () => 'WORKSPACE_ROOT=/workspace\nORCH_ROOT=.github\n'
);

const generateDockerComposeMock = mock.fn(
  () => 'services:\n  radorch-ui:\n    image: node:20-alpine\n'
);

// ── Patch node:fs methods (default import — shared object) ────────────────────

mock.method(fs, 'mkdirSync', mkdirSyncMock);
mock.method(fs, 'cpSync', cpSyncMock);
mock.method(fs, 'writeFileSync', writeFileSyncMock);
mock.method(fs, 'statSync', statSyncMock);

// ── Register module mocks before importing ui-builder.js ─────────────────────

await mock.module('node:child_process', {
  namedExports: { execFileSync: execFileSyncMock, spawn: spawnMock },
});
await mock.module('ora', { defaultExport: oraMock });
await mock.module('./env-generator.js', {
  namedExports: { generateEnvLocal: generateEnvLocalMock },
});
await mock.module('./docker-generator.js', {
  namedExports: { generateDockerCompose: generateDockerComposeMock },
});

// ── Import module under test ──────────────────────────────────────────────────

const { checkNodeNpm, installUi } = await import('./ui-builder.js');

// ── Reset helper ──────────────────────────────────────────────────────────────

const ALL_MOCKS = [
  execFileSyncMock, spawnMock, mkdirSyncMock, cpSyncMock, writeFileSyncMock,
  statSyncMock, oraMock, generateEnvLocalMock, generateDockerComposeMock,
];

function resetMocks() {
  ALL_MOCKS.forEach((m) => m.mock.resetCalls());
  spinnerInstances.length = 0;
  callOrder.length = 0;
  resetState();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_OPTS = {
  repoRoot: '/repo',
  uiDir: '/target/ui',
  workspaceDir: '/workspace',
  orchRoot: '.github',
};

// ── checkNodeNpm() ────────────────────────────────────────────────────────────

test('checkNodeNpm - returns { available: true } when both node and npm succeed', () => {
  resetMocks();
  const result = checkNodeNpm();
  assert.deepEqual(result, { available: true });
  assert.equal(execFileSyncMock.mock.callCount(), 2);
});

test('checkNodeNpm - returns { available: false, error } when node --version throws', () => {
  resetMocks();
  state.execFileSyncThrowsFor = 'node';
  const result = checkNodeNpm();
  assert.equal(result.available, false);
  assert.ok(typeof result.error === 'string' && result.error.length > 0);
});

test('checkNodeNpm - returns { available: false, error } when npm --version throws', () => {
  resetMocks();
  state.execFileSyncThrowsFor = expectedNpmCmd;
  const result = checkNodeNpm();
  assert.equal(result.available, false);
  assert.ok(typeof result.error === 'string' && result.error.length > 0);
});

test('checkNodeNpm - execFileSync called with node --version using stdio: pipe', () => {
  resetMocks();
  checkNodeNpm();
  const nodecall = execFileSyncMock.mock.calls[0];
  assert.equal(nodecall.arguments[0], 'node');
  assert.deepEqual(nodecall.arguments[1], ['--version']);
  assert.deepEqual(nodecall.arguments[2], { stdio: 'pipe' });
});

test('checkNodeNpm - execFileSync called with npm --version using stdio: pipe', () => {
  resetMocks();
  checkNodeNpm();
  const npmCall = execFileSyncMock.mock.calls[1];
  assert.equal(npmCall.arguments[0], expectedNpmCmd);
  assert.deepEqual(npmCall.arguments[1], ['--version']);
  assert.deepEqual(npmCall.arguments[2], { stdio: 'pipe' });
});

// ── installUi() — fs.mkdirSync ────────────────────────────────────────────────

test('installUi - calls fs.mkdirSync with uiDir and { recursive: true }', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  assert.ok(mkdirSyncMock.mock.callCount() >= 1);
  const [dir, opts] = mkdirSyncMock.mock.calls[0].arguments;
  assert.equal(dir, DEFAULT_OPTS.uiDir);
  assert.deepEqual(opts, { recursive: true });
});

// ── installUi() — cpSync filter ───────────────────────────────────────────────

test('installUi - cpSync filter excludes node_modules', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const { filter } = cpSyncMock.mock.calls[0].arguments[2];
  assert.equal(filter('/repo/ui/node_modules', '/ui/node_modules'), false);
});

test('installUi - cpSync filter excludes .next', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const { filter } = cpSyncMock.mock.calls[0].arguments[2];
  assert.equal(filter('/repo/ui/.next', '/ui/.next'), false);
});

test('installUi - cpSync filter excludes .env.local', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const { filter } = cpSyncMock.mock.calls[0].arguments[2];
  assert.equal(filter('/repo/ui/.env.local', '/ui/.env.local'), false);
});

test('installUi - cpSync filter excludes .env', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const { filter } = cpSyncMock.mock.calls[0].arguments[2];
  assert.equal(filter('/repo/ui/.env', '/ui/.env'), false);
});

test('installUi - cpSync filter allows non-excluded paths', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const { filter } = cpSyncMock.mock.calls[0].arguments[2];
  assert.equal(filter('/repo/ui/package.json', '/ui/package.json'), true);
  assert.equal(filter('/repo/ui/app', '/ui/app'), true);
  assert.equal(filter('/repo/ui/components', '/ui/components'), true);
});

// ── installUi() — .env.local written before npm commands ─────────────────────

test('installUi - writes .env.local content from generateEnvLocal() before running npm', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  assert.equal(generateEnvLocalMock.mock.callCount(), 1);
  // Verify .env.local was written with the content from generateEnvLocal
  const envWrite = writeFileSyncMock.mock.calls.find((c) =>
    String(c.arguments[0]).endsWith('.env.local')
  );
  assert.ok(envWrite, '.env.local was written');
  assert.equal(envWrite.arguments[1], 'WORKSPACE_ROOT=/workspace\nORCH_ROOT=.github\n');
  // .env.local written before first spawn
  const envWriteIdx = callOrder.indexOf('writeFileSync');
  const spawnIdx = callOrder.findIndex((e) => e.startsWith('spawn:'));
  assert.ok(envWriteIdx < spawnIdx, `.env.local (index ${envWriteIdx}) written before first spawn (index ${spawnIdx})`);
});

// ── installUi() — npm install spawn args ─────────────────────────────────────

test('installUi - spawns npm install with args [\'install\'] and cwd=uiDir', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const installCall = spawnMock.mock.calls[0];
  assert.equal(installCall.arguments[0], expectedNpmCmd);
  assert.deepEqual(installCall.arguments[1], ['install']);
  assert.equal(installCall.arguments[2].cwd, DEFAULT_OPTS.uiDir);
});

test('installUi - npm install spawn does not use shell: true', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const opts = spawnMock.mock.calls[0].arguments[2];
  assert.ok(!opts.shell, 'shell must not be true');
});

test('installUi - npm install spawn uses stdio: pipe', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const opts = spawnMock.mock.calls[0].arguments[2];
  assert.equal(opts.stdio, 'pipe');
});

// ── installUi() — npm run build spawn args ────────────────────────────────────

test('installUi - spawns npm run build with args [\'run\', \'build\'] and cwd=uiDir', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const buildCall = spawnMock.mock.calls[1];
  assert.equal(buildCall.arguments[0], expectedNpmCmd);
  assert.deepEqual(buildCall.arguments[1], ['run', 'build']);
  assert.equal(buildCall.arguments[2].cwd, DEFAULT_OPTS.uiDir);
});

test('installUi - npm run build spawn does not use shell: true', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const opts = spawnMock.mock.calls[1].arguments[2];
  assert.ok(!opts.shell, 'shell must not be true');
});

test('installUi - npm run build spawn uses stdio: pipe', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const opts = spawnMock.mock.calls[1].arguments[2];
  assert.equal(opts.stdio, 'pipe');
});

// ── installUi() — ora spinner elapsed time ────────────────────────────────────

test('installUi - creates an ora spinner that updates with elapsed time every second', async (t) => {
  resetMocks();
  t.mock.timers.enable({ apis: ['setInterval'] });

  const promise = installUi(DEFAULT_OPTS);

  // Spinner is created synchronously inside Promise constructor before first await
  assert.ok(spinnerInstances.length >= 1, 'spinner created');
  const firstSpinner = spinnerInstances[0];

  // Tick 1 second — setInterval callback should update spinner.text
  t.mock.timers.tick(1000);
  assert.match(firstSpinner.text, /\(1s\)/, 'spinner text updated with (1s)');

  await promise;
});

// ── installUi() — npm install failure ────────────────────────────────────────

test('installUi - npm install failure: installSuccess=false, error contains message', async () => {
  resetMocks();
  state.spawnResults = [{ exitCode: 1, stderr: 'npm ERR! install failed' }];

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.installSuccess, false);
  assert.ok(result.error.includes('npm ERR! install failed'), 'error contains stderr');
});

test('installUi - npm install failure: error contains manual retry command', async () => {
  resetMocks();
  state.spawnResults = [{ exitCode: 1, stderr: 'ERR' }];

  const result = await installUi(DEFAULT_OPTS);

  assert.ok(result.error.includes('npm install'), 'retry command in error');
  assert.ok(result.error.includes(DEFAULT_OPTS.uiDir), 'uiDir in retry command');
});

test('installUi - npm install failure: function returns without throwing', async () => {
  resetMocks();
  state.spawnResults = [{ exitCode: 1, stderr: 'ERR' }];

  await assert.doesNotReject(() => installUi(DEFAULT_OPTS));
});

test('installUi - npm install failure: copySuccess remains true from prior step', async () => {
  resetMocks();
  state.spawnResults = [{ exitCode: 1, stderr: 'ERR' }];

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.copySuccess, true, 'copy succeeded before install failed');
});

test('installUi - npm install failure: build step is not executed', async () => {
  resetMocks();
  state.spawnResults = [{ exitCode: 1, stderr: 'ERR' }];

  await installUi(DEFAULT_OPTS);

  assert.equal(spawnMock.mock.callCount(), 1, 'only one spawn call (install, no build)');
});

// ── installUi() — npm run build failure ──────────────────────────────────────

test('installUi - npm build failure: buildSuccess=false, error contains message', async () => {
  resetMocks();
  state.spawnResults = [
    { exitCode: 0 },
    { exitCode: 1, stderr: 'build failed: type error' },
  ];

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.buildSuccess, false);
  assert.ok(result.error.includes('build failed: type error'));
});

test('installUi - npm build failure: installSuccess remains true', async () => {
  resetMocks();
  state.spawnResults = [
    { exitCode: 0 },
    { exitCode: 1, stderr: 'ERR' },
  ];

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.installSuccess, true, 'installSuccess=true even when build fails');
});

test('installUi - npm build failure: error contains manual retry command', async () => {
  resetMocks();
  state.spawnResults = [
    { exitCode: 0 },
    { exitCode: 1, stderr: 'ERR' },
  ];

  const result = await installUi(DEFAULT_OPTS);

  assert.ok(result.error.includes('npm run build'), 'retry command in error');
  assert.ok(result.error.includes(DEFAULT_OPTS.uiDir), 'uiDir in retry command');
});

test('installUi - npm build failure: function returns without throwing', async () => {
  resetMocks();
  state.spawnResults = [
    { exitCode: 0 },
    { exitCode: 1, stderr: 'ERR' },
  ];

  await assert.doesNotReject(() => installUi(DEFAULT_OPTS));
});

// ── installUi() — copy failure ────────────────────────────────────────────────

test('installUi - copy failure: copySuccess=false and error is set', async () => {
  resetMocks();
  state.cpSyncThrows = new Error('EACCES: permission denied');

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.copySuccess, false);
  assert.ok(result.error.includes('EACCES'));
});

test('installUi - copy failure: remaining steps are skipped (no writeFileSync)', async () => {
  resetMocks();
  state.cpSyncThrows = new Error('ENOENT: no such file');

  await installUi(DEFAULT_OPTS);

  assert.equal(writeFileSyncMock.mock.callCount(), 0, 'no writeFileSync calls after copy failure');
});

test('installUi - copy failure: remaining steps are skipped (no spawn)', async () => {
  resetMocks();
  state.cpSyncThrows = new Error('ENOENT: no such file');

  await installUi(DEFAULT_OPTS);

  assert.equal(spawnMock.mock.callCount(), 0, 'no spawn calls after copy failure');
});

test('installUi - copy failure: no generateDockerCompose call', async () => {
  resetMocks();
  state.cpSyncThrows = new Error('copy error');

  await installUi(DEFAULT_OPTS);

  assert.equal(generateDockerComposeMock.mock.callCount(), 0);
});

// ── installUi() — full success ────────────────────────────────────────────────

test('installUi - full success: copySuccess, installSuccess, buildSuccess all true', async () => {
  resetMocks();
  const result = await installUi(DEFAULT_OPTS);
  assert.equal(result.copySuccess, true);
  assert.equal(result.installSuccess, true);
  assert.equal(result.buildSuccess, true);
});

test('installUi - full success: fileCount > 0', async () => {
  resetMocks();
  const result = await installUi(DEFAULT_OPTS);
  assert.ok(result.fileCount > 0, `fileCount should be > 0, got ${result.fileCount}`);
});

test('installUi - full success: no error field populated', async () => {
  resetMocks();
  const result = await installUi(DEFAULT_OPTS);
  assert.equal(result.error, undefined);
});

// ── installUi() — docker-compose.yml generation ──────────────────────────────

test('installUi - generateDockerCompose is called with correct options', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  assert.equal(generateDockerComposeMock.mock.callCount(), 1);
  const [opts] = generateDockerComposeMock.mock.calls[0].arguments;
  assert.equal(opts.uiDir, DEFAULT_OPTS.uiDir);
  assert.equal(opts.workspaceDir, DEFAULT_OPTS.workspaceDir);
  assert.equal(opts.orchRoot, DEFAULT_OPTS.orchRoot);
});

test('installUi - docker-compose.yml is written to {uiDir}/docker-compose.yml', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  const dockerWrite = writeFileSyncMock.mock.calls.find((c) =>
    String(c.arguments[0]).endsWith('docker-compose.yml')
  );
  assert.ok(dockerWrite, 'docker-compose.yml was written');
  assert.equal(
    dockerWrite.arguments[0],
    path.join(DEFAULT_OPTS.uiDir, 'docker-compose.yml')
  );
  assert.ok(
    String(dockerWrite.arguments[1]).includes('radorch-ui'),
    'content from generateDockerCompose'
  );
});

// ── installUi() — ora spinner succeed/fail ────────────────────────────────────

test('installUi - spinner succeed is called on successful npm install', async () => {
  resetMocks();
  await installUi(DEFAULT_OPTS);
  assert.ok(spinnerInstances.length >= 1);
  assert.equal(spinnerInstances[0].succeed.mock.callCount(), 1);
});

test('installUi - spinner fail is called on npm install error event', async () => {
  resetMocks();
  state.spawnResults = [{ error: new Error('spawn ENOENT') }];

  const result = await installUi(DEFAULT_OPTS);

  assert.equal(result.installSuccess, false);
  assert.equal(spinnerInstances[0].fail.mock.callCount(), 1);
});

// installer/lib/prompts/memory-install.test.js

import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Mock functions ────────────────────────────────────────────────────────────

const confirmMock = mock.fn(async () => true);
const selectMock = mock.fn(async () => 'ask');

const execFileMock = mock.fn((cmd, args, cb) => {
  cb(null, 'ok', '');
});

const oraSpinner = {
  start: mock.fn(function () { return oraSpinner; }),
  succeed: mock.fn(function () { return oraSpinner; }),
  fail: mock.fn(function () { return oraSpinner; }),
};
const oraMock = mock.fn(() => oraSpinner);

const existsSyncMock = mock.fn(() => false);
const readFileSyncMock = mock.fn(() => '{}');
const writeFileSyncMock = mock.fn(() => {});
const mkdirSyncMock = mock.fn(() => {});
const copyFileSyncMock = mock.fn(() => {});

// ── Register module mocks BEFORE dynamic import ──────────────────────────────

mock.module('@inquirer/prompts', {
  namedExports: { confirm: confirmMock, select: selectMock },
});

mock.module('node:child_process', {
  namedExports: { execFile: execFileMock },
});

mock.module('ora', {
  defaultExport: oraMock,
});

mock.module('node:fs', {
  defaultExport: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    mkdirSync: mkdirSyncMock,
    copyFileSync: copyFileSyncMock,
  },
});

// Dynamic import after mock registration
const {
  isTotalRecallInstalled,
  installTotalRecall,
  registerMcpServer,
  promptMemoryInstall,
} = await import('./memory-install.js');

const WORKSPACE_DIR = '/home/user/myproject';

// ── Helper to reset all mocks ─────────────────────────────────────────────────

function resetAllMocks() {
  confirmMock.mock.resetCalls();
  selectMock.mock.resetCalls();
  execFileMock.mock.resetCalls();
  oraMock.mock.resetCalls();
  oraSpinner.start.mock.resetCalls();
  oraSpinner.succeed.mock.resetCalls();
  oraSpinner.fail.mock.resetCalls();
  existsSyncMock.mock.resetCalls();
  readFileSyncMock.mock.resetCalls();
  writeFileSyncMock.mock.resetCalls();
  mkdirSyncMock.mock.resetCalls();
  copyFileSyncMock.mock.resetCalls();

  // Reset implementations to safe defaults
  confirmMock.mock.mockImplementation(async () => true);
  selectMock.mock.mockImplementation(async () => 'ask');
  execFileMock.mock.mockImplementation((cmd, args, cb) => { cb(null, 'ok', ''); });
  existsSyncMock.mock.mockImplementation(() => false);
  readFileSyncMock.mock.mockImplementation(() => '{}');
  writeFileSyncMock.mock.mockImplementation(() => {});
  mkdirSyncMock.mock.mockImplementation(() => {});
  copyFileSyncMock.mock.mockImplementation(() => {});
}

// ── isTotalRecallInstalled ────────────────────────────────────────────────────

describe('isTotalRecallInstalled', () => {
  beforeEach(() => resetAllMocks());

  it('returns true when execFile succeeds (binary found on PATH)', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    const result = await isTotalRecallInstalled();
    assert.equal(result, true);
  });

  it('returns false when execFile errors (binary not found)', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(new Error('not found'));
    });
    const result = await isTotalRecallInstalled();
    assert.equal(result, false);
  });

  it('calls execFile with "total-recall" and ["--version"]', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    await isTotalRecallInstalled();
    const call = execFileMock.mock.calls[0].arguments;
    assert.equal(call[0], 'total-recall');
    assert.deepEqual(call[1], ['--version']);
  });
});

// ── installTotalRecall ────────────────────────────────────────────────────────

describe('installTotalRecall', () => {
  beforeEach(() => resetAllMocks());

  it('calls execFile with "npm" and ["install", "-g", "@strvmarv/total-recall"]', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, '', '');
    });
    await installTotalRecall();
    const call = execFileMock.mock.calls[0].arguments;
    assert.equal(call[0], 'npm');
    assert.deepEqual(call[1], ['install', '-g', '@strvmarv/total-recall']);
  });

  it('returns { success: true } on successful install', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, '', '');
    });
    const result = await installTotalRecall();
    assert.deepEqual(result, { success: true });
  });

  it('returns { success: false, error: "..." } on install failure', async () => {
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(new Error('npm install failed'));
    });
    const result = await installTotalRecall();
    assert.equal(result.success, false);
    assert.equal(result.error, 'npm install failed');
  });
});

// ── registerMcpServer ─────────────────────────────────────────────────────────

describe('registerMcpServer', () => {
  beforeEach(() => resetAllMocks());

  it('creates .vscode/mcp.json with correct structure when file does not exist', () => {
    existsSyncMock.mock.mockImplementation(() => false);
    const result = registerMcpServer(WORKSPACE_DIR);
    assert.equal(result.success, true);
    assert.equal(result.merged, false);
    // Check writeFileSync was called with the correct content
    const writeCall = writeFileSyncMock.mock.calls[0].arguments;
    const written = JSON.parse(writeCall[1]);
    assert.deepEqual(written, { servers: { 'total-recall': { command: 'total-recall' } } });
  });

  it('creates .vscode directory with { recursive: true } when it does not exist', () => {
    existsSyncMock.mock.mockImplementation(() => false);
    registerMcpServer(WORKSPACE_DIR);
    const mkdirCall = mkdirSyncMock.mock.calls[0].arguments;
    assert.ok(mkdirCall[0].endsWith('.vscode'));
    assert.deepEqual(mkdirCall[1], { recursive: true });
  });

  it('merges into existing file preserving other server entries, returns { success: true, merged: true }', () => {
    existsSyncMock.mock.mockImplementation(() => true);
    readFileSyncMock.mock.mockImplementation(() =>
      JSON.stringify({ servers: { 'other-server': { command: 'other' } } })
    );
    const result = registerMcpServer(WORKSPACE_DIR);
    assert.equal(result.success, true);
    assert.equal(result.merged, true);
    // Check that the written file includes both servers
    const writeCall = writeFileSyncMock.mock.calls[0].arguments;
    const written = JSON.parse(writeCall[1]);
    assert.deepEqual(written.servers['other-server'], { command: 'other' });
    assert.deepEqual(written.servers['total-recall'], { command: 'total-recall' });
  });

  it('backs up corrupt .vscode/mcp.json (invalid JSON), writes fresh config, returns { success: true, merged: false }', () => {
    existsSyncMock.mock.mockImplementation(() => true);
    readFileSyncMock.mock.mockImplementation(() => '{ invalid json !!!');
    const result = registerMcpServer(WORKSPACE_DIR);
    assert.equal(result.success, true);
    assert.equal(result.merged, false);
    // Check backup was created
    assert.equal(copyFileSyncMock.mock.callCount(), 1);
    const backupArgs = copyFileSyncMock.mock.calls[0].arguments;
    assert.ok(backupArgs[1].endsWith('.backup'));
    // Check fresh config was written
    const writeCall = writeFileSyncMock.mock.calls[0].arguments;
    const written = JSON.parse(writeCall[1]);
    assert.deepEqual(written, { servers: { 'total-recall': { command: 'total-recall' } } });
  });

  it('returns { success: true, merged: false } for new file', () => {
    existsSyncMock.mock.mockImplementation(() => false);
    const result = registerMcpServer(WORKSPACE_DIR);
    assert.equal(result.success, true);
    assert.equal(result.merged, false);
  });

  it('returns { success: false, merged: false, error: "..." } on file-system permission error', () => {
    existsSyncMock.mock.mockImplementation(() => false);
    mkdirSyncMock.mock.mockImplementation(() => {
      const err = new Error('EACCES: permission denied');
      err.code = 'EACCES';
      throw err;
    });
    const result = registerMcpServer(WORKSPACE_DIR);
    assert.equal(result.success, false);
    assert.equal(result.merged, false);
    assert.ok(result.error.includes('EACCES'));
  });
});

// ── promptMemoryInstall ───────────────────────────────────────────────────────

describe('promptMemoryInstall', () => {
  beforeEach(() => resetAllMocks());

  it('returns { installMemory: false, autoIngest: "never" } when user declines install', async () => {
    confirmMock.mock.mockImplementation(async () => false);
    const result = await promptMemoryInstall(WORKSPACE_DIR);
    assert.deepEqual(result, { installMemory: false, autoIngest: 'never' });
  });

  it('skips install step when binary is already detected', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    // First execFile call: isTotalRecallInstalled succeeds
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    // registerMcpServer needs fs mocks
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);

    // execFile should only have been called once (for isTotalRecallInstalled)
    // installTotalRecall was NOT called — no second execFile for npm
    assert.equal(execFileMock.mock.callCount(), 1);
    assert.equal(execFileMock.mock.calls[0].arguments[0], 'total-recall');
  });

  it('calls installTotalRecall when binary is not detected', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    let callCount = 0;
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      callCount++;
      if (callCount === 1) {
        // isTotalRecallInstalled — binary not found
        cb(new Error('not found'));
      } else {
        // installTotalRecall — succeeds
        cb(null, '', '');
      }
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);

    // Should have called execFile twice: once for detect, once for install
    assert.equal(execFileMock.mock.callCount(), 2);
    assert.equal(execFileMock.mock.calls[1].arguments[0], 'npm');
  });

  it('starts spinner and shows success message on install success', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    let callCount = 0;
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      callCount++;
      if (callCount === 1) {
        cb(new Error('not found'));
      } else {
        cb(null, '', '');
      }
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);

    // Spinner was created and started
    assert.ok(oraMock.mock.callCount() >= 1);
    assert.ok(oraSpinner.start.mock.callCount() >= 1);
    assert.ok(oraSpinner.succeed.mock.callCount() >= 1);
  });

  it('returns correct result on successful install + auto-ingest selection', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    let callCount = 0;
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      callCount++;
      if (callCount === 1) {
        cb(new Error('not found'));
      } else {
        cb(null, '', '');
      }
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'always');

    const result = await promptMemoryInstall(WORKSPACE_DIR);
    assert.deepEqual(result, { installMemory: true, autoIngest: 'always' });
  });

  it('handles install failure → "Continue without?" → yes path', async () => {
    let confirmCallCount = 0;
    confirmMock.mock.mockImplementation(async () => {
      confirmCallCount++;
      // First confirm: want install (true), second confirm: continue without (true)
      return true;
    });
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      // Both detect and install fail
      cb(new Error('install failed'));
    });

    const result = await promptMemoryInstall(WORKSPACE_DIR);
    assert.deepEqual(result, { installMemory: false, autoIngest: 'never' });
  });

  it('handles MCP registration failure → "Continue without?" → yes path', async () => {
    let confirmCallCount = 0;
    confirmMock.mock.mockImplementation(async () => {
      confirmCallCount++;
      return true;
    });
    // Binary is found
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    // MCP registration fails — existsSync returns false, mkdirSync throws
    existsSyncMock.mock.mockImplementation(() => false);
    mkdirSyncMock.mock.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const result = await promptMemoryInstall(WORKSPACE_DIR);
    assert.deepEqual(result, { installMemory: true, autoIngest: 'never' });
  });

  it('passes theme: INQUIRER_THEME to confirm prompt', async () => {
    confirmMock.mock.mockImplementation(async () => false);
    await promptMemoryInstall(WORKSPACE_DIR);
    const args = confirmMock.mock.calls[0].arguments[0];
    assert.deepEqual(args.theme, { prefix: { idle: '?', done: '' } });
  });

  it('passes theme: INQUIRER_THEME to select prompt', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);
    const args = selectMock.mock.calls[0].arguments[0];
    assert.deepEqual(args.theme, { prefix: { idle: '?', done: '' } });
  });

  it('select prompt has correct choices with values always, ask, never', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);
    const args = selectMock.mock.calls[0].arguments[0];
    assert.deepEqual(args.choices.map(c => c.value), ['always', 'ask', 'never']);
  });

  it('select prompt default is "ask"', async () => {
    confirmMock.mock.mockImplementation(async () => true);
    execFileMock.mock.mockImplementation((cmd, args, cb) => {
      cb(null, 'v1.0.0', '');
    });
    existsSyncMock.mock.mockImplementation(() => false);
    selectMock.mock.mockImplementation(async () => 'ask');

    await promptMemoryInstall(WORKSPACE_DIR);
    const args = selectMock.mock.calls[0].arguments[0];
    assert.equal(args.default, 'ask');
  });
});

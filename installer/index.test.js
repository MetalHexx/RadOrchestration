// installer/index.test.js — Tests for installer/index.js
//
// Strategy: mock.module() live bindings only propagate to modules loaded AFTER
// the mock is registered. Because index.js is loaded once (ES module cache),
// we set up all persistent mocks BEFORE importing index.js, then adjust
// per-test behaviour via mutable state + mock.resetCalls().

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ── Shared mutable test state ────────────────────────────────────────────────

function makeDefaultConfig() {
  return {
    tool: 'copilot-vscode',
    workspaceDir: '/workspace',
    orchRoot: '.github',
    projectsBasePath: 'projects',
    projectsNaming: 'SCREAMING_CASE',
    maxPhases: 5,
    maxTasksPerPhase: 10,
    maxRetriesPerTask: 3,
    maxConsecutiveReviewRejections: 2,
    executionMode: 'ask',
    installUi: false,
    skipConfirmation: false,
  };
}

function makeUiConfig() {
  return { ...makeDefaultConfig(), installUi: true, uiDir: '/workspace/ui' };
}

// Mutable state changed per-test
const state = {
  wizardError: null,         // if set, runWizard throws this
  confirmResponse: true,     // boolean returned by confirm
  existsSyncResponse: null,  // fn(path) => boolean; null = always false
  parseArgsResult: null,     // if set, parseArgs returns this instead of default
  spawnExitCode: 0,          // exit code for spawn mock
  spawnError: null,          // if set, spawn mock emits 'error' event
  installedVersionResponse: null, // value returned by readInstalledPackageVersion
  modifiedFilesResponse: [], // array returned by detectModifiedFiles
  confirmModifiedResponse: true, // boolean returned by confirmModifiedFiles
};

function resetState() {
  state.wizardError = null;
  state.confirmResponse = true;
  state.existsSyncResponse = null;
  state.parseArgsResult = null;
  state.spawnExitCode = 0;
  state.spawnError = null;
  state.installedVersionResponse = null;
  state.modifiedFilesResponse = [];
  state.confirmModifiedResponse = true;
}

// ── Persistent mock functions (set up ONCE before index.js is imported) ──────

const renderBannerMock = mock.fn();
const sectionHeaderMock = mock.fn();
const renderPreInstallSummaryMock = mock.fn();
const renderPostInstallSummaryMock = mock.fn();

const runWizardMock = mock.fn(async ({ skipConfirmation, cliOverrides }) => {
  if (state.wizardError) throw state.wizardError;
  return { ...makeDefaultConfig(), skipConfirmation };
});

const getManifestMock = mock.fn(() => ({
  categories: [
    { name: 'Agents', sourceDir: '.github/agents', targetDir: 'agents', recursive: false },
    { name: 'Skills', sourceDir: '.github/skills', targetDir: 'skills', recursive: true },
  ],
  globalExcludes: ['node_modules'],
}));

const confirmMock = mock.fn(async () => state.confirmResponse);

const copyCategoryMock = mock.fn((cat) => ({
  category: cat.name,
  fileCount: 5,
  success: true,
}));

const generateConfigMock = mock.fn(() => 'yaml: content');
const writeConfigMock = mock.fn();
const resolveOrchRootMock = mock.fn((workspaceDir, orchRoot) => `${workspaceDir}/${orchRoot}`);
const existsSyncMock = mock.fn((p) =>
  state.existsSyncResponse ? state.existsSyncResponse(p) : false
);
const mkdirSyncMock = mock.fn();

// UI module mocks — mutable state drives behavior
const checkNodeNpmMock = mock.fn(() => ({ available: true }));
const installUiMock = mock.fn(async () => ({
  copySuccess: true, installSuccess: true, buildSuccess: true, fileCount: 42,
}));
const renderPartialSuccessSummaryMock = mock.fn();

// CLI module mocks
const parseArgsMock = mock.fn((argv) => {
  if (state.parseArgsResult) return state.parseArgsResult;
  const options = {};
  if (argv.includes('--yes') || argv.includes('-y')) options.skipConfirmation = true;
  if (argv.includes('--overwrite') || argv.includes('--force')) options.overwrite = true;
  return { command: 'run', options };
});
const renderHelpMock = mock.fn();

// child_process spawn mock
const spawnCalls = [];
const execSyncMock = mock.fn();
const spawnMock = mock.fn((cmd, opts) => {
  const call = { cmd, opts };
  spawnCalls.push(call);
  const listeners = {};
  const child = {
    stdout: { on: mock.fn() },
    stderr: { on: mock.fn((evt, cb) => { if (evt === 'data') call.stderrCb = cb; }) },
    on: mock.fn((evt, cb) => { listeners[evt] = cb; }),
  };
  // Fire events asynchronously
  Promise.resolve().then(() => {
    if (state.spawnError) {
      listeners['error']?.(state.spawnError);
    } else {
      listeners['close']?.(state.spawnExitCode);
    }
  });
  return child;
});

// Upgrade-composition mocks (manifest-aware path: P04-T03)
const readInstalledPackageVersionMock = mock.fn(() => state.installedVersionResponse);
const loadBundledManifestMock = mock.fn(() => ({ files: [] }));
const detectModifiedFilesMock = mock.fn(() => state.modifiedFilesResponse);
const confirmModifiedFilesMock = mock.fn(async () => state.confirmModifiedResponse);
const removeManifestFilesMock = mock.fn(() => ({ removedCount: 0, prunedDirs: [] }));

// Cross-harness scan mock (P05-T01 → wired in P05-T02)
const findPriorInstallMock = mock.fn(() => null);

const THEME = { banner: (s) => s, warning: (s) => s, error: (s) => s, body: (s) => s, command: (s) => s, label: (s) => s, spinner: 'cyan' };

// Spinner factory - instances collected into array, cleared between tests
const spinnerInstances = [];
const oraMock = mock.fn(() => {
  const spinner = { succeed: mock.fn(), fail: mock.fn() };
  spinner.start = mock.fn(() => spinner);
  spinnerInstances.push(spinner);
  return spinner;
});

// ── Register module mocks before importing index.js ──────────────────────────

await mock.module('./lib/banner.js', { namedExports: { renderBanner: renderBannerMock } });
await mock.module('./lib/theme.js', { namedExports: { THEME, sectionHeader: sectionHeaderMock } });
await mock.module('./lib/summary.js', {
  namedExports: {
    renderPreInstallSummary: renderPreInstallSummaryMock,
    renderPostInstallSummary: renderPostInstallSummaryMock,
    renderPartialSuccessSummary: renderPartialSuccessSummaryMock,
  },
});
await mock.module('./lib/cli.js', { namedExports: { parseArgs: parseArgsMock } });
await mock.module('./lib/help.js', { namedExports: { renderHelp: renderHelpMock } });
await mock.module('./lib/wizard.js', { namedExports: { runWizard: runWizardMock } });
await mock.module('./lib/manifest.js', { namedExports: { getManifest: getManifestMock } });
await mock.module('./lib/config-generator.js', {
  namedExports: { generateConfig: generateConfigMock, writeConfig: writeConfigMock },
});
await mock.module('./lib/path-utils.js', { namedExports: { resolveOrchRoot: resolveOrchRootMock } });
await mock.module('./lib/file-copier.js', { namedExports: { copyCategory: copyCategoryMock } });
await mock.module('./lib/ui-builder.js', {
  namedExports: { checkNodeNpm: checkNodeNpmMock, installUi: installUiMock },
});
await mock.module('@inquirer/prompts', { namedExports: { confirm: confirmMock } });
await mock.module('ora', { defaultExport: oraMock });
await mock.module('node:child_process', { namedExports: { execSync: execSyncMock, spawn: spawnMock } });
await mock.module('./lib/installed-version.js', {
  namedExports: { readInstalledPackageVersion: readInstalledPackageVersionMock },
});
await mock.module('./lib/catalog.js', {
  namedExports: { loadBundledManifest: loadBundledManifestMock },
});
await mock.module('./lib/hash-check.js', {
  namedExports: {
    detectModifiedFiles: detectModifiedFilesMock,
    confirmModifiedFiles: confirmModifiedFilesMock,
  },
});
await mock.module('./lib/remove.js', {
  namedExports: { removeManifestFiles: removeManifestFilesMock },
});
await mock.module('./lib/cross-harness-scan.js', {
  namedExports: { findPriorInstallAtOtherOrchRoot: findPriorInstallMock },
});
// Patch fs methods on the shared default-export object
mock.method(fs, 'existsSync', existsSyncMock);
mock.method(fs, 'mkdirSync', mkdirSyncMock);

// ── Single import of index.js (uses live bindings above) ─────────────────────

const { main, installScriptsDeps } = await import('./index.js');

// ── Reset helper ──────────────────────────────────────────────────────────────

const ALL_MOCKS = [
  renderBannerMock, sectionHeaderMock, renderPreInstallSummaryMock, renderPostInstallSummaryMock,
  renderPartialSuccessSummaryMock,
  parseArgsMock, renderHelpMock,
  runWizardMock, getManifestMock, confirmMock, copyCategoryMock,
  generateConfigMock, writeConfigMock, resolveOrchRootMock, existsSyncMock, mkdirSyncMock, oraMock,
  checkNodeNpmMock, installUiMock, spawnMock, execSyncMock,
  readInstalledPackageVersionMock, loadBundledManifestMock, detectModifiedFilesMock,
  confirmModifiedFilesMock, removeManifestFilesMock,
  findPriorInstallMock,
];

function resetMocks() {
  ALL_MOCKS.forEach((m) => m.mock.resetCalls());
  spinnerInstances.length = 0;
  spawnCalls.length = 0;
  resetState();
}

// ── --yes / -y flag parsing ───────────────────────────────────────────────────

test('--yes flag: skipConfirmation=true → pre-install confirm NOT called', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmMock.mock.callCount(), 0, 'confirm not called with --yes');
});

test('-y flag: skipConfirmation=true → pre-install confirm NOT called', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '-y'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmMock.mock.callCount(), 0, 'confirm not called with -y');
});

test('no flags → skipConfirmation=false → pre-install confirm IS called', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(confirmMock.mock.callCount() >= 1, 'confirm called when no --yes flag');
});

// ── Happy path flow ───────────────────────────────────────────────────────────

test('happy path: modules called in correct order with --yes', async () => {
  resetMocks();
  const callOrder = [];
  renderBannerMock.mock.mockImplementationOnce(() => callOrder.push('renderBanner'));
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) => {
    callOrder.push('runWizard');
    return { ...makeDefaultConfig(), skipConfirmation };
  });
  getManifestMock.mock.mockImplementationOnce(() => {
    callOrder.push('getManifest');
    return {
      categories: [{ name: 'Agents', sourceDir: '.github/agents', targetDir: 'agents', recursive: false }],
      globalExcludes: ['node_modules'],
    };
  });
  renderPreInstallSummaryMock.mock.mockImplementationOnce(() => callOrder.push('renderPreInstallSummary'));
  copyCategoryMock.mock.mockImplementationOnce((cat) => { callOrder.push('copyCategory'); return { category: cat.name, fileCount: 3, success: true }; });
  generateConfigMock.mock.mockImplementationOnce(() => { callOrder.push('generateConfig'); return 'yaml'; });
  writeConfigMock.mock.mockImplementationOnce(() => callOrder.push('writeConfig'));
  renderPostInstallSummaryMock.mock.mockImplementationOnce(() => callOrder.push('renderPostInstallSummary'));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(callOrder.indexOf('renderBanner') < callOrder.indexOf('runWizard'), 'renderBanner before runWizard');
  assert.ok(callOrder.indexOf('runWizard') < callOrder.indexOf('getManifest'), 'runWizard before getManifest');
  assert.ok(callOrder.indexOf('getManifest') < callOrder.indexOf('renderPreInstallSummary'), 'getManifest before renderPreInstallSummary');
  assert.ok(callOrder.indexOf('renderPreInstallSummary') < callOrder.indexOf('copyCategory'), 'renderPreInstallSummary before copyCategory');
  assert.ok(callOrder.indexOf('copyCategory') < callOrder.indexOf('generateConfig'), 'copyCategory before generateConfig');
  assert.ok(callOrder.indexOf('generateConfig') < callOrder.indexOf('renderPostInstallSummary'), 'generateConfig before renderPostInstallSummary');
  assert.deepEqual(runWizardMock.mock.calls[0].arguments[0], { skipConfirmation: true, cliOverrides: { skipConfirmation: true } });
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 1);
});

// ── --yes skips pre-install confirmation ──────────────────────────────────────

test('--yes skips pre-install confirmation; copyCategory runs for each category', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmMock.mock.callCount(), 0, 'no confirm when --yes');
  assert.equal(copyCategoryMock.mock.callCount(), 2, 'copyCategory called for each category');
});

// ── Pre-install declined ──────────────────────────────────────────────────────

test('pre-install declined: exits 0 without calling copyCategory or generateConfig', async () => {
  resetMocks();
  state.confirmResponse = false;  // user declines

  const exitCodes = [];
  const origExit = process.exit;
  const origConsoleError = console.error;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };
  console.error = () => {};  // suppress cascade noise

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js'];
  try {
    await main();
  } catch (_) {
    // expected
  } finally {
    process.argv = originalArgv;
    process.exit = origExit;
    console.error = origConsoleError;
  }

  assert.equal(exitCodes[0], 0, 'first exit is 0 on decline');
  assert.equal(copyCategoryMock.mock.callCount(), 0, 'copyCategory not called');
  assert.equal(generateConfigMock.mock.callCount(), 0, 'generateConfig not called');
});

// ── Modified-file gate: shown when prior install + locally modified files ─────

test('modified-file gate: confirmModifiedFiles called when prior install has locally modified files', async () => {
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.modifiedFilesResponse = ['agents/coder.md'];

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmModifiedFilesMock.mock.callCount(), 1, 'confirmModifiedFiles called when modified files exist');
});

// ── Modified-file gate: user declines → exits 0 without copying ───────────────

test('modified-file gate: user declines → exits 0 without copyCategory or removeManifestFiles', async () => {
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.modifiedFilesResponse = ['agents/coder.md'];
  state.confirmModifiedResponse = false;  // declines

  const exitCodes = [];
  const origExit = process.exit;
  const origConsoleError = console.error;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };
  console.error = () => {};

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js'];
  try {
    await main();
  } catch (_) {
    // expected
  } finally {
    process.argv = originalArgv;
    process.exit = origExit;
    console.error = origConsoleError;
  }

  assert.equal(exitCodes[0], 0, 'exits 0 on modified-file decline');
  assert.equal(removeManifestFilesMock.mock.callCount(), 0, 'removeManifestFiles not called');
  assert.equal(copyCategoryMock.mock.callCount(), 0, 'copyCategory not called');
});

// ── --yes does NOT bypass modified-file gate (NFR-5) ──────────────────────────

test('--yes does NOT bypass the modified-file gate (NFR-5)', async () => {
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.modifiedFilesResponse = ['agents/coder.md'];

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmModifiedFilesMock.mock.callCount(), 1, 'confirmModifiedFiles called even with --yes');
});

// ── Per-category ora spinners ─────────────────────────────────────────────────

test('per-category spinners: ora called once per category; text contains category name', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // 2 categories + 1 config spinner = at least 3 ora calls
  assert.ok(oraMock.mock.callCount() >= 2, 'ora called at least twice (categories)');
  const texts = oraMock.mock.calls.map((c) => c.arguments[0]?.text ?? '');
  assert.ok(texts.some((t) => t.includes('Agents')), 'spinner text mentions Agents');
  assert.ok(texts.some((t) => t.includes('Skills')), 'spinner text mentions Skills');
  for (const spinner of spinnerInstances) {
    const settled = spinner.succeed.mock.callCount() + spinner.fail.mock.callCount();
    assert.ok(settled >= 1, 'each spinner calls succeed or fail');
  }
});

// ── Config generation spinner ─────────────────────────────────────────────────

test('config generation: generateConfig and writeConfig called with a spinner', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(generateConfigMock.mock.callCount(), 1, 'generateConfig called once');
  assert.equal(writeConfigMock.mock.callCount(), 1, 'writeConfig called once');
  const configSpinner = spinnerInstances[spinnerInstances.length - 1];
  assert.ok(
    configSpinner.succeed.mock.callCount() + configSpinner.fail.mock.callCount() >= 1,
    'config spinner settles'
  );
});

// ── Projects base path directory creation ────────────────────────────────────

test('projects base path: mkdirSync called with resolved absolute path after config is written', async () => {
  resetMocks();
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(mkdirSyncMock.mock.callCount() >= 1, 'mkdirSync called at least once');
  const calls = mkdirSyncMock.mock.calls.map((c) => c.arguments[0]);
  // config has workspaceDir='/workspace', projectsBasePath='projects' → resolves to '/workspace/projects'
  assert.ok(calls.some((p) => String(p).includes('projects')), 'mkdirSync called with a path containing projects');
  const opts = mkdirSyncMock.mock.calls[0].arguments[1];
  assert.deepEqual(opts, { recursive: true }, 'mkdirSync called with recursive: true');
});

test('projects base path: mkdirSync called after writeConfig', async () => {
  resetMocks();
  const callOrder = [];
  writeConfigMock.mock.mockImplementationOnce(() => callOrder.push('writeConfig'));
  mkdirSyncMock.mock.mockImplementationOnce(() => callOrder.push('mkdirSync'));
  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(callOrder.indexOf('writeConfig') < callOrder.indexOf('mkdirSync'), 'mkdirSync called after writeConfig');
});

test('projects base path: absolute projectsBasePath used as-is', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async () => ({
    ...makeDefaultConfig(),
    projectsBasePath: '/abs/path/to/projects',
  }));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  const mkdirCalls = mkdirSyncMock.mock.calls;
  const absDirCall = mkdirCalls.find(
    (c) => c.arguments[0] === '/abs/path/to/projects'
  );
  assert.ok(absDirCall, 'mkdirSync called with absolute path unchanged');
});

// ── Top-level error handling ──────────────────────────────────────────────────

test('non-Inquirer error → prints message (no stack trace) and exits 1', async () => {
  resetMocks();
  state.wizardError = new Error('Unexpected storage failure');

  const errorMessages = [];
  const origConsoleError = console.error;
  console.error = (msg) => errorMessages.push(msg);

  const exitCodes = [];
  const origExit = process.exit;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } catch (_) {
    // expected
  } finally {
    process.argv = originalArgv;
    console.error = origConsoleError;
    process.exit = origExit;
  }

  assert.ok(exitCodes.includes(1), 'exits with 1 on unexpected error');
  assert.ok(errorMessages.length > 0, 'prints an error message');
  assert.ok(errorMessages[0].includes('Unexpected storage failure'), 'message includes error text');
  assert.ok(!errorMessages[0].includes('    at '), 'message has no stack trace lines');
});

// ── Ctrl+C / ExitPromptError ──────────────────────────────────────────────────

test('ExitPromptError exits cleanly with code 0 and no error message', async () => {
  resetMocks();
  const ctrlCError = new Error('User pressed Ctrl+C');
  ctrlCError.name = 'ExitPromptError';
  state.wizardError = ctrlCError;

  const errorMessages = [];
  const origConsoleError = console.error;
  console.error = (msg) => errorMessages.push(msg);

  const exitCodes = [];
  const origExit = process.exit;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js'];
  try {
    await main();
  } catch (_) {
    // expected
  } finally {
    process.argv = originalArgv;
    console.error = origConsoleError;
    process.exit = origExit;
  }

  assert.ok(exitCodes.includes(0), 'ExitPromptError exits with 0');
  assert.equal(errorMessages.length, 0, 'no error messages for ExitPromptError');
});

// ── UI integration flow ───────────────────────────────────────────────────────

test('UI happy path: checkNodeNpm and installUi called; renderPostInstallSummary called', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(checkNodeNpmMock.mock.callCount(), 1, 'checkNodeNpm called once');
  assert.equal(installUiMock.mock.callCount(), 1, 'installUi called once');
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 1, 'renderPostInstallSummary called');
  assert.equal(renderPartialSuccessSummaryMock.mock.callCount(), 0, 'renderPartialSuccessSummary not called');
});

test('UI declined (installUi: false): checkNodeNpm and installUi NOT called', async () => {
  resetMocks();
  // default runWizardMock returns installUi: false

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(checkNodeNpmMock.mock.callCount(), 0, 'checkNodeNpm not called when installUi false');
  assert.equal(installUiMock.mock.callCount(), 0, 'installUi not called when installUi false');
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 1, 'renderPostInstallSummary still called');
});

test('Node/npm missing — user continues: installUi NOT called, renderPostInstallSummary called', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );
  checkNodeNpmMock.mock.mockImplementationOnce(() => ({ available: false, error: 'node not found' }));
  state.confirmResponse = true; // user continues without UI

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(checkNodeNpmMock.mock.callCount(), 1, 'checkNodeNpm called');
  assert.equal(installUiMock.mock.callCount(), 0, 'installUi not called when node missing');
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 1, 'renderPostInstallSummary called');
});

test('Node/npm missing — user cancels: process exits with code 0', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );
  checkNodeNpmMock.mock.mockImplementationOnce(() => ({ available: false, error: 'node not found' }));
  state.confirmResponse = false; // user cancels

  const exitCodes = [];
  const origExit = process.exit;
  const origConsoleError = console.error;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };
  console.error = () => {};

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } catch (_) {
    // expected
  } finally {
    process.argv = originalArgv;
    process.exit = origExit;
    console.error = origConsoleError;
  }

  assert.equal(exitCodes[0], 0, 'exits 0 when user cancels UI-less installation');
  assert.equal(installUiMock.mock.callCount(), 0, 'installUi not called');
});

test('UI build failure: renderPartialSuccessSummary called with error; renderPostInstallSummary NOT called', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );
  installUiMock.mock.mockImplementationOnce(async () => ({
    copySuccess: true, installSuccess: true, buildSuccess: false, fileCount: 0, error: 'build error',
  }));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(renderPartialSuccessSummaryMock.mock.callCount(), 1, 'renderPartialSuccessSummary called');
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 0, 'renderPostInstallSummary not called');
  const args = renderPartialSuccessSummaryMock.mock.calls[0].arguments;
  assert.equal(args[3], 'build error', 'error message passed to renderPartialSuccessSummary');
});

test('UI install failure: renderPartialSuccessSummary called', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );
  installUiMock.mock.mockImplementationOnce(async () => ({
    copySuccess: false, installSuccess: false, buildSuccess: false, fileCount: 0, error: 'install error',
  }));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(renderPartialSuccessSummaryMock.mock.callCount(), 1, 'renderPartialSuccessSummary called on install failure');
  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 0, 'renderPostInstallSummary not called on install failure');
});

test('Core files not rolled back on UI failure: copyCategory and generateConfig already called', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );
  installUiMock.mock.mockImplementationOnce(async () => ({
    copySuccess: false, installSuccess: false, buildSuccess: false, fileCount: 0, error: 'install error',
  }));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(copyCategoryMock.mock.callCount() >= 1, 'copyCategory called before UI failure');
  assert.equal(generateConfigMock.mock.callCount(), 1, 'generateConfig called before UI failure');
  assert.equal(writeConfigMock.mock.callCount(), 1, 'writeConfig called before UI failure');
});

test('installUi receives correct arguments: repoRoot, uiDir, workspaceDir, orchRoot, projectsBasePath', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async ({ skipConfirmation }) =>
    ({ ...makeUiConfig(), skipConfirmation })
  );

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(installUiMock.mock.callCount(), 1, 'installUi called once');
  const args = installUiMock.mock.calls[0].arguments[0];
  assert.equal(args.uiDir, '/workspace/ui', 'uiDir from config');
  assert.equal(args.workspaceDir, '/workspace', 'workspaceDir from config');
  assert.equal(args.orchRoot, '.github', 'orchRoot from config');
  assert.equal(args.projectsBasePath, 'projects', 'projectsBasePath from config');
  assert.ok(typeof args.repoRoot === 'string' && args.repoRoot.length > 0, 'repoRoot is a non-empty string');
});

// ── --help command ────────────────────────────────────────────────────────────

test('--help: renders help and does NOT call renderBanner or runWizard', async () => {
  resetMocks();
  state.parseArgsResult = { command: 'help', options: {} };

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--help'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(renderHelpMock.mock.callCount(), 1, 'renderHelp called');
  assert.equal(renderBannerMock.mock.callCount(), 0, 'renderBanner not called');
  assert.equal(runWizardMock.mock.callCount(), 0, 'runWizard not called');
});

// ── --version command ─────────────────────────────────────────────────────────

test('--version: prints version and does NOT call renderBanner or runWizard', async () => {
  resetMocks();
  state.parseArgsResult = { command: 'version', options: {} };

  const logMessages = [];
  const origLog = console.log;
  console.log = (...args) => logMessages.push(args.join(' '));

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--version'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
    console.log = origLog;
  }

  assert.ok(logMessages.length >= 1, 'something printed to stdout');
  assert.equal(renderBannerMock.mock.callCount(), 0, 'renderBanner not called');
  assert.equal(runWizardMock.mock.callCount(), 0, 'runWizard not called');
});

// ── --overwrite / --force flags (intentional no-op in upgrade path; NFR-5) ────

test('--overwrite: does NOT bypass modified-file gate (NFR-5)', async () => {
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.modifiedFilesResponse = ['agents/coder.md'];

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes', '--overwrite'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // --overwrite is accepted by parseArgs but is a no-op in the upgrade path.
  assert.equal(confirmModifiedFilesMock.mock.callCount(), 1,
    'confirmModifiedFiles still called when --overwrite is passed (NFR-5)');
  assert.ok(copyCategoryMock.mock.callCount() >= 1, 'copyCategory called (installation proceeded)');
});

test('--force: does NOT bypass modified-file gate (NFR-5)', async () => {
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.modifiedFilesResponse = ['agents/coder.md'];

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes', '--force'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(confirmModifiedFilesMock.mock.callCount(), 1,
    'confirmModifiedFiles still called when --force is passed (NFR-5)');
  assert.ok(copyCategoryMock.mock.callCount() >= 1, 'copyCategory called');
});

// ── parseArgs integration ─────────────────────────────────────────────────────

test('parseArgs is called with process.argv.slice(2)', async () => {
  resetMocks();

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes', '--orch-root', '.rad'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(parseArgsMock.mock.callCount(), 1, 'parseArgs called once');
  const parsedArgs = parseArgsMock.mock.calls[0].arguments[0];
  assert.ok(parsedArgs.includes('--yes'), 'argv includes --yes');
  assert.ok(parsedArgs.includes('--orch-root'), 'argv includes --orch-root');
  assert.ok(parsedArgs.includes('.rad'), 'argv includes .rad');
});

test('runWizard receives cliOverrides from parseArgs options', async () => {
  resetMocks();
  state.parseArgsResult = { command: 'run', options: { skipConfirmation: true, orchRoot: '.rad' } };

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes', '--orch-root', '.rad'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(runWizardMock.mock.callCount(), 1, 'runWizard called');
  const wizardArgs = runWizardMock.mock.calls[0].arguments[0];
  assert.equal(wizardArgs.skipConfirmation, true, 'skipConfirmation passed');
  assert.deepEqual(wizardArgs.cliOverrides, { skipConfirmation: true, orchRoot: '.rad' }, 'cliOverrides passed');
});

// ── installScriptsDeps — unit tests ──────────────────────────────────────────

test('installScriptsDeps success: spawn exits 0, spinner.succeed called, returns { success: true }', async () => {
  resetMocks();
  state.spawnExitCode = 0;

  const result = await installScriptsDeps('/test/scripts');

  assert.deepEqual(result, { success: true }, 'returns { success: true }');
  assert.equal(spawnMock.mock.callCount(), 1, 'spawn called once');
  assert.equal(spawnMock.mock.calls[0].arguments[0], 'npm install --omit=dev', 'spawn command correct');
  assert.deepEqual(spawnMock.mock.calls[0].arguments[1], { cwd: '/test/scripts', stdio: 'pipe', shell: true }, 'spawn options correct');
  const spinner = spinnerInstances[0];
  assert.equal(spinner.succeed.mock.callCount(), 1, 'spinner.succeed called');
  assert.equal(spinner.succeed.mock.calls[0].arguments[0], 'Pipeline engine dependencies installed', 'succeed message correct');
  assert.equal(spinner.fail.mock.callCount(), 0, 'spinner.fail not called');
});

test('installScriptsDeps failure: spawn exits 1, spinner.fail called, returns { success: false, error }', async () => {
  resetMocks();
  state.spawnExitCode = 1;

  const result = await installScriptsDeps('/test/scripts');

  assert.equal(result.success, false, 'returns success: false');
  assert.ok('error' in result, 'result has error property');
  const spinner = spinnerInstances[0];
  assert.equal(spinner.fail.mock.callCount(), 1, 'spinner.fail called');
  assert.equal(spinner.fail.mock.calls[0].arguments[0], 'Pipeline engine dependencies: npm install failed', 'fail message correct');
  assert.equal(spinner.succeed.mock.callCount(), 0, 'spinner.succeed not called');
});

test('installScriptsDeps error event: spinner.fail called, returns { success: false, error }', async () => {
  resetMocks();
  state.spawnError = new Error('spawn ENOENT');

  const result = await installScriptsDeps('/test/scripts');

  assert.equal(result.success, false, 'returns success: false on error event');
  assert.equal(result.error, 'spawn ENOENT', 'error message from thrown error');
  const spinner = spinnerInstances[0];
  assert.equal(spinner.fail.mock.callCount(), 1, 'spinner.fail called on error event');
});

test('installScriptsDeps: spawn called with shell: true and stdio: pipe', async () => {
  resetMocks();
  state.spawnExitCode = 0;

  await installScriptsDeps('/some/path');

  const opts = spawnMock.mock.calls[0].arguments[1];
  assert.equal(opts.shell, true, 'shell: true');
  assert.equal(opts.stdio, 'pipe', 'stdio: pipe');
});

// ── installScriptsDeps — integration tests ────────────────────────────────────

test('main() calls installScriptsDeps: spawn invoked with cwd ending in skills/rad-orchestration/scripts', async () => {
  resetMocks();
  state.spawnExitCode = 0;

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(spawnMock.mock.callCount() >= 1, 'spawn called at least once');
  const spawnCall = spawnMock.mock.calls.find((c) =>
    c.arguments[0] === 'npm install --omit=dev'
  );
  assert.ok(spawnCall, 'spawn called with npm install --omit=dev');
  const cwd = spawnCall.arguments[1].cwd;
  assert.ok(
    String(cwd).replace(/\\/g, '/').endsWith('skills/rad-orchestration/scripts'),
    `spawn cwd ends with skills/rad-orchestration/scripts, got: ${cwd}`
  );
});

test('main() continues to renderPostInstallSummary when installScriptsDeps fails (non-fatal)', async () => {
  resetMocks();
  state.spawnExitCode = 1;

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.equal(renderPostInstallSummaryMock.mock.callCount(), 1, 'renderPostInstallSummary called despite spawn failure');
  const failSpinner = spinnerInstances.find((s) => s.fail.mock.callCount() > 0);
  assert.ok(failSpinner, 'a spinner.fail was called');
  assert.equal(
    failSpinner.fail.mock.calls[0].arguments[0],
    'Pipeline engine dependencies: npm install failed',
    'fail message correct'
  );
});

// ── P04-T03: Upgrade composition (uninstall prior → install new) ──────────────

test('main composes upgrade as uninstall(prior) → install(new) when prior install detected', async () => {
  // Arrange: simulate a prior install at the chosen orchRoot.
  resetMocks();
  state.installedVersionResponse = { packageVersion: '1.0.0-alpha.9' };
  state.existsSyncResponse = (p) => p.endsWith('orchestration.yml')
    || p.endsWith('agents') || p.endsWith('skills');
  runWizardMock.mock.mockImplementationOnce(async () => ({
    ...makeDefaultConfig(),
    installUi: false,
  }));

  const callOrder = [];
  removeManifestFilesMock.mock.mockImplementationOnce(() => {
    callOrder.push('removeManifestFiles');
    return { removedCount: 5, prunedDirs: [] };
  });
  copyCategoryMock.mock.mockImplementation((cat) => {
    callOrder.push('copyCategory');
    return { category: cat.name, fileCount: 3, success: true };
  });

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // Verify: the install proceeds AND the prior-removal step ran first.
  assert.ok(removeManifestFilesMock.mock.callCount() > 0,
    'removeManifestFiles called (prior install removed)');
  assert.ok(copyCategoryMock.mock.callCount() > 0,
    'copyCategory called (new install proceeded)');
  assert.ok(loadBundledManifestMock.mock.callCount() > 0,
    'loadBundledManifest called (prior manifest fetched from catalog)');
  assert.equal(callOrder[0], 'removeManifestFiles',
    'removeManifestFiles runs BEFORE copyCategory (uninstall → install order)');
});

test('main aborts with pre-manifest UX when orchestration.yml lacks package_version', async () => {
  // Arrange: existsSync says orchestration.yml exists but installed-version
  // returns { packageVersion: null }.
  resetMocks();
  state.installedVersionResponse = { packageVersion: null };

  const exitCodes = [];
  const origExit = process.exit;
  process.exit = (code) => { exitCodes.push(code); throw new Error(`process.exit(${code})`); };

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } catch (_) {
    // expected — process.exit throws
  } finally {
    process.argv = originalArgv;
    process.exit = origExit;
  }

  // Verify: process exits without calling copyCategory.
  assert.equal(exitCodes[0], 0, 'exits 0 on pre-manifest detection');
  assert.equal(copyCategoryMock.mock.callCount(), 0, 'copyCategory not called');
  assert.equal(removeManifestFilesMock.mock.callCount(), 0, 'removeManifestFiles not called');
  assert.equal(loadBundledManifestMock.mock.callCount(), 0,
    'loadBundledManifest not called (no version to look up)');
});

test('main runs the install path unchanged when no prior install is detected', async () => {
  // Arrange: existsSync returns false for orchestration.yml.
  resetMocks();
  state.installedVersionResponse = null;

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // Verify: copyCategoryMock is called once per category (existing assertion shape).
  assert.equal(copyCategoryMock.mock.callCount(), 2,
    'copyCategory called for each category (no prior install path)');
  assert.equal(removeManifestFilesMock.mock.callCount(), 0,
    'removeManifestFiles not called (no prior install)');
  assert.equal(loadBundledManifestMock.mock.callCount(), 0,
    'loadBundledManifest not called (no prior install)');
  assert.equal(confirmModifiedFilesMock.mock.callCount(), 0,
    'confirmModifiedFiles not called (no prior install)');
});

// ── P05-T02: Cross-harness switch UX (DD-4, FR-8, AD-7, AD-8) ─────────────────

test('main surfaces cross-harness prior install and runs cleanup against the prior orchRoot when user confirms', async () => {
  resetMocks();
  // Wizard chose .github; scanner finds prior install at .claude.
  runWizardMock.mock.mockImplementationOnce(async () => ({
    ...makeDefaultConfig(),
    tool: 'copilot-vscode',
    orchRoot: '.github',
    installUi: false,
  }));
  findPriorInstallMock.mock.mockImplementationOnce(() => ({
    orchRoot: '/workspace/.claude',
    packageVersion: '1.0.0-alpha.9',
  }));
  // User confirms the cleanup prompt.
  state.confirmResponse = true;

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // Verify: removeManifestFilesMock was called with a manifest fetched
  // for the PRIOR orchRoot (claude), not the chosen one (.github).
  const calls = removeManifestFilesMock.mock.calls;
  assert.ok(calls.length >= 1, 'cross-harness cleanup must invoke removeManifestFiles');
  assert.match(calls[0].arguments[1], /\.claude$/, 'removal must target the prior orchRoot');
});

test('main proceeds with install untouched when user declines the cross-harness cleanup prompt (DD-4)', async () => {
  resetMocks();
  runWizardMock.mock.mockImplementationOnce(async () => ({
    ...makeDefaultConfig(),
    tool: 'copilot-vscode',
    orchRoot: '.github',
    installUi: false,
  }));
  findPriorInstallMock.mock.mockImplementationOnce(() => ({
    orchRoot: '/workspace/.claude',
    packageVersion: '1.0.0-alpha.9',
  }));
  state.confirmResponse = false;

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  // The chosen orchRoot's install path still runs; the prior orchRoot is untouched.
  assert.strictEqual(removeManifestFilesMock.mock.callCount(), 0,
    'declined cross-harness cleanup must not call removeManifestFiles against the prior orchRoot');
  assert.ok(copyCategoryMock.mock.callCount() > 0, 'install copy must still proceed');
});

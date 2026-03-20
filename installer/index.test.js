// installer/index.test.js — Tests for installer/index.js
//
// Strategy: mock.module() live bindings only propagate to modules loaded AFTER
// the mock is registered. Because index.js is loaded once (ES module cache),
// we set up all persistent mocks BEFORE importing index.js, then adjust
// per-test behaviour via mutable state + mock.resetCalls().

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ── Shared mutable test state ────────────────────────────────────────────────

function makeDefaultConfig() {
  return {
    tool: 'copilot',
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
};

function resetState() {
  state.wizardError = null;
  state.confirmResponse = true;
  state.existsSyncResponse = null;
}

// ── Persistent mock functions (set up ONCE before index.js is imported) ──────

const renderBannerMock = mock.fn();
const sectionHeaderMock = mock.fn();
const renderPreInstallSummaryMock = mock.fn();
const renderPostInstallSummaryMock = mock.fn();

const runWizardMock = mock.fn(async ({ skipConfirmation }) => {
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

// UI module mocks — mutable state drives behavior
const checkNodeNpmMock = mock.fn(() => ({ available: true }));
const installUiMock = mock.fn(async () => ({
  copySuccess: true, installSuccess: true, buildSuccess: true, fileCount: 42,
}));
const renderPartialSuccessSummaryMock = mock.fn();

const THEME = { banner: (s) => s, warning: (s) => s, error: (s) => s, spinner: 'cyan' };

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
// Patch fs.existsSync on the shared default-export object
mock.method(fs, 'existsSync', existsSyncMock);

// ── Single import of index.js (uses live bindings above) ─────────────────────

const { main } = await import('./index.js');

// ── Reset helper ──────────────────────────────────────────────────────────────

const ALL_MOCKS = [
  renderBannerMock, sectionHeaderMock, renderPreInstallSummaryMock, renderPostInstallSummaryMock,
  renderPartialSuccessSummaryMock,
  runWizardMock, getManifestMock, confirmMock, copyCategoryMock,
  generateConfigMock, writeConfigMock, resolveOrchRootMock, existsSyncMock, oraMock,
  checkNodeNpmMock, installUiMock,
];

function resetMocks() {
  ALL_MOCKS.forEach((m) => m.mock.resetCalls());
  spinnerInstances.length = 0;
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
  assert.deepEqual(runWizardMock.mock.calls[0].arguments[0], { skipConfirmation: true });
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

// ── Existing-file detection ───────────────────────────────────────────────────

test('existing-file detection: overwrite confirm shown when agents/ exists', async () => {
  resetMocks();
  state.existsSyncResponse = (p) => String(p).includes('agents');

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(confirmMock.mock.callCount() >= 1, 'overwrite confirm called when agents/ exists');
  assert.equal(confirmMock.mock.calls[0].arguments[0].default, false, 'overwrite confirm defaults to false');
});

// ── Existing-file detection — user declines overwrite ─────────────────────────

test('existing-file detection: user declines overwrite → exits 0 without copying', async () => {
  resetMocks();
  state.existsSyncResponse = () => true;
  state.confirmResponse = false;  // declines overwrite

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

  assert.equal(exitCodes[0], 0, 'exits 0 on overwrite decline');
  assert.equal(copyCategoryMock.mock.callCount(), 0, 'copyCategory not called');
});

// ── --yes does NOT skip overwrite confirmation ────────────────────────────────

test('--yes does NOT skip the overwrite confirmation (safety gate)', async () => {
  resetMocks();
  state.existsSyncResponse = (p) => String(p).includes('agents');

  const originalArgv = process.argv;
  process.argv = ['node', 'installer/index.js', '--yes'];
  try {
    await main();
  } finally {
    process.argv = originalArgv;
  }

  assert.ok(confirmMock.mock.callCount() >= 1, 'overwrite confirm called even with --yes');
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

test('installUi receives correct arguments: repoRoot, uiDir, workspaceDir, orchRoot', async () => {
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
  assert.ok(typeof args.repoRoot === 'string' && args.repoRoot.length > 0, 'repoRoot is a non-empty string');
});

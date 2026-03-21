// installer/lib/wizard.test.js

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- Call order tracking ---
const callOrder = [];

// --- Mock functions ---
const sectionHeaderMock = mock.fn((marker, title) => {
  callOrder.push(`sectionHeader:${marker}:${title}`);
});

const promptGettingStartedMock = mock.fn(async () => {
  callOrder.push('promptGettingStarted');
  return { tool: 'copilot', workspaceDir: '/home/user/workspace' };
});

const promptOrchRootMock = mock.fn(async () => {
  callOrder.push('promptOrchRoot');
  return { orchRoot: '.github/orchestration' };
});

const promptProjectStorageMock = mock.fn(async () => {
  callOrder.push('promptProjectStorage');
  return { projectsBasePath: './projects', projectsNaming: 'SCREAMING_CASE' };
});

const promptPipelineLimitsMock = mock.fn(async () => {
  callOrder.push('promptPipelineLimits');
  return { maxPhases: 5, maxTasksPerPhase: 10, maxRetriesPerTask: 2, maxConsecutiveReviewRejections: 3 };
});

const promptGateBehaviorMock = mock.fn(async () => {
  callOrder.push('promptGateBehavior');
  return { executionMode: 'ask' };
});

const promptUiInstallMock = mock.fn(async () => {
  callOrder.push('promptUiInstall');
  return { installUi: false };
});

// Register module mocks BEFORE importing the module under test
mock.module('./theme.js', {
  namedExports: { THEME: { hint: (s) => s }, sectionHeader: sectionHeaderMock },
});
mock.module('./prompts/getting-started.js', {
  namedExports: { promptGettingStarted: promptGettingStartedMock },
});
mock.module('./prompts/orch-root.js', {
  namedExports: { promptOrchRoot: promptOrchRootMock },
});
mock.module('./prompts/project-storage.js', {
  namedExports: { promptProjectStorage: promptProjectStorageMock },
});
mock.module('./prompts/pipeline-limits.js', {
  namedExports: { promptPipelineLimits: promptPipelineLimitsMock },
});
mock.module('./prompts/gate-behavior.js', {
  namedExports: { promptGateBehavior: promptGateBehaviorMock },
});
mock.module('./prompts/ui-install.js', {
  namedExports: { promptUiInstall: promptUiInstallMock },
});

// Dynamic import after mocks are registered
const { runWizard } = await import('./wizard.js');

describe('runWizard({ skipConfirmation: false })', () => {
  let result;

  before(async () => {
    // Reset tracking before the primary run
    callOrder.length = 0;
    sectionHeaderMock.mock.resetCalls();
    promptGettingStartedMock.mock.resetCalls();
    promptOrchRootMock.mock.resetCalls();
    promptProjectStorageMock.mock.resetCalls();
    promptPipelineLimitsMock.mock.resetCalls();
    promptGateBehaviorMock.mock.resetCalls();
    promptUiInstallMock.mock.resetCalls();

    result = await runWizard({ skipConfirmation: false });
  });

  it('calls sectionHeader exactly 6 times', () => {
    assert.equal(sectionHeaderMock.mock.calls.length, 6);
  });

  it('calls sectionHeader with correct marker+title pairs in order', () => {
    const calls = sectionHeaderMock.mock.calls.map(c => c.arguments);
    assert.deepEqual(calls[0], ['::', 'Getting Started']);
    assert.deepEqual(calls[1], ['::', 'Orchestration Root']);
    assert.deepEqual(calls[2], ['::', 'Project Storage']);
    assert.deepEqual(calls[3], ['::', 'Pipeline Limits']);
    assert.deepEqual(calls[4], ['::', 'Gate Behavior']);
    assert.deepEqual(calls[5], ['::', 'Dashboard UI']);
  });

  it('calls promptGettingStarted exactly once', () => {
    assert.equal(promptGettingStartedMock.mock.calls.length, 1);
  });

  it('calls promptOrchRoot exactly once', () => {
    assert.equal(promptOrchRootMock.mock.calls.length, 1);
  });

  it('calls promptProjectStorage exactly once', () => {
    assert.equal(promptProjectStorageMock.mock.calls.length, 1);
  });

  it('calls promptPipelineLimits exactly once', () => {
    assert.equal(promptPipelineLimitsMock.mock.calls.length, 1);
  });

  it('calls promptGateBehavior exactly once', () => {
    assert.equal(promptGateBehaviorMock.mock.calls.length, 1);
  });

  it('calls promptUiInstall exactly once', () => {
    assert.equal(promptUiInstallMock.mock.calls.length, 1);
  });

  it('calls promptUiInstall with gettingStarted.workspaceDir', () => {
    const args = promptUiInstallMock.mock.calls[0].arguments;
    assert.equal(args[0], '/home/user/workspace');
  });

  it('calls prompts in the correct order: Getting Started → Orch Root → Project Storage → Pipeline Limits → Gate Behavior → UI Install', () => {
    const gsIdx = callOrder.indexOf('promptGettingStarted');
    const orIdx = callOrder.indexOf('promptOrchRoot');
    const psIdx = callOrder.indexOf('promptProjectStorage');
    const plIdx = callOrder.indexOf('promptPipelineLimits');
    const gbIdx = callOrder.indexOf('promptGateBehavior');
    const uiIdx = callOrder.indexOf('promptUiInstall');

    assert.ok(gsIdx < orIdx, 'Getting Started runs before Orch Root');
    assert.ok(orIdx < psIdx, 'Orch Root runs before Project Storage');
    assert.ok(psIdx < plIdx, 'Project Storage runs before Pipeline Limits');
    assert.ok(plIdx < gbIdx, 'Pipeline Limits runs before Gate Behavior');
    assert.ok(gbIdx < uiIdx, 'Gate Behavior runs before UI Install');
  });

  it('returns tool and workspaceDir from promptGettingStarted', () => {
    assert.equal(result.tool, 'copilot');
    assert.equal(result.workspaceDir, '/home/user/workspace');
  });

  it('returns orchRoot from promptOrchRoot', () => {
    assert.equal(result.orchRoot, '.github/orchestration');
  });

  it('returns projectsBasePath and projectsNaming from promptProjectStorage', () => {
    assert.equal(result.projectsBasePath, './projects');
    assert.equal(result.projectsNaming, 'SCREAMING_CASE');
  });

  it('returns all four limit fields from promptPipelineLimits', () => {
    assert.equal(result.maxPhases, 5);
    assert.equal(result.maxTasksPerPhase, 10);
    assert.equal(result.maxRetriesPerTask, 2);
    assert.equal(result.maxConsecutiveReviewRejections, 3);
  });

  it('returns executionMode from promptGateBehavior', () => {
    assert.equal(result.executionMode, 'ask');
  });

  it('returns installUi: false', () => {
    assert.equal(result.installUi, false);
  });

  it('returns skipConfirmation: false when called with { skipConfirmation: false }', () => {
    assert.equal(result.skipConfirmation, false);
  });

  it('returned object has all expected InstallerConfig keys', () => {
    const expectedKeys = [
      'tool', 'workspaceDir', 'orchRoot', 'projectsBasePath', 'projectsNaming',
      'maxPhases', 'maxTasksPerPhase', 'maxRetriesPerTask', 'maxConsecutiveReviewRejections',
      'executionMode', 'installUi', 'skipConfirmation',
    ];
    for (const key of expectedKeys) {
      assert.ok(Object.hasOwn(result, key), `result has '${key}' property`);
    }
  });
});

describe('runWizard({ skipConfirmation: true })', () => {
  let result;

  before(async () => {
    // Reset before secondary run
    callOrder.length = 0;
    sectionHeaderMock.mock.resetCalls();
    promptGettingStartedMock.mock.resetCalls();
    promptOrchRootMock.mock.resetCalls();
    promptProjectStorageMock.mock.resetCalls();
    promptPipelineLimitsMock.mock.resetCalls();
    promptGateBehaviorMock.mock.resetCalls();
    promptUiInstallMock.mock.resetCalls();

    result = await runWizard({ skipConfirmation: true });
  });

  it('returns skipConfirmation: true when called with { skipConfirmation: true }', () => {
    assert.equal(result.skipConfirmation, true);
  });
});

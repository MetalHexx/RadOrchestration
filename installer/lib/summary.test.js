// installer/lib/summary.test.js — Tests for summary.js

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderPostInstallSummary,
  renderPartialSuccessSummary,
} from './summary.js';


// --- helpers ---

/** Captures all console.log output during fn(), returns joined string */
function capture(fn) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = original;
  }
  // Strip ANSI escape sequences for plain-text assertions
  return logs.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
}

// --- fixtures ---

/** @type {import('./types.js').Manifest} */
const manifest = {
  categories: [
    { name: 'Root config', sourceDir: '.', targetDir: '.', fileCount: 1 },
    { name: 'Agents', sourceDir: 'agents', targetDir: '.github/agents', fileCount: 11 },
    { name: 'Skills', sourceDir: 'skills', targetDir: '.github/skills', fileCount: 100 },
  ],
  globalExcludes: [],
};

/** @type {import('./types.js').InstallerConfig} */
const configBase = {
  tool: 'copilot-vscode',
  workspaceDir: '/home/user/my-project',
  orchRoot: '.github',
  projectsBasePath: 'orchestration-projects',
  projectsNaming: 'SCREAMING_CASE',
  maxPhases: 10,
  maxTasksPerPhase: 10,
  maxRetriesPerTask: 2,
  maxConsecutiveReviewRejections: 2,
  executionMode: 'ask',
  installUi: false,
  skipConfirmation: false,
};

/** @type {import('./types.js').InstallerConfig} */
const configWithUi = {
  ...configBase,
  installUi: true,
  uiDir: '/home/user/my-project/.github/ui',
};

/** @type {import('./types.js').CopyResult[]} */
const copyResults = [
  { category: 'Root config', fileCount: 1, success: true },
  { category: 'Agents', fileCount: 11, success: true },
  { category: 'Skills', fileCount: 100, success: true },
];

const configPath = '/home/user/my-project/.github/skills/rad-orchestration/config/orchestration.yml';

// --- renderPostInstallSummary tests ---

describe('renderPostInstallSummary', () => {
  it('contains "Installation Complete" header', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes('Installation Complete'), 'output should contain "Installation Complete"');
  });

  it('contains ✔ and the total file count', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes('✔'), 'output should contain ✔');
    assert.ok(output.includes('112'), 'output should contain total file count (112)');
  });

  it('contains "What\'s Next" header', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes("What's Next"), 'output should contain "What\'s Next"');
  });

  it('contains getting started guide link exactly once', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    const count = (output.match(/https:\/\/github\.com\/MetalHexx\/RadOrchestration\/blob\/main\/docs\/getting-started\.md/g) || []).length;
    assert.strictEqual(count, 1, 'output should contain getting started guide link exactly once');
  });

  it('contains /rad-brainstorm, /rad-plan, /rad-execute in that order', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    const brainstormIdx = output.indexOf('/rad-brainstorm');
    const planIdx = output.indexOf('/rad-plan');
    const executeIdx = output.indexOf('/rad-execute');
    assert.ok(brainstormIdx >= 0, 'output should contain "/rad-brainstorm"');
    assert.ok(planIdx >= 0, 'output should contain "/rad-plan"');
    assert.ok(executeIdx >= 0, 'output should contain "/rad-execute"');
    assert.ok(
      brainstormIdx < planIdx && planIdx < executeIdx,
      '/rad-brainstorm, /rad-plan, /rad-execute should appear in that order'
    );
  });

  it('with installUi: true points users at the /rad-ui-start slash command', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('/rad-ui-start'), 'output should contain "/rad-ui-start"');
  });

  it('does NOT contain radorch.mjs direct invocation', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('radorch.mjs'), 'output should not contain "radorch.mjs"');
  });

  it('does NOT contain %USERPROFILE%, $HOME, or node ~ paths', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('%USERPROFILE%'), 'output should not contain "%USERPROFILE%"');
    assert.ok(!output.includes('$HOME'), 'output should not contain "$HOME"');
    assert.ok(!output.includes('node ~/.'), 'output should not contain "node ~"');
  });

  it('with installUi: false output contains "skipped" text', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes('skipped'), 'output should contain "skipped"');
  });

  it('with installUi: false output does NOT contain "/rad-ui-start"', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('/rad-ui-start'), 'output should not contain "/rad-ui-start"');
  });

  it('with installUi: false output does NOT contain step "3."', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('3.'), 'output should not contain step "3." when installUi is false');
  });

  it('with installUi: true output contains "built and ready"', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('built and ready'), 'output should contain "built and ready"');
  });

  it('with installUi: true output contains step "2."', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('2.'), 'output should contain step "2."');
  });

  it('does not include platform-specific branching', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    // No platform-specific paths should appear; output is generic across all harnesses
    assert.ok(!output.includes('%USERPROFILE%'), 'output should not contain Windows CMD syntax');
    assert.ok(!output.includes('$HOME'), 'output should not contain POSIX shell syntax');
    assert.ok(!output.includes('setx PATH'), 'output should not contain setx instruction');
    assert.ok(!output.includes('\\.radorch\\bin\\'), 'output should not reference retired ~/.radorch/bin/');
    assert.ok(!output.includes('$HOME/.radorch/bin'), 'output should not reference retired ~/.radorch/bin/');
  });
});

// --- renderPartialSuccessSummary tests ---

describe('renderPartialSuccessSummary', () => {
  const errorMsg = 'npm run build exited with code 1';

  it('contains "Partially Complete" header', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('Partially Complete'), 'output should contain "Partially Complete"');
  });

  it('contains ✖ and "build failed"', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('✖'), 'output should contain ✖');
    assert.ok(output.includes('build failed'), 'output should contain "build failed"');
  });

  it('contains the passed error message', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes(errorMsg), 'output should contain the error message');
  });

  it('contains retry command text', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('npm install'), 'output should contain "npm install"');
    assert.ok(output.includes('npm run build'), 'output should contain "npm run build"');
  });

  it('contains "What\'s Next" section header', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes("What's Next"), 'output should contain "What\'s Next"');
  });

  it('contains getting started guide link', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(
      output.includes('https://github.com/MetalHexx/RadOrchestration/blob/main/docs/getting-started.md'),
      'output should contain getting started guide link'
    );
  });

  it('step 2 contains "Retry" text', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('Retry'), 'output should contain "Retry"');
  });
});

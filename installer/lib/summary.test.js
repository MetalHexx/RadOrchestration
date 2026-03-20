// installer/lib/summary.test.js — Tests for summary.js

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderPreInstallSummary,
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
  tool: 'copilot',
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

const configPath = '/home/user/my-project/.github/skills/orchestration/config/orchestration.yml';

// --- renderPreInstallSummary tests ---

describe('renderPreInstallSummary', () => {
  it('contains "Installation Summary" section header text', () => {
    const output = capture(() => renderPreInstallSummary(configBase, manifest));
    assert.ok(output.includes('Installation Summary'), 'output should contain "Installation Summary"');
  });

  it('contains box-drawing characters', () => {
    const output = capture(() => renderPreInstallSummary(configBase, manifest));
    assert.ok(output.includes('┌'), 'output should contain ┌');
    assert.ok(output.includes('─'), 'output should contain ─');
    assert.ok(output.includes('┐'), 'output should contain ┐');
    assert.ok(output.includes('│'), 'output should contain │');
    assert.ok(output.includes('└'), 'output should contain └');
    assert.ok(output.includes('┘'), 'output should contain ┘');
  });

  it('contains "Target:" and "Root:" labels', () => {
    const output = capture(() => renderPreInstallSummary(configBase, manifest));
    assert.ok(output.includes('Target:'), 'output should contain "Target:"');
    assert.ok(output.includes('Root:'), 'output should contain "Root:"');
  });

  it('contains all category names from the manifest', () => {
    const output = capture(() => renderPreInstallSummary(configBase, manifest));
    assert.ok(output.includes('Root config'), 'output should include "Root config"');
    assert.ok(output.includes('Agents'), 'output should include "Agents"');
    assert.ok(output.includes('Skills'), 'output should include "Skills"');
  });

  it('with installUi: true includes "UI" row', () => {
    const output = capture(() => renderPreInstallSummary(configWithUi, manifest));
    assert.ok(output.includes('UI'), 'output should include "UI" row');
    assert.ok(output.includes('+ build') || output.includes('build'), 'output should mention build');
  });

  it('with installUi: false includes "skipped" text', () => {
    const output = capture(() => renderPreInstallSummary(configBase, manifest));
    assert.ok(output.includes('skipped'), 'output should include "skipped" for UI row');
  });
});

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

  it('contains validate command path', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(
      output.includes('validate-orchestration.js'),
      'output should contain validate command path'
    );
  });

  it('contains @orchestrator instruction', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes('@orchestrator'), 'output should contain @orchestrator');
  });

  it('with installUi: true includes "npm start" and "docker compose" commands', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('npm start'), 'output should contain "npm start"');
    assert.ok(output.includes('docker compose'), 'output should contain "docker compose"');
  });

  it('with installUi: false output contains "skipped" text', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(output.includes('skipped'), 'output should contain "skipped"');
  });

  it('with installUi: false output does NOT contain "npm start"', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('npm start'), 'output should not contain "npm start"');
  });

  it('with installUi: false output does NOT contain "docker compose"', () => {
    const output = capture(() => renderPostInstallSummary(configBase, copyResults, configPath));
    assert.ok(!output.includes('docker compose'), 'output should not contain "docker compose"');
  });

  it('with installUi: true output contains "built and ready"', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('built and ready'), 'output should contain "built and ready"');
  });

  it('with installUi: true output contains "docker-compose.yml"', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('docker-compose.yml'), 'output should contain "docker-compose.yml"');
  });

  it('with installUi: true output contains step "3."', () => {
    const output = capture(() => renderPostInstallSummary(configWithUi, copyResults, configPath));
    assert.ok(output.includes('3.'), 'output should contain step "3."');
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

  it('contains "validate-orchestration.js" command', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('validate-orchestration.js'), 'output should contain validate-orchestration.js');
  });

  it('contains "@orchestrator" instruction', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('@orchestrator'), 'output should contain "@orchestrator"');
  });

  it('step 3 contains "Retry" text', () => {
    const output = capture(() =>
      renderPartialSuccessSummary(configWithUi, copyResults, configPath, errorMsg)
    );
    assert.ok(output.includes('Retry'), 'output should contain "Retry"');
  });
});

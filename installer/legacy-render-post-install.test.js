// installer/legacy-render-post-install.test.js — Unit test for renderPostInstall guidance.
//
// Tests the legacy installer path's post-install summary rendering. The summary
// now emits workflow-first content (/rad-brainstorm → /rad-plan → /rad-execute)
// rather than direct CLI invocation paths.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The test is structured to work around the module loading issue:
// we import dynamically only during test execution, not at module load time.

/** Captures console.log output from fn() and strips ANSI codes */
async function captureOutput(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(''));
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
}

describe('renderPostInstall (legacy installer)', () => {
  it('emits /rad-brainstorm, /rad-plan, /rad-execute in that order', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['claude'] }, '/home/user/.radorch/orchestration.yml')
    );

    const brainstormIdx = output.indexOf('/rad-brainstorm');
    const planIdx = output.indexOf('/rad-plan');
    const executeIdx = output.indexOf('/rad-execute');

    assert.ok(brainstormIdx >= 0, 'output must contain "/rad-brainstorm"');
    assert.ok(planIdx >= 0, 'output must contain "/rad-plan"');
    assert.ok(executeIdx >= 0, 'output must contain "/rad-execute"');
    assert.ok(
      brainstormIdx < planIdx && planIdx < executeIdx,
      '/rad-brainstorm, /rad-plan, /rad-execute must appear in that order'
    );
  });

  it('does NOT contain radorch.mjs, %USERPROFILE%, $HOME, setx, or npm install -g', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['copilot-vscode'] }, '/home/user/.radorch/orchestration.yml')
    );

    assert.doesNotMatch(output, /radorch\.mjs/, 'output must NOT contain "radorch.mjs"');
    assert.doesNotMatch(output, /%USERPROFILE%/, 'output must NOT contain "%USERPROFILE%"');
    assert.doesNotMatch(output, /\$HOME/, 'output must NOT contain "$HOME"');
    assert.doesNotMatch(output, /setx/, 'output must NOT contain "setx"');
    assert.doesNotMatch(output, /npm install -g/, 'output must NOT contain "npm install -g"');
  });

  it('does NOT contain the retired ~/.radorch/bin path', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['claude'] }, '/home/user/.radorch/orchestration.yml')
    );

    assert.doesNotMatch(output, /\.radorch[/\\]bin/, 'output must NOT reference retired ~/.radorch/bin path');
  });

  it('emits /rad-ui-start when harnesses includes claude', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['claude'] }, '/home/user/.radorch/orchestration.yml')
    );

    assert.ok(output.includes('/rad-ui-start'), 'output must contain "/rad-ui-start" when claude is a harness');
  });

  it('does NOT emit /rad-ui-start when harnesses does not include claude', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['copilot-vscode'] }, '/home/user/.radorch/orchestration.yml')
    );

    assert.ok(!output.includes('/rad-ui-start'), 'output must NOT contain "/rad-ui-start" when claude is not a harness');
  });

  it('contains the guide URL exactly once', async () => {
    const { renderPostInstall } = await import('./index.js');

    const output = await captureOutput(() =>
      renderPostInstall({ harnesses: ['claude'] }, '/home/user/.radorch/orchestration.yml')
    );

    const count = (output.match(/https:\/\/github\.com\/MetalHexx\/RadOrchestration\/blob\/main\/docs\/getting-started\.md/g) || []).length;
    assert.strictEqual(count, 1, 'output must contain the guide URL exactly once');
  });
});

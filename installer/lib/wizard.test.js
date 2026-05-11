// installer/lib/wizard.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWizard } from './wizard.js';

test('Quick install fast-exits with canonical defaults', async () => {
  const r = await runWizard({
    skipConfirmation: true,
    cliOverrides: { harnesses: ['claude'], mode: 'quick' },
  });
  assert.deepEqual(r.harnesses, ['claude']);
  assert.equal(r.defaultTemplate, 'ask');
  assert.equal(r.maxPhases, 10);
  assert.equal(r.maxTasksPerPhase, 8);
  assert.equal(r.maxRetriesPerTask, 5);
  assert.equal(r.maxConsecutiveReviewRejections, 3);
  assert.equal(r.humanGates.afterPlanning, true);
  assert.equal(r.humanGates.executionMode, 'ask');
  assert.equal(r.humanGates.afterFinalReview, true);
  assert.equal(r.sourceControl.autoCommit, 'ask');
  assert.equal(r.sourceControl.autoPr, 'ask');
});

test('Custom install walks the ten preferences', async () => {
  const r = await runWizard({
    skipConfirmation: true,
    cliOverrides: {
      harnesses: ['claude', 'copilot-vscode'],
      mode: 'custom',
      defaultTemplate: 'high',
      maxPhases: 6,
      maxTasksPerPhase: 5,
      maxRetriesPerTask: 3,
      maxConsecutiveReviewRejections: 2,
      afterPlanning: false,
      executionMode: 'phase',
      afterFinalReview: true,
      autoCommit: 'always',
      autoPr: 'never',
    },
  });
  assert.deepEqual(r.harnesses, ['claude', 'copilot-vscode']);
  assert.equal(r.defaultTemplate, 'high');
  assert.equal(r.sourceControl.autoCommit, 'always');
});

test('No retired wizard fields are read', async () => {
  const r = await runWizard({
    skipConfirmation: true,
    cliOverrides: { harnesses: ['claude'], mode: 'quick' },
  });
  assert.equal(r.orchRoot, undefined);
  assert.equal(r.projectsBasePath, undefined);
  assert.equal(r.projectsNaming, undefined);
  assert.equal(r.provider, undefined);
});

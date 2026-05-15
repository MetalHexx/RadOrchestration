// installer/lib/wizard.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWizard } from './wizard.js';

test('wizard returns canonical defaults under --yes with harness override', async () => {
  const r = await runWizard({
    skipConfirmation: true,
    cliOverrides: { harnesses: ['claude'] },
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

test('No retired wizard fields are read', async () => {
  const r = await runWizard({
    skipConfirmation: true,
    cliOverrides: { harnesses: ['claude'] },
  });
  assert.equal(r.orchRoot, undefined);
  assert.equal(r.projectsBasePath, undefined);
  assert.equal(r.projectsNaming, undefined);
  assert.equal(r.provider, undefined);
});

test('wizard returns canonical defaults unconditionally under --yes (FR-15, FR-16)', async () => {
  const result = await runWizard({ skipConfirmation: true, cliOverrides: { harnesses: ['claude'] } });
  assert.deepEqual(result.harnesses, ['claude']);
  assert.strictEqual(result.defaultTemplate, 'ask');
  assert.strictEqual(result.maxPhases, 10);
  assert.strictEqual(result.maxTasksPerPhase, 8);
  assert.strictEqual(result.maxRetriesPerTask, 5);
  assert.strictEqual(result.maxConsecutiveReviewRejections, 3);
  assert.strictEqual(result.humanGates.afterPlanning, true);
  assert.strictEqual(result.humanGates.executionMode, 'ask');
  assert.strictEqual(result.humanGates.afterFinalReview, true);
  assert.strictEqual(result.sourceControl.autoCommit, 'ask');
  assert.strictEqual(result.sourceControl.autoPr, 'ask');
  assert.strictEqual(result.mode, undefined, 'mode field must be gone (FR-20)');
});

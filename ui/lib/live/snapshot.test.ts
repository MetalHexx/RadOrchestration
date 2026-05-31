import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArtifactSnapshot, reconcileUnseen } from './snapshot';

test('snapshot pulls the file list over REST and derives the established set (FR-12, FR-5, AD-10)', async () => {
  const fakeFetch = async (url: string) => {
    assert.match(url, /\/api\/projects\/DEMO\/files$/);
    return { ok: true, json: async () => ({ files: ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html'], mtimes: {} }) } as Response;
  };
  const snap = await fetchArtifactSnapshot('DEMO', fakeFetch as typeof fetch);
  assert.deepEqual(snap.artifacts.map((a) => a.fileName), ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html']);
  assert.deepEqual(snap.files, ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html']);
});

test('reconcile drops unseen entries whose files no longer exist (FR-14)', () => {
  const unseen = new Set(['GONE.html', 'STILL.md']);
  const reconciled = reconcileUnseen(unseen, ['STILL.md', 'DEMO-BRAINSTORM.html']);
  assert.equal(reconciled.has('GONE.html'), false, 'deleted file removed from unseen on reconcile');
  assert.equal(reconciled.has('STILL.md'), true, 'present file retained');
});

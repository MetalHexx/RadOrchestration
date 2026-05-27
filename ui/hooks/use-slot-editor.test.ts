import { test } from 'node:test';
import assert from 'node:assert';
import { decideSaveOperation, computeDirtyFlag } from './use-slot-editor';

test('computeDirtyFlag is true only when current content diverges from last-saved (FR-17)', () => {
  assert.strictEqual(computeDirtyFlag('', ''), false);
  assert.strictEqual(computeDirtyFlag('a', ''), true);
  assert.strictEqual(computeDirtyFlag('a', 'a'), false);
  assert.strictEqual(computeDirtyFlag('', 'a'), true);
});

test('decideSaveOperation chooses DELETE when content is empty and file exists (FR-20, AD-7)', () => {
  assert.deepStrictEqual(decideSaveOperation({ content: '', exists: true }), { method: 'DELETE' });
});

test('decideSaveOperation chooses PUT when content is non-empty (FR-18)', () => {
  assert.deepStrictEqual(decideSaveOperation({ content: 'body', exists: false }), { method: 'PUT', body: 'body' });
  assert.deepStrictEqual(decideSaveOperation({ content: 'body', exists: true }), { method: 'PUT', body: 'body' });
});

test('decideSaveOperation returns NOOP when content is empty and file does not exist (FR-14)', () => {
  assert.deepStrictEqual(decideSaveOperation({ content: '', exists: false }), { method: 'NOOP' });
});

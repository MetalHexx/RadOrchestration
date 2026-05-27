import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decideSaveOperation, computeDirtyFlag } from './use-slot-editor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const hookSource = readFileSync(join(__dirname, 'use-slot-editor.ts'), 'utf-8');

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

test('useSlotEditor load callback identity is stable across re-renders when key fields are unchanged (NFR-5)', () => {
  // Source-inspection: the load useCallback must depend on primitive fields
  // (key.kind, key.name, key.slot) not on the raw key object reference.
  // When key is in the dependency array, a new object literal passed from the
  // parent on every render will recreate the callback on every render and cause
  // useEffect(() => { void load(); }, [load]) to fire in an infinite loop.
  const loadIdx = hookSource.indexOf('const load = useCallback');
  assert.ok(loadIdx !== -1, 'load useCallback declaration must exist in hook source');
  // Find the closing bracket of the dependency array for the load callback.
  // The dependency array starts after the async function body.
  const depArrayStart = hookSource.indexOf('}, [', loadIdx);
  assert.ok(depArrayStart !== -1, 'load useCallback must have a dependency array');
  const depArrayEnd = hookSource.indexOf('])', depArrayStart);
  assert.ok(depArrayEnd !== -1, 'load useCallback dependency array must be closed');
  const depArray = hookSource.slice(depArrayStart, depArrayEnd + 2);
  // Must reference primitive fields, not the raw key object
  assert.ok(
    depArray.includes('key.kind') && depArray.includes('key.name') && depArray.includes('key.slot'),
    `load useCallback dependency array must reference key.kind, key.name, key.slot (primitives), not the raw key object. Found: ${depArray}`,
  );
  // Must NOT depend on the raw key object reference
  assert.ok(
    !/,\s*key\s*[,\]]/.test(depArray) && !/\[\s*key\s*[,\]]/.test(depArray),
    `load useCallback must not depend on the raw key object reference. Found: ${depArray}`,
  );
});

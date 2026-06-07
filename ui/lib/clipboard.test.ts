import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyTextToClipboard } from './clipboard';

function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}

function deleteGlobal(name: string) {
  // Restore to undefined-like state by reconfiguring the property
  Object.defineProperty(globalThis, name, { value: undefined, writable: true, configurable: true });
}

test('uses navigator.clipboard in a secure context and reports success', async () => {
  let written = '';
  defineGlobal('window', { isSecureContext: true });
  defineGlobal('navigator', { clipboard: { writeText: async (t: string) => { written = t; } } });
  const ok = await copyTextToClipboard('hello');
  assert.equal(ok, true);
  assert.equal(written, 'hello');
  deleteGlobal('window'); deleteGlobal('navigator');
});

test('falls back to execCommand when the async clipboard is unavailable', async () => {
  let copied = false; const removed: unknown[] = [];
  defineGlobal('window', { isSecureContext: false });
  defineGlobal('navigator', {});
  defineGlobal('document', {
    createElement: () => ({ value: '', setAttribute() {}, style: {}, select() {} }),
    body: { appendChild() {}, removeChild(n: unknown) { removed.push(n); } },
    execCommand: () => { copied = true; return true; },
  });
  const ok = await copyTextToClipboard('lan');
  assert.equal(ok, true);
  assert.equal(copied, true);
  assert.equal(removed.length, 1);
  deleteGlobal('window'); deleteGlobal('navigator'); deleteGlobal('document');
});

test('returns false when neither path can copy so the caller can show a failure', async () => {
  defineGlobal('window', { isSecureContext: false });
  defineGlobal('navigator', {});
  deleteGlobal('document');
  const ok = await copyTextToClipboard('x');
  assert.equal(ok, false);
  deleteGlobal('window'); deleteGlobal('navigator');
});

import assert from 'node:assert';
import { test } from 'node:test';
import { DebounceMap } from './debounce-map';

test('rapid successive calls on same key collapse to one invocation', async () => {
  const dm = new DebounceMap(50);
  let count = 0;
  dm.schedule('k', () => { count++; });
  dm.schedule('k', () => { count++; });
  dm.schedule('k', () => { count++; });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(count, 1);
});

test('different keys do not collapse', async () => {
  const dm = new DebounceMap(50);
  let a = 0, b = 0;
  dm.schedule('a', () => { a++; });
  dm.schedule('b', () => { b++; });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(a, 1);
  assert.strictEqual(b, 1);
});

test('clearAll cancels pending timers', async () => {
  const dm = new DebounceMap(50);
  let count = 0;
  dm.schedule('k', () => { count++; });
  dm.clearAll();
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(count, 0);
});

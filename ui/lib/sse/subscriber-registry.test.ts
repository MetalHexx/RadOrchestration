import assert from 'node:assert';
import { test } from 'node:test';
import { SubscriberRegistry } from './subscriber-registry';
import type { Subscriber } from './types';

test('registry add returns an opaque handle and tracks size', () => {
  const reg = new SubscriberRegistry();
  const sub: Subscriber = { enqueue: () => {}, onError: () => {} };
  const h = reg.add(sub);
  assert.ok(h);
  assert.strictEqual(reg.size(), 1);
});

test('registry remove by handle releases the reference', () => {
  const reg = new SubscriberRegistry();
  const h = reg.add({ enqueue: () => {}, onError: () => {} });
  reg.remove(h);
  assert.strictEqual(reg.size(), 0);
});

test('registry forEach iterates only live subscribers', () => {
  const reg = new SubscriberRegistry();
  const seen: string[] = [];
  reg.add({ enqueue: () => seen.push('a'), onError: () => {} });
  const h2 = reg.add({ enqueue: () => seen.push('b'), onError: () => {} });
  reg.remove(h2);
  reg.forEach((s) => s.enqueue());
  assert.deepStrictEqual(seen, ['a']);
});

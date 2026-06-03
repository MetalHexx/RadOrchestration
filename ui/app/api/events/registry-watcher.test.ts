import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { wireRegistryWatcher, REGISTRY_SETTLE_WINDOW_MS } from './registry-watcher.js';

class FakeWatcher extends EventEmitter {
  async close() { /* no-op */ }
}

test('emits registry_change only for the two registry files (FR-14, AD-7)', () => {
  const root = path.join('C:', 'fake', '.radorc');
  const fake = new FakeWatcher();
  let count = 0;
  wireRegistryWatcher({ registryRoot: root, makeWatcher: () => fake, emit: () => { count += 1; } });
  fake.emit('change', path.join(root, 'repo-registry.yml'));
  fake.emit('change', path.join(root, 'repo-registry.local.yml'));
  fake.emit('change', path.join(root, 'unrelated.txt'));
  assert.equal(count, 2);
});

test('exposes an explicitly chosen settle window (AD-7)', () => {
  assert.equal(typeof REGISTRY_SETTLE_WINDOW_MS, 'number');
  assert.ok(REGISTRY_SETTLE_WINDOW_MS > 0);
});

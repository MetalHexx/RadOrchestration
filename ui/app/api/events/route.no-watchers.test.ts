import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'route.ts'), 'utf-8');

test('route constructs no chokidar watcher of its own (FR-6, NFR-1, AD-3)', () => {
  assert.ok(!/chokidar\.watch\(/.test(src), 'route must not call chokidar.watch directly');
  assert.ok(!src.includes("import chokidar"), 'route must not import chokidar');
});

test('route imports no per-connection watcher helper (FR-6, AD-3)', () => {
  assert.ok(!src.includes('wireProjectStateWatcher'), 'state-watcher helper must be gone');
  assert.ok(!src.includes('wireRegistryWatcher'), 'registry-watcher helper must be gone');
  assert.ok(!src.includes('dirWatcher'), 'shallow dir watcher must be gone');
});

test('the per-connection watcher helper modules are deleted (FR-6)', () => {
  assert.ok(!existsSync(join(__dirname, 'state-watcher.ts')), 'state-watcher.ts must be deleted');
  assert.ok(!existsSync(join(__dirname, 'registry-watcher.ts')), 'registry-watcher.ts must be deleted');
});

test('no per-connection debounce machinery remains (FR-6)', () => {
  assert.ok(!src.includes('debounceTimers'), 'route must not keep the per-connection debounce map');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'route.ts'), 'utf-8');

test('route subscribes to the hub state topic and emits state_change from it (FR-5, FR-7, FR-8, DD-1)', () => {
  assert.match(src, /subscribeAllStateTopics/, 'route must subscribe to the hub state topic');
  assert.match(src, /createSSEEvent\(\s*['"]state_change['"]/, 'route still emits state_change');
});

test('route subscribes to the hub registry topic and emits registry_change from it (FR-5, FR-9, DD-2)', () => {
  assert.match(src, /subscribeRegistry/, 'route must subscribe to the hub registry topic');
  assert.match(src, /createSSEEvent\(\s*['"]registry_change['"]/, 'route still emits registry_change');
});

test('route subscribes to the hub lifecycle topic and emits project_added / project_removed from it (FR-5, DD-3)', () => {
  assert.match(src, /subscribeLifecycle/, 'route must subscribe to the hub lifecycle topic');
  assert.match(src, /createSSEEvent\(\s*['"]project_added['"]/, 'route still emits project_added');
  assert.match(src, /createSSEEvent\(\s*['"]project_removed['"]/, 'route still emits project_removed');
});

test('the live runtime is constructed with both projects and registry roots (FR-5, NFR-2)', () => {
  assert.match(src, /getLiveRuntime\(\s*\{[^}]*projectsRoot[^}]*registryRoot/s, 'runtime gets both watch roots');
});

test('the eight SSE event types are still emitted (FR-5)', () => {
  for (const ev of ['connected', 'state_change', 'project_added', 'project_removed', 'heartbeat', 'registry_change', 'artifact_change', 'live_degraded']) {
    assert.match(src, new RegExp(`createSSEEvent\\(\\s*['"]${ev}['"]`), `route must still emit ${ev}`);
  }
});

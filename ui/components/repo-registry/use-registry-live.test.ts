import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { nextLiveAction } from './use-registry-live';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'use-registry-live.ts'), 'utf-8');

test('a nudge while clean refetches immediately (FR-24)', () => {
  assert.deepStrictEqual(
    nextLiveAction({ event: 'nudge', dirty: false, held: false }),
    { refetch: true, held: false });
});

test('a nudge while dirty is held, not applied (FR-25)', () => {
  assert.deepStrictEqual(
    nextLiveAction({ event: 'nudge', dirty: true, held: false }),
    { refetch: false, held: true });
});

test('dirty→clean with a held nudge runs exactly one catch-up refetch (FR-25)', () => {
  assert.deepStrictEqual(
    nextLiveAction({ event: 'clean', dirty: false, held: true }),
    { refetch: true, held: false });
});

test('dirty→clean with no held nudge does nothing (FR-25)', () => {
  assert.deepStrictEqual(
    nextLiveAction({ event: 'clean', dirty: false, held: false }),
    { refetch: false, held: false });
});

test('hook subscribes via useSSE to registry_change and refetches GET /api/registry (AD-7, FR-24)', () => {
  assert.match(src, /useSSE/);
  assert.match(src, /registry_change/);
  assert.match(src, /\/api\/registry/);
});

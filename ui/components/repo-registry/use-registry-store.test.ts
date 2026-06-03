import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hook = readFileSync(join(__dirname, 'use-registry-store.ts'), 'utf-8');
const page = readFileSync(join(__dirname, '..', '..', 'app', 'repo-registry', 'page.tsx'), 'utf-8');

test('hook hydrates from GET /api/registry into one store (AD-1, NFR-4)', () => {
  assert.match(hook, /\/api\/registry/);
  assert.match(hook, /hydrate/);
  assert.match(hook, /useState/);
});

test('hook exposes store + the response-reconcile reducers (AD-2, NFR-4)', () => {
  assert.match(hook, /upsertRepo|upsertGroup|removeRepo|removeGroup/);
});

test('page composes the rail and the empty state, never imports the server validator (FR-2, FR-27, NFR-1)', () => {
  assert.match(page, /RegistryRail|registry-rail/);
  assert.match(page, /EmptyRegistryState|registry-empty-states/);
  assert.doesNotMatch(page, /lib\/registry\/validate/);
});

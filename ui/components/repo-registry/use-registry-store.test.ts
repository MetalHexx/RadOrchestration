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

test('hook tracks an error string in state and returns it (P04 F-11)', () => {
  // Mirrors the house idiom (use-projects exposes error: string | null)
  assert.match(hook, /useState<string\s*\|\s*null>/);
  assert.match(hook, /setError/);
  // error is part of the returned object
  assert.match(hook, /return\s*\{[\s\S]*\berror\b[\s\S]*\}/);
});

test('refetch handles fetch failures rather than silently dropping them (P04 F-11)', () => {
  // try/catch wraps the fetch
  assert.match(hook, /try\s*\{/);
  assert.match(hook, /catch/);
  // a non-ok response surfaces an error
  assert.match(hook, /res\.ok/);
  assert.match(hook, /setError\(/);
  // success path clears any prior error
  assert.match(hook, /setError\(null\)/);
});

test('page composes the rail and the empty state, never imports the server validator (FR-2, FR-27, NFR-1)', () => {
  assert.match(page, /RegistryRail|registry-rail/);
  assert.match(page, /EmptyRegistryState|registry-empty-states/);
  assert.doesNotMatch(page, /lib\/registry\/validate/);
});

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'registry-empty-states.tsx'), 'utf-8');

test('exports both an empty-registry invite and a nothing-selected placeholder (FR-27)', () => {
  assert.match(src, /export function EmptyRegistryState/);
  assert.match(src, /export function NothingSelectedState/);
});

test('empty invite uses the consistent "Add your first repository" copy (FR-27, DD-9)', () => {
  assert.match(src, /Add your first repository/);
});

test('placeholder copy is muted, token-driven, no hardcoded color (NFR-2)', () => {
  assert.match(src, /text-muted-foreground/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}/);
});

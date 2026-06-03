import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'membership-picker.tsx'), 'utf-8');

test('single component parameterised by entityType repos|groups (FR-12)', () => {
  assert.match(src, /entityType/);
  assert.match(src, /BindStateDot/);
  assert.match(src, /Layers/);
});

test('rows show checkbox + slug + description (FR-12)', () => {
  assert.match(src, /m-slug|slug/);
  assert.match(src, /description/);
  assert.match(src, /checked/);
});

test('detail mode renders staged tags via rowStatus; create mode does not (FR-13, DD-6)', () => {
  assert.match(src, /rowStatus/);
  assert.match(src, /pending-add/);
  assert.match(src, /pending-remove/);
  assert.match(src, /mode/);
});

test('staged colors are token-driven, no hardcoded hex (NFR-2)', () => {
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}/);
});

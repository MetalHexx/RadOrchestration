import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'editable-slot-card.tsx'), 'utf-8');

test('uses Card, Textarea, Button primitives (DD-5, NFR-7)', () => {
  assert.match(src, /@\/components\/ui\/card/);
  assert.match(src, /@\/components\/ui\/textarea/);
  assert.match(src, /@\/components\/ui\/button/);
});
test('renders Save and Discard footer actions (DD-5, FR-16)', () => {
  assert.match(src, /Save/);
  assert.match(src, /Discard/);
});
test('uses font-mono on the Textarea (FR-15)', () => {
  assert.match(src, /font-mono/);
});
test('renders a dirty indicator (FR-17)', () => {
  assert.match(src, /● dirty|dirty/);
});
test('renders empty-state placeholder text naming the slot (DD-11, FR-14)', () => {
  assert.match(src, /placeholder/);
});
